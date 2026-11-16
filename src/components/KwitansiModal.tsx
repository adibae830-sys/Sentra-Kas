import React from 'react';
import { Printer, X } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kwitansi-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-stone-200 bg-white p-6 shadow-2xl">
        <div className="no-print mb-4 flex items-center justify-between border-b border-stone-200 pb-3">
          <h3 id="kwitansi-title" className="text-base font-semibold text-stone-900">
            Kwitansi Resmi Pembayaran Angsuran
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="Tutup kwitansi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 rounded-lg border border-stone-200 bg-[#FAF9F6] p-5">
          <div className="flex items-start justify-between border-b border-stone-200 pb-4">
            <div>
              <p className="text-xs font-semibold text-[#065F46]">Sentra Kas Kelompok</p>
              <h4 className="font-editorial text-xl font-bold text-stone-900">
                BUKTI ANGSURAN
              </h4>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs font-semibold text-stone-900">
                {angsuran.idAngsuran}
              </p>
              <p className="text-xs text-stone-500">{formatTanggalId(angsuran.tanggal)}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-stone-500">Anggota</dt>
              <dd className="font-semibold text-stone-900">
                {namaAnggota || angsuran.idAnggota}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">ID Anggota</dt>
              <dd className="font-mono text-stone-800">{angsuran.idAnggota}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">ID Pinjaman</dt>
              <dd className="font-mono text-stone-800">{angsuran.idPinjaman}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Angsuran Ke</dt>
              <dd className="font-mono tabular-nums text-stone-900">
                Ke-{angsuran.angsuranKe}
              </dd>
            </div>
          </dl>

          <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3.5">
            <span className="text-sm font-medium text-stone-700">Jumlah Dibayar</span>
            <span className="font-mono text-lg font-bold tabular-nums text-[#065F46]">
              {rupiah(angsuran.jumlah)}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-600">Sisa Kewajiban Pinjaman</span>
            <span className="font-mono font-semibold tabular-nums text-stone-900">
              {rupiah(angsuran.sisa)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-6 text-center text-xs text-stone-600">
            <div>
              <p>Penyetor / Anggota</p>
              <div className="mt-10 border-t border-stone-300 pt-1.5 font-medium text-stone-800">
                {namaAnggota || angsuran.idAnggota}
              </div>
            </div>
            <div>
              <p>Petugas Penerima</p>
              <div className="mt-10 border-t border-stone-300 pt-1.5 font-medium text-stone-800">
                {angsuran.user || 'Administrator'}
              </div>
            </div>
          </div>
        </div>

        <div className="no-print mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="whitespace-nowrap shrink-0 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#0B2821] px-4 py-2 text-sm font-semibold text-white hover:bg-[#12382E]"
          >
            <Printer className="h-4 w-4" />
            Cetak / Simpan PDF
          </button>
        </div>
      </div>
    </div>
  );
};
