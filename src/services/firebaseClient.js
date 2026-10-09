import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'weathergpt-db8ac.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const PROFILE_STORAGE_KEY = 'weathergpt_user_profile';

// Track offline/local auth listeners when Firebase is unconfigured or offline
const localListeners = new Set();
function notifyLocalListeners(profile) {
  localListeners.forEach((cb) => {
    try {
      cb(profile);
    } catch (e) {
      console.error('[Auth] Listener callback error:', e);
    }
  });
}

const isConfigured = Boolean(
  firebaseConfig.apiKey &&
  typeof firebaseConfig.apiKey === 'string' &&
  firebaseConfig.apiKey.trim() !== '' &&
  !firebaseConfig.apiKey.includes('YOUR_') &&
  firebaseConfig.projectId
);

let app = null;
let firebaseAuth = null;

if (isConfigured) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    firebaseAuth = getAuth(app);

    // Analytics is optional and unavailable in a few browser environments.
    if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
      isAnalyticsSupported().then((supported) => {
        if (supported) getAnalytics(app);
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[Firebase] Initialization error. Running in local/offline auth mode:', err.message);
    app = null;
    firebaseAuth = null;
  }
} else {
  console.info('[Firebase] VITE_FIREBASE_API_KEY is not configured. Running in offline/local auth mode.');
}

export { firebaseAuth };

function toProfile(user, preferences = {}) {
  return {
    id: user.uid,
    email: user.email || '',
    name: preferences.name || user.displayName || user.email?.split('@')[0] || 'WeatherGPT User',
    occupation: preferences.occupation || 'Farmer',
    language: preferences.language || 'en',
    age: preferences.age || null,
  };
}

function getStoredProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

async function verificationEmail(user) {
  if (!user) return;
  await sendEmailVerification(user, { url: window.location.origin, handleCodeInApp: false });
}

export async function signUpWithEmail({ email, password, name, occupation, language, age }) {
  if (firebaseAuth) {
    const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    await updateProfile(credential.user, { displayName: name });
    const profile = saveProfile(toProfile(credential.user, { name, occupation, language, age: age ? Number(age) : null }));
    await verificationEmail(credential.user);
    await signOut(firebaseAuth);
    return { profile, verificationRequired: true };
  }

  // Offline / Local auth mode
  const profile = saveProfile({
    id: 'user_' + Date.now().toString(36),
    email: email.trim(),
    name: name.trim() || email.split('@')[0],
    occupation: occupation || 'Farmer',
    language: language || 'en',
    age: age ? Number(age) : null,
  });
  notifyLocalListeners(profile);
  return { profile, verificationRequired: false };
}

export async function signInWithEmail({ email, password }) {
  if (firebaseAuth) {
    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);

    if (!credential.user.emailVerified) {
      await verificationEmail(credential.user);
      await signOut(firebaseAuth);
      throw new Error('Your email is not verified. A new verification email has been sent. Verify it, then sign in again.');
    }

    const profile = saveProfile(toProfile(credential.user, getStoredProfile()));
    return { user: credential.user, profile };
  }

  // Offline / Local auth mode
  let profile = getStoredProfile();
  if (!profile || !profile.email || profile.email.toLowerCase() !== email.trim().toLowerCase()) {
    profile = {
      id: 'user_' + Date.now().toString(36),
      email: email.trim(),
      name: email.split('@')[0],
      occupation: 'Farmer',
      language: 'en',
      age: null,
    };
  }
  saveProfile(profile);
  notifyLocalListeners(profile);
  return { user: { uid: profile.id, email: profile.email, displayName: profile.name }, profile };
}

export async function signInWithGoogle() {
  if (firebaseAuth) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(firebaseAuth, provider);
    const profile = saveProfile(toProfile(credential.user, getStoredProfile()));
    return { user: credential.user, profile };
  }

  // Offline / Local Google Sign-In simulation
  let profile = getStoredProfile();
  if (!profile || !profile.email) {
    profile = {
      id: 'google_' + Date.now().toString(36),
      email: 'user@gmail.com',
      name: 'Google User',
      occupation: 'Farmer',
      language: 'en',
      age: null,
    };
  }
  saveProfile(profile);
  notifyLocalListeners(profile);
  return { user: { uid: profile.id, email: profile.email, displayName: profile.name }, profile };
}

export async function signOutUser() {
  localStorage.removeItem(PROFILE_STORAGE_KEY);
  if (firebaseAuth) {
    try {
      await signOut(firebaseAuth);
    } catch (e) {
      console.warn('[Firebase] Sign out warning:', e.message);
    }
  }
  notifyLocalListeners(null);
}

export async function updateUserProfile({ name, occupation, language, age }) {
  const user = firebaseAuth?.currentUser;
  if (user && name && user.displayName !== name) {
    try {
      await updateProfile(user, { displayName: name });
    } catch (e) {
      console.warn('[Firebase] Update display name warning:', e.message);
    }
  }
  const current = getStoredProfile();
  const updated = saveProfile({
    ...current,
    id: user?.uid || current.id || ('user_' + Date.now().toString(36)),
    email: user?.email || current.email,
    name,
    occupation,
    language,
    age,
  });
  notifyLocalListeners(updated);
  return updated;
}

export async function getCurrentUserProfile() {
  if (firebaseAuth?.currentUser) {
    const user = firebaseAuth.currentUser;
    if (!user || !user.emailVerified) return null;
    return saveProfile(toProfile(user, getStoredProfile()));
  }
  const stored = getStoredProfile();
  return (stored && stored.id) ? stored : null;
}

export function observeAuthState(callback) {
  if (firebaseAuth) {
    try {
      return onAuthStateChanged(firebaseAuth, (user) => {
        const profile = user?.emailVerified ? toProfile(user, getStoredProfile()) : null;
        callback(profile);
      });
    } catch (err) {
      console.warn('[Firebase] observeAuthState error, switching to local state listener:', err.message);
    }
  }

  localListeners.add(callback);
  const stored = getStoredProfile();
  const initial = (stored && stored.id) ? stored : null;
  setTimeout(() => callback(initial), 0);

  return () => {
    localListeners.delete(callback);
  };
}
