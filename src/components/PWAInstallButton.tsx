import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export { useOnlineStatus, usePWAInstall };

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isInAppBrowser, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-amber-300/80 bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#103D1B] shadow-xs transition-colors hover:bg-amber-300 active:bg-amber-200"
      >
        <Download className="h-3.5 w-3.5" />
        Install Aplikasi
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <Smartphone className="h-3.5 w-3.5 text-[#1E5B2A]" />
        Pasang di HP / Desktop
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Pasang KSP SENTRA sebagai Aplikasi
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Tutup panduan pasang"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isInAppBrowser ? (
              <div className="space-y-2.5 text-sm text-slate-600">
                <p>
                  Anda sedang membuka link dari browser bawaan aplikasi (seperti WhatsApp/pratinjau). Browser tersebut belum mengizinkan pemasangan otomatis 1 klik.
                </p>
                <ol className="list-decimal space-y-1.5 pl-5">
                  <li>
                    Ketuk menu <strong className="text-slate-900">⋮</strong> di pojok kanan atas lalu pilih{' '}
                    <strong className="text-slate-900">Buka di Chrome / Browser</strong>.
                  </li>
                  <li>
                    Setelah terbuka di Chrome, ketuk tombol{' '}
                    <strong className="text-slate-900">Install Aplikasi</strong> di bagian atas untuk pasang langsung tanpa menu titik tiga.
                  </li>
                </ol>
              </div>
            ) : isIOS ? (
              <div className="space-y-2 text-sm text-slate-600">
                <p>Untuk memasang di iPhone / iPad (Safari):</p>
                <ol className="list-decimal space-y-1.5 pl-5">
                  <li>
                    Ketuk ikon <strong className="text-slate-900">Bagikan (Share)</strong> di bilah bawah Safari.
                  </li>
                  <li>
                    Gulir ke bawah lalu pilih{' '}
                    <strong className="text-slate-900">Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                  </li>
                  <li>
                    Ketuk <strong className="text-slate-900">Tambah</strong> — aplikasi KSP SENTRA siap dibuka langsung dari layar utama.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2.5 text-sm text-slate-600">
                <p>
                  Browser saat ini belum memunculkan popup pasang otomatis (biasanya karena aplikasi sudah pernah dipasang atau tombol popup sebelumnya sempat ditutup).
                </p>
                <ol className="list-decimal space-y-1.5 pl-5">
                  <li>
                    Jika belum terpasang: ketuk menu{' '}
                    <strong className="text-slate-900">⋮ → Instal aplikasi / Tambahkan ke layar utama</strong> di Chrome/Edge.
                  </li>
                  <li>
                    Atau muat ulang halaman (<strong className="text-slate-900">Refresh</strong>) hingga tombol berubah menjadi kuning{' '}
                    <strong className="text-slate-900">Install Aplikasi</strong> untuk pemasangan langsung 1 klik.
                  </li>
                </ol>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-xl bg-[#1E5B2A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#154620]"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      className="no-print fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-md"
      role="status"
    >
      <WifiOff className="h-3.5 w-3.5" />
      <span>Koneksi terputus — Sinkronisasi Spreadsheet menunggu jaringan.</span>
    </div>
  );
};
