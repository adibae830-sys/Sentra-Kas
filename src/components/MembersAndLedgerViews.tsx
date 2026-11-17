import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { formatTanggalId, rupiah } from '../lib/financeEngine';
import { Anggota, FinanceDataset, KasKeluar, KasMasuk } from '../types/finance';
import { CurrencyInput } from './CurrencyInput';

interface DataAnggotaViewProps {
  dataset: FinanceDataset;
  onSaveAnggota: (payload: { nama: string; alamat: string; nohp: string }) => void;
  onUpdateAnggota: (payload: Anggota) => void;
  onDeleteAnggota: (anggota: Anggota) => void;
}

export const DataAnggotaView: React.FC<DataAnggotaViewProps> = ({
  dataset,
  onSaveAnggota,
  onUpdateAnggota,
  onDeleteAnggota,
}) => {
  const [nama, setNama] = useState('');
  const [alamat, setAlamat] = useState('');
  const [nohp, setNohp] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Aktif' | 'Nonaktif'>('Semua');
  const [editing, setEditing] = useState<Anggota | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.anggota.filter((a) => {
      const matchSearch =
        !q ||
        a.nama.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.nohp.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'Semua' || a.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [dataset.anggota, search, statusFilter]);

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveAnggota({ nama, alamat, nohp });
    setNama('');
    setAlamat('');
    setNohp('');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Tambah Anggota Baru</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Mendaftarkan nasabah/anggota baru ke buku besar dengan nomor anggota otomatis.
        </p>

        <form
          onSubmit={handleSubmitNew}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12"
        >
          <input
            type="text"
            required
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Nama lengkap"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-4"
          />
          <input
            type="text"
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
            placeholder="Alamat"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-4"
          />
          <input
            type="tel"
            required
            value={nohp}
            onChange={(e) => setNohp(e.target.value)}
            placeholder="No HP / WhatsApp (08...)"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#004A8F] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#003870] md:col-span-2"
          >
            <Plus className="h-4 w-4" />
            Simpan
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, ID, atau No HP..."
              className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-[#F2F6FA] p-1">
            {(['Semua', 'Aktif', 'Nonaktif'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === tab
                    ? 'bg-white text-[#004A8F] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Cards (md:hidden) */}
        <div className="space-y-3 md:hidden">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              Tidak ada data anggota yang cocok.
            </div>
          ) : (
            filtered.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-slate-200 bg-[#F8FAFD] p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">{a.nama}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {a.nohp || 'Tanpa No HP'} · {formatTanggalId(a.tanggal)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      a.status === 'Aktif'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                {a.alamat && (
                  <p className="mt-1.5 text-xs text-slate-600">{a.alamat}</p>
                )}
                <div className="mt-3 flex items-center gap-2 border-t border-slate-200/70 pt-2.5">
                  <button
                    type="button"
                    onClick={() => setEditing(a)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 active:bg-slate-100"
                  >
                    <Pencil className="h-3.5 w-3.5 text-[#00529C]" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteAnggota(a)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 active:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </button>
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
                <th className="py-2.5 pr-3">Alamat</th>
                <th className="py-2.5 pr-3">No HP / WA</th>
                <th className="py-2.5 pr-3">Tanggal Daftar</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    Tidak ada data anggota yang cocok.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/90">
                    <td className="py-3.5 pr-3 font-mono text-xs text-slate-500">{a.id}</td>
                    <td className="py-3.5 pr-3 font-semibold text-slate-900">{a.nama}</td>
                    <td className="py-3.5 pr-3 text-slate-600">{a.alamat || '-'}</td>
                    <td className="py-3.5 pr-3 font-mono text-xs text-slate-700">{a.nohp}</td>
                    <td className="py-3.5 pr-3 text-xs text-slate-500">
                      {formatTanggalId(a.tanggal)}
                    </td>
                    <td className="py-3.5 pr-3 text-xs font-semibold">
                      <span
                        className={
                          a.status === 'Aktif' ? 'text-emerald-700' : 'text-slate-400'
                        }
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(a)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5 text-[#00529C]" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteAnggota(a)}
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

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Edit Data Anggota · {editing.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Nama</label>
                <input
                  type="text"
                  value={editing.nama}
                  onChange={(e) => setEditing({ ...editing, nama: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Alamat</label>
                <input
                  type="text"
                  value={editing.alamat}
                  onChange={(e) => setEditing({ ...editing, alamat: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">No HP / WA</label>
                <input
                  type="text"
                  value={editing.nohp}
                  onChange={(e) => setEditing({ ...editing, nohp: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Status</label>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = editing;
                  setEditing(null);
                  onUpdateAnggota(target);
                }}
                className="rounded-xl bg-[#004A8F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003870]"
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

interface KasMasukViewProps {
  dataset: FinanceDataset;
  onSaveKasMasuk: (payload: {
    idAnggota: string;
    jenis: string;
    jumlah: number;
    keterangan: string;
  }) => void;
  onUpdateKasMasuk: (item: KasMasuk) => void;
  onDeleteKasMasuk: (item: KasMasuk) => void;
}

export const KasMasukView: React.FC<KasMasukViewProps> = ({
  dataset,
  onSaveKasMasuk,
  onUpdateKasMasuk,
  onDeleteKasMasuk,
}) => {
  const [idAnggota, setIdAnggota] = useState('');
  const [jenis, setJenis] = useState('Simpanan');
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<KasMasuk | null>(null);

  const activeMembers = useMemo(
    () => dataset.anggota.filter((a) => a.status === 'Aktif'),
    [dataset.anggota]
  );

  const memberNames = useMemo(() => {
    const map = new Map<string, string>();
    dataset.anggota.forEach((a) => map.set(a.id, a.nama));
    return map;
  }, [dataset.anggota]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...dataset.kasMasuk]
      .reverse()
      .filter((r) => {
        if (!q) return true;
        const nama = (memberNames.get(r.idAnggota) || '').toLowerCase();
        return (
          r.id.toLowerCase().includes(q) ||
          r.jenis.toLowerCase().includes(q) ||
          r.keterangan.toLowerCase().includes(q) ||
          nama.includes(q)
        );
      });
  }, [dataset.kasMasuk, search, memberNames]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(jumlah);
    if (!num || num <= 0) return;
    onSaveKasMasuk({ idAnggota, jenis, jumlah: num, keterangan });
    setJumlah('');
    setKeterangan('');
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900">Setoran / Kas Masuk</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Mencatat simpanan, angsuran, denda, atau kredit kas lainnya.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Anggota</label>
              <select
                value={idAnggota}
                onChange={(e) => setIdAnggota(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">-- Pilih Anggota (Opsional untuk umum) --</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id} - {m.nama}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Jenis</label>
              <select
                value={jenis}
                onChange={(e) => setJenis(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Simpanan">Simpanan</option>
                <option value="Angsuran">Angsuran</option>
                <option value="Denda">Denda</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Jumlah (Rp)</label>
              <CurrencyInput
                required
                value={jumlah}
                onValueChange={(digits) => setJumlah(digits)}
                placeholder="100.000"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Keterangan</label>
              <textarea
                rows={2}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Simpanan wajib bulan..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#004A8F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#003870]"
            >
              Simpan Kas Masuk
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-8">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900">
              Mutasi Kas Masuk ({rows.length})
            </h3>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari anggota, jenis, keterangan..."
                className="w-full rounded-xl border border-slate-300 py-1.5 pr-3 pl-9 text-sm"
              />
            </div>
          </div>

          {/* Mobile Mutasi Kredit Cards (md:hidden) */}
          <div className="space-y-3 md:hidden">
            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                Belum ada catatan kas masuk.
              </div>
            ) : (
              rows.slice(0, 50).map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-[#F8FAFD] p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-block rounded-md bg-[#EBF3FC] px-2 py-0.5 text-[10px] font-bold text-[#004A8F]">
                        {r.jenis}
                      </span>
                      <p className="mt-1 truncate font-bold text-slate-900">
                        {memberNames.get(r.idAnggota) || r.idAnggota || 'Kas Umum'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatTanggalId(r.tanggal)}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-bold tabular-nums text-emerald-700">
                      + {rupiah(r.jumlah)}
                    </p>
                  </div>
                  {r.keterangan && (
                    <p className="mt-1.5 text-xs text-slate-600">{r.keterangan}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-200/70 pt-2.5">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 active:bg-slate-100"
                    >
                      <Pencil className="h-3.5 w-3.5 text-[#00529C]" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteKasMasuk(r)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 active:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </button>
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
                  <th className="py-2.5 pr-3">Tanggal</th>
                  <th className="py-2.5 pr-3">Anggota</th>
                  <th className="py-2.5 pr-3">Jenis</th>
                  <th className="py-2.5 pr-3">Keterangan</th>
                  <th className="py-2.5 pr-3 text-right">Nominal Kredit</th>
                  <th className="py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                      Belum ada catatan kas masuk.
                    </td>
                  </tr>
                ) : (
                  rows.slice(0, 50).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/90">
                      <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate-500">
                        {formatTanggalId(r.tanggal)}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-slate-900">
                        {memberNames.get(r.idAnggota) || r.idAnggota || '-'}
                      </td>
                      <td className="py-3 pr-3 text-xs font-semibold text-[#00529C]">
                        {r.jenis}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{r.keterangan || '-'}</td>
                      <td className="whitespace-nowrap py-3 pr-3 text-right font-mono font-bold tabular-nums text-emerald-700">
                        + {rupiah(r.jumlah)}
                      </td>
                      <td className="whitespace-nowrap py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditing(r)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5 text-[#00529C]" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteKasMasuk(r)}
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
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Edit Kas Masuk · {editing.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Anggota</label>
                <select
                  value={editing.idAnggota}
                  onChange={(e) => setEditing({ ...editing, idAnggota: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">-- Umum / Tanpa Anggota --</option>
                  {dataset.anggota.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} - {m.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Jenis</label>
                  <select
                    value={editing.jenis}
                    onChange={(e) => setEditing({ ...editing, jenis: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="Simpanan">Simpanan</option>
                    <option value="Angsuran">Angsuran</option>
                    <option value="Denda">Denda</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tanggal
                  </label>
                  <input
                    type="text"
                    value={editing.tanggal}
                    onChange={(e) => setEditing({ ...editing, tanggal: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Nominal (Rp)
                </label>
                <CurrencyInput
                  value={editing.jumlah}
                  onValueChange={(_, num) => setEditing({ ...editing, jumlah: num })}
                  placeholder="100.000"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Keterangan
                </label>
                <textarea
                  rows={2}
                  value={editing.keterangan}
                  onChange={(e) => setEditing({ ...editing, keterangan: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={editing.jumlah <= 0}
                onClick={() => {
                  const target = editing;
                  setEditing(null);
                  onUpdateKasMasuk(target);
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

interface KasKeluarViewProps {
  dataset: FinanceDataset;
  onSaveKasKeluar: (payload: {
    jenis: string;
    jumlah: number;
    keterangan: string;
  }) => void;
  onUpdateKasKeluar: (item: KasKeluar) => void;
  onDeleteKasKeluar: (item: KasKeluar) => void;
}

export const KasKeluarView: React.FC<KasKeluarViewProps> = ({
  dataset,
  onSaveKasKeluar,
  onUpdateKasKeluar,
  onDeleteKasKeluar,
}) => {
  const [jenis, setJenis] = useState('Operasional');
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<KasKeluar | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...dataset.kasKeluar]
      .reverse()
      .filter((r) => {
        if (!q) return true;
        return (
          r.id.toLowerCase().includes(q) ||
          r.jenis.toLowerCase().includes(q) ||
          r.keterangan.toLowerCase().includes(q)
        );
      });
  }, [dataset.kasKeluar, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(jumlah);
    if (!num || num <= 0) return;
    onSaveKasKeluar({ jenis, jumlah: num, keterangan });
    setJumlah('');
    setKeterangan('');
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900">Input Kas Keluar</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Mencatat pengeluaran operasional atau mutasi debit kelompok lainnya.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Jenis Pengeluaran
              </label>
              <select
                value={jenis}
                onChange={(e) => setJenis(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Operasional">Operasional</option>
                <option value="Pencairan Pinjaman">Pencairan Pinjaman</option>
                <option value="Konsumsi Rapat">Konsumsi Rapat</option>
                <option value="Sosial / Santunan">Sosial / Santunan</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Jumlah (Rp)</label>
              <CurrencyInput
                required
                value={jumlah}
                onValueChange={(digits) => setJumlah(digits)}
                placeholder="50.000"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Keterangan</label>
              <textarea
                rows={2}
                required
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Rincian pengeluaran..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
            >
              Simpan Kas Keluar
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-8">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900">
              Mutasi Kas Keluar ({rows.length})
            </h3>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kategori atau keterangan..."
                className="w-full rounded-xl border border-slate-300 py-1.5 pr-3 pl-9 text-sm"
              />
            </div>
          </div>

          {/* Mobile Mutasi Debit Cards (md:hidden) */}
          <div className="space-y-3 md:hidden">
            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                Belum ada pengeluaran tercatat.
              </div>
            ) : (
              rows.slice(0, 50).map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-[#F8FAFD] p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        {r.jenis}
                      </span>
                      <p className="mt-1 text-xs font-semibold text-slate-900">
                        {r.keterangan || '-'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatTanggalId(r.tanggal)} · {r.user || 'Admin'}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-bold tabular-nums text-amber-600">
                      - {rupiah(r.jumlah)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-200/70 pt-2.5">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 active:bg-slate-100"
                    >
                      <Pencil className="h-3.5 w-3.5 text-[#00529C]" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteKasKeluar(r)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 active:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </button>
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
                  <th className="py-2.5 pr-3">Tanggal</th>
                  <th className="py-2.5 pr-3">Kategori</th>
                  <th className="py-2.5 pr-3">Keterangan</th>
                  <th className="py-2.5 pr-3">Petugas</th>
                  <th className="py-2.5 pr-3 text-right">Nominal Debit</th>
                  <th className="py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                      Belum ada pengeluaran tercatat.
                    </td>
                  </tr>
                ) : (
                  rows.slice(0, 50).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/90">
                      <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate-500">
                        {formatTanggalId(r.tanggal)}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-slate-900">{r.jenis}</td>
                      <td className="py-3 pr-3 text-slate-600">{r.keterangan || '-'}</td>
                      <td className="py-3 pr-3 text-xs text-slate-500">{r.user || '-'}</td>
                      <td className="whitespace-nowrap py-3 pr-3 text-right font-mono font-bold tabular-nums text-amber-600">
                        - {rupiah(r.jumlah)}
                      </td>
                      <td className="whitespace-nowrap py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditing(r)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5 text-[#00529C]" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteKasKeluar(r)}
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
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Edit Kas Keluar · {editing.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Kategori
                  </label>
                  <select
                    value={editing.jenis}
                    onChange={(e) => setEditing({ ...editing, jenis: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="Operasional">Operasional</option>
                    <option value="Pencairan Pinjaman">Pencairan Pinjaman</option>
                    <option value="Konsumsi Rapat">Konsumsi Rapat</option>
                    <option value="Sosial / Santunan">Sosial / Santunan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tanggal
                  </label>
                  <input
                    type="text"
                    value={editing.tanggal}
                    onChange={(e) => setEditing({ ...editing, tanggal: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Nominal (Rp)
                </label>
                <CurrencyInput
                  value={editing.jumlah}
                  onValueChange={(_, num) => setEditing({ ...editing, jumlah: num })}
                  placeholder="50.000"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Keterangan
                </label>
                <textarea
                  rows={2}
                  value={editing.keterangan}
                  onChange={(e) => setEditing({ ...editing, keterangan: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={editing.jumlah <= 0}
                onClick={() => {
                  const target = editing;
                  setEditing(null);
                  onUpdateKasKeluar(target);
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
