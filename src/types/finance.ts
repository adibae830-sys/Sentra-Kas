export type RoleType = 'Administrator' | 'Bendahara' | 'Anggota';

export interface AppUser {
  username: string;
  password: string;
  nama: string;
  role: RoleType;
  status: string;
  idAnggota: string;
  rowIndex: number;
}

export interface Anggota {
  id: string;
  nama: string;
  alamat: string;
  nohp: string;
  tanggal: string;
  status: string;
  rowIndex: number;
}

export interface KasMasuk {
  id: string;
  tanggal: string;
  idAnggota: string;
  jenis: string;
  jumlah: number;
  keterangan: string;
  user: string;
  rowIndex: number;
}

export interface KasKeluar {
  id: string;
  tanggal: string;
  jenis: string;
  jumlah: number;
  keterangan: string;
  user: string;
  rowIndex: number;
}

export interface Pinjaman {
  idPinjaman: string;
  tanggal: string;
  idAnggota: string;
  jumlah: number;
  tenor: number;
  angsuranPerBulan: number;
  totalDibayar: number;
  sisa: number;
  status: string;
  rowIndex: number;
}

export interface Angsuran {
  idAngsuran: string;
  tanggal: string;
  idPinjaman: string;
  idAnggota: string;
  angsuranKe: number;
  jumlah: number;
  sisa: number;
  user: string;
  rowIndex: number;
}

export interface LaporanBulanan {
  idLaporan: string;
  periode: string;
  totalMasuk: number;
  totalKeluar: number;
  surplusDefisit: number;
  saldoAkhir: number;
  totalPiutang: number;
  jumlahAnggota: number;
  dibuatPada: string;
  statusKirimWa: string;
  rowIndex: number;
}

export interface LogWhatsApp {
  idLog: string;
  tanggal: string;
  periode: string;
  idAnggota: string;
  nama: string;
  nohp: string;
  tipe: string;
  status: string;
  ringkasan: string;
  rowIndex: number;
}

export interface FinanceDataset {
  spreadsheetTitle: string;
  spreadsheetId: string;
  sheetIds: Record<string, number>;
  availableTabs: string[];
  users: AppUser[];
  anggota: Anggota[];
  kasMasuk: KasMasuk[];
  kasKeluar: KasKeluar[];
  pinjaman: Pinjaman[];
  angsuran: Angsuran[];
  laporanBulanan: LaporanBulanan[];
  logWhatsApp: LogWhatsApp[];
}

export interface MemberSummary {
  idAnggota: string;
  nama: string;
  nohp: string;
  status: string;
  totalSimpanan: number;
  totalPinjaman: number;
  totalDibayar: number;
  totalSisaPinjaman: number;
  saldoAnggotaSaatIni: number;
  totalSisaAngsuran: number;
}

export interface MonthlyExpenseCategory {
  jenis: string;
  total: number;
  count: number;
  percentage: number;
}

export interface MonthlyMemberBreakdown {
  idAnggota: string;
  nama: string;
  nohp: string;
  simpananBulanIni: number;
  angsuranBulanIni: number;
  totalSimpananKumulatif: number;
  sisaPinjamanAktif: number;
  statusIuranWajib: 'Lunas Bulan Ini' | 'Belum Setor';
}

export interface MonthlyReportData {
  periode: string; // YYYY-MM
  periodeLabel: string;
  totalMasukBulan: number;
  totalKeluarBulan: number;
  surplusDefisit: number;
  saldoKasKumulatif: number;
  totalPiutangBerjalan: number;
  anggotaAktifCount: number;
  pengeluaranPerKategori: MonthlyExpenseCategory[];
  pemasukanPerKategori: MonthlyExpenseCategory[];
  transaksiKeluarBulan: KasKeluar[];
  transaksiMasukBulan: KasMasuk[];
  rekapAnggota: MonthlyMemberBreakdown[];
}

export interface ConfirmationState {
  isOpen: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  variant?: 'primary' | 'danger';
  onConfirm: () => Promise<void> | void;
}
