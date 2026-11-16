import React, { useMemo, useState } from 'react';
import { CheckCircle, MessageCircle, Pencil, Receipt, Trash2, X, XCircle } from 'lucide-react';
import { formatNoWA, formatTanggalId, rupiah } from '../lib/financeEngine';
import { Angsuran, FinanceDataset, Pinjaman, RoleType } from '../types/finance';
import { CurrencyInput } from './CurrencyInput';

interface PinjamanAndAccViewProps {
  dataset: FinanceDataset;
  role: RoleType;
  onSavePinjaman: (payload: { idAnggota: string; jumlah: number; tenor: number }) => void;
  onAccPinjaman: (pinjaman: Pinjaman) => void;
  onTolakPinjaman: (pinjaman: Pinjaman) => void;
  onUpdatePinjaman: (pinjaman: Pinjaman) => void;
  onDeletePinjaman: (pinjaman: Pinjaman) => void;
}

export const PinjamanAndAccView: React.FC<PinjamanAndAccViewProps> = ({
  dataset,
  role,
  onSavePinjaman,
  onAccPinjaman,
  onTolakPinjaman,
  onUpdatePinjaman,
  onDeletePinjaman,
}) => {
  const [idAnggota, setIdAnggota] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [tenor, setTenor] = useState('');
  const [editingLoan, setEditingLoan] = useState<Pinjaman | null>(null);

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
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">Fasilitas Pinjaman Baru</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Pinjaman yang diinput admin atau bendahara langsung aktif berstatus Berjalan dan mencatat Kas Keluar.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Anggota</label>
                <select
                  required
                  value={idAnggota}
                  onChange={(e) => setIdAnggota(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Plafon Pinjaman (Rp)
                  </label>
                  <CurrencyInput
                    required
                    value={jumlah}
                    onValueChange={(digits) => setJumlah(digits)}
                    placeholder="1.000.000"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tenor (Bulan)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={tenor}
                    onChange={(e) => setTenor(e.target.value)}
                    placeholder="10"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              {estimasiAngsuran > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-[#EBF3FC]/70 px-3.5 py-2.5 text-xs">
                  <span className="text-slate-600">Estimasi Angsuran/Bulan</span>
                  <span className="font-mono font-bold tabular-nums text-[#004A8F]">
                    {rupiah(estimasiAngsuran)}
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-[#004A8F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#003870]"
              >
                Simpan & Cairkan Pinjaman
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Antrean Persetujuan Pinjaman ({pendingLoans.length})
              </h3>
              <p className="text-xs text-slate-500">
                Pengajuan mandiri dari anggota yang menunggu otorisasi Administrator.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-2 pr-3">ID & Tanggal</th>
                    <th className="py-2 pr-3">Anggota</th>
                    <th className="py-2 pr-3 text-right">Jumlah</th>
                    <th className="py-2 pr-3 text-right">Tenor</th>
                    <th className="py-2 text-right">Keputusan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingLoans.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                        Tidak ada pengajuan pinjaman yang menunggu ACC.
                      </td>
                    </tr>
                  ) : (
                    pendingLoans.map((p) => (
                      <tr key={p.idPinjaman}>
                        <td className="py-3 pr-3">
                          <div className="font-mono text-xs font-semibold text-slate-900">
                            {p.idPinjaman}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatTanggalId(p.tanggal)}
                          </div>
                        </td>
                        <td className="py-3 pr-3 font-semibold text-slate-900">
                          {memberMap.get(p.idAnggota) || p.idAnggota}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums text-slate-900">
                          {rupiah(p.jumlah)}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-xs text-slate-600">
                          {p.tenor} bln
                        </td>
                        <td className="py-3 text-right">
                          {role === 'Administrator' ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onAccPinjaman(p)}
                                className="inline-flex items-center gap-1 rounded-xl bg-[#004A8F] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#003870]"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                ACC
                              </button>
                              <button
                                type="button"
                                onClick={() => onTolakPinjaman(p)}
                                className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Tolak
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">Khusus Admin</span>
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

      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <h3 className="mb-3 text-base font-bold text-slate-900">
          Portofolio Pinjaman Kelompok ({allLoans.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-3">ID Pinjaman</th>
                <th className="py-2.5 pr-3">Anggota</th>
                <th className="py-2.5 pr-3 text-right">Pokok Pinjaman</th>
                <th className="py-2.5 pr-3 text-right">Angsuran/Bln</th>
                <th className="py-2.5 pr-3 text-right">Total Dibayar</th>
                <th className="py-2.5 pr-3 text-right">Sisa</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allLoans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-slate-400">
                    Belum ada catatan pinjaman.
                  </td>
                </tr>
              ) : (
                allLoans.map((p) => (
                  <tr key={p.idPinjaman} className="hover:bg-slate-50/90">
                    <td className="py-3 pr-3">
                      <div className="font-mono text-xs font-semibold text-slate-900">
                        {p.idPinjaman}
                      </div>
                      <div className="text-xs text-slate-500">{formatTanggalId(p.tanggal)}</div>
                    </td>
                    <td className="py-3 pr-3 font-semibold text-slate-900">
                      {memberMap.get(p.idAnggota) || p.idAnggota}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-slate-900">
                      {rupiah(p.jumlah)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-slate-600">
                      {rupiah(p.angsuranPerBulan)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-emerald-700">
                      {rupiah(p.totalDibayar)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-slate-900">
                      {rupiah(p.sisa)}
                    </td>
                    <td className="py-3 pr-3 text-xs font-semibold">
                      <span
                        className={
                          p.status === 'Lunas'
                            ? 'text-emerald-700'
                            : p.status === 'Berjalan'
                            ? 'text-[#00529C]'
                            : p.status === 'Ditolak'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingLoan(p)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5 text-[#00529C]" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePinjaman(p)}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingLoan && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Edit Data Pinjaman · {editingLoan.idPinjaman}
              </h3>
              <button
                type="button"
                onClick={() => setEditingLoan(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Anggota</label>
                <select
                  value={editingLoan.idAnggota}
                  onChange={(e) => setEditingLoan({ ...editingLoan, idAnggota: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {dataset.anggota.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} - {m.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Pokok Pinjaman (Rp)
                  </label>
                  <CurrencyInput
                    value={editingLoan.jumlah}
                    onValueChange={(_, jml) => {
                      const tnr = Math.max(editingLoan.tenor, 1);
                      const sisa = Math.max(jml - editingLoan.totalDibayar, 0);
                      setEditingLoan({
                        ...editingLoan,
                        jumlah: jml,
                        angsuranPerBulan: Math.round(jml / tnr),
                        sisa,
                      });
                    }}
                    placeholder="1.000.000"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tenor (Bulan)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingLoan.tenor}
                    onChange={(e) => {
                      const tnr = Math.max(Number(e.target.value) || 1, 1);
                      setEditingLoan({
                        ...editingLoan,
                        tenor: tnr,
                        angsuranPerBulan: Math.round(editingLoan.jumlah / tnr),
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Status</label>
                  <select
                    value={editingLoan.status}
                    onChange={(e) => setEditingLoan({ ...editingLoan, status: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="Menunggu">Menunggu</option>
                    <option value="Berjalan">Berjalan</option>
                    <option value="Lunas">Lunas</option>
                    <option value="Ditolak">Ditolak</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tanggal
                  </label>
                  <input
                    type="text"
                    value={editingLoan.tanggal}
                    onChange={(e) => setEditingLoan({ ...editingLoan, tanggal: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-blue-200 bg-[#EBF3FC]/70 px-3.5 py-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Angsuran/Bulan</span>
                  <span className="font-mono font-bold text-[#004A8F]">
                    {rupiah(editingLoan.angsuranPerBulan)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-slate-600">Sisa Pinjaman</span>
                  <span className="font-mono font-bold text-slate-900">
                    {rupiah(editingLoan.sisa)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingLoan(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={editingLoan.jumlah <= 0 || editingLoan.tenor <= 0}
                onClick={() => {
                  const target = editingLoan;
                  setEditingLoan(null);
                  onUpdatePinjaman(target);
                }}
                className="rounded-xl bg-[#004A8F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003870] disabled:opacity-50"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
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
  onUpdateAngsuran: (angsuran: Angsuran) => void;
  onDeleteAngsuran: (angsuran: Angsuran) => void;
  onShowKwitansi: (angsuran: Angsuran) => void;
}

export const AngsuranAndTunggakanView: React.FC<AngsuranAndTunggakanViewProps> = ({
  dataset,
  onSaveAngsuran,
  onUpdateAngsuran,
  onDeleteAngsuran,
  onShowKwitansi,
}) => {
  const [selectedPinjamanId, setSelectedPinjamanId] = useState('');
  const [angsuranKe, setAngsuranKe] = useState('');
  const [jumlahBayar, setJumlahBayar] = useState('');
  const [editingAngsuran, setEditingAngsuran] = useState<Angsuran | null>(null);

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
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">Pembayaran Angsuran</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Otomatis memperbarui sisa pinjaman dan mencatat mutasi Kas Masuk.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Pilih Pinjaman Berjalan
                </label>
                <select
                  required
                  value={selectedPinjamanId}
                  onChange={(e) => handleSelectLoan(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-blue-200 bg-[#EBF3FC]/70 p-3 text-xs">
                  <div>
                    <span className="text-slate-500">Anggota</span>
                    <p className="font-bold text-slate-900">
                      {memberMap.get(selectedLoan.idAnggota)?.nama || selectedLoan.idAnggota}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Sisa Kewajiban</span>
                    <p className="font-mono font-bold tabular-nums text-amber-600">
                      {rupiah(selectedLoan.sisa)}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Angsuran Ke
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={angsuranKe}
                    onChange={(e) => setAngsuranKe(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Jumlah Bayar (Rp)
                  </label>
                  <CurrencyInput
                    required
                    value={jumlahBayar}
                    onValueChange={(digits) => setJumlahBayar(digits)}
                    placeholder="100.000"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-[#004A8F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#003870]"
              >
                Proses Pembayaran Angsuran
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900">
              Pinjaman Berjalan & Pengingat ({activeLoans.length})
            </h3>
            <p className="mt-0.5 mb-4 text-xs text-slate-500">
              Kirim notifikasi tagihan angsuran langsung melalui WhatsApp ke anggota terkait.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-2 pr-3">Anggota</th>
                    <th className="py-2 pr-3 text-right">Angsuran/Bln</th>
                    <th className="py-2 pr-3 text-right">Sisa Pinjaman</th>
                    <th className="py-2 text-right">WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeLoans.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-slate-400">
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
                        <tr key={p.idPinjaman} className="hover:bg-slate-50/90">
                          <td className="py-3 pr-3">
                            <div className="font-semibold text-slate-900">{nama}</div>
                            <div className="font-mono text-xs text-slate-500">
                              {p.idPinjaman} · {nohp || 'Tanpa HP'}
                            </div>
                          </td>
                          <td className="py-3 pr-3 text-right font-mono tabular-nums text-slate-700">
                            {rupiah(p.angsuranPerBulan)}
                          </td>
                          <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-amber-600">
                            {rupiah(p.sisa)}
                          </td>
                          <td className="py-3 text-right">
                            {waNum.length >= 10 ? (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-blue-200 bg-[#EBF3FC] px-3 py-1.5 text-xs font-semibold text-[#004A8F] hover:bg-blue-100"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                Tagih WA
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">No HP belum ada</span>
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

      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <h3 className="mb-3 text-base font-bold text-slate-900">
          Riwayat Angsuran & e-Resi Pembayaran
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-2 pr-3">No. Referensi</th>
                <th className="py-2 pr-3">Tanggal</th>
                <th className="py-2 pr-3">Anggota</th>
                <th className="py-2 pr-3">Ke</th>
                <th className="py-2 pr-3 text-right">Dibayar</th>
                <th className="py-2 pr-3 text-right">Sisa</th>
                <th className="py-2 text-right">Bukti & Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataset.angsuran.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    Belum ada riwayat pembayaran angsuran.
                  </td>
                </tr>
              ) : (
                [...dataset.angsuran]
                  .reverse()
                  .slice(0, 40)
                  .map((ang) => (
                    <tr key={ang.idAngsuran} className="hover:bg-slate-50/90">
                      <td className="py-3 pr-3 font-mono text-xs text-slate-700">
                        {ang.idAngsuran}
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-500">
                        {formatTanggalId(ang.tanggal)}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-slate-900">
                        {memberMap.get(ang.idAnggota)?.nama || ang.idAnggota}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs text-slate-600">
                        Ke-{ang.angsuranKe}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-emerald-700">
                        {rupiah(ang.jumlah)}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono tabular-nums text-slate-700">
                        {rupiah(ang.sisa)}
                      </td>
                      <td className="whitespace-nowrap py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onShowKwitansi(ang)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#004A8F] hover:bg-[#EBF3FC]"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            e-Resi
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAngsuran(ang)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            title="Edit nominal angsuran"
                          >
                            <Pencil className="h-3.5 w-3.5 text-[#00529C]" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteAngsuran(ang)}
                            className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            title="Hapus pembayaran angsuran"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingAngsuran && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Edit Pembayaran · {editingAngsuran.idAngsuran}
              </h3>
              <button
                type="button"
                onClick={() => setEditingAngsuran(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-200 bg-[#EBF3FC]/70 px-3.5 py-2.5 text-xs text-slate-700">
                Pinjaman: <span className="font-mono font-bold">{editingAngsuran.idPinjaman}</span> ·
                Sisa pinjaman di sheet Pinjaman akan otomatis dihitung ulang setelah disimpan.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Angsuran Ke
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingAngsuran.angsuranKe}
                    onChange={(e) =>
                      setEditingAngsuran({
                        ...editingAngsuran,
                        angsuranKe: Number(e.target.value) || 1,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tanggal
                  </label>
                  <input
                    type="text"
                    value={editingAngsuran.tanggal}
                    onChange={(e) =>
                      setEditingAngsuran({ ...editingAngsuran, tanggal: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Nominal Bayar (Rp)
                </label>
                <CurrencyInput
                  value={editingAngsuran.jumlah}
                  onValueChange={(_, num) =>
                    setEditingAngsuran({
                      ...editingAngsuran,
                      jumlah: num,
                    })
                  }
                  placeholder="100.000"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingAngsuran(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={editingAngsuran.jumlah <= 0}
                onClick={() => {
                  const target = editingAngsuran;
                  setEditingAngsuran(null);
                  onUpdateAngsuran(target);
                }}
                className="rounded-xl bg-[#004A8F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003870] disabled:opacity-50"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
