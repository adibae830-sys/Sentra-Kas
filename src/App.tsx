import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { CashflowChart } from './components/CashflowChart';
import { ConfirmActionModal } from './components/ConfirmActionModal';
import { CurrencyInput } from './components/CurrencyInput';
import { KwitansiModal } from './components/KwitansiModal';
import { QuickRecordModal, QuickRecordTab } from './components/QuickRecordModal';
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
  KonfirmasiSetoranView,
  SetorAnggotaView,
} from './components/SetorDanKonfirmasiViews';
import { KnowledgeView } from './components/KnowledgeView';
import { VideoPanduanModal, VideoTopic } from './components/VideoPanduanModal';
import {
  buildWhatsAppMutasiGroupMessage,
  computeAdminDashboard,
  computeAnggotaDashboard,
  computeMonthlyCashflowSeries,
  computeRingkasanAnggota,
  formatTanggalId,
  nowIsoShort,
  rupiah,
} from './lib/financeEngine';
import {
  dataUrlToBlob,
  generateRingkasanSaldoImage,
  RingkasanImageResult,
} from './lib/reportImage';
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
  isPortalToken,
  loadAllFinanceData,
  PORTAL_TOKEN_PREFIX,
  portalUpdateAccount,
  SheetsAuthExpiredError,
  updateRowValues,
} from './lib/sheetsApi';
import {
  Anggota,
  Angsuran,
  AppUser,
  ConfirmationState,
  FinanceDataset,
  KasKeluar,
  KasMasuk,
  KonfirmasiSetoran,
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
  | 'konfirmasiSetoran'
  | 'anggotaSaya'
  | 'setorSaya'
  | 'ajukanPinjaman'
  | 'knowledge'
  | 'pengaturan';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

const STORAGE_KEYS = {
  SPREADSHEET_ID: 'sentra_kas_spreadsheet_id',
  APP_SESSION: 'sentra_kas_app_session',
  ACTIVE_PAGE: 'sentra_kas_active_page',
  WA_GROUP_SETTINGS: 'sentra_kas_wa_group_settings',
  PORTAL_TOKEN: 'sentra_kas_portal_token',
} as const;

interface WaGroupSettings {
  enabled: boolean;
  groupId: string;
  autoSendGateway: boolean;
}

function readSavedWaGroupSettings(): WaGroupSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WA_GROUP_SETTINGS);
    if (!raw) return { enabled: true, groupId: '', autoSendGateway: true };
    const parsed = JSON.parse(raw) as Partial<WaGroupSettings>;
    return {
      enabled: parsed.enabled !== false,
      groupId: String(parsed.groupId || ''),
      autoSendGateway: parsed.autoSendGateway !== false,
    };
  } catch {
    return { enabled: true, groupId: '', autoSendGateway: true };
  }
}

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

function readSavedPortalToken(): string | null {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.PORTAL_TOKEN);
    return val ? val.trim() : null;
  } catch {
    return null;
  }
}

function setStoredPortalToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.PORTAL_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEYS.PORTAL_TOKEN);
    }
  } catch {
    // ignore storage errors
  }
}

export default function App() {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(true);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [serviceAccountConfigured, setServiceAccountConfigured] = useState(false);
  const [isPortalSubmitting, setIsPortalSubmitting] = useState(false);

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
  const [quickRecordOpen, setQuickRecordOpen] = useState(false);
  const [videoPanduanOpen, setVideoPanduanOpen] = useState(false);
  const [videoPanduanTopic, setVideoPanduanTopic] = useState<VideoTopic>('setor');
  const openVideoPanduan = (targetTopic: VideoTopic) => {
    setVideoPanduanTopic(targetTopic);
    setVideoPanduanOpen(true);
  };
  const [hideBalance, setHideBalance] = useState(true);

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

  // WhatsApp Group auto-notification state
  const [waGroupSettings, setWaGroupSettings] = useState<WaGroupSettings>(readSavedWaGroupSettings);
  const [waGatewayStatus, setWaGatewayStatus] = useState<{
    configured: boolean;
    provider: string;
    hasDefaultGroup?: boolean;
  }>({ configured: false, provider: 'fonnte', hasDefaultGroup: false });
  const [waShareModal, setWaShareModal] = useState<{
    title: string;
    message: string;
    autoSentError?: string;
    image?: RingkasanImageResult;
  } | null>(null);
  const [copiedWaMsg, setCopiedWaMsg] = useState(false);
  const [copiedWaImg, setCopiedWaImg] = useState(false);
  const [isSendingWaGroup, setIsSendingWaGroup] = useState(false);
  const [emailNotifyStatus, setEmailNotifyStatus] = useState<{
    configured: boolean;
    provider: string;
    recipientMasked: string;
  }>({ configured: false, provider: 'none', recipientMasked: '' });
  const [testNotifyEmail, setTestNotifyEmail] = useState('');
  const [isTestingEmailNotify, setIsTestingEmailNotify] = useState(false);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WA_GROUP_SETTINGS, JSON.stringify(waGroupSettings));
    } catch {
      // Ignore storage errors
    }
  }, [waGroupSettings]);

  useEffect(() => {
    fetch('/api/whatsapp/status')
      .then((r) => r.json())
      .then((data) => setWaGatewayStatus(data))
      .catch(() => {});

    fetch('/api/sheets/status')
      .then((r) => r.json())
      .then((data) => setServiceAccountConfigured(Boolean(data?.serviceAccountConfigured)))
      .catch(() => {});

    fetch('/api/notify/setoran')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.configured === 'boolean') {
          setEmailNotifyStatus({
            configured: Boolean(data.configured),
            provider: String(data.provider || 'none'),
            recipientMasked: String(data.recipientMasked || ''),
          });
        }
      })
      .catch(() => {});
  }, []);

  const notifyWhatsAppGroupForMutasi = useCallback(
    async (params: {
      arah: 'MASUK' | 'KELUAR';
      jenis: string;
      jumlah: number;
      tanggal: string;
      idAnggota?: string;
      keterangan?: string;
      latestDataset?: FinanceDataset | null;
    }) => {
      if (!waGroupSettings.enabled) return;

      const targetDataset = params.latestDataset || dataset;
      const currentMasuk = (targetDataset?.kasMasuk || []).reduce((s, r) => s + r.jumlah, 0);
      const currentKeluar = (targetDataset?.kasKeluar || []).reduce((s, r) => s + r.jumlah, 0);
      const currentSaldo = currentMasuk - currentKeluar;
      // When latestDataset is provided, the mutation is already reflected inside targetDataset
      const saldoSetelahMutasi = params.latestDataset
        ? currentSaldo
        : currentSaldo + (params.arah === 'MASUK' ? params.jumlah : -params.jumlah);

      const anggotaNama = params.idAnggota
        ? targetDataset?.anggota.find((a) => a.id === params.idAnggota)?.nama || params.idAnggota
        : undefined;

      const message = buildWhatsAppMutasiGroupMessage({
        arah: params.arah,
        jenis: params.jenis,
        jumlah: params.jumlah,
        saldoSetelahMutasi,
        tanggal: params.tanggal,
        anggotaNama,
        keterangan: params.keterangan,
        petugas: sessionUser?.nama || 'Pengurus',
        namaKelompok: targetDataset?.spreadsheetTitle,
      });

      const summaryImage = targetDataset
        ? generateRingkasanSaldoImage(targetDataset, {
            highlightText: `${params.arah === 'MASUK' ? '+' : '-'} ${rupiah(params.jumlah)} · ${params.jenis}${
              anggotaNama ? ` (${anggotaNama})` : ''
            }`,
            highlightTone: params.arah === 'MASUK' ? 'credit' : 'debit',
            subtitle:
              params.arah === 'MASUK'
                ? 'Update Saldo Setelah Kas Masuk'
                : 'Update Saldo Setelah Kas Keluar',
          })
        : undefined;

      const targetGroup =
        waGroupSettings.groupId.trim() || (waGatewayStatus.hasDefaultGroup ? 'GROUP' : '');

      if (waGroupSettings.autoSendGateway && waGatewayStatus.configured && targetGroup) {
        try {
          const res = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nohp: targetGroup, message }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.success) {
            showToast('success', 'Transaksi tersimpan & otomatis terkirim ke Grup WhatsApp!');
            return;
          }
          setWaShareModal({
            title:
              params.arah === 'MASUK'
                ? 'Notifikasi Dana Masuk ke Grup WA'
                : 'Notifikasi Dana Keluar ke Grup WA',
            message,
            image: summaryImage,
            autoSentError:
              data?.error || 'Auto-kirim server gagal. Silakan bagikan manual 1-klik ke Grup WA.',
          });
          return;
        } catch {
          setWaShareModal({
            title:
              params.arah === 'MASUK'
                ? 'Notifikasi Dana Masuk ke Grup WA'
                : 'Notifikasi Dana Keluar ke Grup WA',
            message,
            image: summaryImage,
            autoSentError: 'Gagal terhubung ke server WhatsApp. Gunakan tombol Bagikan ke Grup WA.',
          });
          return;
        }
      }

      setWaShareModal({
        title:
          params.arah === 'MASUK'
            ? 'Bagikan Info Kas Masuk ke Grup WA'
            : 'Bagikan Info Kas Keluar ke Grup WA',
        message,
        image: summaryImage,
      });
    },
    [waGroupSettings, waGatewayStatus, dataset, sessionUser, showToast]
  );

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

  const getActiveSheetToken = useCallback((): string | null => {
    const googleToken = getAccessToken();
    if (googleToken) return googleToken;
    const portalToken = readSavedPortalToken();
    return portalToken ? `${PORTAL_TOKEN_PREFIX}${portalToken}` : null;
  }, []);

  const clearSavedAppSession = useCallback(() => {
    setSavedSession(null);
    setSessionUser(null);
    setStoredPortalToken(null);
    if (!getAccessToken()) {
      setDataset(null);
      setNeedsGoogleAuth(true);
    }
    try {
      localStorage.removeItem(STORAGE_KEYS.APP_SESSION);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PAGE);
    } catch {
      // ignore
    }
  }, []);

  const refreshDataset = useCallback(
    async (explicitToken?: string): Promise<FinanceDataset | null> => {
      const token = explicitToken || getActiveSheetToken();
      if (!token) {
        setNeedsGoogleAuth(true);
        return null;
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
        return data;
      } catch (err) {
        if (err instanceof SheetsAuthExpiredError) {
          clearAccessToken();
          setStoredPortalToken(null);
          setNeedsGoogleAuth(true);
          setSheetError(err.message);
        } else {
          setSheetError(
            err instanceof Error
              ? err.message
              : 'Gagal memuat data dari Google Spreadsheet.'
          );
        }
        return null;
      } finally {
        setIsLoadingSheet(false);
      }
    },
    [activeSpreadsheetId, getActiveSheetToken]
  );

  // Restore saved Service Account Portal session on mount if present
  useEffect(() => {
    const portalToken = readSavedPortalToken();
    if (!portalToken || getAccessToken()) return;

    let cancelled = false;
    setIsLoadingSheet(true);
    fetch('/api/sheets/refresh', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${portalToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ spreadsheetId: activeSpreadsheetId }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          user?: AppUser;
          dataset?: FinanceDataset;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.user || !data.dataset) {
          setStoredPortalToken(null);
          setNeedsGoogleAuth(true);
          return;
        }
        setDataset(data.dataset);
        setSessionUser(data.user);
        setUsernameBaru(data.user.username);
        setNeedsGoogleAuth(false);
        const savedPage = readSavedActivePage();
        const defaultPage: PageId =
          data.user.role === 'Administrator'
            ? 'dashboard'
            : data.user.role === 'Bendahara'
              ? 'kasMasuk'
              : 'anggotaSaya';
        setActivePage(savedPage || defaultPage);
      })
      .catch(() => {
        // Keep token on transient offline errors
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSheet(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSpreadsheetId]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setNeedsGoogleAuth(false);
        refreshDataset(token);
      },
      (user) => {
        setGoogleUser(user);
        if (readSavedPortalToken()) return;
        // Firebase still remembers the signed-in Google account across refresh;
        // only the in-memory Sheets access token needs a quick 1-click refresh.
        setNeedsGoogleAuth(true);
        setDataset(null);
        setSessionUser(null);
      },
      () => {
        setGoogleUser(null);
        if (readSavedPortalToken()) return;
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
        setStoredPortalToken(null);
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
    setStoredPortalToken(null);
    setNeedsGoogleAuth(true);
    setDataset(null);
    clearSavedAppSession();
  };

  const handlePortalLogin = async (usernameInput: string, passwordInput: string) => {
    setLoginError(null);
    setIsPortalSubmitting(true);
    try {
      const res = await fetch('/api/sheets/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: activeSpreadsheetId,
          username: usernameInput.trim(),
          password: passwordInput.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: AppUser;
        portalToken?: string;
        dataset?: FinanceDataset;
        error?: string;
      };
      if (!res.ok || !data.user || !data.portalToken || !data.dataset) {
        setLoginError(
          data.error ||
            'Login gagal. Periksa username, password, dan pastikan akun berstatus Aktif.'
        );
        return;
      }

      setStoredPortalToken(data.portalToken);
      setDataset(data.dataset);
      setSessionUser(data.user);
      setNeedsGoogleAuth(false);
      setUsernameBaru(data.user.username);

      const toSave: SavedAppSession = {
        username: data.user.username,
        nama: data.user.nama,
        role: data.user.role,
        idAnggota: data.user.idAnggota,
      };
      setSavedSession(toSave);
      try {
        localStorage.setItem(STORAGE_KEYS.APP_SESSION, JSON.stringify(toSave));
      } catch {
        // ignore
      }

      if (data.user.role === 'Administrator') {
        setActivePage('dashboard');
      } else if (data.user.role === 'Bendahara') {
        setActivePage('kasMasuk');
      } else {
        setActivePage('anggotaSaya');
      }
    } catch {
      setLoginError('Gagal menghubungi server portal login. Periksa koneksi internet Anda.');
    } finally {
      setIsPortalSubmitting(false);
    }
  };

  const handlePortalRegister = async (payload: {
    nama: string;
    alamat: string;
    nohp: string;
    username: string;
    password: string;
  }): Promise<boolean> => {
    setLoginError(null);
    setIsPortalSubmitting(true);
    try {
      const res = await fetch('/api/sheets/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: activeSpreadsheetId,
          ...payload,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        idAnggota?: string;
        error?: string;
      };
      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Pendaftaran anggota gagal. Silakan coba lagi.');
        return false;
      }
      showToast(
        'success',
        `Pendaftaran berhasil (${data.idAnggota}). Silakan masuk dengan akun Anda.`
      );
      return true;
    } catch {
      setLoginError('Gagal terhubung ke server pendaftaran.');
      return false;
    } finally {
      setIsPortalSubmitting(false);
    }
  };

  const openConfirm = (config: Omit<ConfirmationState, 'isOpen'>) => {
    setConfirmState({ ...config, isOpen: true });
  };

  const closeConfirm = () => {
    if (isMutating) return;
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  const runConfirmedMutation = async (
    fn: () => Promise<void>,
    successMessage: string,
    afterRefresh?: (freshDataset: FinanceDataset | null) => Promise<void> | void
  ) => {
    const token = getActiveSheetToken();
    if (!token) {
      setNeedsGoogleAuth(true);
      showToast('error', 'Sesi login berakhir. Silakan masuk kembali.');
      return;
    }

    setIsMutating(true);
    try {
      await fn();
      const fresh = await refreshDataset(token);
      setConfirmState((prev) => ({ ...prev, isOpen: false }));
      showToast('success', successMessage);
      if (afterRefresh) {
        await afterRefresh(fresh);
      }
    } catch (err) {
      if (err instanceof SheetsAuthExpiredError) {
        clearAccessToken();
        setStoredPortalToken(null);
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
        'Tindakan ini akan memeriksa dan membuat tab yang belum tersedia (Users, Anggota, KasMasuk, KasKeluar, Pinjaman, Angsuran, LaporanBulanan, LogWhatsApp, KonfirmasiSetoran) beserta header kolomnya.',
      details: [
        `Spreadsheet ID: ${activeSpreadsheetId}`,
        'Membuat akun admin default (username: admin) jika belum ada user Administrator.',
      ],
      confirmLabel: 'Setup Struktur Sheet',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getActiveSheetToken()!;
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
          const token = getActiveSheetToken()!;
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
          const token = getActiveSheetToken()!;
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
          const token = getActiveSheetToken()!;
          await updateRowValues(activeSpreadsheetId, token, 'Anggota', updated.rowIndex, [
            updated.id,
            updated.nama,
            updated.alamat,
            updated.nohp,
            updated.tanggal,
            updated.status,
          ]);
          const linkedUsers = (dataset?.users || []).filter((u) => u.idAnggota === updated.id);
          for (const u of linkedUsers) {
            if (u.status !== updated.status) {
              await updateRowValues(activeSpreadsheetId, token, 'Users', u.rowIndex, [
                u.username,
                u.password,
                updated.nama,
                u.role,
                updated.status,
                u.idAnggota,
              ]);
            }
          }
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
          const token = getActiveSheetToken()!;
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
      onConfirm: () => {
        const tgl = nowIsoShort();
        return runConfirmedMutation(
          async () => {
            const token = getActiveSheetToken()!;
            await appendRow(activeSpreadsheetId, token, 'KasMasuk', [
              newId,
              tgl,
              payload.idAnggota,
              payload.jenis,
              payload.jumlah,
              payload.keterangan,
              sessionUser?.nama || 'Admin',
            ]);
          },
          `Kas masuk ${rupiah(payload.jumlah)} berhasil disimpan.`,
          async (fresh) => {
            await notifyWhatsAppGroupForMutasi({
              arah: 'MASUK',
              jenis: payload.jenis,
              jumlah: payload.jumlah,
              tanggal: tgl,
              idAnggota: payload.idAnggota,
              keterangan: payload.keterangan,
              latestDataset: fresh,
            });
          }
        );
      },
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
      onConfirm: () => {
        const tgl = nowIsoShort();
        return runConfirmedMutation(
          async () => {
            const token = getActiveSheetToken()!;
            await appendRow(activeSpreadsheetId, token, 'KasKeluar', [
              newId,
              tgl,
              payload.jenis,
              payload.jumlah,
              payload.keterangan,
              sessionUser?.nama || 'Admin',
            ]);
          },
          `Pengeluaran ${rupiah(payload.jumlah)} berhasil dicatat.`,
          async (fresh) => {
            await notifyWhatsAppGroupForMutasi({
              arah: 'KELUAR',
              jenis: payload.jenis,
              jumlah: payload.jumlah,
              tanggal: tgl,
              keterangan: payload.keterangan,
              latestDataset: fresh,
            });
          }
        );
      },
    });
  };

  const handleUpdateKasMasuk = (updated: KasMasuk) => {
    openConfirm({
      title: 'Perbarui Catatan Kas Masuk?',
      description: `Mengubah transaksi ${updated.id} pada tab KasMasuk di Google Sheets.`,
      details: [
        `Jenis: ${updated.jenis}`,
        `Nominal Baru: ${rupiah(updated.jumlah)}`,
        `Keterangan: ${updated.keterangan || '-'}`,
      ],
      confirmLabel: 'Simpan Perubahan',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getActiveSheetToken()!;
          await updateRowValues(activeSpreadsheetId, token, 'KasMasuk', updated.rowIndex, [
            updated.id,
            updated.tanggal,
            updated.idAnggota,
            updated.jenis,
            updated.jumlah,
            updated.keterangan,
            updated.user || sessionUser?.nama || 'Admin',
          ]);
        }, `Kas masuk ${updated.id} berhasil diperbarui.`),
    });
  };

  const handleDeleteKasMasuk = (target: KasMasuk) => {
    if (!dataset) return;
    const sheetId = dataset.sheetIds['KasMasuk'];
    if (sheetId === undefined) return;
    openConfirm({
      title: 'Hapus Catatan Kas Masuk?',
      description: 'Baris transaksi ini akan dihapus permanen dari tab KasMasuk.',
      details: [
        `ID: ${target.id}`,
        `Jenis: ${target.jenis}`,
        `Nominal: ${rupiah(target.jumlah)}`,
      ],
      confirmLabel: 'Ya, Hapus Transaksi',
      variant: 'danger',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getActiveSheetToken()!;
          await deleteRow(activeSpreadsheetId, token, sheetId, target.rowIndex);
        }, `Kas masuk ${target.id} berhasil dihapus.`),
    });
  };

  const handleUpdateKasKeluar = (updated: KasKeluar) => {
    openConfirm({
      title: 'Perbarui Catatan Kas Keluar?',
      description: `Mengubah transaksi ${updated.id} pada tab KasKeluar di Google Sheets.`,
      details: [
        `Kategori: ${updated.jenis}`,
        `Nominal Baru: ${rupiah(updated.jumlah)}`,
        `Keterangan: ${updated.keterangan || '-'}`,
      ],
      confirmLabel: 'Simpan Perubahan',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getActiveSheetToken()!;
          await updateRowValues(activeSpreadsheetId, token, 'KasKeluar', updated.rowIndex, [
            updated.id,
            updated.tanggal,
            updated.jenis,
            updated.jumlah,
            updated.keterangan,
            updated.user || sessionUser?.nama || 'Admin',
          ]);
        }, `Kas keluar ${updated.id} berhasil diperbarui.`),
    });
  };

  const handleDeleteKasKeluar = (target: KasKeluar) => {
    if (!dataset) return;
    const sheetId = dataset.sheetIds['KasKeluar'];
    if (sheetId === undefined) return;
    openConfirm({
      title: 'Hapus Catatan Kas Keluar?',
      description: 'Baris pengeluaran ini akan dihapus permanen dari tab KasKeluar.',
      details: [
        `ID: ${target.id}`,
        `Kategori: ${target.jenis}`,
        `Nominal: ${rupiah(target.jumlah)}`,
      ],
      confirmLabel: 'Ya, Hapus Transaksi',
      variant: 'danger',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getActiveSheetToken()!;
          await deleteRow(activeSpreadsheetId, token, sheetId, target.rowIndex);
        }, `Kas keluar ${target.id} berhasil dihapus.`),
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
      onConfirm: () => {
        const now = nowIsoShort();
        return runConfirmedMutation(
          async () => {
            const token = getActiveSheetToken()!;
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
          },
          `Pinjaman ${idPinjaman} berhasil disimpan dan dicairkan.`,
          async (fresh) => {
            await notifyWhatsAppGroupForMutasi({
              arah: 'KELUAR',
              jenis: 'Pencairan Pinjaman',
              jumlah: payload.jumlah,
              tanggal: now,
              idAnggota: payload.idAnggota,
              keterangan: `Pencairan pinjaman ${idPinjaman} (${payload.tenor} bulan)`,
              latestDataset: fresh,
            });
          }
        );
      },
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
      onConfirm: () => {
        const now = nowIsoShort();
        return runConfirmedMutation(
          async () => {
            const token = getActiveSheetToken()!;
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
              now,
              'Pencairan Pinjaman',
              pinjaman.jumlah,
              `ACC pinjaman anggota ${pinjaman.idAnggota} / ${pinjaman.idPinjaman}`,
              sessionUser?.nama || 'Administrator',
            ]);
          },
          `Pinjaman ${pinjaman.idPinjaman} berhasil disetujui.`,
          async (fresh) => {
            await notifyWhatsAppGroupForMutasi({
              arah: 'KELUAR',
              jenis: 'Pencairan Pinjaman (ACC)',
              jumlah: pinjaman.jumlah,
              tanggal: now,
              idAnggota: pinjaman.idAnggota,
              keterangan: `ACC pinjaman ${pinjaman.idPinjaman}`,
              latestDataset: fresh,
            });
          }
        );
      },
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
          const token = getActiveSheetToken()!;
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
        runConfirmedMutation(
          async () => {
            const token = getActiveSheetToken()!;
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
          },
          'Angsuran berhasil disimpan dan kwitansi siap dicetak.',
          async (fresh) => {
            await notifyWhatsAppGroupForMutasi({
              arah: 'MASUK',
              jenis: `Angsuran Ke-${angsuranKe}`,
              jumlah,
              tanggal: now,
              idAnggota: pinjaman.idAnggota,
              keterangan: `Pembayaran pinjaman ${pinjaman.idPinjaman} (Sisa: ${rupiah(sisaBaru)})`,
              latestDataset: fresh,
            });
          }
        ),
    });
  };

  const handleUpdatePinjaman = (updated: Pinjaman) => {
    const angsuranPerBulan = Math.round(updated.jumlah / Math.max(updated.tenor, 1));
    const sisa = Math.max(updated.jumlah - updated.totalDibayar, 0);
    const status =
      updated.status === 'Berjalan' && sisa <= 0 ? 'Lunas' : updated.status;

    openConfirm({
      title: 'Perbarui Data Pinjaman?',
      description: `Mengubah data pinjaman ${updated.idPinjaman} pada tab Pinjaman di Google Sheets.`,
      details: [
        `Pokok Baru: ${rupiah(updated.jumlah)} (${updated.tenor} bulan)`,
        `Angsuran/Bulan: ${rupiah(angsuranPerBulan)}`,
        `Sisa Pinjaman: ${rupiah(sisa)} · Status: ${status}`,
      ],
      confirmLabel: 'Simpan Perubahan',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getActiveSheetToken()!;
          await updateRowValues(activeSpreadsheetId, token, 'Pinjaman', updated.rowIndex, [
            updated.idPinjaman,
            updated.tanggal,
            updated.idAnggota,
            updated.jumlah,
            updated.tenor,
            angsuranPerBulan,
            updated.totalDibayar,
            sisa,
            status,
          ]);
        }, `Data pinjaman ${updated.idPinjaman} berhasil diperbarui.`),
    });
  };

  const handleDeletePinjaman = (target: Pinjaman) => {
    if (!dataset) return;
    const sheetId = dataset.sheetIds['Pinjaman'];
    if (sheetId === undefined) return;
    openConfirm({
      title: 'Hapus Catatan Pinjaman?',
      description:
        'Baris pinjaman ini akan dihapus permanen dari tab Pinjaman. (Mutasi KasKeluar sebelumnya tidak ikut terhapus otomatis.)',
      details: [
        `ID Pinjaman: ${target.idPinjaman}`,
        `Nominal: ${rupiah(target.jumlah)}`,
        `Status: ${target.status}`,
      ],
      confirmLabel: 'Ya, Hapus Pinjaman',
      variant: 'danger',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getActiveSheetToken()!;
          await deleteRow(activeSpreadsheetId, token, sheetId, target.rowIndex);
        }, `Pinjaman ${target.idPinjaman} berhasil dihapus.`),
    });
  };

  const handleUpdateAngsuran = (updated: Angsuran) => {
    if (!dataset) return;
    const linkedLoan = dataset.pinjaman.find((p) => p.idPinjaman === updated.idPinjaman);
    const totalDibayarBaru = dataset.angsuran
      .filter((a) => a.idPinjaman === updated.idPinjaman)
      .reduce(
        (sum, a) => sum + (a.idAngsuran === updated.idAngsuran ? updated.jumlah : a.jumlah),
        0
      );
    const sisaPinjamanBaru = linkedLoan
      ? Math.max(linkedLoan.jumlah - totalDibayarBaru, 0)
      : updated.sisa;
    const statusPinjamanBaru = linkedLoan
      ? sisaPinjamanBaru <= 0
        ? 'Lunas'
        : 'Berjalan'
      : 'Berjalan';

    openConfirm({
      title: 'Perbarui Pembayaran Angsuran?',
      description:
        'Memperbarui baris pada tab Angsuran sekaligus menghitung ulang Total Dibayar dan Sisa pada tab Pinjaman.',
      details: [
        `ID Angsuran: ${updated.idAngsuran} (Ke-${updated.angsuranKe})`,
        `Nominal Baru: ${rupiah(updated.jumlah)}`,
        ...(linkedLoan
          ? [`Sisa Pinjaman (${linkedLoan.idPinjaman}): ${rupiah(sisaPinjamanBaru)} (${statusPinjamanBaru})`]
          : []),
      ],
      confirmLabel: 'Simpan Perubahan',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getActiveSheetToken()!;
          await updateRowValues(activeSpreadsheetId, token, 'Angsuran', updated.rowIndex, [
            updated.idAngsuran,
            updated.tanggal,
            updated.idPinjaman,
            updated.idAnggota,
            updated.angsuranKe,
            updated.jumlah,
            sisaPinjamanBaru,
            updated.user || sessionUser?.nama || 'Admin',
          ]);
          if (linkedLoan) {
            await updateRowValues(activeSpreadsheetId, token, 'Pinjaman', linkedLoan.rowIndex, [
              linkedLoan.idPinjaman,
              linkedLoan.tanggal,
              linkedLoan.idAnggota,
              linkedLoan.jumlah,
              linkedLoan.tenor,
              linkedLoan.angsuranPerBulan,
              totalDibayarBaru,
              sisaPinjamanBaru,
              statusPinjamanBaru,
            ]);
          }
        }, `Angsuran ${updated.idAngsuran} berhasil diperbarui.`),
    });
  };

  const handleDeleteAngsuran = (target: Angsuran) => {
    if (!dataset) return;
    const sheetId = dataset.sheetIds['Angsuran'];
    if (sheetId === undefined) return;
    const linkedLoan = dataset.pinjaman.find((p) => p.idPinjaman === target.idPinjaman);
    const totalDibayarBaru = dataset.angsuran
      .filter((a) => a.idPinjaman === target.idPinjaman && a.idAngsuran !== target.idAngsuran)
      .reduce((sum, a) => sum + a.jumlah, 0);
    const sisaPinjamanBaru = linkedLoan
      ? Math.max(linkedLoan.jumlah - totalDibayarBaru, 0)
      : 0;
    const statusPinjamanBaru = linkedLoan
      ? sisaPinjamanBaru <= 0
        ? 'Lunas'
        : 'Berjalan'
      : 'Berjalan';

    openConfirm({
      title: 'Hapus Pembayaran Angsuran?',
      description:
        'Baris angsuran akan dihapus permanen dan Total Dibayar serta Sisa pada tab Pinjaman akan disesuaikan kembali.',
      details: [
        `ID Angsuran: ${target.idAngsuran}`,
        `Nominal Dihapus: ${rupiah(target.jumlah)}`,
        ...(linkedLoan
          ? [`Sisa Pinjaman (${linkedLoan.idPinjaman}) menjadi: ${rupiah(sisaPinjamanBaru)}`]
          : []),
      ],
      confirmLabel: 'Ya, Hapus Angsuran',
      variant: 'danger',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getActiveSheetToken()!;
          await deleteRow(activeSpreadsheetId, token, sheetId, target.rowIndex);
          if (linkedLoan) {
            await updateRowValues(activeSpreadsheetId, token, 'Pinjaman', linkedLoan.rowIndex, [
              linkedLoan.idPinjaman,
              linkedLoan.tanggal,
              linkedLoan.idAnggota,
              linkedLoan.jumlah,
              linkedLoan.tenor,
              linkedLoan.angsuranPerBulan,
              totalDibayarBaru,
              sisaPinjamanBaru,
              statusPinjamanBaru,
            ]);
          }
        }, `Angsuran ${target.idAngsuran} berhasil dihapus.`),
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
          const token = getActiveSheetToken()!;
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

  // Pengajuan Konfirmasi Setoran Iuran / Angsuran oleh Anggota (Menunggu Admin/Bendahara)
  const handleAjukanSetoranAnggota = (payload: {
    jenisSetoran: 'Simpanan' | 'Angsuran' | 'Gabungan';
    idPinjaman: string;
    jumlah: number;
    jumlahSimpanan: number;
    jumlahAngsuran: number;
    metodeBayar: string;
    keterangan: string;
  }) => {
    if (!sessionUser?.idAnggota) {
      showToast('error', 'ID Anggota tidak terhubung ke akun Anda.');
      return;
    }
    if (payload.jumlah <= 0) {
      showToast('error', 'Nominal setoran harus lebih dari 0.');
      return;
    }
    if (payload.jenisSetoran === 'Angsuran' || payload.jenisSetoran === 'Gabungan') {
      const targetLoan = dataset?.pinjaman.find(
        (p) =>
          p.idPinjaman === payload.idPinjaman &&
          p.idAnggota === sessionUser.idAnggota &&
          p.status === 'Berjalan' &&
          p.sisa > 0
      );
      if (!targetLoan) {
        showToast('error', 'Pinjaman aktif yang dipilih tidak valid atau sudah lunas.');
        return;
      }
      if (payload.jenisSetoran === 'Gabungan') {
        if (payload.jumlahSimpanan <= 0 || payload.jumlahAngsuran <= 0) {
          showToast('error', 'Pembagian porsi iuran dan angsuran harus lebih dari 0.');
          return;
        }
        if (payload.jumlahAngsuran > targetLoan.sisa) {
          showToast(
            'error',
            `Porsi angsuran (${rupiah(payload.jumlahAngsuran)}) melebihi sisa pinjaman (${rupiah(targetLoan.sisa)}).`
          );
          return;
        }
      }
    }

    const idSetoran = 'STR-' + Date.now();
    openConfirm({
      title:
        payload.jenisSetoran === 'Simpanan'
          ? 'Kirim Konfirmasi Setor Iuran?'
          : payload.jenisSetoran === 'Gabungan'
            ? 'Kirim Konfirmasi Setoran Gabungan?'
            : 'Kirim Konfirmasi Bayar Angsuran?',
      description:
        'Pengajuan akan masuk ke antrean konfirmasi Admin/Bendahara dan belum dicatat ke saldo kas sampai disetujui.',
      details: [
        `ID Pengajuan: ${idSetoran}`,
        `Jenis: ${
          payload.jenisSetoran === 'Simpanan'
            ? 'Iuran / Simpanan'
            : payload.jenisSetoran === 'Gabungan'
              ? `Gabungan (${payload.idPinjaman})`
              : `Angsuran (${payload.idPinjaman})`
        }`,
        `Total Transfer: ${rupiah(payload.jumlah)} · Metode: ${payload.metodeBayar}`,
        ...(payload.jenisSetoran === 'Gabungan'
          ? [
              `Rincian: Simpanan ${rupiah(payload.jumlahSimpanan)} + Angsuran ${rupiah(payload.jumlahAngsuran)}`,
            ]
          : []),
        ...(payload.keterangan ? [`Keterangan: ${payload.keterangan}`] : []),
      ],
      confirmLabel: 'Ya, Kirim Konfirmasi',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getActiveSheetToken()!;
          if (
            !isPortalToken(token) &&
            dataset &&
            !dataset.availableTabs.includes('KonfirmasiSetoran')
          ) {
            try {
              await ensureDatabaseStructure(activeSpreadsheetId, token, {
                includeReportingTabs: true,
              });
            } catch {
              throw new Error(
                'Tab KonfirmasiSetoran belum dibuat di Spreadsheet. Minta Admin menjalankan "Verifikasi & Setup Tab Sheet" di menu Pengaturan.'
              );
            }
          }
          await appendRow(activeSpreadsheetId, token, 'KonfirmasiSetoran', [
            idSetoran,
            nowIsoShort(),
            sessionUser.idAnggota,
            payload.jenisSetoran,
            payload.idPinjaman,
            payload.jumlah,
            payload.metodeBayar,
            payload.keterangan,
            'Menunggu',
            '',
            payload.jumlahSimpanan,
            payload.jumlahAngsuran,
          ]);
        }, 'Konfirmasi setoran berhasil dikirim dan menunggu persetujuan Admin/Bendahara.', () => {
          fetch('/api/notify/setoran', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idSetoran,
              idAnggota: sessionUser.idAnggota,
              namaAnggota: sessionUser.nama,
              jenisSetoran: payload.jenisSetoran,
              idPinjaman: payload.idPinjaman,
              jumlah: payload.jumlah,
              jumlahSimpanan: payload.jumlahSimpanan,
              jumlahAngsuran: payload.jumlahAngsuran,
              metodeBayar: payload.metodeBayar,
              keterangan: payload.keterangan,
              appUrl: window.location.origin,
            }),
          }).catch(() => {});
        }),
    });
  };

  // Konfirmasi (ACC) Setoran Anggota oleh Administrator / Bendahara
  const handleKonfirmasiSetoran = (item: KonfirmasiSetoran) => {
    if (item.status !== 'Menunggu') return;
    const namaAnggota = memberNameLookup.get(item.idAnggota) || item.idAnggota;
    const petugas = sessionUser?.nama || 'Admin';

    if (item.jenisSetoran === 'Simpanan') {
      const idKasMasuk = 'KM-' + Date.now();
      const keteranganGabungan = [item.metodeBayar, item.keterangan]
        .filter(Boolean)
        .join(' · ');

      openConfirm({
        title: 'Konfirmasi & Catat Setoran Iuran?',
        description:
          'Menyetujui setoran ini akan mengubah status menjadi Dikonfirmasi dan langsung mencatat transaksi ke tab KasMasuk.',
        details: [
          `Anggota: ${namaAnggota} (${item.idAnggota})`,
          `Nominal Simpanan: ${rupiah(item.jumlah)}`,
          `Metode & Ket: ${keteranganGabungan || '-'}`,
        ],
        confirmLabel: 'Ya, Konfirmasi & Catat',
        onConfirm: () => {
          const now = nowIsoShort();
          return runConfirmedMutation(
            async () => {
              const token = getActiveSheetToken()!;
              await updateRowValues(
                activeSpreadsheetId,
                token,
                'KonfirmasiSetoran',
                item.rowIndex,
                [
                  item.idSetoran,
                  item.tanggal,
                  item.idAnggota,
                  item.jenisSetoran,
                  item.idPinjaman,
                  item.jumlah,
                  item.metodeBayar,
                  item.keterangan,
                  'Dikonfirmasi',
                  petugas,
                  item.jumlahSimpanan || item.jumlah,
                  item.jumlahAngsuran || 0,
                ]
              );
              await appendRow(activeSpreadsheetId, token, 'KasMasuk', [
                idKasMasuk,
                now,
                item.idAnggota,
                'Simpanan',
                item.jumlah,
                keteranganGabungan || `Setoran terkonfirmasi (${item.idSetoran})`,
                petugas,
              ]);
            },
            `Setoran iuran ${namaAnggota} (${rupiah(item.jumlah)}) berhasil dikonfirmasi & dicatat.`,
            async (fresh) => {
              await notifyWhatsAppGroupForMutasi({
                arah: 'MASUK',
                jenis: 'Simpanan',
                jumlah: item.jumlah,
                tanggal: now,
                idAnggota: item.idAnggota,
                keterangan: keteranganGabungan || `Konfirmasi setoran ${item.idSetoran}`,
                latestDataset: fresh,
              });
            }
          );
        },
      });
      return;
    }

    // Jenis Setoran: Angsuran atau Gabungan (Simpanan + Angsuran)
    const linkedLoan = dataset?.pinjaman.find((p) => p.idPinjaman === item.idPinjaman);
    if (!linkedLoan) {
      showToast('error', `Data pinjaman ${item.idPinjaman} tidak ditemukan.`);
      return;
    }
    if (linkedLoan.status !== 'Berjalan' || linkedLoan.sisa <= 0) {
      showToast(
        'error',
        `Pinjaman ${linkedLoan.idPinjaman} sudah berstatus ${linkedLoan.status}. Tolak setoran ini agar tidak tercatat ganda.`
      );
      return;
    }

    const isGabungan = item.jenisSetoran === 'Gabungan';
    const nominalSimpanan = isGabungan ? item.jumlahSimpanan : 0;
    const nominalAngsuran = isGabungan ? item.jumlahAngsuran : item.jumlah;

    if (nominalAngsuran <= 0 || (isGabungan && nominalSimpanan <= 0)) {
      showToast('error', 'Rincian nominal simpanan/angsuran tidak valid.');
      return;
    }

    const existingCount = (dataset?.angsuran || []).filter(
      (a) => a.idPinjaman === linkedLoan.idPinjaman
    ).length;
    const angsuranKe = existingCount + 1;
    const totalBaru = linkedLoan.totalDibayar + nominalAngsuran;
    const sisaBaru = Math.max(linkedLoan.sisa - nominalAngsuran, 0);
    const statusBaru = sisaBaru <= 0 ? 'Lunas' : 'Berjalan';
    const idAngsuran = 'ANG-' + Date.now();
    const idKasMasukSimpanan = 'KM-' + Date.now();
    const idKasMasukAngsuran = 'KM-' + (Date.now() + 1);
    const keteranganGabungan = [
      `Pembayaran pinjaman ${linkedLoan.idPinjaman}`,
      item.metodeBayar,
      item.keterangan,
    ]
      .filter(Boolean)
      .join(' · ');

    openConfirm({
      title: isGabungan
        ? 'Konfirmasi & Catat Setoran Gabungan (1x Transfer)?'
        : 'Konfirmasi & Catat Pembayaran Angsuran?',
      description: isGabungan
        ? 'Menyetujui setoran ini akan mencatat Simpanan ke KasMasuk, memperbarui Pinjaman, serta mencatat Angsuran dan KasMasuk secara otomatis.'
        : 'Menyetujui setoran ini akan memperbarui Pinjaman, mencatat Angsuran baru, dan menambah KasMasuk.',
      details: [
        `Anggota: ${namaAnggota} (${linkedLoan.idPinjaman})`,
        ...(isGabungan
          ? [
              `Total Transfer: ${rupiah(item.jumlah)}`,
              `Masuk Simpanan: ${rupiah(nominalSimpanan)}`,
            ]
          : []),
        `Masuk Angsuran: ${rupiah(nominalAngsuran)} (Angsuran ke-${angsuranKe})`,
        `Sisa Setelah Konfirmasi: ${rupiah(sisaBaru)} (${statusBaru})`,
      ],
      confirmLabel: isGabungan ? 'Ya, Konfirmasi Gabungan' : 'Ya, Konfirmasi Angsuran',
      onConfirm: () => {
        const now = nowIsoShort();
        return runConfirmedMutation(
          async () => {
            const token = getActiveSheetToken()!;
            await updateRowValues(
              activeSpreadsheetId,
              token,
              'KonfirmasiSetoran',
              item.rowIndex,
              [
                item.idSetoran,
                item.tanggal,
                item.idAnggota,
                item.jenisSetoran,
                item.idPinjaman,
                item.jumlah,
                item.metodeBayar,
                item.keterangan,
                'Dikonfirmasi',
                petugas,
                nominalSimpanan,
                nominalAngsuran,
              ]
            );
            if (isGabungan && nominalSimpanan > 0) {
              await appendRow(activeSpreadsheetId, token, 'KasMasuk', [
                idKasMasukSimpanan,
                now,
                item.idAnggota,
                'Simpanan',
                nominalSimpanan,
                [item.metodeBayar, item.keterangan || `Iuran gabungan (${item.idSetoran})`]
                  .filter(Boolean)
                  .join(' · '),
                petugas,
              ]);
            }
            await updateRowValues(activeSpreadsheetId, token, 'Pinjaman', linkedLoan.rowIndex, [
              linkedLoan.idPinjaman,
              linkedLoan.tanggal,
              linkedLoan.idAnggota,
              linkedLoan.jumlah,
              linkedLoan.tenor,
              linkedLoan.angsuranPerBulan,
              totalBaru,
              sisaBaru,
              statusBaru,
            ]);
            await appendRow(activeSpreadsheetId, token, 'Angsuran', [
              idAngsuran,
              now,
              linkedLoan.idPinjaman,
              linkedLoan.idAnggota,
              angsuranKe,
              nominalAngsuran,
              sisaBaru,
              petugas,
            ]);
            await appendRow(activeSpreadsheetId, token, 'KasMasuk', [
              idKasMasukAngsuran,
              now,
              linkedLoan.idAnggota,
              'Angsuran',
              nominalAngsuran,
              keteranganGabungan,
              petugas,
            ]);

            setKwitansiModalData({
              idAngsuran,
              tanggal: now,
              idPinjaman: linkedLoan.idPinjaman,
              idAnggota: linkedLoan.idAnggota,
              angsuranKe,
              jumlah: nominalAngsuran,
              sisa: sisaBaru,
              user: petugas,
              rowIndex: 0,
            });
          },
          isGabungan
            ? `Setoran gabungan ${namaAnggota} (${rupiah(item.jumlah)}) berhasil dikonfirmasi & dipisah ke Simpanan + Angsuran.`
            : `Pembayaran angsuran ${namaAnggota} (${rupiah(nominalAngsuran)}) berhasil dikonfirmasi & kwitansi siap.`,
          async (fresh) => {
            await notifyWhatsAppGroupForMutasi({
              arah: 'MASUK',
              jenis: isGabungan
                ? `Iuran + Angsuran Ke-${angsuranKe}`
                : `Angsuran Ke-${angsuranKe}`,
              jumlah: item.jumlah,
              tanggal: now,
              idAnggota: linkedLoan.idAnggota,
              keterangan: isGabungan
                ? `Simpanan ${rupiah(nominalSimpanan)} + Angsuran ${rupiah(nominalAngsuran)} · ${linkedLoan.idPinjaman} (Sisa: ${rupiah(sisaBaru)})`
                : `${keteranganGabungan} (Sisa: ${rupiah(sisaBaru)})`,
              latestDataset: fresh,
            });
          }
        );
      },
    });
  };

  // Tolak Setoran Anggota oleh Administrator / Bendahara
  const handleTolakSetoran = (item: KonfirmasiSetoran) => {
    if (item.status !== 'Menunggu') return;
    const namaAnggota = memberNameLookup.get(item.idAnggota) || item.idAnggota;
    const petugas = sessionUser?.nama || 'Admin';

    openConfirm({
      title: 'Tolak Konfirmasi Setoran Anggota?',
      description:
        'Status pengajuan setoran akan diubah menjadi Ditolak tanpa mencatat transaksi ke KasMasuk maupun Angsuran.',
      details: [
        `Anggota: ${namaAnggota}`,
        `Jenis: ${item.jenisSetoran}${item.idPinjaman ? ` (${item.idPinjaman})` : ''}`,
        `Nominal: ${rupiah(item.jumlah)}`,
      ],
      confirmLabel: 'Ya, Tolak Setoran',
      variant: 'danger',
      onConfirm: () =>
        runConfirmedMutation(async () => {
          const token = getActiveSheetToken()!;
          await updateRowValues(
            activeSpreadsheetId,
            token,
            'KonfirmasiSetoran',
            item.rowIndex,
            [
              item.idSetoran,
              item.tanggal,
              item.idAnggota,
              item.jenisSetoran,
              item.idPinjaman,
              item.jumlah,
              item.metodeBayar,
              item.keterangan,
              'Ditolak',
              petugas,
              item.jumlahSimpanan,
              item.jumlahAngsuran,
            ]
          );
        }, `Setoran ${item.idSetoran} dari ${namaAnggota} telah ditolak.`),
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
          const token = getActiveSheetToken()!;
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
    const token = getActiveSheetToken();
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

    const activeToken = getActiveSheetToken();
    const usingPortal = isPortalToken(activeToken);

    if (!usingPortal && passwordLama !== sessionUser.password) {
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
          const token = getActiveSheetToken()!;
          if (isPortalToken(token)) {
            await portalUpdateAccount(activeSpreadsheetId, token, {
              oldPassword: passwordLama,
              newUsername: usernameBaru.trim(),
              newPassword: passwordBaru.trim(),
            });
          } else {
            await updateRowValues(activeSpreadsheetId, token, 'Users', sessionUser.rowIndex, [
              usernameBaru.trim(),
              passwordBaru.trim(),
              sessionUser.nama,
              sessionUser.role,
              sessionUser.status,
              sessionUser.idAnggota,
            ]);
          }
          setPasswordLama('');
          setPasswordBaru('');
          clearSavedAppSession();
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

  const pendingSetoranItems = useMemo(
    () =>
      (dataset?.konfirmasiSetoran || [])
        .filter((k) => k.status === 'Menunggu')
        .slice()
        .reverse(),
    [dataset]
  );

  const pendingSetoranCount = pendingSetoranItems.length;

  const myPendingSetoranCount = useMemo(() => {
    if (!sessionUser?.idAnggota) return 0;
    return (dataset?.konfirmasiSetoran || []).filter(
      (k) => k.idAnggota === sessionUser.idAnggota && k.status === 'Menunggu'
    ).length;
  }, [dataset, sessionUser]);

  // Menu items based on role
  const navItems = useMemo(() => {
    if (!sessionUser) return [];
    const role = sessionUser.role;
    const all: Array<{
      id: PageId;
      label: string;
      icon: React.ReactNode;
      roles: string[];
      badgeCount?: number;
    }> = [
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
        id: 'setorSaya',
        label: 'Setor Iuran & Angsuran',
        icon: <ClipboardCheck className="h-4 w-4" />,
        roles: ['Anggota'],
        badgeCount: myPendingSetoranCount,
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
        id: 'konfirmasiSetoran',
        label: 'Konfirmasi Setoran',
        icon: <ClipboardCheck className="h-4 w-4" />,
        roles: ['Administrator', 'Bendahara'],
        badgeCount: pendingSetoranCount,
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
        id: 'knowledge',
        label: 'Knowledge & Panduan',
        icon: <BookOpen className="h-4 w-4" />,
        roles: ['Administrator', 'Bendahara', 'Anggota'],
      },
      {
        id: 'pengaturan',
        label: 'Pengaturan & Akun',
        icon: <Settings className="h-4 w-4" />,
        roles: ['Administrator', 'Bendahara', 'Anggota'],
      },
    ];
    return all.filter((item) => item.roles.includes(role));
  }, [sessionUser, pendingSetoranCount, myPendingSetoranCount]);

  const currentNavLabel =
    navItems.find((i) => i.id === activePage)?.label || 'Sistem Keuangan';

  const canQuickRecord =
    sessionUser?.role === 'Administrator' || sessionUser?.role === 'Bendahara';

  const defaultQuickTab: QuickRecordTab =
    activePage === 'kasKeluar'
      ? 'pengeluaran'
      : activePage === 'angsuran'
        ? 'angsuran'
        : activePage === 'pinjaman'
          ? 'pinjaman'
          : 'pemasukan';

  // Render AuthGate when not authenticated in both Google & App role
  if (needsGoogleAuth || !dataset || !sessionUser) {
    return (
      <>
        <AuthGate
          googleUser={googleUser}
          needsGoogleAuth={needsGoogleAuth}
          isGoogleSigningIn={isGoogleSigningIn}
          serviceAccountConfigured={serviceAccountConfigured}
          isPortalSubmitting={isPortalSubmitting}
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
          onPortalLogin={handlePortalLogin}
          onRegisterMember={handleRegisterMember}
          onPortalRegister={handlePortalRegister}
          loginError={loginError}
        />

        <ConfirmActionModal
          state={confirmState}
          isSubmitting={isMutating}
          onClose={closeConfirm}
        />

        <OfflineIndicator />

        {toast && (
          <div className="fixed right-5 bottom-5 z-50 flex max-w-sm items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg">
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            )}
            <p
              className={`font-medium ${
                toast.type === 'success' ? 'text-slate-900' : 'text-red-700'
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
    <div className="flex min-h-screen bg-[#F4F6F3] text-slate-900">
      {/* Sidebar Desktop - Hover Expandable Push Rail (KSP SENTRA Forest Green) */}
      <aside className="group/sidebar no-print sticky top-0 z-30 hidden h-screen w-[74px] shrink-0 flex-col overflow-hidden border-r border-[#0D3015] bg-gradient-to-b from-[#103D1B] via-[#1B5727] to-[#1E5B2A] text-emerald-50 transition-[width] duration-200 ease-out hover:w-64 focus-within:w-64 lg:flex">
          <div className="shrink-0 border-b border-white/12 px-[14px] py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-300/50 bg-[#F7F5EE] p-0.5 shadow-xs">
                <img
                  src="/assets/aistudio/image_1d167c98.png"
                  alt="Logo KSP SENTRA"
                  className="h-full w-full rounded-lg object-cover"
                />
              </div>
              <div className="min-w-0 overflow-hidden opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
                <p className="font-editorial truncate whitespace-nowrap text-base font-bold tracking-tight text-white">
                  KSP SENTRA
                </p>
                <p className="truncate whitespace-nowrap text-[11px] font-medium text-emerald-100/85">
                  Bersama Membangun Umat
                </p>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-b border-white/12 bg-white/5 px-[16px] py-3">
            <div className="flex items-center gap-3">
              <span
                title={`${sessionUser.nama} (${sessionUser.role})`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-white/12 text-xs font-extrabold tracking-wide text-amber-300"
              >
                {sessionUser.nama
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() || '')
                  .join('') || 'KS'}
              </span>
              <div className="min-w-0 overflow-hidden opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
                <p className="truncate whitespace-nowrap text-[10px] font-semibold tracking-[0.12em] text-emerald-100/75 uppercase">
                  {sessionUser.role}
                </p>
                <p className="truncate whitespace-nowrap text-sm font-bold text-white">
                  {sessionUser.nama}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-hidden overflow-y-auto">
            <nav className="space-y-1 p-3">
              {navItems.map((item) => {
                const isActive = activePage === item.id;
                const hasBadge = typeof item.badgeCount === 'number' && item.badgeCount > 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => setActivePage(item.id)}
                    className={`flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? 'border border-white/18 bg-white/15 text-white shadow-xs'
                        : 'border border-transparent text-emerald-100/80 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`relative flex h-5 w-6 shrink-0 items-center justify-center ${
                          isActive ? 'text-amber-300' : 'text-emerald-200/85'
                        }`}
                      >
                        {item.icon}
                        {hasBadge && (
                          <span className="absolute -top-0.5 right-0 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[#164A21] group-hover/sidebar:hidden group-focus-within/sidebar:hidden" />
                        )}
                      </span>
                      <span className="truncate opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
                        {item.label}
                      </span>
                    </span>
                    {hasBadge && (
                      <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 font-mono text-[11px] font-bold text-[#103D1B] opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
                        {item.badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="mx-3 space-y-1.5 border-t border-white/12 pt-3 pb-4">
              {canQuickRecord && (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka Spreadsheet"
                  aria-label="Buka Spreadsheet"
                  className="flex w-full items-center gap-3 whitespace-nowrap rounded-xl border border-white/18 bg-white/8 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15"
                >
                  <span className="flex h-5 w-6 shrink-0 items-center justify-center">
                    <ExternalLink className="h-4 w-4 text-amber-300" />
                  </span>
                  <span className="truncate opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
                    Buka Spreadsheet
                  </span>
                </a>
              )}
              <button
                type="button"
                title="Keluar Akun"
                aria-label="Keluar Akun"
                onClick={clearSavedAppSession}
                className="flex w-full items-center gap-3 whitespace-nowrap rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-emerald-100/95 transition-colors hover:bg-red-500/20 hover:border-red-300/35 hover:text-white"
              >
                <span className="flex h-5 w-6 shrink-0 items-center justify-center">
                  <LogOut className="h-4 w-4 text-amber-300" />
                </span>
                <span className="truncate opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
                  Keluar Akun
                </span>
              </button>
              <p className="flex items-center gap-2 px-3 pt-1 whitespace-nowrap text-[11px] text-emerald-100/60 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
                <Lock className="h-3 w-3 shrink-0" />
                <span>Sinkronisasi Terenkripsi</span>
              </p>
            </div>
          </div>
      </aside>

      {/* Mobile Bottom Sheet Menu (Native App Feel) */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-end justify-center lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="bg-gradient-to-r from-[#103D1B] via-[#1B5727] to-[#287336] px-5 pt-3 pb-4 text-white">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/30" />
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{sessionUser.nama}</p>
                  <p className="text-[11px] font-medium text-amber-300">
                    {sessionUser.role} · KSP SENTRA
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl bg-white/10 p-1.5 text-emerald-100 hover:bg-white/20"
                  aria-label="Tutup menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4">
              <p className="mb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                Semua Layanan & Fitur
              </p>
              <nav className="grid grid-cols-2 gap-2.5">
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
                      className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left text-xs font-semibold transition-colors ${
                        isActive
                          ? 'border-[#1E5B2A]/30 bg-[#EAF4EC] text-[#1E5B2A]'
                          : 'border-slate-200 bg-[#F8FAF8] text-slate-700 active:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          isActive
                            ? 'bg-[#1E5B2A] text-white'
                            : 'bg-white text-[#1E5B2A] shadow-2xs'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="line-clamp-2 flex-1">{item.label}</span>
                      {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                          {item.badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div
                className={`mt-4 grid gap-2.5 border-t border-slate-100 pt-4 ${
                  canQuickRecord ? 'grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {canQuickRecord && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-[#1E5B2A]" />
                    Spreadsheet
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    clearSavedAppSession();
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2.5 text-xs font-semibold text-red-700 active:bg-red-100"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Keluar Akun
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Native Forest Green Mobile App Header */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-r from-[#103D1B] via-[#1B5727] to-[#287336] px-4 py-3 text-white shadow-sm lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-300/45 bg-[#F7F5EE] p-0.5">
              <img
                src="/assets/aistudio/image_1d167c98.png"
                alt="Logo KSP SENTRA"
                className="h-full w-full rounded-lg object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-tight text-white">
                {currentNavLabel}
              </h1>
              <p className="truncate text-[11px] text-emerald-100/85">
                {sessionUser.nama} · <span className="text-amber-300">{sessionUser.role}</span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!canQuickRecord && (
              <button
                type="button"
                onClick={() => setActivePage('knowledge')}
                aria-label="Knowledge & Panduan"
                title="Knowledge & Panduan"
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                  activePage === 'knowledge'
                    ? 'border-amber-300 bg-white/25 text-amber-200'
                    : 'border-white/20 bg-white/10 text-amber-300 active:bg-white/20'
                }`}
              >
                <BookOpen className="h-4 w-4" />
              </button>
            )}
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => refreshDataset()}
              disabled={isLoadingSheet}
              aria-label="Sinkronkan Sheet"
              title="Sinkronkan Sheet"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white active:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingSheet ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={clearSavedAppSession}
              aria-label="Keluar Akun"
              title="Keluar Akun"
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 active:bg-white/25"
            >
              <LogOut className="h-4 w-4 text-amber-300" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Desktop Top Bar */}
        <header className="no-print sticky top-0 z-30 hidden items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-7 py-3.5 backdrop-blur-md lg:flex">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-bold tracking-wide text-[#1E5B2A] uppercase">
                KSP SENTRA
              </span>
              <span className="text-slate-300">/</span>
              <h1 className="font-editorial truncate text-lg font-bold tracking-tight text-slate-900">
                {currentNavLabel}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {canQuickRecord && (
              <button
                type="button"
                onClick={() => setQuickRecordOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#1E5B2A] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#154620]"
              >
                <Plus className="h-3.5 w-3.5" />
                Catat
              </button>
            )}
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => refreshDataset()}
              disabled={isLoadingSheet}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-[#1E5B2A]/40 hover:bg-slate-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-[#1E5B2A] ${isLoadingSheet ? 'animate-spin' : ''}`}
              />
              Sinkronkan Sheet
            </button>
          </div>
        </header>

        {/* Viewport */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-24 sm:px-5 lg:p-7">
          {canQuickRecord &&
            pendingSetoranCount > 0 &&
            activePage !== 'konfirmasiSetoran' &&
            (activePage === 'dashboard' || activePage === 'kasMasuk' || activePage === 'angsuran') && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/90 bg-amber-50 px-4 py-3.5 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                    <Clock className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-amber-950">
                      {pendingSetoranCount} Konfirmasi Setoran Anggota Menunggu Persetujuan
                    </p>
                    <p className="text-xs text-amber-800">
                      Setoran iuran / angsuran dari anggota belum masuk kas sebelum dikonfirmasi.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePage('konfirmasiSetoran')}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#1E5B2A] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#154620]"
                >
                  <ClipboardCheck className="h-4 w-4 text-amber-300" />
                  Tinjau Konfirmasi ({pendingSetoranCount}) →
                </button>
              </div>
            )}

          {activePage === 'dashboard' && adminMetrics && (
            <div className="space-y-6">
              {/* Primary Rekening Card + 3 KPI Cards */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#103D1B] via-[#1B5727] to-[#287336] p-6 text-white shadow-sm lg:col-span-5">
                  <div
                    className="pointer-events-none absolute -top-12 -right-10 h-44 w-44 rounded-full bg-white/6"
                    aria-hidden="true"
                  />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-bold tracking-[0.14em] text-amber-300 uppercase">
                        Rekening Kas KSP SENTRA
                      </p>
                      <button
                        type="button"
                        onClick={() => setHideBalance((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-50 transition-colors hover:bg-white/20"
                        aria-label={hideBalance ? 'Tampilkan nominal saldo' : 'Sembunyikan nominal saldo'}
                      >
                        {hideBalance ? (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            Tampilkan
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5" />
                            Sembunyikan
                          </>
                        )}
                      </button>
                    </div>

                    <p className="mt-1.5 font-mono text-[11px] text-emerald-100/80">
                      Buku Besar ID: {activeSpreadsheetId.slice(0, 12)}···
                    </p>

                    <p className="mt-3 font-mono text-3xl font-bold tracking-tight tabular-nums text-white sm:text-4xl">
                      {hideBalance ? 'Rp ••••••••' : rupiah(adminMetrics.saldo)}
                    </p>
                    <p className="mt-1 text-xs text-emerald-100/80">
                      Saldo Kas Bersih Tersedia
                    </p>
                  </div>

                  <div className="relative mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
                    <div>
                      <p className="text-[11px] font-medium text-emerald-100/75">
                        Dana Masuk (Kredit)
                      </p>
                      <p className="mt-1 font-mono text-sm font-bold tabular-nums text-emerald-300 sm:text-base">
                        {hideBalance ? 'Rp ••••••' : `+ ${rupiah(adminMetrics.masuk)}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-emerald-100/75">
                        Dana Keluar (Debit)
                      </p>
                      <p className="mt-1 font-mono text-sm font-bold tabular-nums text-amber-300 sm:text-base">
                        {hideBalance ? 'Rp ••••••' : `- ${rupiah(adminMetrics.keluar)}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-7">
                  <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Anggota Aktif</p>
                      <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#1E5B2A]">
                        {adminMetrics.anggotaAktif}
                      </p>
                    </div>
                    <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 sm:text-xs">
                      Total {adminMetrics.anggotaTotal} terdaftar
                    </p>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        Menunggu ACC
                      </p>
                      <p
                        className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
                          pendingSetoranCount + adminMetrics.pinjamanStatusCounts.Menunggu > 0
                            ? 'text-amber-600'
                            : 'text-slate-900'
                        }`}
                      >
                        {pendingSetoranCount + adminMetrics.pinjamanStatusCounts.Menunggu}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Setoran: <strong className="text-slate-800">{pendingSetoranCount}</strong> · Pinjaman:{' '}
                        <strong className="text-slate-800">{adminMetrics.pinjamanStatusCounts.Menunggu}</strong>
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2.5 text-[11px] font-semibold sm:text-xs">
                      <button
                        type="button"
                        onClick={() => setActivePage('konfirmasiSetoran')}
                        className="text-[#1E5B2A] hover:underline"
                      >
                        ACC Setoran →
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePage('pinjaman')}
                        className="text-slate-600 hover:text-[#1E5B2A] hover:underline"
                      >
                        Pinjaman →
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2 flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:col-span-1 sm:p-5">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        Total Piutang Pinjaman
                      </p>
                      <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-amber-600">
                        {hideBalance ? 'Rp ••••••' : rupiah(adminMetrics.piutang)}
                      </p>
                    </div>
                    <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 sm:text-xs">
                      {adminMetrics.pinjamanStatusCounts.Berjalan} fasilitas berjalan
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu Cepat 3-col mobile shortcuts */}
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
                {[
                  {
                    page: 'konfirmasiSetoran' as PageId,
                    label: 'ACC Setoran',
                    icon: <ClipboardCheck className="h-5 w-5" />,
                    badge: pendingSetoranCount,
                  },
                  {
                    page: 'kasMasuk' as PageId,
                    label: 'Kas Masuk',
                    icon: <ArrowDownLeft className="h-5 w-5" />,
                    badge: 0,
                  },
                  {
                    page: 'kasKeluar' as PageId,
                    label: 'Kas Keluar',
                    icon: <ArrowUpRight className="h-5 w-5" />,
                    badge: 0,
                  },
                  {
                    page: 'pinjaman' as PageId,
                    label: 'Pinjaman',
                    icon: <CreditCard className="h-5 w-5" />,
                    badge: adminMetrics.pinjamanStatusCounts.Menunggu,
                  },
                  {
                    page: 'angsuran' as PageId,
                    label: 'Angsuran',
                    icon: <FileSpreadsheet className="h-5 w-5" />,
                    badge: 0,
                  },
                  {
                    page: 'laporan' as PageId,
                    label: 'Laporan & WA',
                    icon: <BarChart3 className="h-5 w-5" />,
                    badge: 0,
                  },
                  {
                    page: 'anggota' as PageId,
                    label: 'Anggota',
                    icon: <Users className="h-5 w-5" />,
                    badge: 0,
                  },
                ].map((item) => (
                  <button
                    key={item.page}
                    type="button"
                    onClick={() => setActivePage(item.page)}
                    className="group relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-2 py-3.5 text-center shadow-xs transition-all active:scale-[0.98] hover:border-[#1E5B2A]/45 hover:bg-[#F4FAF5]"
                  >
                    {item.badge > 0 && (
                      <span className="absolute top-2 right-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                        {item.badge}
                      </span>
                    )}
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF4EC] text-[#1E5B2A] transition-colors group-hover:bg-[#1E5B2A] group-hover:text-white">
                      {item.icon}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-800 sm:text-xs">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Antrean ACC Setoran & Angsuran Anggota Langsung di Ringkasan Keuangan */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        pendingSetoranItems.length > 0
                          ? 'bg-amber-500 text-white'
                          : 'bg-[#EAF4EC] text-[#1E5B2A]'
                      }`}
                    >
                      <ClipboardCheck className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-editorial text-base font-bold text-slate-900 sm:text-lg">
                        Antrean ACC Setoran &amp; Angsuran Anggota
                      </h3>
                      <p className="text-xs text-slate-500">
                        {pendingSetoranItems.length > 0
                          ? `${pendingSetoranItems.length} pengajuan transfer dari anggota menunggu konfirmasi langsung Anda.`
                          : 'Belum ada setoran baru dari anggota yang menunggu ACC saat ini.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePage('konfirmasiSetoran')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-[#1E5B2A]/40 hover:bg-[#F4FAF5] hover:text-[#1E5B2A]"
                  >
                    Kelola Semua ACC Setoran →
                  </button>
                </div>

                {pendingSetoranItems.length > 0 && (
                  <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-amber-200/80 bg-amber-50/35">
                    {pendingSetoranItems.slice(0, 5).map((item) => {
                      const namaAnggota = memberNameLookup.get(item.idAnggota) || item.idAnggota;
                      return (
                        <div
                          key={item.idSetoran}
                          className="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center sm:px-4"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">
                                {namaAnggota}
                              </span>
                              <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                                {item.jenisSetoran === 'Gabungan'
                                  ? `Gabungan (${item.idPinjaman})`
                                  : item.jenisSetoran === 'Angsuran'
                                    ? `Angsuran (${item.idPinjaman})`
                                    : 'Iuran / Simpanan'}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {formatTanggalId(item.tanggal)} · {item.metodeBayar}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              <strong className="font-mono text-[#1E5B2A]">
                                {rupiah(item.jumlah)}
                              </strong>
                              {item.jenisSetoran === 'Gabungan' && (
                                <span className="ml-2 text-slate-500">
                                  (Simpanan {rupiah(item.jumlahSimpanan)} + Angsuran{' '}
                                  {rupiah(item.jumlahAngsuran)})
                                </span>
                              )}
                              {item.keterangan && (
                                <span className="ml-2 text-slate-500">· {item.keterangan}</span>
                              )}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleKonfirmasiSetoran(item)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E5B2A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#154620]"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              ACC
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTolakSetoran(item)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Tolak
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Chart & Status Pinjaman */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <CashflowChart series={cashflowSeries} />
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-4">
                  <div>
                    <h3 className="font-editorial text-lg font-bold text-slate-900">
                      Status Fasilitas Pinjaman
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Ringkasan pengajuan serta aksi rekap akhir bulan.
                    </p>

                    <dl className="mt-5 divide-y divide-slate-100 text-sm">
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-slate-600">Menunggu ACC</dt>
                        <dd className="font-mono font-semibold tabular-nums text-amber-600">
                          {adminMetrics.pinjamanStatusCounts.Menunggu}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-slate-600">Pinjaman Berjalan</dt>
                        <dd className="font-mono font-semibold tabular-nums text-[#1E5B2A]">
                          {adminMetrics.pinjamanStatusCounts.Berjalan}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-slate-600">Lunas</dt>
                        <dd className="font-mono font-semibold tabular-nums text-emerald-700">
                          {adminMetrics.pinjamanStatusCounts.Lunas}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-slate-600">Ditolak</dt>
                        <dd className="font-mono font-semibold tabular-nums text-slate-500">
                          {adminMetrics.pinjamanStatusCounts.Ditolak}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActivePage('laporan')}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E5B2A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#154620]"
                  >
                    <BarChart3 className="h-4 w-4 text-amber-300" />
                    Buka Laporan Bulanan & WA
                  </button>
                </div>
              </div>

              {/* Ringkasan Anggota Table */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-editorial text-lg font-bold text-slate-900">
                      Mutasi & Posisi Rekening Anggota
                    </h3>
                    <p className="text-xs text-slate-500">
                      Akumulasi simpanan, sisa pinjaman, dan saldo bersih setiap anggota.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        const img = generateRingkasanSaldoImage(dataset, {
                          subtitle: 'Update Posisi Kas & Rincian Keuangan Anggota',
                        });
                        const lines = [
                          `*UPDATE SALDO & REKAP ANGGOTA*`,
                          `_${dataset.spreadsheetTitle || 'KSP SENTRA'}_`,
                          `--------------------------------`,
                          `• *Saldo Kas Saat Ini:* *${rupiah(adminMetrics.saldo)}*`,
                          `• *Total Kas Masuk:* ${rupiah(adminMetrics.masuk)}`,
                          `• *Total Kas Keluar:* ${rupiah(adminMetrics.keluar)}`,
                          `• *Piutang Pinjaman:* ${rupiah(adminMetrics.piutang)}`,
                          `• *Anggota Aktif:* ${adminMetrics.anggotaAktif} orang`,
                          `--------------------------------`,
                          `_Rincian masing-masing anggota (Total Saldo, Pinjaman, Saldo Saat Ini) terlampir pada gambar._`,
                        ];
                        setWaShareModal({
                          title: 'Bagikan Rincian Saldo & Anggota ke Grup',
                          message: lines.join('\n'),
                          image: img,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Bagikan Saldo & Gambar
                    </button>
                    <div className="relative w-full sm:w-64">
                      <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Cari nama atau ID anggota..."
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Mobile Member Summary Cards (md:hidden) */}
                <div className="space-y-3 md:hidden">
                  {filteredMemberSummaries.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                      Tidak ada data anggota.
                    </div>
                  ) : (
                    filteredMemberSummaries.map((m) => (
                      <div
                        key={m.idAnggota}
                        className="rounded-xl border border-slate-200 bg-[#F8FAF8] p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900">{m.nama}</p>
                            <p className="text-[11px] text-slate-500">
                              {m.status} · Sisa {m.totalSisaAngsuran}x angsuran
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-bold tabular-nums ${
                              m.saldoAnggotaSaatIni < 0
                                ? 'bg-red-50 text-red-600'
                                : 'bg-[#EAF4EC] text-[#1E5B2A]'
                            }`}
                          >
                            {rupiah(m.saldoAnggotaSaatIni)}
                          </span>
                        </div>
                        <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-lg bg-white p-2.5 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500">Total Simpanan</span>
                            <p className="font-mono font-semibold text-emerald-700">
                              {rupiah(m.totalSimpanan)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500">Sisa Pinjaman</span>
                            <p className="font-mono font-semibold text-amber-600">
                              {rupiah(m.totalSisaPinjaman)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
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
                    <tbody className="divide-y divide-slate-100">
                      {filteredMemberSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-sm text-slate-400">
                            Tidak ada data anggota.
                          </td>
                        </tr>
                      ) : (
                        filteredMemberSummaries.map((m) => (
                          <tr key={m.idAnggota} className="hover:bg-[#F4FAF5]">
                            <td className="py-3 pr-3 font-mono text-xs text-slate-500">
                              {m.idAnggota}
                            </td>
                            <td className="py-3 pr-3 font-semibold text-slate-900">{m.nama}</td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-emerald-700">
                              {rupiah(m.totalSimpanan)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-amber-600">
                              {rupiah(m.totalSisaPinjaman)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-[#1E5B2A]">
                              {rupiah(m.saldoAnggotaSaatIni)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-slate-600">
                              {rupiah(m.totalPinjaman)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-slate-600">
                              {rupiah(m.totalDibayar)}
                            </td>
                            <td className="py-3 text-right font-mono text-xs tabular-nums text-slate-700">
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
            <KasMasukView
              dataset={dataset}
              onSaveKasMasuk={handleSaveKasMasuk}
              onUpdateKasMasuk={handleUpdateKasMasuk}
              onDeleteKasMasuk={handleDeleteKasMasuk}
            />
          )}

          {activePage === 'kasKeluar' && (
            <KasKeluarView
              dataset={dataset}
              onSaveKasKeluar={handleSaveKasKeluar}
              onUpdateKasKeluar={handleUpdateKasKeluar}
              onDeleteKasKeluar={handleDeleteKasKeluar}
            />
          )}

          {activePage === 'pinjaman' && (
            <PinjamanAndAccView
              dataset={dataset}
              role={sessionUser.role}
              onSavePinjaman={handleSavePinjaman}
              onAccPinjaman={handleAccPinjaman}
              onTolakPinjaman={handleTolakPinjaman}
              onUpdatePinjaman={handleUpdatePinjaman}
              onDeletePinjaman={handleDeletePinjaman}
            />
          )}

          {activePage === 'angsuran' && (
            <AngsuranAndTunggakanView
              dataset={dataset}
              onSaveAngsuran={handleSaveAngsuran}
              onUpdateAngsuran={handleUpdateAngsuran}
              onDeleteAngsuran={handleDeleteAngsuran}
              onShowKwitansi={setKwitansiModalData}
            />
          )}

          {activePage === 'konfirmasiSetoran' && canQuickRecord && (
            <KonfirmasiSetoranView
              dataset={dataset}
              onKonfirmasiSetoran={handleKonfirmasiSetoran}
              onTolakSetoran={handleTolakSetoran}
            />
          )}

          {activePage === 'setorSaya' && (
            <SetorAnggotaView
              dataset={dataset}
              idAnggota={sessionUser.idAnggota}
              onAjukanSetoran={handleAjukanSetoranAnggota}
            />
          )}

          {activePage === 'anggotaSaya' && anggotaMetrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#103D1B] via-[#1B5727] to-[#287336] p-6 text-white shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold tracking-[0.14em] text-amber-300 uppercase">
                      Rekening Anggota KSP SENTRA
                    </p>
                    <button
                      type="button"
                      onClick={() => setHideBalance((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-50 transition-colors hover:bg-white/20"
                      aria-label={hideBalance ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
                    >
                      {hideBalance ? (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          Tampilkan
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Sembunyikan
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-emerald-100/80">Saldo Bersih Anda Saat Ini</p>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">
                    {hideBalance ? 'Rp ••••••••' : rupiah(anggotaMetrics.saldoAnggotaSaatIni)}
                  </p>
                  <p className="mt-4 border-t border-white/15 pt-3 text-xs text-emerald-100/85">
                    Sisa pinjaman aktif:{' '}
                    {hideBalance ? 'Rp ••••••' : rupiah(anggotaMetrics.totalSisaPinjaman)}
                  </p>
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Total Simpanan Saya</p>
                    <p className="mt-2.5 font-mono text-2xl font-bold tabular-nums text-emerald-700">
                      {hideBalance ? 'Rp ••••••' : rupiah(anggotaMetrics.simpananSaya)}
                    </p>
                  </div>
                  <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    Kekurangan target iuran:{' '}
                    {hideBalance ? 'Rp ••••••' : rupiah(anggotaMetrics.kekuranganIuran)}
                  </p>
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Total Saldo Kelompok</p>
                    <p className="mt-2.5 font-mono text-2xl font-bold tabular-nums text-[#1E5B2A]">
                      {hideBalance ? 'Rp ••••••' : rupiah(anggotaMetrics.saldoKelompok)}
                    </p>
                  </div>
                  <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    Akumulasi kas seluruh anggota kelompok
                  </p>
                </div>
              </div>

              {myPendingSetoranCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-xs">
                  <div className="flex items-center gap-2.5 text-amber-900">
                    <Clock className="h-4 w-4 shrink-0 text-amber-700" />
                    <span>
                      Anda memiliki <strong>{myPendingSetoranCount} pengajuan setoran</strong> yang sedang menunggu konfirmasi Admin/Bendahara.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePage('setorSaya')}
                    className="font-semibold text-[#1E5B2A] hover:underline"
                  >
                    Lihat Status →
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setActivePage('setorSaya')}
                  className="group flex items-center gap-3 rounded-2xl border border-emerald-200 bg-[#EAF4EC]/60 p-4 text-left shadow-xs transition-all hover:border-[#1E5B2A]/45 hover:bg-[#EAF4EC]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E5B2A] text-white">
                    <ClipboardCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Setor Iuran / Angsuran</p>
                    <p className="text-xs text-slate-600">Kirim konfirmasi bayar ke pengurus</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePage('ajukanPinjaman')}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-xs transition-all hover:border-[#1E5B2A]/45 hover:bg-[#F4FAF5]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EC] text-[#1E5B2A] group-hover:bg-[#1E5B2A] group-hover:text-white">
                    <CreditCard className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Ajukan Pinjaman</p>
                    <p className="text-xs text-slate-500">Kirim pengajuan baru ke pengurus</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePage('laporan')}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-xs transition-all hover:border-[#1E5B2A]/45 hover:bg-[#F4FAF5]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EC] text-[#1E5B2A] group-hover:bg-[#1E5B2A] group-hover:text-white">
                    <BarChart3 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Laporan Bulanan</p>
                    <p className="text-xs text-slate-500">Lihat transparansi kas kelompok</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePage('pengaturan')}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-xs transition-all hover:border-[#1E5B2A]/45 hover:bg-[#F4FAF5]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EC] text-[#1E5B2A] group-hover:bg-[#1E5B2A] group-hover:text-white">
                    <Settings className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Pengaturan Akun</p>
                    <p className="text-xs text-slate-500">Ubah username atau password</p>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActivePage('knowledge')}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-white p-4 text-left shadow-xs transition-all hover:border-[#1E5B2A]/45 hover:bg-[#F4FAF5]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EC] text-[#1E5B2A]">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Knowledge &amp; Video Panduan Aplikasi
                    </p>
                    <p className="text-xs text-slate-500">
                      Video cara setor, ajukan pinjaman &amp; cara instal aplikasi di HP/PC
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-xl bg-[#EAF4EC] px-3 py-1.5 text-xs font-bold text-[#1E5B2A]">
                  Buka →
                </span>
              </button>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6">
                <h3 className="font-editorial mb-4 text-lg font-bold text-slate-900">
                  Fasilitas Pinjaman Saya
                </h3>

                {/* Mobile Cards */}
                <div className="space-y-3 md:hidden">
                  {anggotaMetrics.pinjamanSaya.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                      Anda tidak memiliki catatan pinjaman.
                    </div>
                  ) : (
                    anggotaMetrics.pinjamanSaya.map((p) => (
                      <div
                        key={p.idPinjaman}
                        className="rounded-xl border border-slate-200 bg-[#F8FAF8] p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900">{rupiah(p.jumlah)}</p>
                            <p className="text-[11px] text-slate-500">
                              {formatTanggalId(p.tanggal)}
                            </p>
                          </div>
                          <span className="rounded-full bg-[#EAF4EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#1E5B2A]">
                            {p.status}
                          </span>
                        </div>
                        <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-lg bg-white p-2.5 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500">Dibayar</span>
                            <p className="font-mono font-semibold text-emerald-700">
                              {rupiah(p.totalDibayar)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500">Sisa</span>
                            <p className="font-mono font-bold text-[#1E5B2A]">
                              {rupiah(p.sisa)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                        <th className="py-2.5 pr-3">ID Pinjaman</th>
                        <th className="py-2.5 pr-3">Tanggal</th>
                        <th className="py-2.5 pr-3 text-right">Jumlah</th>
                        <th className="py-2.5 pr-3 text-right">Total Dibayar</th>
                        <th className="py-2.5 pr-3 text-right">Sisa</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {anggotaMetrics.pinjamanSaya.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                            Anda tidak memiliki catatan pinjaman.
                          </td>
                        </tr>
                      ) : (
                        anggotaMetrics.pinjamanSaya.map((p) => (
                          <tr key={p.idPinjaman} className="hover:bg-[#F4FAF5]">
                            <td className="py-3 pr-3 font-mono text-xs text-slate-600">
                              {p.idPinjaman}
                            </td>
                            <td className="py-3 pr-3 text-xs text-slate-500">
                              {formatTanggalId(p.tanggal)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-slate-900">
                              {rupiah(p.jumlah)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono tabular-nums text-emerald-700">
                              {rupiah(p.totalDibayar)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono font-semibold tabular-nums text-[#1E5B2A]">
                              {rupiah(p.sisa)}
                            </td>
                            <td className="py-3 text-xs font-semibold text-slate-800">
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
            <div className="max-w-lg rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
              <div>
                <h3 className="font-editorial text-lg font-bold text-slate-900">
                  Form Pengajuan Pinjaman Anggota
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Pengajuan akan masuk ke antrean Administrator untuk disetujui (ACC) atau ditolak.
                </p>
              </div>

              <form onSubmit={handleAjukanPinjamanAnggota} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Jumlah Pinjaman (Rp)
                  </label>
                  <CurrencyInput
                    required
                    value={ajuJumlah}
                    onValueChange={(digits) => setAjuJumlah(digits)}
                    placeholder="1.000.000"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tenor (Jumlah Bulan Angsuran)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={ajuTenor}
                    onChange={(e) => setAjuTenor(e.target.value)}
                    placeholder="10"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900"
                  />
                </div>

                {Number(ajuJumlah) > 0 && Number(ajuTenor) > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-[#EAF4EC] px-3.5 py-2.5 text-xs">
                    <span className="font-medium text-slate-700">Estimasi Angsuran/Bulan</span>
                    <span className="font-mono font-bold tabular-nums text-[#1E5B2A]">
                      {rupiah(Number(ajuJumlah) / Number(ajuTenor))}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#1E5B2A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#154620]"
                >
                  Kirim Pengajuan Pinjaman
                </button>
              </form>
            </div>
          )}

          {activePage === 'knowledge' && (
            <KnowledgeView onOpenVideo={openVideoPanduan} onNotify={showToast} />
          )}

          {activePage === 'pengaturan' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6 lg:col-span-12">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold tracking-wider text-[#1E5B2A] uppercase">
                    Sesi Login Aktif
                  </p>
                  <p className="mt-0.5 truncate text-base font-bold text-slate-900">
                    {sessionUser.nama}{' '}
                    <span className="ml-1.5 inline-flex rounded-full bg-[#EAF4EC] px-2.5 py-0.5 text-xs font-semibold text-[#1E5B2A]">
                      {sessionUser.role}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Username: <span className="font-mono text-slate-700">{sessionUser.username}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearSavedAppSession}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 active:bg-red-200"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar Akun (Logout)
                </button>
              </div>

              <div
                className={`rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs ${
                  canQuickRecord ? 'lg:col-span-6' : 'lg:col-span-12'
                }`}
              >
                <h3 className="font-editorial text-lg font-bold text-slate-900">
                  Ubah Username & Password Akun
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Mengubah kredensial akun yang sedang login pada sistem.
                </p>

                <form onSubmit={handleUpdateAkun} className="mt-4 space-y-3.5">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Username Baru
                    </label>
                    <input
                      type="text"
                      required
                      value={usernameBaru}
                      onChange={(e) => setUsernameBaru(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Password Lama
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordLama}
                      onChange={(e) => setPasswordLama(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Password Baru
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordBaru}
                      onChange={(e) => setPasswordBaru(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#1E5B2A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#154620]"
                  >
                    Simpan Perubahan Akun
                  </button>
                </form>
              </div>

              {canQuickRecord && (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-6">
                  <h3 className="font-editorial text-lg font-bold text-slate-900">
                    Koneksi Spreadsheet Database
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Spreadsheet aktif yang terhubung ke sistem keuangan ini.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Tautan / ID Spreadsheet
                      </label>
                      <input
                        type="text"
                        value={spreadsheetInput}
                        onChange={(e) => setSpreadsheetInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => refreshDataset()}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Muat Ulang Data
                      </button>
                      {sessionUser.role === 'Administrator' && (
                        <button
                          type="button"
                          onClick={handleRequestSetupDatabase}
                          className="rounded-xl bg-[#1E5B2A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#154620]"
                        >
                          Verifikasi & Setup Tab Sheet
                        </button>
                      )}
                    </div>
                    <div className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                      Tab terdeteksi:{' '}
                      <span className="font-mono text-slate-700">
                        {dataset.availableTabs.join(', ') || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {sessionUser.role === 'Administrator' && (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-12">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EC] text-[#1E5B2A]">
                        <ShieldCheck className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="font-editorial text-lg font-bold text-slate-900">
                          Akses Login Anggota &amp; Solusi Error 403 Google
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Pengaturan agar seluruh anggota dapat membuka aplikasi dari HP masing-masing tanpa terblokir verifikasi Google.
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                        serviceAccountConfigured
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {serviceAccountConfigured
                        ? 'Portal Tanpa Login Google: Aktif'
                        : 'Mode Login Google (Butuh Test Users)'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-emerald-200/80 bg-[#EAF4EC]/55 p-4 text-xs leading-relaxed text-slate-700">
                      <p className="font-bold text-[#1E5B2A]">
                        1. Cara Terbaik: Portal Tanpa Login Google (Disarankan)
                      </p>
                      <p className="mt-1.5">
                        Anggota cukup membuka link web dan langsung masuk pakai{' '}
                        <strong>Username &amp; Password</strong> — tidak perlu klik Google Sign-In,
                        tidak kena <strong>Error 403</strong>, dan tidak perlu diberi akses edit Spreadsheet.
                      </p>
                      <ol className="mt-2 list-decimal space-y-1 pl-4 text-slate-600">
                        <li>
                          Buat 1 <strong>Service Account</strong> di Google Cloud Console &amp; unduh file JSON key-nya.
                        </li>
                        <li>
                          Bagikan Google Spreadsheet kelompok <strong>1 kali saja</strong> ke email bot Service Account sebagai <strong>Editor</strong>.
                        </li>
                        <li>
                          Tambahkan <code className="font-mono text-slate-900">GOOGLE_SERVICE_ACCOUNT_JSON</code> pada Environment Variables Vercel lalu redeploy.
                        </li>
                      </ol>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 text-xs leading-relaxed text-slate-700">
                      <p className="font-bold text-slate-900">
                        2. Cara Cepat Jika Tetap Pakai Login Google (Mengatasi Error 403)
                      </p>
                      <p className="mt-1.5">
                        Error <code className="font-mono text-red-700">403: access_denied</code> muncul karena
                        status <em>OAuth consent screen</em> masih <strong>Testing</strong>.
                      </p>
                      <ol className="mt-2 list-decimal space-y-1 pl-4 text-slate-600">
                        <li>
                          Buka <strong>Google Cloud Console</strong> → <em>APIs &amp; Services</em> →{' '}
                          <em>OAuth consent screen</em>.
                        </li>
                        <li>
                          Pada bagian <strong>Test users</strong>, klik <strong>+ ADD USERS</strong> lalu masukkan email Google anggota (atau klik <strong>Publish App</strong>).
                        </li>
                        <li>
                          Pastikan file Google Spreadsheet juga dibagikan ke email anggota agar bisa membaca data.
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              {(sessionUser.role === 'Administrator' || sessionUser.role === 'Bendahara') && (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-12">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-editorial text-lg font-bold text-slate-900">
                        Notifikasi Otomatis Mutasi ke Grup WhatsApp
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Siapkan atau kirim pesan otomatis ke Grup WhatsApp setiap kali ada{' '}
                        <strong>Kas Masuk</strong>, <strong>Kas Keluar</strong>,{' '}
                        <strong>Pencairan Pinjaman</strong>, atau <strong>Angsuran</strong>.
                      </p>
                    </div>
                    <span className="rounded-lg border border-emerald-200 bg-[#EAF4EC] px-3 py-1.5 text-xs font-semibold text-[#1E5B2A]">
                      {waGatewayStatus.configured
                        ? `Gateway Server Aktif (${waGatewayStatus.provider.toUpperCase()})`
                        : 'Mode 1-Klik Bagikan ke Grup WA'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="space-y-4 lg:col-span-7">
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5">
                        <input
                          type="checkbox"
                          checked={waGroupSettings.enabled}
                          onChange={(e) =>
                            setWaGroupSettings((prev) => ({
                              ...prev,
                              enabled: e.target.checked,
                            }))
                          }
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1E5B2A]"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Aktifkan Notifikasi Grup Setelah Simpan Transaksi
                          </p>
                          <p className="text-xs text-slate-500">
                            Setiap selesai mencatat uang masuk atau keluar, pesan info mutasi + saldo terkini otomatis disiapkan/dikirim ke Grup WA.
                          </p>
                        </div>
                      </label>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">
                          ID Grup WhatsApp / Telegram (Opsional — khusus Auto-Kirim Tanpa Klik)
                        </label>
                        <input
                          type="text"
                          value={waGroupSettings.groupId}
                          onChange={(e) =>
                            setWaGroupSettings((prev) => ({
                              ...prev,
                              groupId: e.target.value,
                            }))
                          }
                          placeholder={
                            waGatewayStatus.hasDefaultGroup
                              ? 'Kosongkan untuk pakai ID default server, atau isi ID Grup'
                              : 'WA: 120363xxxx@g.us · Telegram: -100xxxxxxxxxx'
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
                        />
                      </div>

                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5">
                        <input
                          type="checkbox"
                          checked={waGroupSettings.autoSendGateway}
                          onChange={(e) =>
                            setWaGroupSettings((prev) => ({
                              ...prev,
                              autoSendGateway: e.target.checked,
                            }))
                          }
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1E5B2A]"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Kirim Otomatis via Gateway Server (Jika Terpasang)
                          </p>
                          <p className="text-xs text-slate-500">
                            Jika token Telegram/Fonnte/Wablas/Webhook & ID Grup aktif, pesan langsung masuk ke grup tanpa perlu klik. Jika belum, otomatis memakai pop-up <strong>Bagikan ke Grup WA</strong>.
                          </p>
                        </div>
                      </label>

                      <div className="flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            const sampleMsg = buildWhatsAppMutasiGroupMessage({
                              arah: 'MASUK',
                              jenis: 'Simpanan Wajib (Uji Coba)',
                              jumlah: 100000,
                              saldoSetelahMutasi: adminMetrics?.saldo || 0,
                              tanggal: nowIsoShort(),
                              anggotaNama: 'Contoh Anggota',
                              keterangan: 'Tes notifikasi otomatis grup WhatsApp',
                              petugas: sessionUser.nama,
                              namaKelompok: dataset.spreadsheetTitle,
                            });
                            const sampleImg = generateRingkasanSaldoImage(dataset, {
                              highlightText: '+ Rp 100.000 · Simpanan Wajib (Uji Coba)',
                              highlightTone: 'credit',
                              subtitle: 'Pratinjau Gambar Rincian Saldo & Anggota',
                            });
                            setWaShareModal({
                              title: 'Uji Coba Pesan & Gambar Grup WA',
                              message: sampleMsg,
                              image: sampleImg,
                            });
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#1E5B2A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#154620]"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Uji Coba Pesan Grup
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-[#EAF4EC]/65 p-4 text-xs leading-relaxed text-slate-700 lg:col-span-5">
                      <p className="font-bold text-[#1E5B2A]">Pilihan Cara Kirim ke Grup (Gratis & Otomatis):</p>
                      <ul className="mt-2.5 space-y-2.5">
                        <li>
                          <strong>1. Grup WA 1-Klik (100% Gratis):</strong> Biarkan kolom ID Grup kosong. Setiap selesai input Kas Masuk/Keluar, klik <strong>Bagikan ke Grup WA</strong> lalu pilih grup Anda.
                        </li>
                        <li>
                          <strong>2. Bot Telegram (100% Gratis Selamanya & Full Otomatis):</strong> Pasang <code className="font-mono text-slate-900">WHATSAPP_PROVIDER=telegram</code> dan <code className="font-mono text-slate-900">TELEGRAM_BOT_TOKEN</code> di Vercel + masukkan Chat ID Grup (<code className="font-mono text-slate-900">-100...</code>).
                        </li>
                        <li>
                          <strong>3. Gateway WA Otomatis:</strong> Bisa memakai paket gratis <strong>Fonnte</strong> (kuota terbatas), <strong>Wablas</strong>, atau bot self-hosted gratis seperti <strong>WAHA / Baileys</strong> via <code className="font-mono text-slate-900">webhook</code>.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {(sessionUser.role === 'Administrator' || sessionUser.role === 'Bendahara') && (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-12">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-editorial text-lg font-bold text-slate-900">
                        Notifikasi Email Otomatis ke Admin (Realtime Setoran Anggota)
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Setiap kali anggota mengirim konfirmasi setor iuran atau bayar angsuran lewat aplikasi, sistem otomatis mengirim email notifikasi ke Admin lengkap dengan rincian nominal dan tombol ACC.
                      </p>
                    </div>
                    <span
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                        emailNotifyStatus.configured
                          ? 'border-emerald-200 bg-[#EAF4EC] text-[#1E5B2A]'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {emailNotifyStatus.configured
                        ? `Aktif (${emailNotifyStatus.provider.toUpperCase()}) · ${emailNotifyStatus.recipientMasked}`
                        : 'Belum Dikonfigurasi di Server'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="space-y-3 lg:col-span-6">
                      <label className="block text-xs font-semibold text-slate-700">
                        Uji Coba Pengiriman Email Notifikasi
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="email"
                          value={testNotifyEmail}
                          onChange={(e) => setTestNotifyEmail(e.target.value)}
                          placeholder={
                            emailNotifyStatus.recipientMasked
                              ? `Kosongkan untuk kirim ke ${emailNotifyStatus.recipientMasked}`
                              : 'Email tujuan uji coba (opsional)'
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
                        />
                        <button
                          type="button"
                          disabled={isTestingEmailNotify}
                          onClick={async () => {
                            setIsTestingEmailNotify(true);
                            try {
                              const res = await fetch('/api/notify/setoran', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  idSetoran: 'STR-TEST-' + Date.now().toString().slice(-4),
                                  idAnggota: 'AGT-TEST',
                                  namaAnggota: 'Contoh Anggota (Uji Coba)',
                                  jenisSetoran: 'Gabungan',
                                  idPinjaman: 'PINJ-CONTOH',
                                  jumlah: 350000,
                                  jumlahSimpanan: 100000,
                                  jumlahAngsuran: 250000,
                                  metodeBayar: 'Transfer Bank',
                                  keterangan: 'Uji coba notifikasi email realtime Admin',
                                  appUrl: window.location.origin,
                                  isTest: true,
                                  overrideRecipient: testNotifyEmail.trim() || undefined,
                                }),
                              });
                              const data = (await res.json().catch(() => ({}))) as {
                                sent?: boolean;
                                error?: string;
                              };
                              if (!res.ok || !data.sent) {
                                showToast(
                                  'error',
                                  data.error ||
                                    'Gagal mengirim email uji coba. Pastikan SMTP_USER, SMTP_PASS, dan ADMIN_NOTIFY_EMAIL sudah diisi di Vercel.'
                                );
                              } else {
                                showToast(
                                  'success',
                                  'Email uji coba berhasil terkirim! Silakan cek kotak masuk email Admin.'
                                );
                              }
                            } catch {
                              showToast('error', 'Gagal menghubungi server email notifikasi.');
                            } finally {
                              setIsTestingEmailNotify(false);
                            }
                          }}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1E5B2A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#154620] disabled:opacity-60"
                        >
                          <Mail className="h-4 w-4" />
                          {isTestingEmailNotify ? 'Mengirim...' : 'Kirim Email Uji Coba'}
                        </button>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-500">
                        Tip: Anda dapat mengisi lebih dari 1 email penerima di{' '}
                        <code className="font-mono text-slate-700">ADMIN_NOTIFY_EMAIL</code>{' '}
                        dipisahkan tanda koma (misal email Admin &amp; Bendahara).
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-200/80 bg-[#EAF4EC]/55 p-4 text-xs leading-relaxed text-slate-700 lg:col-span-6">
                      <p className="font-bold text-[#1E5B2A]">
                        Cara Aktifkan Notifikasi Email Realtime (Gratis Pakai Gmail):
                      </p>
                      <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-slate-700">
                        <li>
                          Buka <strong>Akun Google → Keamanan → Verifikasi 2 Langkah → Sandi Aplikasi (App Passwords)</strong>, lalu buat 1 sandi 16 digit untuk <em>Mail</em>.
                        </li>
                        <li>
                          Di <strong>Vercel → Settings → Environment Variables</strong>, tambahkan:
                          <div className="mt-1 space-y-0.5 rounded-lg bg-white/80 p-2 font-mono text-[11px] text-slate-900">
                            <div>SMTP_USER = emailgmailanda@gmail.com</div>
                            <div>SMTP_PASS = 16_digit_app_password</div>
                            <div>ADMIN_NOTIFY_EMAIL = email_admin_penerima@gmail.com</div>
                          </div>
                        </li>
                        <li>
                          Klik <strong>Redeploy</strong> di Vercel, lalu tekan <strong>Kirim Email Uji Coba</strong> di sebelah kiri untuk memastikan langsung masuk.
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modals & Toast */}
      {canQuickRecord && (
        <QuickRecordModal
          isOpen={quickRecordOpen}
          initialTab={defaultQuickTab}
          dataset={dataset}
          onClose={() => setQuickRecordOpen(false)}
          onSaveKasMasuk={handleSaveKasMasuk}
          onSaveKasKeluar={handleSaveKasKeluar}
          onSaveAngsuran={handleSaveAngsuran}
          onSavePinjaman={handleSavePinjaman}
        />
      )}

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

      <VideoPanduanModal
        isOpen={videoPanduanOpen}
        initialTopic={videoPanduanTopic}
        onClose={() => setVideoPanduanOpen(false)}
        onNotify={showToast}
      />

      {waShareModal && !kwitansiModalData && (
        <div
          className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-2xl sm:pb-0">
            <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-[#103D1B] via-[#1B5727] to-[#287336] px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="h-5 w-5 text-amber-300" />
                <div>
                  <h3 className="text-sm font-bold">{waShareModal.title}</h3>
                  <p className="text-[11px] text-emerald-100">
                    Siap diteruskan ke grup WhatsApp beserta gambar rincian saldo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaShareModal(null)}
                className="rounded-lg p-1 text-emerald-100 hover:bg-white/15 hover:text-white"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {waShareModal.autoSentError && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {waShareModal.autoSentError}
                </div>
              )}

              <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5 font-sans text-xs leading-relaxed text-slate-800">
                {waShareModal.message}
              </pre>

              {waShareModal.image?.dataUrl && (
                <div className="mt-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <ImageIcon className="h-3.5 w-3.5 text-[#1E5B2A]" />
                      Gambar Rincian Saldo & Anggota
                    </span>
                    <span className="text-[11px] text-slate-500">Salin & Tempel di WA</span>
                  </div>
                  <img
                    src={waShareModal.image.dataUrl}
                    alt="Ringkasan Saldo Kelompok dan Rincian Anggota"
                    className="max-h-56 w-full rounded-lg border border-slate-200 bg-white object-contain"
                  />
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!waShareModal.image?.dataUrl) return;
                        try {
                          if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
                            showToast(
                              'error',
                              'Browser tidak mendukung salin gambar. Gunakan Unduh Gambar (.png).'
                            );
                            return;
                          }
                          const blob = dataUrlToBlob(waShareModal.image.dataUrl);
                          await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob }),
                          ]);
                          setCopiedWaImg(true);
                          setTimeout(() => setCopiedWaImg(false), 2000);
                          showToast(
                            'success',
                            'Gambar saldo disalin! Tekan Ctrl+V di grup WhatsApp.'
                          );
                        } catch {
                          showToast(
                            'error',
                            'Gagal menyalin gambar ke clipboard. Gunakan tombol Unduh (.png).'
                          );
                        }
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {copiedWaImg ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-[#1E5B2A]" />
                      )}
                      {copiedWaImg ? 'Gambar Disalin' : 'Salin Gambar'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!waShareModal.image?.dataUrl) return;
                        const link = document.createElement('a');
                        link.href = waShareModal.image.dataUrl;
                        link.download = waShareModal.image.filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        showToast('success', 'Gambar rincian saldo berhasil diunduh.');
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5 text-[#1E5B2A]" />
                      Unduh (.png)
                    </button>

                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!waShareModal.image?.dataUrl) return;
                          try {
                            const blob = dataUrlToBlob(waShareModal.image.dataUrl);
                            const file = new File([blob], waShareModal.image.filename, {
                              type: 'image/png',
                            });
                            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                              await navigator.share({
                                title: waShareModal.title,
                                text: waShareModal.message,
                                files: [file],
                              });
                              return;
                            }
                            showToast(
                              'error',
                              'Perangkat belum mendukung berbagi file langsung. Gunakan Salin Gambar.'
                            );
                          } catch (err) {
                            if ((err as { name?: string })?.name !== 'AbortError') {
                              showToast('error', 'Gagal membuka menu berbagi sistem.');
                            }
                          }
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#1E5B2A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#154620]"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Bagikan Gambar + Teks
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(waShareModal.message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWaShareModal(null)}
                  className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  Bagikan ke Grup WA
                </a>

                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(waShareModal.message);
                    setCopiedWaMsg(true);
                    setTimeout(() => setCopiedWaMsg(false), 2000);
                    showToast('success', 'Pesan grup WhatsApp berhasil disalin.');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {copiedWaMsg ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-[#1E5B2A]" />
                  )}
                  {copiedWaMsg ? 'Tersalin' : 'Salin Teks'}
                </button>

                {waGatewayStatus.configured &&
                  (waGroupSettings.groupId.trim() || waGatewayStatus.hasDefaultGroup) && (
                    <button
                      type="button"
                      disabled={isSendingWaGroup}
                      onClick={async () => {
                        setIsSendingWaGroup(true);
                        try {
                          const target = waGroupSettings.groupId.trim() || 'GROUP';
                          const res = await fetch('/api/whatsapp/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              nohp: target,
                              message: waShareModal.message,
                            }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok && data?.success) {
                            setWaShareModal(null);
                            showToast('success', 'Pesan berhasil dikirim ke Grup WhatsApp via Gateway!');
                          } else {
                            showToast('error', data?.error || 'Gagal mengirim ke Grup WhatsApp.');
                          }
                        } finally {
                          setIsSendingWaGroup(false);
                        }
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E5B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#154620] disabled:opacity-60"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {isSendingWaGroup ? 'Mengirim ke Grup...' : 'Kirim Otomatis via Gateway Server'}
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Native Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi Cepat Mobile"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-2 pt-1.5 pb-[calc(0.45rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(15,23,42,0.06)] backdrop-blur-md lg:hidden"
      >
        {canQuickRecord ? (
          <div className="mx-auto flex max-w-lg items-end justify-around gap-1">
            {(sessionUser.role === 'Administrator'
              ? [
                  { id: 'dashboard' as PageId, label: 'Beranda', icon: <LayoutDashboard className="h-5 w-5" /> },
                  { id: 'kasMasuk' as PageId, label: 'Masuk', icon: <ArrowDownLeft className="h-5 w-5" /> },
                ]
              : [
                  { id: 'kasMasuk' as PageId, label: 'Masuk', icon: <ArrowDownLeft className="h-5 w-5" /> },
                  { id: 'kasKeluar' as PageId, label: 'Keluar', icon: <ArrowUpRight className="h-5 w-5" /> },
                ]
            ).map((tab) => {
              const active = activePage === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePage(tab.id)}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-semibold transition-colors ${
                    active ? 'text-[#1E5B2A]' : 'text-slate-500 active:text-slate-900'
                  }`}
                >
                  <span
                    className={`flex h-7 w-10 items-center justify-center rounded-full transition-colors ${
                      active ? 'bg-[#EAF4EC] text-[#1E5B2A]' : 'bg-transparent'
                    }`}
                  >
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}

            {/* Center Raised +Catat Action Button */}
            <button
              type="button"
              onClick={() => setQuickRecordOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 pb-0.5 text-[11px] font-bold text-[#1E5B2A]"
              aria-label="Catat Transaksi Cepat"
            >
              <span className="-mt-4 flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-white bg-gradient-to-br from-[#103D1B] via-[#1E5B2A] to-[#287336] text-white shadow-md shadow-[#1E5B2A]/25 transition-transform active:scale-95">
                <Plus className="h-5 w-5" />
              </span>
              <span>Catat</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePage('laporan')}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-semibold transition-colors ${
                activePage === 'laporan'
                  ? 'text-[#1E5B2A]'
                  : 'text-slate-500 active:text-slate-900'
              }`}
            >
              <span
                className={`flex h-7 w-10 items-center justify-center rounded-full transition-colors ${
                  activePage === 'laporan' ? 'bg-[#EAF4EC] text-[#1E5B2A]' : 'bg-transparent'
                }`}
              >
                <BarChart3 className="h-5 w-5" />
              </span>
              <span>Laporan</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-semibold transition-colors ${
                mobileMenuOpen ||
                ['pinjaman', 'angsuran', 'anggota', 'knowledge', 'pengaturan', 'konfirmasiSetoran'].includes(
                  activePage
                ) ||
                (sessionUser.role === 'Administrator' && activePage === 'kasKeluar')
                  ? 'text-[#1E5B2A]'
                  : 'text-slate-500 active:text-slate-900'
              }`}
            >
              <span className="relative flex h-7 w-10 items-center justify-center rounded-full">
                <Menu className="h-5 w-5" />
                {pendingSetoranCount > 0 && (
                  <span className="absolute top-0.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                )}
              </span>
              <span>Menu</span>
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-lg items-center justify-around gap-1">
            {[
              { id: 'anggotaSaya' as PageId, label: 'Saldo', icon: <Wallet className="h-5 w-5" /> },
              {
                id: 'setorSaya' as PageId,
                label: 'Setor',
                icon: <ClipboardCheck className="h-5 w-5" />,
              },
              {
                id: 'ajukanPinjaman' as PageId,
                label: 'Pinjam',
                icon: <CreditCard className="h-5 w-5" />,
              },
              {
                id: 'laporan' as PageId,
                label: 'Laporan',
                icon: <BarChart3 className="h-5 w-5" />,
              },
              {
                id: 'pengaturan' as PageId,
                label: 'Akun',
                icon: <Settings className="h-5 w-5" />,
              },
            ].map((tab) => {
              const active = activePage === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePage(tab.id)}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-semibold transition-colors ${
                    active ? 'text-[#1E5B2A]' : 'text-slate-500 active:text-slate-900'
                  }`}
                >
                  <span
                    className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
                      active ? 'bg-[#EAF4EC] text-[#1E5B2A]' : 'bg-transparent'
                    }`}
                  >
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      <OfflineIndicator />

      {toast && (
        <div
          className="no-print fixed right-4 bottom-20 z-50 flex max-w-sm items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg lg:right-5 lg:bottom-5"
          role="status"
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <p
            className={`font-medium ${
              toast.type === 'success' ? 'text-slate-900' : 'text-red-700'
            }`}
          >
            {toast.message}
          </p>
        </div>
      )}
    </div>
  );
}
