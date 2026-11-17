import React from 'react';
import { CheckCircle2, Printer, X } from 'lucide-react';
import { formatTanggalId, rupiah } from '../lib/financeEngine';
import { Angsuran } from '../types/finance';

interface KwitansiModalProps {
  angsuran: Angsuran | null;
  namaAnggota: string;
  onClose: () => void;
}

export const KwitansiModal: React.FC<KwitansiModalProps> = ({
  angsuran,
  namaAnggota,
  onClose,
}) => {
  if (!angsuran) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kwitansi-title"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-5">
        <div className="no-print mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="no-print mb-3 flex items-center justify-between">
          <h3 id="kwitansi-title" className="text-sm font-bold text-slate-900">
            Bukti Transaksi Pembayaran
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup bukti transaksi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Authentic e-Banking Receipt Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="bg-gradient-to-r from-[#103D1B] via-[#1B5727] to-[#287336] px-5 py-4 text-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <img
                  src="/assets/aistudio/image_1d167c98.png"
                  alt="Logo KSP SENTRA"
                  className="h-7 w-7 rounded-lg bg-[#F7F5EE] p-0.5 object-contain"
                />
                <span className="text-xs font-bold tracking-wider uppercase text-amber-300">
                  KSP SENTRA · e-Resi
                </span>
              </div>
              <span className="font-mono text-[11px] text-emerald-100">
                {angsuran.idAngsuran}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-300" />
              <div>
                <p className="text-sm font-bold text-white">Pembayaran Berhasil</p>
                <p className="text-[11px] text-emerald-100">
                  {formatTanggalId(angsuran.tanggal)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="rounded-xl bg-[#F4F6F3] px-4 py-3 text-center">
              <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Nominal Dibayar
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#1E5B2A]">
                {rupiah(angsuran.jumlah)}
              </p>
            </div>

            <dl className="divide-y divide-dashed divide-slate-200 text-xs">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-500">Nama Anggota</dt>
                <dd className="font-semibold text-slate-900">
                  {namaAnggota || angsuran.idAnggota}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-500">Nomor Anggota</dt>
                <dd className="font-mono font-medium text-slate-800">{angsuran.idAnggota}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-500">Nomor Referensi Pinjaman</dt>
                <dd className="font-mono font-medium text-slate-800">{angsuran.idPinjaman}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-500">Angsuran Periode</dt>
                <dd className="font-mono font-semibold tabular-nums text-slate-900">
                  Ke-{angsuran.angsuranKe}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-500">Sisa Kewajiban Pinjaman</dt>
                <dd className="font-mono font-bold tabular-nums text-amber-700">
                  {rupiah(angsuran.sisa)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-500">Petugas Validasi</dt>
                <dd className="font-medium text-slate-800">
                  {angsuran.user || 'Administrator'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="no-print mt-4 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="whitespace-nowrap shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-[#1E5B2A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#154620]"
          >
            <Printer className="h-3.5 w-3.5" />
            Cetak / Simpan Resi PDF
          </button>
        </div>
      </div>
    </div>
  );
};
