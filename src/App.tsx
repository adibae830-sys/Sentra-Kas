import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileSpreadsheet,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { CashflowChart } from './components/CashflowChart';
import { ConfirmActionModal } from './components/ConfirmActionModal';
import { KwitansiModal } from './components/KwitansiModal';
import {
  AngsuranAndTunggakanView,
  PinjamanAndAccView,
} from './components/LoansAndInstallmentsViews';
import {
  DataAnggotaView,
  KasKeluarView,
  KasMasukView,
} from './components/MembersAndLedgerViews';
import { MonthlyReportView } from './components/MonthlyReportView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import {
  computeAdminDashboard,
  computeAnggotaDashboard,
  computeMonthlyCashflowSeries,
  computeRingkasanAnggota,
  formatTanggalId,
  nowIsoShort,
  rupiah,
} from './lib/financeEngine';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logoutGoogle,
} from './lib/firebaseAuth';
import {
  appendRow,
  DEFAULT_SPREADSHEET_ID,
  deleteRow,
  ensureDatabaseStructure,
  extractSpreadsheetId,
  loadAllFinanceData,
  SheetsAuthExpiredError,
  updateRowValues,
} from './lib/sheetsApi';
import {
  Anggota,
  Angsuran,
  AppUser,
  ConfirmationState,
  FinanceDataset,
  Pinjaman,
} from './types/finance';

type PageId =
  | 'dashboard'
  | 'laporan'
  | 'anggota'
  | 'kasMasuk'
  | 'kasKeluar'
  | 'pinjaman'
  | 'angsuran'
  | 'anggotaSaya'
  | 'ajukanPinjaman'
  | 'pengaturan';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

const STORAGE_KEYS = {
  SPREADSHEET_ID: 'sentra_kas_spreadsheet_id',
  APP_SESSION: 'sentra_kas_app_session',
  ACTIVE_PAGE: 'sentra_kas_active_page',
} as const;

interface SavedAppSession {
  username: string;
  nama: string;
  role: AppUser['role'];
  idAnggota: string;
}

function readSavedAppSession(): SavedAppSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APP_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedAppSession>;
    if (!parsed?.username || !parsed?.role) return null;
    return {
      username: parsed.username,
      nama: parsed.nama || parsed.username,
      role: parsed.role,
      idAnggota: parsed.idAnggota || '',
    };
  } catch {
    return null;
  }
}

function readSavedSpreadsheetId(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.SPREADSHEET_ID) || DEFAULT_SPREADSHEET_ID;
  } catch {
    return DEFAULT_SPREADSHEET_ID;
  }
}

function readSavedActivePage(): PageId | null {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.ACTIVE_PAGE) as PageId | null;
    return val || null;
  } catch {
    return null;
  }
}

export default function App() {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(true);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  const [spreadsheetInput, setSpreadsheetInput] = useState<string>(readSavedSpreadsheetId);
  const activeSpreadsheetId = useMemo(
    () => extractSpreadsheetId(spreadsheetInput),
    [spreadsheetInput]
  );

  const [dataset, setDataset] = useState<FinanceDataset | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const [savedSession, setSavedSession] = useState<SavedAppSession | null>(readSavedAppSession);
  const [sessionUser, setSessionUser] = useState<AppUser | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<PageId>(() => readSavedActivePage() || 'dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Konfirmasi',
    onConfirm: () => {},
  });

  const [kwitansiModalData, setKwitansiModalData] = useState<Angsuran | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  // Form states for Ajukan Pinjaman & Pengaturan Akun
  const [ajuJumlah, setAjuJumlah] = useState('');
  const [ajuTenor, setAjuTenor] = useState('');
  const [usernameBaru, setUsernameBaru] = useState('');
  const [passwordLama, setPasswordLama] = useState('');
  const [passwordBaru, setPasswordBaru] = useState('');

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, spreadsheetInput);
    } catch {
      // ignore storage quota errors
    }
  }, [spreadsheetInput]);

  useEffect(() => {
    if (!sessionUser) return;
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PAGE, activePage);
    } catch {
      // ignore storage quota errors
    }
  }, [activePage, sessionUser]);

  const clearSavedAppSession = useCallback(() => {
    setSavedSession(null);
    setSessionUser(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.APP_SESSION);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PAGE);
    } catch {
      // ignore
    }
  }, []);

  const refreshDataset = useCallback(
    async (explicitToken?: string) => {
      const token = explicitToken || getAccessToken();
      if (!token) {
        setNeedsGoogleAuth(true);
        return;
      }
      setIsLoadingSheet(true);
      setSheetError(null);
      try {
        const data = await loadAllFinanceData(activeSpreadsheetId, token);
        setDataset(data);

        // Automatically restore saved Admin/Bendahara/Anggota session once sheet is loaded
        const pendingSaved = readSavedAppSession();
        if (pendingSaved) {
          const matched = data.users.find(
            (u) => u.username === pendingSaved.username && u.status === 'Aktif'
          );
          if (matched) {
            let resolvedIdAnggota = matched.idAnggota;
            if (matched.role === 'Anggota' && !resolvedIdAnggota) {
              const byName = data.anggota.find(
                (a) => a.nama.toLowerCase() === matched.nama.toLowerCase()
              );
              if (byName) resolvedIdAnggota = byName.id;
            }
            const restored: AppUser = { ...matched, idAnggota: resolvedIdAnggota };
            setSessionUser((prev) => prev || restored);

            const savedPage = readSavedActivePage();
            const defaultPage: PageId =
              restored.role === 'Administrator'
                ? 'dashboard'
                : restored.role === 'Bendahara'
                  ? 'kasMasuk'
                  : 'anggotaSaya';
            setActivePage((prev) => savedPage || prev || defaultPage);
          }
        }
      } catch (err) {
        if (err instanceof SheetsAuthExpiredError) {
          clearAccessToken();
          setNeedsGoogleAuth(true);
          setSheetError(err.message);
        } else {
          setSheetError(
            err instanceof Error
              ? err.message
              : 'Gagal memuat data dari Google Spreadsheet.'
          );
        }
      } finally {
        setIsLoadingSheet(false);
      }
    },
    [activeSpreadsheetId]
  );

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setNeedsGoogleAuth(false);
        refreshDataset(token);
      },
      (user) => {
        // Firebase still remembers the signed-in Google account across refresh;
        // only the in-memory Sheets access token needs a quick 1-click refresh.
        setGoogleUser(user);
        setNeedsGoogleAuth(true);
        setDataset(null);
        setSessionUser(null);
      },
      () => {
        setGoogleUser(null);
        setNeedsGoogleAuth(true);
        setDataset(null);
        setSessionUser(null);
      }
    );
    return () => unsubscribe();
  }, [refreshDataset]);

  const handleGoogleLogin = async (forceAccountPicker = false) => {
    setIsGoogleSigningIn(true);
    setSheetError(null);
    try {
      const res = await googleSignIn({
        loginHint: forceAccountPicker ? undefined : googleUser?.email || undefined,
        forceAccountPicker,
      });
      if (res) {
        setGoogleUser(res.user);
        setNeedsGoogleAuth(false);
        await refreshDataset(res.accessToken);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const rawMsg = err instanceof Error ? err.message : '';
      if (code === 'auth/unauthorized-domain' || rawMsg.includes('unauthorized-domain')) {
        const host = window.location.hostname;
        setSheetError(
          `Domain "${host}" belum didaftarkan pada Firebase Authentication -> Settings -> Authorized domains.`
        );
      } else {
        setSheetError(
          rawMsg || 'Gagal masuk dengan akun Google. Periksa izin popup browser.'
        );
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setNeedsGoogleAuth(true);
    setDataset(null);
    clearSavedAppSession();
  };

  const openConfirm = (config: Omit<ConfirmationState, 'isOpen'>) => {
    setConfirmState({ ...config, isOpen: true });
  };

  const closeConfirm = () => {
    if (isMutating) return;
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  const runConfirmedMutation = async (fn: () => Promise<void>, successMessage: string) => {
    const token = getAccessToken();
    if (!token) {
      setNeedsGoogleAuth(true);
      showToast('error', 'Sesi Google berakhir. Silakan sambungkan kembali akun Google.');
      return;
    }

    setIsMutating(true);
    try {
      await fn();
      await refreshDataset(token);
      setConfirmState((prev) => ({ ...prev, isOpen: false }));
      showToast('success', successMessage);
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) {
        clearAccessToken();
        setNeedsGoogleAuth(true);
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      }
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal memperbarui Google Spreadsheet.'
      );
    } finally {
      setIsMutating(false);
    }
  };

  // Setup Database Tabs & Admin Row
  const handleRequestSetupDatabase = () => {
    openConfirm({
      title: 'Setup Struktur Tab Google Sheets?',
      description:
        'Tindakan ini akan memeriksa dan membuat tab yang belum tersedia (Users, Anggota, KasMasuk, KasKeluar, Pinjaman, Angsuran, LaporanBulanan, LogWhatsApp) beserta header kolomnya.',
      details: [
        `Spreadsheet ID: ${activeSpreadsheetId}`,
        'Membuat akun admin default (username: admin) jika belum ada user Administrator.',
      ],
      confirmLabel: 'Setup Struktur Sheet',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          await ensureDatabaseStructure(activeSpreadsheetId, token, {
            includeReportingTabs: true,
          });
        }, 'Struktur database Google Sheets berhasil disiapkan.'),
    });
  };

  // Login to app role using Users sheet
  const handleAppLogin = (usernameInput: string, passwordInput: string) => {
    if (!dataset) return;
    setLoginError(null);

    const uTrim = usernameInput.trim();
    const pTrim = passwordInput.trim();

    const matched = dataset.users.find(
      (u) => u.username === uTrim && u.password === pTrim && u.status === 'Aktif'
    );

    if (!matched) {
      setLoginError(
        'Login gagal. Periksa username, password, dan pastikan status akun Aktif di sheet Users.'
      );
      return;
    }

    let resolvedIdAnggota = matched.idAnggota;
    if (matched.role === 'Anggota' && !resolvedIdAnggota) {
      const byName = dataset.anggota.find(
        (a) => a.nama.toLowerCase() === matched.nama.toLowerCase()
      );
      if (byName) resolvedIdAnggota = byName.id;
    }

    const activeUser: AppUser = { ...matched, idAnggota: resolvedIdAnggota };
    setSessionUser(activeUser);
    const toSave: SavedAppSession = {
      username: activeUser.username,
      nama: activeUser.nama,
      role: activeUser.role,
      idAnggota: activeUser.idAnggota,
    };
    setSavedSession(toSave);
    try {
      localStorage.setItem(STORAGE_KEYS.APP_SESSION, JSON.stringify(toSave));
    } catch {
      // ignore
    }
    setUsernameBaru(activeUser.username);

    if (activeUser.role === 'Administrator') {
      setActivePage('dashboard');
    } else if (activeUser.role === 'Bendahara') {
      setActivePage('kasMasuk');
    } else {
      setActivePage('anggotaSaya');
    }
  };

  // Daftar Anggota Mandiri
  const handleRegisterMember = (payload: {
    nama: string;
    alamat: string;
    nohp: string;
    username: string;
    password: string;
  }) => {
    if (!dataset) return;
    setLoginError(null);

    const exists = dataset.users.some((u) => u.username === payload.username.trim());
    if (exists) {
      setLoginError('Username sudah digunakan. Silakan pilih username lain.');
      return;
    }

    const newId = 'AGT-' + Date.now();
    openConfirm({
      title: 'Daftarkan Anggota Baru ke Spreadsheet?',
      description:
        'Data anggota dan akun login baru akan ditambahkan ke sheet Anggota dan sheet Users.',
      details: [
        `ID Anggota: ${newId}`,
        `Nama: ${payload.nama}`,
        `No HP / WA: ${payload.nohp}`,
        `Username: ${payload.username}`,
      ],
      confirmLabel: 'Ya, Daftarkan',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          const now = nowIsoShort();
          await appendRow(activeSpreadsheetId, token, 'Anggota', [
            newId,
            payload.nama.trim(),
            payload.alamat.trim(),
            payload.nohp.trim(),
            now,
            'Aktif',
          ]);
          await appendRow(activeSpreadsheetId, token, 'Users', [
            payload.username.trim(),
            payload.password.trim(),
            payload.nama.trim(),
            'Anggota',
            'Aktif',
            newId,
          ]);
        }, `Pendaftaran berhasil (ID: ${newId}). Silakan login menggunakan akun Anda.`),
    });
  };

  // Anggota CRUD
  const handleSaveAnggota = (payload: { nama: string; alamat: string; nohp: string }) => {
    const newId = 'AGT-' + Date.now();
    openConfirm({
      title: 'Simpan Anggota Baru?',
      description: 'Menambahkan baris baru ke tab Anggota di Google Sheets.',
      details: [
        `ID: ${newId}`,
        `Nama: ${payload.nama}`,
        `No HP: ${payload.nohp}`,
      ],
      confirmLabel: 'Simpan Anggota',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          await appendRow(activeSpreadsheetId, token, 'Anggota', [
            newId,
            payload.nama.trim(),
            payload.alamat.trim(),
            payload.nohp.trim(),
            nowIsoShort(),
            'Aktif',
          ]);
        }, `Anggota ${payload.nama} berhasil ditambahkan (${newId}).`),
    });
  };

  const handleUpdateAnggota = (updated: Anggota) => {
    openConfirm({
      title: 'Perbarui Data Anggota?',
      description: `Mengubah baris ${updated.rowIndex} pada tab Anggota di Google Sheets.`,
      details: [
        `ID: ${updated.id}`,
        `Nama: ${updated.nama}`,
        `No HP: ${updated.nohp}`,
        `Status: ${updated.status}`,
      ],
      confirmLabel: 'Simpan Perubahan',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          await updateRowValues(activeSpreadsheetId, token, 'Anggota', updated.rowIndex, [
            updated.id,
            updated.nama,
            updated.alamat,
            updated.nohp,
            updated.tanggal,
            updated.status,
          ]);
        }, `Data anggota ${updated.nama} berhasil diperbarui.`),
    });
  };

  const handleDeleteAnggota = (target: Anggota) => {
    if (!dataset) return;
    const sheetId = dataset.sheetIds['Anggota'];
    openConfirm({
      title: 'Hapus Anggota dari Spreadsheet?',
      description:
        'Baris anggota ini akan dihapus permanen dari tab Anggota pada Google Spreadsheet Anda.',
      details: [`ID: ${target.id}`, `Nama: ${target.nama}`, `No HP: ${target.nohp}`],
      confirmLabel: 'Ya, Hapus Anggota',
      variant: 'danger',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          await deleteRow(activeSpreadsheetId, token, sheetId, target.rowIndex);
        }, `Anggota ${target.nama} berhasil dihapus.`),
    });
  };

  // Kas Masuk & Kas Keluar
  const handleSaveKasMasuk = (payload: {
    idAnggota: string;
    jenis: string;
    jumlah: number;
    keterangan: string;
  }) => {
    const newId = 'KM-' + Date.now();
    openConfirm({
      title: 'Catat Kas Masuk ke Spreadsheet?',
      description: 'Menambahkan transaksi pemasukan baru ke tab KasMasuk.',
      details: [
        `ID: ${newId}`,
        `Jenis: ${payload.jenis}`,
        `Jumlah: ${rupiah(payload.jumlah)}`,
        `Anggota: ${payload.idAnggota || 'Umum'}`,
      ],
      confirmLabel: 'Simpan Kas Masuk',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          await appendRow(activeSpreadsheetId, token, 'KasMasuk', [
            newId,
            nowIsoShort(),
            payload.idAnggota,
            payload.jenis,
            payload.jumlah,
            payload.keterangan,
            sessionUser?.nama || 'Admin',
          ]);
        }, `Kas masuk ${rupiah(payload.jumlah)} berhasil disimpan.`),
    });
  };

  const handleSaveKasKeluar = (payload: {
    jenis: string;
    jumlah: number;
    keterangan: string;
  }) => {
    const newId = 'KK-' + Date.now();
    openConfirm({
      title: 'Catat Pengeluaran (Kas Keluar)?',
      description: 'Menambahkan transaksi pengeluaran baru ke tab KasKeluar.',
      details: [
        `ID: ${newId}`,
        `Kategori: ${payload.jenis}`,
        `Jumlah: ${rupiah(payload.jumlah)}`,
        `Keterangan: ${payload.keterangan || '-'}`,
      ],
      confirmLabel: 'Simpan Kas Keluar',
      variant: 'danger',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          await appendRow(activeSpreadsheetId, token, 'KasKeluar', [
            newId,
            nowIsoShort(),
            payload.jenis,
            payload.jumlah,
            payload.keterangan,
            sessionUser?.nama || 'Admin',
          ]);
        }, `Pengeluaran ${rupiah(payload.jumlah)} berhasil dicatat.`),
    });
  };

  // Pinjaman & ACC
  const handleSavePinjaman = (payload: {
    idAnggota: string;
    jumlah: number;
    tenor: number;
  }) => {
    const idPinjaman = 'PJM-' + Date.now();
    const angsuran = Math.round(payload.jumlah / payload.tenor);

    openConfirm({
      title: 'Simpan & Cairkan Pinjaman Baru?',
      description:
        'Mencatat pinjaman berstatus Berjalan pada tab Pinjaman serta mencatat pencairan dana pada tab KasKeluar.',
      details: [
        `ID Pinjaman: ${idPinjaman}`,
        `Anggota: ${payload.idAnggota}`,
        `Pokok: ${rupiah(payload.jumlah)} (${payload.tenor} bulan)`,
        `Angsuran/Bulan: ${rupiah(angsuran)}`,
      ],
      confirmLabel: 'Simpan & Cairkan',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          const now = nowIsoShort();
          await appendRow(activeSpreadsheetId, token, 'Pinjaman', [
            idPinjaman,
            now,
            payload.idAnggota,
            payload.jumlah,
            payload.tenor,
            angsuran,
            0,
            payload.jumlah,
            'Berjalan',
          ]);
          await appendRow(activeSpreadsheetId, token, 'KasKeluar', [
            'KK-' + Date.now(),
            now,
            'Pencairan Pinjaman',
            payload.jumlah,
            `Pinjaman anggota ${payload.idAnggota} (${idPinjaman})`,
            sessionUser?.nama || 'Admin',
          ]);
        }, `Pinjaman ${idPinjaman} berhasil disimpan dan dicairkan.`),
    });
  };

  const handleAccPinjaman = (pinjaman: Pinjaman) => {
    openConfirm({
      title: 'Setujui (ACC) Pengajuan Pinjaman?',
      description:
        'Mengubah status pinjaman menjadi Berjalan dan mencatat pencairan pinjaman di tab KasKeluar.',
      details: [
        `ID Pinjaman: ${pinjaman.idPinjaman}`,
        `ID Anggota: ${pinjaman.idAnggota}`,
        `Jumlah Cair: ${rupiah(pinjaman.jumlah)}`,
      ],
      confirmLabel: 'Ya, ACC Pinjaman',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          await updateRowValues(activeSpreadsheetId, token, 'Pinjaman', pinjaman.rowIndex, [
            pinjaman.idPinjaman,
            pinjaman.tanggal,
            pinjaman.idAnggota,
            pinjaman.jumlah,
            pinjaman.tenor,
            pinjaman.angsuranPerBulan,
            pinjaman.totalDibayar,
            pinjaman.sisa,
            'Berjalan',
          ]);
          await appendRow(activeSpreadsheetId, token, 'KasKeluar', [
            'KK-' + Date.now(),
            nowIsoShort(),
            'Pencairan Pinjaman',
            pinjaman.jumlah,
            `ACC pinjaman anggota ${pinjaman.idAnggota} / ${pinjaman.idPinjaman}`,
            sessionUser?.nama || 'Administrator',
          ]);
        }, `Pinjaman ${pinjaman.idPinjaman} berhasil disetujui.`),
    });
  };

  const handleTolakPinjaman = (pinjaman: Pinjaman) => {
    openConfirm({
      title: 'Tolak Pengajuan Pinjaman?',
      description: 'Status pengajuan pinjaman ini akan diubah menjadi Ditolak di tab Pinjaman.',
      details: [
        `ID Pinjaman: ${pinjaman.idPinjaman}`,
        `Jumlah Diajukan: ${rupiah(pinjaman.jumlah)}`,
      ],
      confirmLabel: 'Ya, Tolak Pengajuan',
      variant: 'danger',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          await updateRowValues(activeSpreadsheetId, token, 'Pinjaman', pinjaman.rowIndex, [
            pinjaman.idPinjaman,
            pinjaman.tanggal,
            pinjaman.idAnggota,
            pinjaman.jumlah,
            pinjaman.tenor,
            pinjaman.angsuranPerBulan,
            pinjaman.totalDibayar,
            pinjaman.sisa,
            'Ditolak',
          ]);
        }, `Pengajuan ${pinjaman.idPinjaman} telah ditolak.`),
    });
  };

  // Angsuran
  const handleSaveAngsuran = (payload: {
    pinjaman: Pinjaman;
    angsuranKe: number;
    jumlah: number;
  }) => {
    const { pinjaman, angsuranKe, jumlah } = payload;
    const totalBaru = pinjaman.totalDibayar + jumlah;
    const sisaBaru = Math.max(pinjaman.sisa - jumlah, 0);
    const statusBaru = sisaBaru <= 0 ? 'Lunas' : 'Berjalan';
    const idAngsuran = 'ANG-' + Date.now();
    const now = nowIsoShort();

    openConfirm({
      title: 'Simpan Pembayaran Angsuran?',
      description:
        'Memperbarui sisa pinjaman pada tab Pinjaman serta menambahkan baris pada tab Angsuran dan tab KasMasuk.',
      details: [
        `ID Pinjaman: ${pinjaman.idPinjaman}`,
        `Jumlah Bayar: ${rupiah(jumlah)} (Angsuran ke-${angsuranKe})`,
        `Sisa Setelah Bayar: ${rupiah(sisaBaru)} (${statusBaru})`,
      ],
      confirmLabel: 'Simpan Angsuran',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          await updateRowValues(activeSpreadsheetId, token, 'Pinjaman', pinjaman.rowIndex, [
            pinjaman.idPinjaman,
            pinjaman.tanggal,
            pinjaman.idAnggota,
            pinjaman.jumlah,
            pinjaman.tenor,
            pinjaman.angsuranPerBulan,
            totalBaru,
            sisaBaru,
            statusBaru,
          ]);
          await appendRow(activeSpreadsheetId, token, 'Angsuran', [
            idAngsuran,
            now,
            pinjaman.idPinjaman,
            pinjaman.idAnggota,
            angsuranKe,
            jumlah,
            sisaBaru,
            sessionUser?.nama || 'Admin',
          ]);
          await appendRow(activeSpreadsheetId, token, 'KasMasuk', [
            'KM-' + Date.now(),
            now,
            pinjaman.idAnggota,
            'Angsuran',
            jumlah,
            `Pembayaran pinjaman ${pinjaman.idPinjaman}`,
            sessionUser?.nama || 'Admin',
          ]);

          setKwitansiModalData({
            idAngsuran,
            tanggal: now,
            idPinjaman: pinjaman.idPinjaman,
            idAnggota: pinjaman.idAnggota,
            angsuranKe,
            jumlah,
            sisa: sisaBaru,
            user: sessionUser?.nama || 'Admin',
            rowIndex: 0,
          });
        }, 'Angsuran berhasil disimpan dan kwitansi siap dicetak.'),
    });
  };

  // Pengajuan Pinjaman oleh Anggota
  const handleAjukanPinjamanAnggota = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser?.idAnggota) {
      showToast('error', 'ID Anggota tidak terhubung ke akun Anda.');
      return;
    }
    const jml = Number(ajuJumlah);
    const tnr = Number(ajuTenor);
    if (jml <= 0 || tnr <= 0) return;

    const idPinjaman = 'PJM-' + Date.now();
    const angsuran = Math.round(jml / tnr);

    openConfirm({
      title: 'Kirim Pengajuan Pinjaman?',
      description:
        'Pengajuan akan dicatat ke sheet Pinjaman dengan status Menunggu persetujuan Administrator.',
      details: [
        `ID Pengajuan: ${idPinjaman}`,
        `Jumlah: ${rupiah(jml)} · Tenor: ${tnr} bulan`,
        `Estimasi Angsuran: ${rupiah(angsuran)} / bulan`,
      ],
      confirmLabel: 'Kirim Pengajuan',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          await appendRow(activeSpreadsheetId, token, 'Pinjaman', [
            idPinjaman,
            nowIsoShort(),
            sessionUser.idAnggota,
            jml,
            tnr,
            angsuran,
            0,
            jml,
            'Menunggu',
          ]);
          setAjuJumlah('');
          setAjuTenor('');
        }, 'Pengajuan pinjaman berhasil dikirim dan menunggu ACC Administrator.'),
    });
  };

  // Arsip Laporan Bulanan ke Sheet
  const handleArchiveMonthlyReport = (reportData: {
    periode: string;
    totalMasuk: number;
    totalKeluar: number;
    surplusDefisit: number;
    saldoAkhir: number;
    totalPiutang: number;
    jumlahAnggota: number;
    statusKirimWa: string;
  }) => {
    const idLap = 'LAP-' + reportData.periode + '-' + Date.now().toString().slice(-4);
    openConfirm({
      title: `Arsipkan Laporan Periode ${reportData.periode}?`,
      description:
        'Menyimpan ringkasan laporan bulanan ke tab LaporanBulanan di Google Spreadsheet Anda (membuat tab otomatis jika belum tersedia).',
      details: [
        `Kas Masuk: ${rupiah(reportData.totalMasuk)}`,
        `Pengeluaran: ${rupiah(reportData.totalKeluar)}`,
        `Saldo Akhir: ${rupiah(reportData.saldoAkhir)}`,
      ],
      confirmLabel: 'Arsipkan Laporan',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          await ensureDatabaseStructure(activeSpreadsheetId, token, {
            includeReportingTabs: true,
          });
          await appendRow(activeSpreadsheetId, token, 'LaporanBulanan', [
            idLap,
            reportData.periode,
            reportData.totalMasuk,
            reportData.totalKeluar,
            reportData.surplusDefisit,
            reportData.saldoAkhir,
            reportData.totalPiutang,
            reportData.jumlahAnggota,
            nowIsoShort(),
            reportData.statusKirimWa,
          ]);
        }, `Laporan periode ${reportData.periode} berhasil diarsipkan ke Google Sheets.`),
    });
  };

  const handleLogWhatsAppDispatch = async (
    entries: Array<{
      periode: string;
      idAnggota: string;
      nama: string;
      nohp: string;
      tipe: string;
      status: string;
      ringkasan: string;
    }>
  ) => {
    const token = getAccessToken();
    if (!token) return;
    await ensureDatabaseStructure(activeSpreadsheetId, token, {
      includeReportingTabs: true,
    });
    for (const item of entries) {
      await appendRow(activeSpreadsheetId, token, 'LogWhatsApp', [
        'WA-' + Date.now() + '-' + Math.floor(Math.random() * 100),
        nowIsoShort(),
        item.periode,
        item.idAnggota,
        item.nama,
        item.nohp,
        item.tipe,
        item.status,
        item.ringkasan,
      ]);
    }
    await refreshDataset(token);
  };

  // Ubah Username & Password
  const handleUpdateAkun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataset || !sessionUser) return;

    if (passwordLama !== sessionUser.password) {
      showToast('error', 'Password lama tidak sesuai.');
      return;
    }

    const dup = dataset.users.some(
      (u) => u.username === usernameBaru.trim() && u.username !== sessionUser.username
    );
    if (dup) {
      showToast('error', 'Username baru sudah digunakan oleh akun lain.');
      return;
    }

    openConfirm({
      title: 'Perbarui Username & Password?',
      description: 'Mengubah kredensial akun Anda pada tab Users di Google Sheets.',
      details: [`Username Baru: ${usernameBaru.trim()}`],
      confirmLabel: 'Simpan Perubahan',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getAccessToken()!;
          await updateRowValues(activeSpreadsheetId, token, 'Users', sessionUser.rowIndex, [
            usernameBaru.trim(),
            passwordBaru.trim(),
            sessionUser.nama,
            sessionUser.role,
            sessionUser.status,
            sessionUser.idAnggota,
          ]);
          setPasswordLama('');
          setPasswordBaru('');
          setSessionUser(null);
        }, 'Kredensial akun berhasil diperbarui. Silakan login kembali.'),
    });
  };

  // Computed data for dashboards
  const adminMetrics = useMemo(
    () => (dataset ? computeAdminDashboard(dataset) : null),
    [dataset]
  );

  const memberSummaries = useMemo(
    () => (dataset ? computeRingkasanAnggota(dataset) : []),
    [dataset]
  );

  const filteredMemberSummaries = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return memberSummaries;
    return memberSummaries.filter(
      (m) =>
        m.nama.toLowerCase().includes(q) || m.idAnggota.toLowerCase().includes(q)
    );
  }, [memberSummaries, memberSearch]);

  const cashflowSeries = useMemo(
    () => (dataset ? computeMonthlyCashflowSeries(dataset, 6) : []),
    [dataset]
  );

  const anggotaMetrics = useMemo(() => {
    if (!dataset || !sessionUser?.idAnggota) return null;
    return computeAnggotaDashboard(dataset, sessionUser.idAnggota);
  }, [dataset, sessionUser]);

  const memberNameLookup = useMemo(() => {
    const map = new Map<string, string>();
    dataset?.anggota.forEach((a) => map.set(a.id, a.nama));
    return map;
  }, [dataset]);

  // Menu items based on role
  const navItems = useMemo(() => {
    if (!sessionUser) return [];
    const role = sessionUser.role;
    const all: Array<{ id: PageId; label: string; icon: React.ReactNode; roles: string[] }> = [
      {
        id: 'dashboard',
        label: 'Ringkasan Keuangan',
        icon: <LayoutDashboard className="h-4 w-4" />,
        roles: ['Administrator'],
      },
      {
        id: 'anggotaSaya',
        label: 'Saldo & Simpanan Saya',
        icon: <Wallet className="h-4 w-4" />,
        roles: ['Anggota'],
      },
      {
        id: 'laporan',
        label: 'Laporan Bulanan & WA',
        icon: <BarChart3 className="h-4 w-4" />,
        roles: ['Administrator', 'Bendahara', 'Anggota'],
      },
      {
        id: 'anggota',
        label: 'Data Anggota',
        icon: <Users className="h-4 w-4" />,
        roles: ['Administrator'],
      },
      {
        id: 'kasMasuk',
        label: 'Kas Masuk',
        icon: <ArrowDownLeft className="h-4 w-4" />,
        roles: ['Administrator', 'Bendahara'],
      },
      {
        id: 'kasKeluar',
        label: 'Kas Keluar',
        icon: <ArrowUpRight className="h-4 w-4" />,
        roles: ['Administrator', 'Bendahara'],
      },
      {
        id: 'pinjaman',
        label: 'Pinjaman & ACC',
        icon: <CreditCard className="h-4 w-4" />,
        roles: ['Administrator', 'Bendahara'],
      },
      {
        id: 'angsuran',
        label: 'Angsuran & Tunggakan',
        icon: <FileSpreadsheet className="h-4 w-4" />,
        roles: ['Administrator', 'Bendahara'],
      },
      {
        id: 'ajukanPinjaman',
        label: 'Ajukan Pinjaman',
        icon: <CreditCard className="h-4 w-4" />,
        roles: ['Anggota'],
      },
      {
        id: 'pengaturan',
        label: 'Pengaturan & Akun',
        icon: <Settings className="h-4 w-4" />,
        roles: ['Administrator', 'Bendahara', 'Anggota'],
      },
    ];
    return all.filter((item) => item.roles.includes(role));
  }, [sessionUser]);

  const currentNavLabel =
    navItems.find((i) => i.id === activePage)?.label || 'Sistem Keuangan';

  // Render AuthGate when not authenticated in both Google & App role
  if (needsGoogleAuth || !dataset || !sessionUser) {
    return (
      <>
        <AuthGate
          googleUser={googleUser}
          needsGoogleAuth={needsGoogleAuth}
          isGoogleSigningIn={isGoogleSigningIn}
          spreadsheetInput={spreadsheetInput}
          onSpreadsheetInputChange={setSpreadsheetInput}
          onGoogleLogin={handleGoogleLogin}
          onGoogleLogout={handleGoogleLogout}
          savedSession={savedSession}
          onClearSavedSession={clearSavedAppSession}
          dataset={dataset}
          isLoadingSheet={isLoadingSheet}
          sheetError={sheetError}
          onReloadSheet={() => refreshDataset()}
          onRequestSetupDatabase={handleRequestSetupDatabase}
          onAppLogin={handleAppLogin}
          onRegisterMember={handleRegisterMember}
          loginError={loginError}
        />

        <ConfirmActionModal
          state={confirmState}
          isSubmitting={isMutating}
          onClose={closeConfirm}
        />

        <OfflineIndicator />

        {toast && (
          <div className="fixed right-5 bottom-5 z-50 flex max-w-sm items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-lg">
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-700" />
            )}
            <p
              className={`font-medium ${
                toast.type === 'success' ? 'text-stone-900' : 'text-red-700'
              }`}
            >
              {toast.message}
            </p>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F6F7F5] text-stone-900">
      {/* Sidebar Desktop */}
      <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-[#08201A] bg-[#0B2821] text-stone-100 lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E5C178]/35 bg-white/8 text-[#E5C178]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4.5 w-4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v8m-3-5h6"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-editorial truncate text-lg font-semibold tracking-tight text-white">
                Sentra Kas
              </p>
              <p className="truncate text-[11px] text-emerald-100/65">
                {dataset.spreadsheetTitle}
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-[11px] font-medium tracking-wider text-emerald-200/60 uppercase">
            Akun Aktif
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white">
            {sessionUser.nama}
          </p>
          <p className="mt-0.5 text-xs font-medium text-[#E5C178]">{sessionUser.role}</p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActivePage(item.id)}
                className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                  isActive
                    ? 'border border-white/12 bg-white/12 text-white shadow-xs'
                    : 'border border-transparent text-emerald-100/75 hover:bg-white/7 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-[#E5C178]' : 'text-emerald-200/70'}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-white/10 p-3">
          <a
            href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-stone-100 transition-colors hover:bg-white/10"
          >
            <ExternalLink className="h-3.5 w-3.5 text-[#E5C178]" />
            Buka Spreadsheet
          </a>
          <button
            type="button"
            onClick={clearSavedAppSession}
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/15 bg-transparent px-3 py-2 text-xs font-semibold text-emerald-100/85 transition-colors hover:bg-white/8 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar Akun
          </button>
          <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-emerald-100/50">
            <Lock className="h-3 w-3" />
            Sinkronisasi Google Sheets
          </p>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex w-72 max-w-[85vw] flex-col bg-[#0B2821] text-stone-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <span className="font-editorial text-lg font-semibold text-white">
                  Sentra Kas
                </span>
                <p className="truncate text-[11px] text-emerald-100/65">
                  {sessionUser.nama} · {sessionUser.role}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-emerald-100/75 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {navItems.map((item) => {
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActivePage(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? 'border border-white/12 bg-white/12 text-white'
                        : 'border border-transparent text-emerald-100/75 hover:bg-white/7 hover:text-white'
                    }`}
                  >
                    <span className={isActive ? 'text-[#E5C178]' : 'text-emerald-200/70'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="space-y-2 border-t border-white/10 p-3">
              <a
                href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-stone-100"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#E5C178]" />
                Buka Spreadsheet
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  clearSavedAppSession();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-emerald-100/85 hover:bg-white/8"
              >
                <LogOut className="h-3.5 w-3.5" />
                Keluar Akun
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-stone-200/90 bg-white/95 px-5 py-3.5 backdrop-blur-md lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-stone-200 p-2 text-stone-600 hover:bg-stone-50 lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 truncate">
              <span className="hidden text-xs font-medium tracking-wide text-stone-400 uppercase sm:inline">
                Sentra Kas
              </span>
              <span className="hidden text-stone-300 sm:inline">/</span>
              <h1 className="font-editorial truncate text-lg font-semibold tracking-tight text-stone-900">
                {currentNavLabel}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => refreshDataset()}
              disabled={isLoadingSheet}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-stone-600 ${isLoadingSheet ? 'animate-spin' : ''}`}
              />
              Sinkronkan Sheet
            </button>
          </div>
        </header>

        {/* Viewport */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-5 lg:p-7">
          {activePage === 'dashboard' && adminMetrics && (
            <div className="space-y-6">
              {/* Focal Treasury + Supporting KPIs */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="flex flex-col justify-between rounded-2xl bg-[#0B2821] p-6 text-white shadow-sm lg:col-span-5">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-[#E5C178] uppercase">
                      Perbendaharaan Kelompok
                    </p>
                    <p className="mt-1.5 text-xs text-emerald-100/75">
                      Saldo Kas Bersih Tercatat
                    </p>
                    <p className="mt-2 font-mono text-3xl font-bold tracking-tight tabular-nums text-white sm:text-4xl">
                      {rupiah(adminMetrics.saldo)}
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/12 pt-4">
                    <div>
                      <p className="text-[11px] font-medium text-emerald-200/70">
                        Total Kas Masuk
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-emerald-200 sm:text-base">
                        {rupiah(adminMetrics.masuk)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-emerald-200/70">
                        Total Kas Keluar
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-amber-200 sm:text-base">
                        {rupiah(adminMetrics.keluar)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-7">
                  <div className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-5">
                    <div>
                      <p className="text-xs font-medium text-stone-500">Anggota Aktif</p>
                      <p className="mt-2.5 font-mono text-2xl font-bold tabular-nums text-stone-900">
                        {adminMetrics.anggotaAktif}
                      </p>
                    </div>
                    <p className="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-500">
                      Dari total {adminMetrics.anggotaTotal} anggota terdaftar
                    </p>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-5">
                    <div>
                      <p className="text-xs font-medium text-stone-500">
                        Total Piutang Pinjaman
                      </p>
                      <p className="mt-2.5 font-mono text-2xl font-bold tabular-nums text-amber-700">
                        {rupiah(adminMetrics.piutang)}
                      </p>
                    </div>
                    <p className="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-500">
                      {adminMetrics.pinjamanStatusCounts.Berjalan} pinjaman berstatus berjalan
                    </p>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-5">
                    <div>
                      <p className="text-xs font-medium text-stone-500">
                        Menunggu Persetujuan
                      </p>
                      <p className="mt-2.5 font-mono text-2xl font-bold tabular-nums text-stone-900">
                        {adminMetrics.pinjamanStatusCounts.Menunggu}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActivePage('pinjaman')}
                      className="mt-4 border-t border-stone-100 pt-3 text-left text-xs font-semibold text-emerald-800 hover:underline"
                    >
                      Tinjau antrean ACC →
                    </button>
                  </div>
                </div>
              </div>

              {/* Chart & Status Pinjaman */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <CashflowChart series={cashflowSeries} />
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-6 lg:col-span-4">
                  <div>
                    <h3 className="font-editorial text-lg font-semibold text-stone-900">
                      Status Pinjaman & Laporan
                    </h3>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Ringkasan pengajuan serta aksi rekap akhir bulan.
                    </p>

                    <dl className="mt-5 divide-y divide-stone-100 text-sm">
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-stone-600">Menunggu ACC</dt>
                        <dd className="font-mono font-semibold tabular-nums text-amber-700">
                          {adminMetrics.pinjamanStatusCounts.Menunggu}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-stone-600">Pinjaman Berjalan</dt>
                        <dd className="font-mono font-semibold tabular-nums text-stone-900">
                          {adminMetrics.pinjamanStatusCounts.Berjalan}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-stone-600">Lunas</dt>
                        <dd className="font-mono font-semibold tabular-nums text-emerald-800">
                          {adminMetrics.pinjamanStatusCounts.Lunas}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-stone-600">Ditolak</dt>
                        <dd className="font-mono font-semibold tabular-nums text-stone-500">
                          {adminMetrics.pinjamanStatusCounts.Ditolak}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActivePage('laporan')}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B2821] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#12382E]"
                  >
                    <BarChart3 className="h-4 w-4 text-[#E5C178]" />
                    Buka Laporan Bulanan & WA
                  </button>
                </div>
              </div>

              {/* Ringkasan Anggota Table */}
              <div className="rounded-2xl border border-stone-200/90 bg-white p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-editorial text-lg font-semibold text-stone-900">
                      Ringkasan Keuangan Per Anggota
                    </h3>
                    <p className="text-xs text-stone-500">
                      Akumulasi simpanan, sisa pinjaman, dan saldo bersih setiap anggota.
                    </p>
                  </div>
                  <div className="relative w-full max-w-xs">
                    <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-stone-400" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Cari nama atau ID anggota..."
                      className="w-full rounded-xl border border-stone-300 bg-white py-2 pr-3 pl-9 text-sm text-stone-900 placeholder:text-stone-400"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500">
                        <th className="py-2.5 pr-3">ID Anggota</th>
                        <th className="py-2.5 pr-3">Nama</th>
                        <th className="py-2.5 pr-3 text-right">Total Simpanan</th>
                        <th className="py-2.5 pr-3 text-right">Sisa Pinjaman</th>
                        <th className="py-2.5 pr-3 text-right">Saldo Saat Ini</th>
                        <th className="py-2.5 pr-3 text-right">Total Pinjaman</th>
                        <th className="py-2.5 pr-3 text-right">Total Dibayar</th>
                        <th className="py-2.5 text-right">Sisa Angsuran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredMemberSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-sm text-stone-400">
                            Tidak ada data anggota.
                          </td>
                        </tr>
                      ) : (
                        filteredMemberSummaries.map((m) => (
                          <tr key={m.idAnggota} className="hover:bg-stone-50/80">
                            <td className="py-3 pr-3 font-mono text-xs text-stone-500">
                              {m.idAnggota}
                            </td>
                            <td className="py-3 pr-3 font-medium text-stone-900">
                              {m.nama}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-emerald-800">
                              {rupiah(m.totalSimpanan)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-amber-700">
                              {rupiah(m.totalSisaPinjaman)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono font-semibold tabular-nums text-stone-900">
                              {rupiah(m.saldoAnggotaSaatIni)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-stone-600">
                              {rupiah(m.totalPinjaman)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-stone-600">
                              {rupiah(m.totalDibayar)}
                            </td>
                            <td className="py-3 text-right font-mono text-xs tabular-nums text-stone-700">
                              {m.totalSisaAngsuran} kali
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activePage === 'laporan' && (
            <MonthlyReportView
              dataset={dataset}
              role={sessionUser.role}
              onArchiveReport={handleArchiveMonthlyReport}
              onLogWhatsAppDispatch={handleLogWhatsAppDispatch}
              onNotify={showToast}
            />
          )}

          {activePage === 'anggota' && (
            <DataAnggotaView
              dataset={dataset}
              onSaveAnggota={handleSaveAnggota}
              onUpdateAnggota={handleUpdateAnggota}
              onDeleteAnggota={handleDeleteAnggota}
            />
          )}

          {activePage === 'kasMasuk' && (
            <KasMasukView dataset={dataset} onSaveKasMasuk={handleSaveKasMasuk} />
          )}

          {activePage === 'kasKeluar' && (
            <KasKeluarView dataset={dataset} onSaveKasKeluar={handleSaveKasKeluar} />
          )}

          {activePage === 'pinjaman' && (
            <PinjamanAndAccView
              dataset={dataset}
              role={sessionUser.role}
              onSavePinjaman={handleSavePinjaman}
              onAccPinjaman={handleAccPinjaman}
              onTolakPinjaman={handleTolakPinjaman}
            />
          )}

          {activePage === 'angsuran' && (
            <AngsuranAndTunggakanView
              dataset={dataset}
              onSaveAngsuran={handleSaveAngsuran}
              onShowKwitansi={setKwitansiModalData}
            />
          )}

          {activePage === 'anggotaSaya' && anggotaMetrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl bg-[#0B2821] p-6 text-white shadow-sm">
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-[#E5C178] uppercase">
                    Posisi Bersih Anda
                  </p>
                  <p className="mt-1 text-xs text-emerald-100/75">
                    Saldo Anggota Saat Ini
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">
                    {rupiah(anggotaMetrics.saldoAnggotaSaatIni)}
                  </p>
                  <p className="mt-4 border-t border-white/12 pt-3 text-xs text-emerald-100/80">
                    Sisa pinjaman aktif: {rupiah(anggotaMetrics.totalSisaPinjaman)}
                  </p>
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-6">
                  <div>
                    <p className="text-xs font-medium text-stone-500">Total Simpanan Saya</p>
                    <p className="mt-2.5 font-mono text-2xl font-bold tabular-nums text-emerald-800">
                      {rupiah(anggotaMetrics.simpananSaya)}
                    </p>
                  </div>
                  <p className="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-500">
                    Kekurangan target iuran: {rupiah(anggotaMetrics.kekuranganIuran)}
                  </p>
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-6">
                  <div>
                    <p className="text-xs font-medium text-stone-500">Total Saldo Kelompok</p>
                    <p className="mt-2.5 font-mono text-2xl font-bold tabular-nums text-stone-900">
                      {rupiah(anggotaMetrics.saldoKelompok)}
                    </p>
                  </div>
                  <p className="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-500">
                    Akumulasi saldo kas seluruh anggota
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200/90 bg-white p-6">
                <h3 className="font-editorial mb-4 text-lg font-semibold text-stone-900">
                  Pinjaman Saya
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500">
                        <th className="py-2.5 pr-3">ID Pinjaman</th>
                        <th className="py-2.5 pr-3">Tanggal</th>
                        <th className="py-2.5 pr-3 text-right">Jumlah</th>
                        <th className="py-2.5 pr-3 text-right">Total Dibayar</th>
                        <th className="py-2.5 pr-3 text-right">Sisa</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {anggotaMetrics.pinjamanSaya.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-sm text-stone-400">
                            Anda tidak memiliki catatan pinjaman.
                          </td>
                        </tr>
                      ) : (
                        anggotaMetrics.pinjamanSaya.map((p) => (
                          <tr key={p.idPinjaman} className="hover:bg-stone-50/80">
                            <td className="py-3 pr-3 font-mono text-xs text-stone-600">
                              {p.idPinjaman}
                            </td>
                            <td className="py-3 pr-3 text-xs text-stone-500">
                              {formatTanggalId(p.tanggal)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-stone-900">
                              {rupiah(p.jumlah)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-emerald-800">
                              {rupiah(p.totalDibayar)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono font-semibold tabular-nums text-stone-900">
                              {rupiah(p.sisa)}
                            </td>
                            <td className="py-3 text-xs font-semibold text-stone-800">
                              {p.status}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activePage === 'ajukanPinjaman' && (
            <div className="max-w-lg rounded-2xl border border-stone-200/90 bg-white p-6">
              <h3 className="font-editorial text-lg font-semibold text-stone-900">
                Form Pengajuan Pinjaman Anggota
              </h3>
              <p className="mt-1 text-xs text-stone-500">
                Pengajuan akan masuk ke antrean Administrator untuk disetujui (ACC) atau ditolak.
              </p>

              <form onSubmit={handleAjukanPinjamanAnggota} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    Jumlah Pinjaman (Rp)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    required
                    value={ajuJumlah}
                    onChange={(e) => setAjuJumlah(e.target.value)}
                    placeholder="1000000"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 font-mono text-sm text-stone-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    Tenor (Jumlah Bulan Angsuran)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={ajuTenor}
                    onChange={(e) => setAjuTenor(e.target.value)}
                    placeholder="10"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2.5 font-mono text-sm text-stone-900"
                  />
                </div>

                {Number(ajuJumlah) > 0 && Number(ajuTenor) > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs">
                    <span className="text-stone-600">Estimasi Angsuran/Bulan</span>
                    <span className="font-mono font-semibold tabular-nums text-stone-900">
                      {rupiah(Number(ajuJumlah) / Number(ajuTenor))}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#0B2821] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#12382E]"
                >
                  Kirim Pengajuan Pinjaman
                </button>
              </form>
            </div>
          )}

          {activePage === 'pengaturan' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-2xl border border-stone-200/90 bg-white p-6 lg:col-span-6">
                <h3 className="font-editorial text-lg font-semibold text-stone-900">
                  Ubah Username & Password Akun
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Mengubah kredensial akun yang sedang login pada sheet Users.
                </p>

                <form onSubmit={handleUpdateAkun} className="mt-4 space-y-3.5">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-700">
                      Username Baru
                    </label>
                    <input
                      type="text"
                      required
                      value={usernameBaru}
                      onChange={(e) => setUsernameBaru(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-700">
                      Password Lama
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordLama}
                      onChange={(e) => setPasswordLama(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-700">
                      Password Baru
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordBaru}
                      onChange={(e) => setPasswordBaru(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#0B2821] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#12382E]"
                  >
                    Simpan Perubahan Akun
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-stone-200/90 bg-white p-6 lg:col-span-6">
                <h3 className="font-editorial text-lg font-semibold text-stone-900">
                  Koneksi Spreadsheet Database
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Spreadsheet aktif yang terhubung ke sistem keuangan ini.
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-700">
                      Tautan / ID Spreadsheet
                    </label>
                    <input
                      type="text"
                      value={spreadsheetInput}
                      onChange={(e) => setSpreadsheetInput(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => refreshDataset()}
                      className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50"
                    >
                      Muat Ulang Data
                    </button>
                    {sessionUser.role === 'Administrator' && (
                      <button
                        type="button"
                        onClick={handleRequestSetupDatabase}
                        className="rounded-xl bg-[#0B2821] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#12382E]"
                      >
                        Verifikasi & Setup Tab Sheet
                      </button>
                    )}
                  </div>
                  <div className="border-t border-stone-100 pt-3 text-xs text-stone-500">
                    Tab terdeteksi:{' '}
                    <span className="font-mono text-stone-700">
                      {dataset.availableTabs.join(', ') || '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals & Toast */}
      <ConfirmActionModal
        state={confirmState}
        isSubmitting={isMutating}
        onClose={closeConfirm}
      />

      <KwitansiModal
        angsuran={kwitansiModalData}
        namaAnggota={
          kwitansiModalData
            ? memberNameLookup.get(kwitansiModalData.idAnggota) || kwitansiModalData.idAnggota
            : ''
        }
        onClose={() => setKwitansiModalData(null)}
      />

      <OfflineIndicator />

      {toast && (
        <div
          className="no-print fixed right-5 bottom-5 z-50 flex max-w-sm items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-lg"
          role="status"
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-700" />
          )}
          <p
            className={`font-medium ${
              toast.type === 'success' ? 'text-stone-900' : 'text-red-700'
            }`}
          >
            {toast.message}
          </p>
        </div>
      )}
    </div>
  );
}
