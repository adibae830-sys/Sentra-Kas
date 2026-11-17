import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { rupiah } from '../lib/financeEngine';
import { FinanceDataset, Pinjaman } from '../types/finance';
import { CurrencyInput } from './CurrencyInput';

export type QuickRecordTab = 'pemasukan' | 'pengeluaran' | 'angsuran' | 'pinjaman';

interface QuickRecordModalProps {
  isOpen: boolean;
  initialTab?: QuickRecordTab;
  dataset: FinanceDataset;
  onClose: () => void;
  onSaveKasMasuk: (payload: {
    idAnggota: string;
    jenis: string;
    jumlah: number;
    keterangan: string;
  }) => void;
  onSaveKasKeluar: (payload: {
    jenis: string;
    jumlah: number;
    keterangan: string;
  }) => void;
  onSaveAngsuran: (payload: {
    pinjaman: Pinjaman;
    angsuranKe: number;
    jumlah: number;
  }) => void;
  onSavePinjaman: (payload: {
    idAnggota: string;
    jumlah: number;
    tenor: number;
  }) => void;
}

export const QuickRecordModal: React.FC<QuickRecordModalProps> = ({
  isOpen,
  initialTab = 'pemasukan',
  dataset,
  onClose,
  onSaveKasMasuk,
  onSaveKasKeluar,
  onSaveAngsuran,
  onSavePinjaman,
}) => {
  const [activeTab, setActiveTab] = useState<QuickRecordTab>(initialTab);

  // Pemasukan state
  const [masukAnggota, setMasukAnggota] = useState('');
  const [masukJenis, setMasukJenis] = useState('Simpanan');
  const [masukJumlah, setMasukJumlah] = useState('');
  const [masukKet, setMasukKet] = useState('');

  // Pengeluaran state
  const [keluarJenis, setKeluarJenis] = useState('Operasional');
  const [keluarJumlah, setKeluarJumlah] = useState('');
  const [keluarKet, setKeluarKet] = useState('');

  // Angsuran state
  const [angPinjamanId, setAngPinjamanId] = useState('');
  const [angKe, setAngKe] = useState('');
  const [angJumlah, setAngJumlah] = useState('');

  // Pinjaman state
  const [pinjAnggota, setPinjAnggota] = useState('');
  const [pinjJumlah, setPinjJumlah] = useState('');
  const [pinjTenor, setPinjTenor] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const activeMembers = useMemo(
    () => dataset.anggota.filter((a) => a.status === 'Aktif'),
    [dataset.anggota]
  );

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    dataset.anggota.forEach((a) => map.set(a.id, a.nama));
    return map;
  }, [dataset.anggota]);

  const activeLoans = useMemo(
    () => dataset.pinjaman.filter((p) => p.status === 'Berjalan' && p.sisa > 0),
    [dataset.pinjaman]
  );

  const selectedLoan = useMemo(
    () => activeLoans.find((p) => p.idPinjaman === angPinjamanId) || null,
    [activeLoans, angPinjamanId]
  );

  const estimasiAngsuran =
    Number(pinjJumlah) > 0 && Number(pinjTenor) > 0
      ? Number(pinjJumlah) / Number(pinjTenor)
      : 0;

  if (!isOpen) return null;

  const handleSelectLoan = (id: string) => {
    setAngPinjamanId(id);
    const loan = activeLoans.find((p) => p.idPinjaman === id);
    if (loan) {
      const prevCount = dataset.angsuran.filter((a) => a.idPinjaman === id).length;
      setAngKe(String(prevCount + 1));
      setAngJumlah(String(Math.min(Math.round(loan.angsuranPerBulan), loan.sisa)));
    } else {
      setAngKe('');
      setAngJumlah('');
    }
  };

  const handleSubmitMasuk = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(masukJumlah);
    if (!num || num <= 0) return;
    onClose();
    onSaveKasMasuk({
      idAnggota: masukAnggota,
      jenis: masukJenis,
      jumlah: num,
      keterangan: masukKet,
    });
    setMasukJumlah('');
    setMasukKet('');
  };

  const handleSubmitKeluar = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(keluarJumlah);
    if (!num || num <= 0) return;
    onClose();
    onSaveKasKeluar({
      jenis: keluarJenis,
      jumlah: num,
      keterangan: keluarKet,
    });
    setKeluarJumlah('');
    setKeluarKet('');
  };

  const handleSubmitAngsuran = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(angJumlah);
    if (!selectedLoan || !num || num <= 0) return;
    onClose();
    onSaveAngsuran({
      pinjaman: selectedLoan,
      angsuranKe: Number(angKe) || 1,
      jumlah: num,
    });
    setAngPinjamanId('');
    setAngKe('');
    setAngJumlah('');
  };

  const handleSubmitPinjaman = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(pinjJumlah);
    const tnr = Number(pinjTenor);
    if (!pinjAnggota || !num || num <= 0 || !tnr || tnr <= 0) return;
    onClose();
    onSavePinjaman({
      idAnggota: pinjAnggota,
      jumlah: num,
      tenor: tnr,
    });
    setPinjAnggota('');
    setPinjJumlah('');
    setPinjTenor('');
  };

  const tabs: Array<{
    id: QuickRecordTab;
    label: string;
    icon: React.ReactNode;
    activeClass: string;
  }> = [
    {
      id: 'pemasukan',
      label: 'Pemasukan',
      icon: <ArrowDownLeft className="h-3.5 w-3.5" />,
      activeClass: 'bg-emerald-600 text-white shadow-xs',
    },
    {
      id: 'pengeluaran',
      label: 'Pengeluaran',
      icon: <ArrowUpRight className="h-3.5 w-3.5" />,
      activeClass: 'bg-amber-600 text-white shadow-xs',
    },
    {
      id: 'angsuran',
      label: 'Angsuran',
      icon: <FileSpreadsheet className="h-3.5 w-3.5" />,
      activeClass: 'bg-[#1E5B2A] text-white shadow-xs',
    },
    {
      id: 'pinjaman',
      label: 'Pinjaman',
      icon: <CreditCard className="h-3.5 w-3.5" />,
      activeClass: 'bg-[#1E5B2A] text-white shadow-xs',
    },
  ];

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-record-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-2xl sm:pb-0">
        {/* Header KSP SENTRA Forest Green */}
        <div className="shrink-0 bg-gradient-to-r from-[#103D1B] via-[#1B5727] to-[#287336] px-5 pt-3 pb-4 text-white">
          <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-white/30 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 id="quick-record-title" className="text-base font-bold text-white">
                Catat Transaksi Cepat
              </h3>
              <p className="text-[11px] text-emerald-100/90">
                Langsung simpan pemasukan, pengeluaran, angsuran, atau pinjaman
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-emerald-100 hover:bg-white/20 hover:text-white"
              aria-label="Tutup form catat cepat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 4-Tab Selector */}
          <div className="mt-3.5 grid grid-cols-4 gap-1 rounded-xl bg-black/20 p-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-h-[38px] items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs ${
                    isActive
                      ? tab.activeClass
                      : 'text-blue-100/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="hidden sm:inline">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto p-5">
          {activeTab === 'pemasukan' && (
            <form onSubmit={handleSubmitMasuk} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Anggota (Opsional untuk Kas Umum)
                </label>
                <select
                  value={masukAnggota}
                  onChange={(e) => setMasukAnggota(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                >
                  <option value="">-- Pilih Anggota (Opsional) --</option>
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama} ({m.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Jenis Pemasukan
                  </label>
                  <select
                    value={masukJenis}
                    onChange={(e) => setMasukJenis(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                  >
                    <option value="Simpanan">Simpanan</option>
                    <option value="Angsuran">Angsuran</option>
                    <option value="Denda">Denda</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Nominal (Rp)
                  </label>
                  <CurrencyInput
                    required
                    value={masukJumlah}
                    onValueChange={(digits) => setMasukJumlah(digits)}
                    placeholder="100.000"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Keterangan
                </label>
                <textarea
                  rows={2}
                  value={masukKet}
                  onChange={(e) => setMasukKet(e.target.value)}
                  placeholder="Contoh: Simpanan wajib bulan ini..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] flex-1 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-initial"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] flex-1 whitespace-nowrap rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Simpan Pemasukan
                </button>
              </div>
            </form>
          )}

          {activeTab === 'pengeluaran' && (
            <form onSubmit={handleSubmitKeluar} className="space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Kategori Pengeluaran
                  </label>
                  <select
                    value={keluarJenis}
                    onChange={(e) => setKeluarJenis(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
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
                    Nominal (Rp)
                  </label>
                  <CurrencyInput
                    required
                    value={keluarJumlah}
                    onValueChange={(digits) => setKeluarJumlah(digits)}
                    placeholder="50.000"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Keterangan
                </label>
                <textarea
                  rows={2}
                  required
                  value={keluarKet}
                  onChange={(e) => setKeluarKet(e.target.value)}
                  placeholder="Rincian keperluan pengeluaran..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] flex-1 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-initial"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] flex-1 whitespace-nowrap rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                >
                  Simpan Pengeluaran
                </button>
              </div>
            </form>
          )}

          {activeTab === 'angsuran' && (
            <form onSubmit={handleSubmitAngsuran} className="space-y-3.5">
              {activeLoans.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] p-5 text-center text-xs text-slate-500">
                  Tidak ada pinjaman berstatus Berjalan saat ini.
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Pilih Pinjaman Berjalan
                    </label>
                    <select
                      required
                      value={angPinjamanId}
                      onChange={(e) => handleSelectLoan(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                    >
                      <option value="">-- Pilih Pinjaman Anggota --</option>
                      {activeLoans.map((p) => {
                        const nama = memberMap.get(p.idAnggota) || p.idAnggota;
                        return (
                          <option key={p.idPinjaman} value={p.idPinjaman}>
                            {nama} · Sisa {rupiah(p.sisa)} ({p.idPinjaman})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {selectedLoan && (
                    <div className="grid grid-cols-2 gap-3 rounded-xl border border-emerald-200 bg-[#EAF4EC]/70 p-3 text-xs">
                      <div>
                        <span className="text-slate-500">Anggota</span>
                        <p className="font-bold text-slate-900">
                          {memberMap.get(selectedLoan.idAnggota) || selectedLoan.idAnggota}
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
                        value={angKe}
                        onChange={(e) => setAngKe(e.target.value)}
                        placeholder="1"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Jumlah Bayar (Rp)
                      </label>
                      <CurrencyInput
                        required
                        value={angJumlah}
                        onValueChange={(digits) => setAngJumlah(digits)}
                        placeholder="100.000"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] flex-1 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-initial"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!selectedLoan || Number(angJumlah) <= 0}
                  className="min-h-[44px] flex-1 whitespace-nowrap rounded-xl bg-[#1E5B2A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#154620] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Proses Angsuran
                </button>
              </div>
            </form>
          )}

          {activeTab === 'pinjaman' && (
            <form onSubmit={handleSubmitPinjaman} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Pilih Anggota
                </label>
                <select
                  required
                  value={pinjAnggota}
                  onChange={(e) => setPinjAnggota(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                >
                  <option value="">-- Pilih Anggota Aktif --</option>
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama} ({m.id})
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
                    value={pinjJumlah}
                    onValueChange={(digits) => setPinjJumlah(digits)}
                    placeholder="1.000.000"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900"
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
                    value={pinjTenor}
                    onChange={(e) => setPinjTenor(e.target.value)}
                    placeholder="10"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm text-slate-900"
                  />
                </div>
              </div>

              {estimasiAngsuran > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-[#EAF4EC]/70 px-3.5 py-2.5 text-xs">
                  <span className="text-slate-600">Estimasi Angsuran/Bulan</span>
                  <span className="font-mono font-bold tabular-nums text-[#1E5B2A]">
                    {rupiah(estimasiAngsuran)}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] flex-1 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-initial"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] flex-1 whitespace-nowrap rounded-xl bg-[#1E5B2A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#154620]"
                >
                  Simpan & Cairkan
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
