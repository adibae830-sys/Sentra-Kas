import React, { useMemo, useState } from 'react';
import { CheckCircle, MessageCircle, Receipt, XCircle } from 'lucide-react';
import { formatNoWA, formatTanggalId, rupiah } from '../lib/financeEngine';
import { Angsuran, FinanceDataset, Pinjaman, RoleType } from '../types/finance';

interface PinjamanAndAccViewProps {
  dataset: FinanceDataset;
  role: RoleType;
  onSavePinjaman: (payload: { idAnggota: string; jumlah: number; tenor: number }) => void;
  onAccPinjaman: (pinjaman: Pinjaman) => void;
  onTolakPinjaman: (pinjaman: Pinjaman) => void;
}

export const PinjamanAndAccView: React.FC<PinjamanAndAccViewProps> = ({
  dataset,
  role,
  onSavePinjaman,
  onAccPinjaman,
  onTolakPinjaman,
}) => {
  const [idAnggota, setIdAnggota] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [tenor, setTenor] = useState('');

  const activeMembers = useMemo(
    () => dataset.anggota.filter((a) => a.status === 'Aktif'),
    [dataset.anggota]
  );

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    dataset.anggota.forEach((a) => map.set(a.id, a.nama));
    return map;
  }, [dataset.anggota]);

  const pendingLoans = useMemo(
    () => dataset.pinjaman.filter((p) => p.status === 'Menunggu'),
    [dataset.pinjaman]
  );

  const allLoans = useMemo(() => [...dataset.pinjaman].reverse(), [dataset.pinjaman]);

  const estimasiAngsuran =
    Number(jumlah) > 0 && Number(tenor) > 0 ? Number(jumlah) / Number(tenor) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idAnggota || Number(jumlah) <= 0 || Number(tenor) <= 0) return;
    onSavePinjaman({ idAnggota, jumlah: Number(jumlah), tenor: Number(tenor) });
    setIdAnggota('');
    setJumlah('');
    setTenor('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-stone-200/90 bg-white p-6">
            <h3 className="text-base font-semibold text-stone-900">Input Pinjaman Baru</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Pinjaman yang diinput admin atau bendahara langsung aktif berstatus Berjalan dan mencatat Kas Keluar.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">Anggota</label>
                <select
                  required
                  value={idAnggota}
                  onChange={(e) => setIdAnggota(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih Anggota --</option>
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} - {m.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    Jumlah Pinjaman (Rp)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    required
                    value={jumlah}
                    onChange={(e) => setJumlah(e.target.value)}
                    placeholder="1000000"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    Tenor (Bulan)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={tenor}
                    onChange={(e) => setTenor(e.target.value)}
                    placeholder="10"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              {estimasiAngsuran > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs">
                  <span className="text-stone-600">Estimasi Angsuran/Bulan</span>
                  <span className="font-mono font-semibold tabular-nums text-stone-900">
                    {rupiah(estimasiAngsuran)}
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-lg bg-[#0B2821] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#12382E]"
              >
                Simpan & Cairkan Pinjaman
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-xl border border-stone-200/90 bg-white p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-stone-900">
                Antrean Pengajuan Pinjaman ({pendingLoans.length})
              </h3>
              <p className="text-xs text-stone-500">
                Pengajuan mandiri dari anggota yang menunggu persetujuan Administrator.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500">
                    <th className="py-2 pr-3">ID & Tanggal</th>
                    <th className="py-2 pr-3">Anggota</th>
                    <th className="py-2 pr-3 text-right">Jumlah</th>
                    <th className="py-2 pr-3 text-right">Tenor</th>
                    <th className="py-2 text-right">Keputusan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {pendingLoans.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-stone-400">
                        Tidak ada pengajuan pinjaman yang menunggu ACC.
                      </td>
                    </tr>
                  ) : (
                    pendingLoans.map((p) => (
                      <tr key={p.idPinjaman}>
                        <td className="py-3 pr-3">
                          <div className="font-mono text-xs font-medium text-stone-900">
                            {p.idPinjaman}
                          </div>
                          <div className="text-xs text-stone-500">
                            {formatTanggalId(p.tanggal)}
                          </div>
                        </td>
                        <td className="py-3 pr-3 font-medium text-stone-900">
                          {memberMap.get(p.idAnggota) || p.idAnggota}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums text-stone-900">
                          {rupiah(p.jumlah)}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-xs text-stone-600">
                          {p.tenor} bln
                        </td>
                        <td className="py-3 text-right">
                          {role === 'Administrator' ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onAccPinjaman(p)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#0B2821] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#12382E]"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                ACC
                              </button>
                              <button
                                type="button"
                                onClick={() => onTolakPinjaman(p)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Tolak
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-stone-500">Khusus Admin</span>
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

      <div className="rounded-xl border border-stone-200/90 bg-white p-6">
        <h3 className="mb-3 text-base font-semibold text-stone-900">
          Daftar Pinjaman Kelompok ({allLoans.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500">
                <th className="py-2.5 pr-3">ID Pinjaman</th>
                <th className="py-2.5 pr-3">Anggota</th>
                <th className="py-2.5 pr-3 text-right">Pokok Pinjaman</th>
                <th className="py-2.5 pr-3 text-right">Angsuran/Bln</th>
                <th className="py-2.5 pr-3 text-right">Total Dibayar</th>
                <th className="py-2.5 pr-3 text-right">Sisa</th>
                <th className="py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {allLoans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-stone-400">
                    Belum ada catatan pinjaman.
                  </td>
                </tr>
              ) : (
                allLoans.map((p) => (
                  <tr key={p.idPinjaman} className="hover:bg-stone-50/90">
                    <td className="py-3 pr-3">
                      <div className="font-mono text-xs font-medium text-stone-900">
                        {p.idPinjaman}
                      </div>
                      <div className="text-xs text-stone-500">{formatTanggalId(p.tanggal)}</div>
                    </td>
                    <td className="py-3 pr-3 font-medium text-stone-900">
                      {memberMap.get(p.idAnggota) || p.idAnggota}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-stone-900">
                      {rupiah(p.jumlah)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-stone-600">
                      {rupiah(p.angsuranPerBulan)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-[#065F46]">
                      {rupiah(p.totalDibayar)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono font-semibold tabular-nums text-stone-900">
                      {rupiah(p.sisa)}
                    </td>
                    <td className="py-3 text-xs font-semibold">
                      <span
                        className={
                          p.status === 'Lunas'
                            ? 'text-[#065F46]'
                            : p.status === 'Berjalan'
                            ? 'text-[#B45309]'
                            : p.status === 'Ditolak'
                            ? 'text-red-700'
                            : 'text-stone-600'
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface AngsuranAndTunggakanViewProps {
  dataset: FinanceDataset;
  onSaveAngsuran: (payload: {
    pinjaman: Pinjaman;
    angsuranKe: number;
    jumlah: number;
  }) => void;
  onShowKwitansi: (angsuran: Angsuran) => void;
}

export const AngsuranAndTunggakanView: React.FC<AngsuranAndTunggakanViewProps> = ({
  dataset,
  onSaveAngsuran,
  onShowKwitansi,
}) => {
  const [selectedPinjamanId, setSelectedPinjamanId] = useState('');
  const [angsuranKe, setAngsuranKe] = useState('');
  const [jumlahBayar, setJumlahBayar] = useState('');

  const memberMap = useMemo(() => {
    const map = new Map<string, { nama: string; nohp: string }>();
    dataset.anggota.forEach((a) => map.set(a.id, { nama: a.nama, nohp: a.nohp }));
    return map;
  }, [dataset.anggota]);

  const activeLoans = useMemo(
    () => dataset.pinjaman.filter((p) => p.status === 'Berjalan' && p.sisa > 0),
    [dataset.pinjaman]
  );

  const selectedLoan = useMemo(
    () => activeLoans.find((p) => p.idPinjaman === selectedPinjamanId) || null,
    [activeLoans, selectedPinjamanId]
  );

  const handleSelectLoan = (id: string) => {
    setSelectedPinjamanId(id);
    const loan = activeLoans.find((p) => p.idPinjaman === id);
    if (loan) {
      const prevCount = dataset.angsuran.filter((a) => a.idPinjaman === id).length;
      setAngsuranKe(String(prevCount + 1));
      setJumlahBayar(String(Math.min(Math.round(loan.angsuranPerBulan), loan.sisa)));
    } else {
      setAngsuranKe('');
      setJumlahBayar('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || Number(jumlahBayar) <= 0) return;
    onSaveAngsuran({
      pinjaman: selectedLoan,
      angsuranKe: Number(angsuranKe) || 1,
      jumlah: Number(jumlahBayar),
    });
    setSelectedPinjamanId('');
    setAngsuranKe('');
    setJumlahBayar('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-stone-200/90 bg-white p-6">
            <h3 className="text-base font-semibold text-stone-900">Input Pembayaran Angsuran</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Otomatis memperbarui sisa pinjaman dan mencatat Kas Masuk.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  Pilih Pinjaman Berjalan
                </label>
                <select
                  required
                  value={selectedPinjamanId}
                  onChange={(e) => handleSelectLoan(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih Pinjaman --</option>
                  {activeLoans.map((p) => {
                    const mName = memberMap.get(p.idAnggota)?.nama || p.idAnggota;
                    return (
                      <option key={p.idPinjaman} value={p.idPinjaman}>
                        {p.idPinjaman} · {mName} (Sisa {rupiah(p.sisa)})
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedLoan && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
                  <div>
                    <span className="text-stone-500">Anggota</span>
                    <p className="font-semibold text-stone-900">
                      {memberMap.get(selectedLoan.idAnggota)?.nama || selectedLoan.idAnggota}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-stone-500">Sisa Pinjaman</span>
                    <p className="font-mono font-semibold tabular-nums text-[#B45309]">
                      {rupiah(selectedLoan.sisa)}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    Angsuran Ke
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={angsuranKe}
                    onChange={(e) => setAngsuranKe(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    Jumlah Bayar (Rp)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={jumlahBayar}
                    onChange={(e) => setJumlahBayar(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-[#0B2821] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#12382E]"
              >
                Simpan Angsuran
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-xl border border-stone-200/90 bg-white p-6">
            <h3 className="text-base font-semibold text-stone-900">
              Daftar Pinjaman Berjalan / Tunggakan ({activeLoans.length})
            </h3>
            <p className="mt-0.5 mb-4 text-xs text-stone-500">
              Kirim pengingat angsuran langsung melalui WhatsApp ke anggota terkait.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500">
                    <th className="py-2 pr-3">Anggota</th>
                    <th className="py-2 pr-3 text-right">Angsuran/Bln</th>
                    <th className="py-2 pr-3 text-right">Sisa Pinjaman</th>
                    <th className="py-2 text-right">WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {activeLoans.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-stone-400">
                        Semua pinjaman sudah lunas.
                      </td>
                    </tr>
                  ) : (
                    activeLoans.map((p) => {
                      const info = memberMap.get(p.idAnggota);
                      const nama = info?.nama || p.idAnggota;
                      const nohp = info?.nohp || '';
                      const waNum = formatNoWA(nohp);
                      const pesan = `Assalamu'alaikum ${nama},\n\nKami informasikan bahwa angsuran pinjaman Anda masih berjalan.\n\nID Pinjaman: ${p.idPinjaman}\nAngsuran yang harus dibayar: ${rupiah(p.angsuranPerBulan)}\nSisa pinjaman: ${rupiah(p.sisa)}\n\nMohon segera melakukan pembayaran angsuran.\n\nTerima kasih.`;
                      const waUrl = `https://wa.me/${waNum}?text=${encodeURIComponent(pesan)}`;

                      return (
                        <tr key={p.idPinjaman} className="hover:bg-stone-50/90">
                          <td className="py-3 pr-3">
                            <div className="font-semibold text-stone-900">{nama}</div>
                            <div className="font-mono text-xs text-stone-500">
                              {p.idPinjaman} · {nohp || 'Tanpa HP'}
                            </div>
                          </td>
                          <td className="py-3 pr-3 text-right font-mono tabular-nums text-stone-700">
                            {rupiah(p.angsuranPerBulan)}
                          </td>
                          <td className="py-3 pr-3 text-right font-mono font-semibold tabular-nums text-[#B45309]">
                            {rupiah(p.sisa)}
                          </td>
                          <td className="py-3 text-right">
                            {waNum.length >= 10 ? (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-900/20 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-[#065F46] hover:bg-emerald-100"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                Tagih WA
                              </a>
                            ) : (
                              <span className="text-xs text-stone-400">No HP belum ada</span>
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
      </div>

      <div className="rounded-xl border border-stone-200/90 bg-white p-6">
        <h3 className="mb-3 text-base font-semibold text-stone-900">
          Riwayat Angsuran & Cetak Kwitansi
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500">
                <th className="py-2 pr-3">ID Angsuran</th>
                <th className="py-2 pr-3">Tanggal</th>
                <th className="py-2 pr-3">Anggota</th>
                <th className="py-2 pr-3">Ke</th>
                <th className="py-2 pr-3 text-right">Dibayar</th>
                <th className="py-2 pr-3 text-right">Sisa</th>
                <th className="py-2 text-right">Kwitansi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {dataset.angsuran.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-stone-400">
                    Belum ada riwayat pembayaran angsuran.
                  </td>
                </tr>
              ) : (
                [...dataset.angsuran]
                  .reverse()
                  .slice(0, 40)
                  .map((ang) => (
                    <tr key={ang.idAngsuran} className="hover:bg-stone-50/90">
                      <td className="py-3 pr-3 font-mono text-xs text-stone-700">
                        {ang.idAngsuran}
                      </td>
                      <td className="py-3 pr-3 text-xs text-stone-500">
                        {formatTanggalId(ang.tanggal)}
                      </td>
                      <td className="py-3 pr-3 font-medium text-stone-900">
                        {memberMap.get(ang.idAnggota)?.nama || ang.idAnggota}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-stone-600">
                        Ke-{ang.angsuranKe}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono font-semibold tabular-nums text-[#065F46]">
                        {rupiah(ang.jumlah)}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono tabular-nums text-stone-700">
                        {rupiah(ang.sisa)}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onShowKwitansi(ang)}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          Kwitansi
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
