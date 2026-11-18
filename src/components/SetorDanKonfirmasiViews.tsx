import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  CreditCard,
  Info,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import {
  formatTanggalId,
  IURAN_WAJIB_PER_BULAN,
  rupiah,
} from '../lib/financeEngine';
import { FinanceDataset, KonfirmasiSetoran } from '../types/finance';
import { CurrencyInput } from './CurrencyInput';

interface SetorAnggotaViewProps {
  dataset: FinanceDataset;
  idAnggota: string;
  onAjukanSetoran: (payload: {
    jenisSetoran: 'Simpanan' | 'Angsuran';
    idPinjaman: string;
    jumlah: number;
    metodeBayar: string;
    keterangan: string;
  }) => void;
}

export const SetorAnggotaView: React.FC<SetorAnggotaViewProps> = ({
  dataset,
  idAnggota,
  onAjukanSetoran,
}) => {
  const activeLoans = useMemo(
    () =>
      dataset.pinjaman.filter(
        (p) => p.idAnggota === idAnggota && p.status === 'Berjalan' && p.sisa > 0
      ),
    [dataset.pinjaman, idAnggota]
  );

  const [jenisSetoran, setJenisSetoran] = useState<'Simpanan' | 'Angsuran'>('Simpanan');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [jumlah, setJumlah] = useState<string>(String(IURAN_WAJIB_PER_BULAN));
  const [metodeBayar, setMetodeBayar] = useState<string>('Transfer Bank');
  const [keterangan, setKeterangan] = useState<string>('');

  useEffect(() => {
    if (jenisSetoran === 'Angsuran') {
      const targetLoan =
        activeLoans.find((l) => l.idPinjaman === selectedLoanId) || activeLoans[0];
      if (targetLoan) {
        if (targetLoan.idPinjaman !== selectedLoanId) {
          setSelectedLoanId(targetLoan.idPinjaman);
        }
        const defaultPay = Math.min(
          targetLoan.angsuranPerBulan || targetLoan.sisa,
          targetLoan.sisa
        );
        setJumlah(String(defaultPay));
      } else {
        setSelectedLoanId('');
        setJumlah('');
      }
    } else {
      setJumlah((curr) => (curr && Number(curr) > 0 ? curr : String(IURAN_WAJIB_PER_BULAN)));
    }
  }, [jenisSetoran, activeLoans, selectedLoanId]);

  const selectedLoan = useMemo(
    () => activeLoans.find((l) => l.idPinjaman === selectedLoanId) || null,
    [activeLoans, selectedLoanId]
  );

  const myHistory = useMemo(
    () =>
      (dataset.konfirmasiSetoran || [])
        .filter((k) => k.idAnggota === idAnggota)
        .slice()
        .reverse(),
    [dataset.konfirmasiSetoran, idAnggota]
  );

  const myPendingCount = useMemo(
    () => myHistory.filter((k) => k.status === 'Menunggu').length,
    [myHistory]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericJumlah = Number(jumlah);
    if (!Number.isFinite(numericJumlah) || numericJumlah <= 0) return;

    if (jenisSetoran === 'Angsuran' && !selectedLoan) return;

    onAjukanSetoran({
      jenisSetoran,
      idPinjaman: jenisSetoran === 'Angsuran' && selectedLoan ? selectedLoan.idPinjaman : '',
      jumlah: numericJumlah,
      metodeBayar,
      keterangan: keterangan.trim(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-950">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div>
          <p className="font-bold text-amber-900">
            Menunggu Verifikasi Admin / Bendahara
          </p>
          <p className="mt-0.5 text-amber-800">
            Setoran iuran bulanan maupun pembayaran angsuran yang Anda kirim di sini masuk ke antrean konfirmasi terlebih dahulu dan{' '}
            <strong>tidak langsung mengubah saldo kas atau sisa pinjaman</strong> sebelum dikonfirmasi oleh Administrator atau Bendahara.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6 lg:col-span-5">
          <h3 className="font-editorial text-lg font-bold text-slate-900">
            Form Konfirmasi Setoran Anggota
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Laporkan transfer iuran wajib/simpanan atau pembayaran cicilan pinjaman Anda.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setJenisSetoran('Simpanan');
                setJumlah(String(IURAN_WAJIB_PER_BULAN));
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                jenisSetoran === 'Simpanan'
                  ? 'bg-white text-[#1E5B2A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />
              Setor Iuran / Simpanan
            </button>
            <button
              type="button"
              onClick={() => setJenisSetoran('Angsuran')}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                jenisSetoran === 'Angsuran'
                  ? 'bg-white text-[#1E5B2A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Bayar Angsuran
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {jenisSetoran === 'Angsuran' && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Pilih Pinjaman Berjalan
                </label>
                {activeLoans.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-4 text-center text-xs text-slate-500">
                    Anda tidak memiliki fasilitas pinjaman berstatus Berjalan saat ini.
                  </div>
                ) : (
                  <select
                    value={selectedLoanId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedLoanId(nextId);
                      const loan = activeLoans.find((l) => l.idPinjaman === nextId);
                      if (loan) {
                        setJumlah(
                          String(Math.min(loan.angsuranPerBulan || loan.sisa, loan.sisa))
                        );
                      }
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-900"
                  >
                    {activeLoans.map((l) => (
                      <option key={l.idPinjaman} value={l.idPinjaman}>
                        {l.idPinjaman} — Sisa {rupiah(l.sisa)} (Cicilan {rupiah(l.angsuranPerBulan)}/bln)
                      </option>
                    ))}
                  </select>
                )}

                {selectedLoan && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200/80 bg-[#EAF4EC]/60 px-3 py-2 text-xs">
                    <span className="text-slate-600">
                      Sisa Tagihan: <strong className="font-mono text-[#1E5B2A]">{rupiah(selectedLoan.sisa)}</strong>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setJumlah(
                            String(
                              Math.min(
                                selectedLoan.angsuranPerBulan || selectedLoan.sisa,
                                selectedLoan.sisa
                              )
                            )
                          )
                        }
                        className="rounded-lg border border-[#1E5B2A]/25 bg-white px-2 py-1 text-[11px] font-semibold text-[#1E5B2A] hover:bg-[#EAF4EC]"
                      >
                        1x Angsuran
                      </button>
                      <button
                        type="button"
                        onClick={() => setJumlah(String(selectedLoan.sisa))}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        Lunasi Sisa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Nominal Setoran (Rp)
              </label>
              <CurrencyInput
                required
                value={jumlah}
                onValueChange={(digits) => setJumlah(digits)}
                placeholder="100.000"
                disabled={jenisSetoran === 'Angsuran' && activeLoans.length === 0}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900 disabled:bg-slate-100"
              />
              {jenisSetoran === 'Simpanan' && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[100000, 200000, 300000, 500000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setJumlah(String(preset))}
                      className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                        Number(jumlah) === preset
                          ? 'border-[#1E5B2A] bg-[#EAF4EC] text-[#1E5B2A]'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {rupiah(preset)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Metode Pembayaran
              </label>
              <select
                value={metodeBayar}
                onChange={(e) => setMetodeBayar(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              >
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="QRIS">QRIS / E-Wallet</option>
                <option value="Tunai">Tunai ke Pengurus</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Keterangan / No. Referensi Transfer
              </label>
              <input
                type="text"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder={
                  jenisSetoran === 'Simpanan'
                    ? 'Contoh: Iuran bulan ini via Transfer BRI'
                    : 'Contoh: Cicilan pinjaman via BCA a.n ...'
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={
                Number(jumlah) <= 0 ||
                (jenisSetoran === 'Angsuran' && !selectedLoan)
              }
              className="w-full rounded-xl bg-[#1E5B2A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#154620] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {jenisSetoran === 'Simpanan'
                ? 'Kirim Konfirmasi Setor Iuran'
                : 'Kirim Konfirmasi Bayar Angsuran'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6 lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-editorial text-lg font-bold text-slate-900">
                Riwayat Pengajuan Setoran Saya
              </h3>
              <p className="text-xs text-slate-500">
                Pantau status verifikasi setoran iuran dan angsuran Anda.
              </p>
            </div>
            {myPendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                <Clock className="h-3.5 w-3.5" />
                {myPendingCount} Menunggu Konfirmasi
              </span>
            )}
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {myHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                Belum ada pengajuan konfirmasi setoran.
              </div>
            ) : (
              myHistory.map((item) => (
                <div
                  key={item.idSetoran}
                  className="rounded-xl border border-slate-200 bg-[#F8FAF8] p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">
                        {item.jenisSetoran === 'Simpanan' ? 'Iuran / Simpanan' : 'Angsuran Pinjaman'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatTanggalId(item.tanggal)} · {item.metodeBayar}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        item.status === 'Dikonfirmasi'
                          ? 'bg-emerald-50 text-emerald-700'
                          : item.status === 'Ditolak'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {item.status === 'Menunggu' ? 'Menunggu Konfirmasi' : item.status}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/70 pt-2">
                    <span className="truncate text-xs text-slate-600">
                      {item.idPinjaman ? `${item.idPinjaman} · ` : ''}
                      {item.keterangan || '-'}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-[#1E5B2A]">
                      {rupiah(item.jumlah)}
                    </span>
                  </div>
                  {item.diprosesOleh && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Diproses oleh: {item.diprosesOleh}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-3">Tanggal</th>
                  <th className="py-2.5 pr-3">Jenis</th>
                  <th className="py-2.5 pr-3">Metode &amp; Keterangan</th>
                  <th className="py-2.5 pr-3 text-right">Nominal</th>
                  <th className="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                      Belum ada pengajuan konfirmasi setoran.
                    </td>
                  </tr>
                ) : (
                  myHistory.map((item) => (
                    <tr key={item.idSetoran} className="hover:bg-[#F4FAF5]">
                      <td className="py-3 pr-3 text-xs text-slate-500">
                        {formatTanggalId(item.tanggal)}
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-900">
                          {item.jenisSetoran === 'Simpanan' ? 'Iuran / Simpanan' : 'Angsuran'}
                        </p>
                        {item.idPinjaman && (
                          <p className="font-mono text-[11px] text-slate-500">
                            {item.idPinjaman}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">{item.metodeBayar}</span>
                        {item.keterangan ? ` · ${item.keterangan}` : ''}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-[#1E5B2A]">
                        {rupiah(item.jumlah)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.status === 'Dikonfirmasi'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'Ditolak'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {item.status === 'Menunggu' ? 'Menunggu Konfirmasi' : item.status}
                        </span>
                        {item.diprosesOleh && (
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            oleh {item.diprosesOleh}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

interface KonfirmasiSetoranViewProps {
  dataset: FinanceDataset;
  onKonfirmasiSetoran: (item: KonfirmasiSetoran) => void;
  onTolakSetoran: (item: KonfirmasiSetoran) => void;
}

export const KonfirmasiSetoranView: React.FC<KonfirmasiSetoranViewProps> = ({
  dataset,
  onKonfirmasiSetoran,
  onTolakSetoran,
}) => {
  const [statusFilter, setStatusFilter] = useState<'Menunggu' | 'Dikonfirmasi' | 'Ditolak' | 'Semua'>('Menunggu');
  const [search, setSearch] = useState('');

  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    dataset.anggota.forEach((a) => map.set(a.id, a.nama));
    return map;
  }, [dataset.anggota]);

  const loanMap = useMemo(() => {
    const map = new Map<string, { sisa: number; status: string }>();
    dataset.pinjaman.forEach((p) => map.set(p.idPinjaman, { sisa: p.sisa, status: p.status }));
    return map;
  }, [dataset.pinjaman]);

  const allItems = useMemo(
    () => (dataset.konfirmasiSetoran || []).slice().reverse(),
    [dataset.konfirmasiSetoran]
  );

  const counts = useMemo(() => {
    const menunggu = allItems.filter((i) => i.status === 'Menunggu');
    return {
      menungguCount: menunggu.length,
      menungguNominal: menunggu.reduce((sum, i) => sum + i.jumlah, 0),
      dikonfirmasiCount: allItems.filter((i) => i.status === 'Dikonfirmasi').length,
      ditolakCount: allItems.filter((i) => i.status === 'Ditolak').length,
    };
  }, [allItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (statusFilter !== 'Semua' && item.status !== statusFilter) return false;
      if (!q) return true;
      const nama = (nameMap.get(item.idAnggota) || item.idAnggota).toLowerCase();
      return (
        nama.includes(q) ||
        item.idSetoran.toLowerCase().includes(q) ||
        item.idPinjaman.toLowerCase().includes(q) ||
        item.keterangan.toLowerCase().includes(q) ||
        item.metodeBayar.toLowerCase().includes(q)
      );
    });
  }, [allItems, statusFilter, search, nameMap]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-200/90 bg-amber-50/70 p-5 shadow-xs">
          <p className="text-xs font-semibold text-amber-800">Menunggu Konfirmasi</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-amber-950">
            {counts.menungguCount} <span className="text-sm font-semibold">pengajuan</span>
          </p>
          <p className="mt-1 font-mono text-xs font-semibold text-amber-800">
            Total: {rupiah(counts.menungguNominal)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Sudah Dikonfirmasi</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-[#1E5B2A]">
            {counts.dikonfirmasiCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Tercatat ke KasMasuk / Angsuran</p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Ditolak</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-700">
            {counts.ditolakCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Tidak mempengaruhi saldo kas</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(['Menunggu', 'Dikonfirmasi', 'Ditolak', 'Semua'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === tab
                    ? 'bg-[#1E5B2A] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab === 'Menunggu'
                  ? `Menunggu (${counts.menungguCount})`
                  : tab === 'Dikonfirmasi'
                    ? `Dikonfirmasi (${counts.dikonfirmasiCount})`
                    : tab === 'Ditolak'
                      ? `Ditolak (${counts.ditolakCount})`
                      : `Semua (${allItems.length})`}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, ID, keterangan..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="space-y-3 md:hidden">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              Tidak ada pengajuan setoran pada filter ini.
            </div>
          ) : (
            filtered.map((item) => {
              const nama = nameMap.get(item.idAnggota) || item.idAnggota;
              const loan = item.idPinjaman ? loanMap.get(item.idPinjaman) : undefined;
              return (
                <div
                  key={item.idSetoran}
                  className="rounded-xl border border-slate-200 bg-[#F8FAF8] p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">{nama}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatTanggalId(item.tanggal)} ·{' '}
                        {item.jenisSetoran === 'Simpanan' ? 'Iuran / Simpanan' : `Angsuran (${item.idPinjaman})`}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-[#1E5B2A]">
                      {rupiah(item.jumlah)}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-600">
                    <span className="font-semibold">{item.metodeBayar}</span>
                    {item.keterangan ? ` · ${item.keterangan}` : ''}
                  </p>

                  {loan && item.status === 'Menunggu' && (
                    <p className="mt-1 text-[11px] text-amber-800">
                      Sisa pinjaman saat ini: <strong className="font-mono">{rupiah(loan.sisa)}</strong> ({loan.status})
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5">
                    {item.status === 'Menunggu' ? (
                      <div className="flex w-full gap-2">
                        <button
                          type="button"
                          onClick={() => onKonfirmasiSetoran(item)}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#1E5B2A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#154620]"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Konfirmasi (ACC)
                        </button>
                        <button
                          type="button"
                          onClick={() => onTolakSetoran(item)}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          <X className="h-3.5 w-3.5" />
                          Tolak
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          item.status === 'Dikonfirmasi'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {item.status}
                        {item.diprosesOleh ? ` · ${item.diprosesOleh}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-3">Tanggal</th>
                <th className="py-2.5 pr-3">Anggota</th>
                <th className="py-2.5 pr-3">Jenis Setoran</th>
                <th className="py-2.5 pr-3">Metode &amp; Keterangan</th>
                <th className="py-2.5 pr-3 text-right">Nominal</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    Tidak ada pengajuan setoran pada filter ini.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const nama = nameMap.get(item.idAnggota) || item.idAnggota;
                  const loan = item.idPinjaman ? loanMap.get(item.idPinjaman) : undefined;
                  return (
                    <tr key={item.idSetoran} className="hover:bg-[#F4FAF5]">
                      <td className="py-3 pr-3 text-xs text-slate-500">
                        {formatTanggalId(item.tanggal)}
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-900">{nama}</p>
                        <p className="font-mono text-[11px] text-slate-400">{item.idAnggota}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold ${
                            item.jenisSetoran === 'Simpanan'
                              ? 'bg-[#EAF4EC] text-[#1E5B2A]'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {item.jenisSetoran === 'Simpanan' ? 'Iuran / Simpanan' : 'Angsuran'}
                        </span>
                        {item.idPinjaman && (
                          <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                            {item.idPinjaman}
                            {loan && item.status === 'Menunggu'
                              ? ` · Sisa ${rupiah(loan.sisa)}`
                              : ''}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">{item.metodeBayar}</span>
                        {item.keterangan ? ` · ${item.keterangan}` : ''}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-[#1E5B2A]">
                        {rupiah(item.jumlah)}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.status === 'Dikonfirmasi'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'Ditolak'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {item.status === 'Menunggu' ? 'Menunggu' : item.status}
                        </span>
                        {item.diprosesOleh && (
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            oleh {item.diprosesOleh}
                          </p>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {item.status === 'Menunggu' ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onKonfirmasiSetoran(item)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#1E5B2A] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#154620]"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Konfirmasi
                            </button>
                            <button
                              type="button"
                              onClick={() => onTolakSetoran(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              <X className="h-3.5 w-3.5" />
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Selesai</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
