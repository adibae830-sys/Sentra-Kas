import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let isSigningIn = false;
let cachedAccessToken: string | null = null;

function createGoogleProvider(options?: {
  loginHint?: string;
  forceAccountPicker?: boolean;
}) {
  const provider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => provider.addScope(scope));

  const customParams: Record<string, string> = {};
  if (options?.loginHint) {
    customParams.login_hint = options.loginHint;
  }
  if (options?.forceAccountPicker) {
    customParams.prompt = 'select_account';
  }

  if (Object.keys(customParams).length > 0) {
    provider.setCustomParameters(customParams);
  }
  return provider;
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onTokenNeeded?: (user: User) => void,
  onSignedOut?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onTokenNeeded) onTokenNeeded(user);
      }
    } else {
      cachedAccessToken = null;
      if (onSignedOut) onSignedOut();
    }
  });
};

export const googleSignIn = async (options?: {
  loginHint?: string;
  forceAccountPicker?: boolean;
}): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const hint = options?.loginHint || auth.currentUser?.email || undefined;
    const provider = createGoogleProvider({
      loginHint: hint,
      forceAccountPicker: options?.forceAccountPicker ?? !hint,
    });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses Google Sheets dari sesi masuk.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const clearAccessToken = () => {
  cachedAccessToken = null;
};

export const logoutGoogle = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
