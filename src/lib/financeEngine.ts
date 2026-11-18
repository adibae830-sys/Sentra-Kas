import {
  Anggota,
  AppUser,
  FinanceDataset,
  MemberSummary,
  MonthlyExpenseCategory,
  MonthlyMemberBreakdown,
  MonthlyReportData,
} from '../types/finance';

export function isMemberAccountActive(a: Anggota, users: AppUser[] = []): boolean {
  const anggotaStatus = String(a.status || 'Aktif').trim().toLowerCase();
  if (anggotaStatus !== 'aktif') return false;

  const linkedUsers = users.filter((u) => u.idAnggota && u.idAnggota === a.id);
  if (
    linkedUsers.length > 0 &&
    linkedUsers.every((u) => String(u.status || '').trim().toLowerCase() !== 'aktif')
  ) {
    return false;
  }
  return true;
}

export const IURAN_WAJIB_PER_BULAN = 100000;
export const TARGET_IURAN_WAJIB = 2400000;

export function rupiah(n: number | string | undefined | null): string {
  const num = Number(n || 0);
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

export function formatNoWA(nohp: string): string {
  let nomor = String(nohp || '').replace(/\D/g, '');
  if (!nomor) return '';
  if (nomor.startsWith('0')) {
    nomor = '62' + nomor.substring(1);
  } else if (!nomor.startsWith('62')) {
    nomor = '62' + nomor;
  }
  return nomor;
}

export function parseSheetDate(raw: string): Date | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Handle ISO or standard JS date string
  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  // Handle dd/mm/yyyy or dd-mm-yyyy
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

export function toYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatTanggalId(raw: string): string {
  const d = parseSheetDate(raw);
  if (!d) return raw || '-';
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatPeriodeLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return yearMonth;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

export function nowIsoShort(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function computeAdminDashboard(data: FinanceDataset) {
  const totalMasuk = data.kasMasuk.reduce((acc, r) => acc + r.jumlah, 0);
  const totalKeluar = data.kasKeluar.reduce((acc, r) => acc + r.jumlah, 0);
  const piutang = data.pinjaman
    .filter((p) => p.status === 'Berjalan')
    .reduce((acc, p) => acc + p.sisa, 0);

  const pinjamanStatusCounts = {
    Menunggu: data.pinjaman.filter((p) => p.status === 'Menunggu').length,
    Berjalan: data.pinjaman.filter((p) => p.status === 'Berjalan').length,
    Lunas: data.pinjaman.filter((p) => p.status === 'Lunas').length,
    Ditolak: data.pinjaman.filter((p) => p.status === 'Ditolak').length,
  };

  return {
    anggotaTotal: data.anggota.length,
    anggotaAktif: data.anggota.filter((a) => isMemberAccountActive(a, data.users)).length,
    masuk: totalMasuk,
    keluar: totalKeluar,
    saldo: totalMasuk - totalKeluar,
    piutang,
    pinjamanStatusCounts,
  };
}

export function computeRingkasanAnggota(data: FinanceDataset): MemberSummary[] {
  return data.anggota
    .filter((a) => isMemberAccountActive(a, data.users))
    .map((a) => {
    const totalSimpanan = data.kasMasuk
      .filter((k) => k.idAnggota === a.id && k.jenis === 'Simpanan')
      .reduce((sum, k) => sum + k.jumlah, 0);

    const pinjamanAnggota = data.pinjaman.filter((p) => p.idAnggota === a.id);

    const totalPinjaman = pinjamanAnggota
      .filter((p) => p.status === 'Berjalan' || p.status === 'Lunas')
      .reduce((sum, p) => sum + p.jumlah, 0);

    const totalDibayar = pinjamanAnggota.reduce((sum, p) => sum + p.totalDibayar, 0);

    const totalSisaPinjaman = pinjamanAnggota
      .filter((p) => p.status === 'Berjalan')
      .reduce((sum, p) => sum + p.sisa, 0);

    let totalSisaAngsuran = 0;
    pinjamanAnggota.forEach((p) => {
      if (p.status === 'Berjalan' && p.angsuranPerBulan > 0 && p.sisa > 0) {
        totalSisaAngsuran += Math.ceil(p.sisa / p.angsuranPerBulan);
      }
    });

    return {
      idAnggota: a.id,
      nama: a.nama,
      nohp: a.nohp,
      status: a.status,
      totalSimpanan,
      totalPinjaman,
      totalDibayar,
      totalSisaPinjaman,
      saldoAnggotaSaatIni: totalSimpanan - totalSisaPinjaman,
      totalSisaAngsuran,
    };
  });
}

export function computeAnggotaDashboard(data: FinanceDataset, idAnggota: string) {
  const admin = computeAdminDashboard(data);

  const simpananSaya = data.kasMasuk
    .filter((k) => k.idAnggota === idAnggota && k.jenis === 'Simpanan')
    .reduce((sum, k) => sum + k.jumlah, 0);

  const pinjamanSaya = data.pinjaman.filter((p) => p.idAnggota === idAnggota);

  const totalSisaPinjaman = pinjamanSaya
    .filter((p) => p.status === 'Berjalan')
    .reduce((sum, p) => sum + p.sisa, 0);

  const saldoAnggotaSaatIni = simpananSaya - totalSisaPinjaman;
  const kekuranganIuran = Math.max(TARGET_IURAN_WAJIB - simpananSaya, 0);

  return {
    idAnggota,
    saldoKelompok: admin.saldo,
    simpananSaya,
    totalSisaPinjaman,
    saldoAnggotaSaatIni,
    iuranWajibPerBulan: IURAN_WAJIB_PER_BULAN,
    targetIuranWajib: TARGET_IURAN_WAJIB,
    kekuranganIuran,
    pinjamanSaya,
    transaksiSaya: data.kasMasuk.filter((k) => k.idAnggota === idAnggota),
  };
}

export function getAvailablePeriods(data: FinanceDataset): string[] {
  const set = new Set<string>();
  set.add(toYearMonth(new Date()));

  data.kasMasuk.forEach((k) => {
    const d = parseSheetDate(k.tanggal);
    if (d) set.add(toYearMonth(d));
  });
  data.kasKeluar.forEach((k) => {
    const d = parseSheetDate(k.tanggal);
    if (d) set.add(toYearMonth(d));
  });

  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export function computeMonthlyCashflowSeries(data: FinanceDataset, monthsCount = 6) {
  const map = new Map<string, { periode: string; label: string; masuk: number; keluar: number }>();

  const now = new Date();
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = toYearMonth(d);
    const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    map.set(key, { periode: key, label, masuk: 0, keluar: 0 });
  }

  data.kasMasuk.forEach((k) => {
    const d = parseSheetDate(k.tanggal);
    if (!d) return;
    const key = toYearMonth(d);
    const bucket = map.get(key);
    if (bucket) bucket.masuk += k.jumlah;
  });

  data.kasKeluar.forEach((k) => {
    const d = parseSheetDate(k.tanggal);
    if (!d) return;
    const key = toYearMonth(d);
    const bucket = map.get(key);
    if (bucket) bucket.keluar += k.jumlah;
  });

  return Array.from(map.values());
}

export function computeMonthlyReport(data: FinanceDataset, periode: string): MonthlyReportData {
  const admin = computeAdminDashboard(data);

  const transaksiMasukBulan = data.kasMasuk.filter((k) => {
    const d = parseSheetDate(k.tanggal);
    return d ? toYearMonth(d) === periode : false;
  });

  const transaksiKeluarBulan = data.kasKeluar.filter((k) => {
    const d = parseSheetDate(k.tanggal);
    return d ? toYearMonth(d) === periode : false;
  });

  const totalMasukBulan = transaksiMasukBulan.reduce((sum, k) => sum + k.jumlah, 0);
  const totalKeluarBulan = transaksiKeluarBulan.reduce((sum, k) => sum + k.jumlah, 0);

  const outMap = new Map<string, { total: number; count: number }>();
  transaksiKeluarBulan.forEach((k) => {
    const key = k.jenis || 'Lainnya';
    const curr = outMap.get(key) || { total: 0, count: 0 };
    curr.total += k.jumlah;
    curr.count += 1;
    outMap.set(key, curr);
  });

  const pengeluaranPerKategori: MonthlyExpenseCategory[] = Array.from(outMap.entries())
    .map(([jenis, info]) => ({
      jenis,
      total: info.total,
      count: info.count,
      percentage: totalKeluarBulan > 0 ? Math.round((info.total / totalKeluarBulan) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const inMap = new Map<string, { total: number; count: number }>();
  transaksiMasukBulan.forEach((k) => {
    const key = k.jenis || 'Lainnya';
    const curr = inMap.get(key) || { total: 0, count: 0 };
    curr.total += k.jumlah;
    curr.count += 1;
    inMap.set(key, curr);
  });

  const pemasukanPerKategori: MonthlyExpenseCategory[] = Array.from(inMap.entries())
    .map(([jenis, info]) => ({
      jenis,
      total: info.total,
      count: info.count,
      percentage: totalMasukBulan > 0 ? Math.round((info.total / totalMasukBulan) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const activeMembers = data.anggota.filter((a) => isMemberAccountActive(a, data.users));
  const rekapAnggota: MonthlyMemberBreakdown[] = activeMembers.map((a) => {
    const simpananBulanIni = transaksiMasukBulan
      .filter((k) => k.idAnggota === a.id && k.jenis === 'Simpanan')
      .reduce((sum, k) => sum + k.jumlah, 0);

    const angsuranBulanIni = transaksiMasukBulan
      .filter((k) => k.idAnggota === a.id && k.jenis === 'Angsuran')
      .reduce((sum, k) => sum + k.jumlah, 0);

    const totalSimpananKumulatif = data.kasMasuk
      .filter((k) => k.idAnggota === a.id && k.jenis === 'Simpanan')
      .reduce((sum, k) => sum + k.jumlah, 0);

    const sisaPinjamanAktif = data.pinjaman
      .filter((p) => p.idAnggota === a.id && p.status === 'Berjalan')
      .reduce((sum, p) => sum + p.sisa, 0);

    return {
      idAnggota: a.id,
      nama: a.nama,
      nohp: a.nohp,
      simpananBulanIni,
      angsuranBulanIni,
      totalSimpananKumulatif,
      sisaPinjamanAktif,
      statusIuranWajib: simpananBulanIni >= IURAN_WAJIB_PER_BULAN ? 'Lunas Bulan Ini' : 'Belum Setor',
    };
  });

  return {
    periode,
    periodeLabel: formatPeriodeLabel(periode),
    totalMasukBulan,
    totalKeluarBulan,
    surplusDefisit: totalMasukBulan - totalKeluarBulan,
    saldoKasKumulatif: admin.saldo,
    totalPiutangBerjalan: admin.piutang,
    anggotaAktifCount: activeMembers.length,
    pengeluaranPerKategori,
    pemasukanPerKategori,
    transaksiKeluarBulan,
    transaksiMasukBulan,
    rekapAnggota,
  };
}

export function buildWhatsAppMonthlyMessage(
  report: MonthlyReportData,
  member?: MonthlyMemberBreakdown
): string {
  const kategoriLines =
    report.pengeluaranPerKategori.length > 0
      ? report.pengeluaranPerKategori
          .map((cat) => `  • ${cat.jenis}: ${rupiah(cat.total)} (${cat.percentage}%)`)
          .join('\n')
      : '  • Tidak ada pengeluaran tercatat pada bulan ini';

  const headerGreeting = member
    ? `Assalamu'alaikum / Salam sejahtera, *${member.nama}*`
    : `Assalamu'alaikum / Salam sejahtera, *Seluruh Anggota Kelompok*`;

  const personalSection = member
    ? [
        '',
        `*Catatan Pribadi Anda (${member.idAnggota}):*`,
        `• Simpanan Bulan Ini: ${rupiah(member.simpananBulanIni)}`,
        `• Total Simpanan Kumulatif: ${rupiah(member.totalSimpananKumulatif)}`,
        `• Sisa Pinjaman Aktif: ${rupiah(member.sisaPinjamanAktif)}`,
        `• Status Iuran Wajib: ${member.statusIuranWajib}`,
      ].join('\n')
    : '';

  return [
    `*RINGKASAN KEUANGAN BULANAN KELOMPOK*`,
    `Periode: *${report.periodeLabel}*`,
    `--------------------------------`,
    '',
    headerGreeting,
    `Berikut adalah laporan kas dan ringkasan pengeluaran kelompok akhir bulan:`,
    '',
    `[+] *Total Kas Masuk Bulan Ini:* ${rupiah(report.totalMasukBulan)}`,
    `[-] *Total Pengeluaran (Kas Keluar):* ${rupiah(report.totalKeluarBulan)}`,
    `[=] *Surplus / Defisit Bulan Ini:* ${rupiah(report.surplusDefisit)}`,
    '',
    `*Rincian Pengeluaran per Kategori:*`,
    kategoriLines,
    '',
    `*Saldo Kas Kelompok Saat Ini:* ${rupiah(report.saldoKasKumulatif)}`,
    `*Total Piutang Pinjaman Berjalan:* ${rupiah(report.totalPiutangBerjalan)}`,
    personalSection,
    '',
    `_Laporan ini dibuat otomatis oleh Sistem Keuangan KSP SENTRA._`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

export interface MutasiGroupAlertParams {
  arah: 'MASUK' | 'KELUAR';
  jenis: string;
  jumlah: number;
  saldoSetelahMutasi: number;
  tanggal: string;
  anggotaNama?: string;
  keterangan?: string;
  petugas?: string;
  namaKelompok?: string;
}

export function buildWhatsAppMutasiGroupMessage(params: MutasiGroupAlertParams): string {
  const label = params.arah === 'MASUK' ? 'DANA MASUK (KREDIT)' : 'DANA KELUAR (DEBIT)';
  const tanda = params.arah === 'MASUK' ? '+' : '-';

  const lines = [
    `*NOTIFIKASI ${label}*`,
    params.namaKelompok ? `_${params.namaKelompok}_` : '_KSP SENTRA · Bersama Membangun Umat_',
    `--------------------------------`,
    `• *Tanggal:* ${formatTanggalId(params.tanggal)}`,
    `• *Kategori:* ${params.jenis}`,
    ...(params.anggotaNama ? [`• *Anggota:* ${params.anggotaNama}`] : []),
    `• *Nominal:* *${tanda} ${rupiah(params.jumlah)}*`,
    `• *Keterangan:* ${params.keterangan?.trim() || '-'}`,
    `--------------------------------`,
    `*Saldo Kas Terkini:* *${rupiah(params.saldoSetelahMutasi)}*`,
    ...(params.petugas ? [`_Dicatat oleh: ${params.petugas}_`] : []),
    '',
    `_Notifikasi mutasi otomatis KSP SENTRA._`,
  ];

  return lines.join('\n');
}
