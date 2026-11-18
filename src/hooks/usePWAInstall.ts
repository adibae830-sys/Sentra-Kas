import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __kspDeferredPrompt?: BeforeInstallPromptEvent | null;
    __kspPwaInstalled?: boolean;
  }
}

let sharedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let sharedIsInstalled = false;
let listenersInitialized = false;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((cb) => cb());
}

function checkStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    Boolean(window.__kspPwaInstalled)
  );
}

function ensureGlobalPwaListeners() {
  if (typeof window === 'undefined' || listenersInitialized) return;
  listenersInitialized = true;

  if (window.__kspDeferredPrompt) {
    sharedDeferredPrompt = window.__kspDeferredPrompt;
  }
  if (checkStandalone()) {
    sharedIsInstalled = true;
  }

  const handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    const promptEvent = e as BeforeInstallPromptEvent;
    window.__kspDeferredPrompt = promptEvent;
    sharedDeferredPrompt = promptEvent;
    notifySubscribers();
  };

  const handlePromptReady = () => {
    if (window.__kspDeferredPrompt) {
      sharedDeferredPrompt = window.__kspDeferredPrompt;
      notifySubscribers();
    }
  };

  const handleAppInstalled = () => {
    window.__kspDeferredPrompt = null;
    window.__kspPwaInstalled = true;
    sharedDeferredPrompt = null;
    sharedIsInstalled = true;
    notifySubscribers();
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('ksp-pwa-prompt-ready', handlePromptReady);
  window.addEventListener('appinstalled', handleAppInstalled);
  window.addEventListener('ksp-pwa-installed', handleAppInstalled);
}

export function usePWAInstall() {
  ensureGlobalPwaListeners();

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => sharedDeferredPrompt || (typeof window !== 'undefined' ? window.__kspDeferredPrompt || null : null)
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(
    () => sharedIsInstalled || checkStandalone()
  );
  const [isIOS] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  });
  const [isInAppBrowser] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent;
    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();
    return inIframe || /FBAN|FBAV|Instagram|Line\/|WhatsApp|\bwv\b/i.test(ua);
  });

  useEffect(() => {
    ensureGlobalPwaListeners();

    const sync = () => {
      const currentPrompt =
        sharedDeferredPrompt ||
        (typeof window !== 'undefined' ? window.__kspDeferredPrompt || null : null);
      setDeferredPrompt(currentPrompt);
      setIsInstalled(sharedIsInstalled || checkStandalone());
    };

    sync();
    subscribers.add(sync);
    return () => {
      subscribers.delete(sync);
    };
  }, []);

  const install = useCallback(async () => {
    const activePrompt =
      sharedDeferredPrompt ||
      (typeof window !== 'undefined' ? window.__kspDeferredPrompt || null : null);
    if (!activePrompt) return false;

    try {
      await activePrompt.prompt();
      const { outcome } = await activePrompt.userChoice;
      // Chrome only allows calling prompt() once per BeforeInstallPromptEvent
      sharedDeferredPrompt = null;
      if (typeof window !== 'undefined') {
        window.__kspDeferredPrompt = null;
      }
      if (outcome === 'accepted') {
        sharedIsInstalled = true;
      }
      notifySubscribers();
      return outcome === 'accepted';
    } catch {
      return false;
    }
  }, []);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isInAppBrowser,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}
