import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#0B2821] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#12382E]"
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
        className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50"
      >
        <Smartphone className="h-3.5 w-3.5" />
        Pasang di HP / Desktop
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-editorial text-lg font-semibold text-stone-900">
                Pasang Sentra Kas sebagai Aplikasi
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-2 text-sm text-stone-600">
                <p>Untuk memasang di iPhone / iPad (Safari):</p>
                <ol className="list-decimal space-y-1.5 pl-5">
                  <li>
                    Ketuk ikon <strong className="text-stone-900">Bagikan (Share)</strong> di bilah bawah Safari.
                  </li>
                  <li>
                    Gulir ke bawah lalu pilih{' '}
                    <strong className="text-stone-900">Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                  </li>
                  <li>
                    Ketuk <strong className="text-stone-900">Tambah</strong> — aplikasi Sentra Kas siap dibuka langsung dari layar utama.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-stone-600">
                <p>
                  Aplikasi ini mendukung pemasangan langsung ke layar utama Android maupun Desktop (Chrome / Edge):
                </p>
                <ol className="list-decimal space-y-1.5 pl-5">
                  <li>
                    Buka alamat aplikasi ini di tab browser utama (bukan di dalam frame pratinjau).
                  </li>
                  <li>
                    Klik ikon <strong className="text-stone-900">Install</strong> di bilah alamat Chrome/Edge atau menu{' '}
                    <strong className="text-stone-900">⋮ → Tambahkan ke layar utama / Install app</strong>.
                  </li>
                </ol>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-xl bg-[#0B2821] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#12382E]"
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
