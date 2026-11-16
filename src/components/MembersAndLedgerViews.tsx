import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { formatTanggalId, rupiah } from '../lib/financeEngine';
import { Anggota, FinanceDataset } from '../types/finance';

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
      <div className="rounded-xl border border-stone-200/90 bg-white p-6">
        <h3 className="text-base font-semibold text-stone-900">Tambah Anggota Baru</h3>
        <p className="mt-0.5 text-xs text-stone-500">
          Mendaftarkan anggota baru ke buku besar dengan ID anggota otomatis.
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
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm md:col-span-4"
          />
          <input
            type="text"
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
            placeholder="Alamat"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm md:col-span-4"
          />
          <input
            type="tel"
            required
            value={nohp}
            onChange={(e) => setNohp(e.target.value)}
            placeholder="No HP / WhatsApp (08...)"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm md:col-span-2"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0B2821] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#12382E] md:col-span-2"
          >
            <Plus className="h-4 w-4" />
            Simpan
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-stone-200/90 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, ID, atau No HP..."
              className="w-full rounded-lg border border-stone-300 py-2 pr-3 pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-stone-100 p-1">
            {(['Semua', 'Aktif', 'Nonaktif'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === tab
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500">
                <th className="py-2.5 pr-3">ID Anggota</th>
                <th className="py-2.5 pr-3">Nama</th>
                <th className="py-2.5 pr-3">Alamat</th>
                <th className="py-2.5 pr-3">No HP / WA</th>
                <th className="py-2.5 pr-3">Tanggal Daftar</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-stone-400">
                    Tidak ada data anggota yang cocok.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-stone-50/90">
                    <td className="py-3.5 pr-3 font-mono text-xs text-stone-500">{a.id}</td>
                    <td className="py-3.5 pr-3 font-semibold text-stone-900">{a.nama}</td>
                    <td className="py-3.5 pr-3 text-stone-600">{a.alamat || '-'}</td>
                    <td className="py-3.5 pr-3 font-mono text-xs text-stone-700">{a.nohp}</td>
                    <td className="py-3.5 pr-3 text-xs text-stone-500">
                      {formatTanggalId(a.tanggal)}
                    </td>
                    <td className="py-3.5 pr-3 text-xs font-semibold">
                      <span
                        className={
                          a.status === 'Aktif' ? 'text-[#065F46]' : 'text-stone-400'
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
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteAnggota(a)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
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
          className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-stone-900">
                Edit Data Anggota · {editing.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">Nama</label>
                <input
                  type="text"
                  value={editing.nama}
                  onChange={(e) => setEditing({ ...editing, nama: e.target.value })}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">Alamat</label>
                <input
                  type="text"
                  value={editing.alamat}
                  onChange={(e) => setEditing({ ...editing, alamat: e.target.value })}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">No HP / WA</label>
                <input
                  type="text"
                  value={editing.nohp}
                  onChange={(e) => setEditing({ ...editing, nohp: e.target.value })}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">Status</label>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
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
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
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
                className="rounded-lg bg-[#0B2821] px-4 py-2 text-sm font-semibold text-white hover:bg-[#12382E]"
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
}

export const KasMasukView: React.FC<KasMasukViewProps> = ({
  dataset,
  onSaveKasMasuk,
}) => {
  const [idAnggota, setIdAnggota] = useState('');
  const [jenis, setJenis] = useState('Simpanan');
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [search, setSearch] = useState('');

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
        <div className="rounded-xl border border-stone-200/90 bg-white p-6">
          <h3 className="text-base font-semibold text-stone-900">Input Kas Masuk</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Mencatat simpanan, angsuran, denda, atau pemasukan lain.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-700">Anggota</label>
              <select
                value={idAnggota}
                onChange={(e) => setIdAnggota(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
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
              <label className="mb-1 block text-xs font-semibold text-stone-700">Jenis</label>
              <select
                value={jenis}
                onChange={(e) => setJenis(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="Simpanan">Simpanan</option>
                <option value="Angsuran">Angsuran</option>
                <option value="Denda">Denda</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-700">Jumlah (Rp)</label>
              <input
                type="number"
                min={1}
                required
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                placeholder="100000"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-700">Keterangan</label>
              <textarea
                rows={2}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Simpanan wajib bulan..."
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[#0B2821] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#12382E]"
            >
              Simpan Kas Masuk
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-8">
        <div className="rounded-xl border border-stone-200/90 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-stone-900">
              Riwayat Kas Masuk ({rows.length})
            </h3>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-stone-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari anggota, jenis, keterangan..."
                className="w-full rounded-lg border border-stone-300 py-1.5 pr-3 pl-9 text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500">
                  <th className="py-2.5 pr-3">Tanggal</th>
                  <th className="py-2.5 pr-3">Anggota</th>
                  <th className="py-2.5 pr-3">Jenis</th>
                  <th className="py-2.5 pr-3">Keterangan</th>
                  <th className="py-2.5 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-stone-400">
                      Belum ada catatan kas masuk.
                    </td>
                  </tr>
                ) : (
                  rows.slice(0, 50).map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50/90">
                      <td className="whitespace-nowrap py-3 pr-3 text-xs text-stone-500">
                        {formatTanggalId(r.tanggal)}
                      </td>
                      <td className="py-3 pr-3 font-medium text-stone-900">
                        {memberNames.get(r.idAnggota) || r.idAnggota || '-'}
                      </td>
                      <td className="py-3 pr-3 text-xs font-semibold text-[#065F46]">
                        {r.jenis}
                      </td>
                      <td className="py-3 pr-3 text-stone-600">{r.keterangan || '-'}</td>
                      <td className="whitespace-nowrap py-3 text-right font-mono font-semibold tabular-nums text-[#065F46]">
                        {rupiah(r.jumlah)}
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

interface KasKeluarViewProps {
  dataset: FinanceDataset;
  onSaveKasKeluar: (payload: {
    jenis: string;
    jumlah: number;
    keterangan: string;
  }) => void;
}

export const KasKeluarView: React.FC<KasKeluarViewProps> = ({
  dataset,
  onSaveKasKeluar,
}) => {
  const [jenis, setJenis] = useState('Operasional');
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [search, setSearch] = useState('');

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
        <div className="rounded-xl border border-stone-200/90 bg-white p-6">
          <h3 className="text-base font-semibold text-stone-900">Input Kas Keluar</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Mencatat pengeluaran operasional atau biaya kelompok lainnya.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-700">
                Jenis Pengeluaran
              </label>
              <select
                value={jenis}
                onChange={(e) => setJenis(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="Operasional">Operasional</option>
                <option value="Pencairan Pinjaman">Pencairan Pinjaman</option>
                <option value="Konsumsi Rapat">Konsumsi Rapat</option>
                <option value="Sosial / Santunan">Sosial / Santunan</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-700">Jumlah (Rp)</label>
              <input
                type="number"
                min={1}
                required
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                placeholder="50000"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-700">Keterangan</label>
              <textarea
                rows={2}
                required
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Rincian pengeluaran..."
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[#B45309] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800"
            >
              Simpan Kas Keluar
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-8">
        <div className="rounded-xl border border-stone-200/90 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-stone-900">
              Riwayat Pengeluaran ({rows.length})
            </h3>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-stone-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kategori atau keterangan..."
                className="w-full rounded-lg border border-stone-300 py-1.5 pr-3 pl-9 text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500">
                  <th className="py-2.5 pr-3">Tanggal</th>
                  <th className="py-2.5 pr-3">Kategori</th>
                  <th className="py-2.5 pr-3">Keterangan</th>
                  <th className="py-2.5 pr-3">Petugas</th>
                  <th className="py-2.5 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-stone-400">
                      Belum ada pengeluaran tercatat.
                    </td>
                  </tr>
                ) : (
                  rows.slice(0, 50).map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50/90">
                      <td className="whitespace-nowrap py-3 pr-3 text-xs text-stone-500">
                        {formatTanggalId(r.tanggal)}
                      </td>
                      <td className="py-3 pr-3 font-medium text-stone-900">{r.jenis}</td>
                      <td className="py-3 pr-3 text-stone-600">{r.keterangan || '-'}</td>
                      <td className="py-3 pr-3 text-xs text-stone-500">{r.user || '-'}</td>
                      <td className="whitespace-nowrap py-3 text-right font-mono font-semibold tabular-nums text-[#B45309]">
                        {rupiah(r.jumlah)}
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
