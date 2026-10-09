import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  getIdToken,
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

function formatAuthError(error, language = 'en') {
  if (!error) return 'An error occurred during authentication.';
  const code = error.code || '';
  const msg = error.message || '';

  if (code === 'auth/email-already-in-use') {
    return language === 'hi'
      ? 'यह ईमेल पहले से पंजीकृत है। कृपया लॉगिन करें।'
      : 'This email is already registered. Please sign in instead.';
  }
  if (code === 'auth/invalid-email') {
    return language === 'hi'
      ? 'अमान्य ईमेल पता।'
      : 'Invalid email address.';
  }
  if (code === 'auth/weak-password') {
    return language === 'hi'
      ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।'
      : 'Password must be at least 6 characters.';
  }
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return language === 'hi'
      ? 'गलत ईमेल या पासवर्ड।'
      : 'Invalid email or password.';
  }
  if (code === 'auth/too-many-requests') {
    return language === 'hi'
      ? 'बहुत अधिक प्रयास। कृपया कुछ देर बाद पुनः प्रयास करें।'
      : 'Too many attempts. Please try again in a few minutes.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return language === 'hi'
      ? 'Google साइन-इन विंडो बंद कर दी गई।'
      : 'Google sign-in popup closed by user.';
  }
  return msg;
}

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
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {}
  return profile;
}

let lastUnverifiedUser = null;

export async function resendConfirmationEmail(email) {
  if (firebaseAuth) {
    if (firebaseAuth.currentUser) {
      await sendEmailVerification(firebaseAuth.currentUser, { url: window.location.origin, handleCodeInApp: false });
      return true;
    }
    if (lastUnverifiedUser && (!email || lastUnverifiedUser.email?.toLowerCase() === email.toLowerCase())) {
      await sendEmailVerification(lastUnverifiedUser, { url: window.location.origin, handleCodeInApp: false });
      return true;
    }
    throw new Error(
      'कृपया पहले अपने ईमेल और पासवर्ड से साइन इन करने का प्रयास करें ताकि नया लिंक तुरंत भेजा जा सके।'
    );
  }
  return true;
}

export async function signUpWithEmail({ email, password, name, occupation, language, age }) {
  const normEmail = (email || '').trim();
  if (firebaseAuth) {
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, normEmail, password);
      if (name) {
        try {
          await updateProfile(credential.user, { displayName: name.trim() });
        } catch (e) {}
      }

      const profile = {
        id: credential.user.uid,
        email: normEmail,
        name: name.trim() || normEmail.split('@')[0],
        occupation: occupation || 'Farmer',
        language: language || 'en',
        age: age ? Number(age) : null,
      };

      const emailKey = `weathergpt_user_profile_${normEmail.toLowerCase()}`;
      try {
        localStorage.setItem(emailKey, JSON.stringify(profile));
      } catch {}
      saveProfile(profile);

      lastUnverifiedUser = credential.user;
      try {
        await sendEmailVerification(credential.user, { url: window.location.origin, handleCodeInApp: false });
      } catch (err) {
        console.warn('[Firebase] Verification email send failed:', err.message);
      }

      await signOut(firebaseAuth);
      return { profile, verificationRequired: true };
    } catch (err) {
      throw new Error(formatAuthError(err, language));
    }
  }

  // Local offline fallback
  const profile = saveProfile({
    id: 'user_' + Date.now().toString(36),
    email: normEmail,
    name: name.trim() || normEmail.split('@')[0],
    occupation: occupation || 'Farmer',
    language: language || 'en',
    age: age ? Number(age) : null,
  });
  notifyLocalListeners(profile);
  return { profile, verificationRequired: false };
}

export async function signInWithEmail({ email, password, language = 'en' }) {
  const normEmail = (email || '').trim();
  if (firebaseAuth) {
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, normEmail, password);

      if (!credential.user.emailVerified) {
        lastUnverifiedUser = credential.user;
        try {
          await sendEmailVerification(credential.user, { url: window.location.origin, handleCodeInApp: false });
        } catch (e) {}
        await signOut(firebaseAuth);
        throw new Error(
          language === 'hi'
            ? 'आपका ईमेल अभी सत्यापित नहीं है। सत्यापन लिंक आपके ईमेल पर भेज दिया गया है। कृपया इनबॉक्स या स्पैम फ़ोल्डर में जाकर वेरिफाई करें, फिर लॉगिन करें।'
            : 'Your email is not verified. A verification link has been sent to your email. Please check your inbox or spam folder to verify, then sign in.'
        );
      }

      const emailKey = `weathergpt_user_profile_${normEmail.toLowerCase()}`;
      let stored = {};
      try {
        stored = JSON.parse(localStorage.getItem(emailKey) || '{}');
      } catch {}
      if (!stored.occupation) {
        stored = getStoredProfile();
      }

      const profile = saveProfile(toProfile(credential.user, stored));
      try {
        localStorage.setItem(emailKey, JSON.stringify(profile));
      } catch {}
      notifyLocalListeners(profile);
      return { user: credential.user, profile };
    } catch (err) {
      throw new Error(formatAuthError(err, language));
    }
  }

  // Local offline fallback
  let profile = getStoredProfile();
  if (!profile || !profile.email || profile.email.toLowerCase() !== normEmail.toLowerCase()) {
    profile = {
      id: 'user_' + Date.now().toString(36),
      email: normEmail,
      name: normEmail.split('@')[0],
      occupation: 'Farmer',
      language: language || 'en',
      age: null,
    };
  }
  saveProfile(profile);
  notifyLocalListeners(profile);
  return { user: { uid: profile.id, email: profile.email, displayName: profile.name }, profile };
}

export async function signInWithGoogle() {
  const pendingOccupation = (typeof localStorage !== 'undefined' && localStorage.getItem('weathergpt_pending_oauth_occupation')) || 'Farmer';
  const pendingLanguage = (typeof localStorage !== 'undefined' && localStorage.getItem('weathergpt_pending_oauth_language')) || 'en';

  if (firebaseAuth) {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(firebaseAuth, provider);

      const emailKey = credential.user.email ? `weathergpt_user_profile_${credential.user.email.toLowerCase()}` : null;
      let existing = {};
      if (emailKey) {
        try {
          existing = JSON.parse(localStorage.getItem(emailKey) || '{}');
        } catch {}
      }
      if (!existing.occupation) {
        existing = getStoredProfile();
      }

      const occupation = pendingOccupation || existing.occupation || 'Farmer';
      const language = pendingLanguage || existing.language || 'en';

      const profile = saveProfile(toProfile(credential.user, {
        ...existing,
        occupation,
        language,
        name: credential.user.displayName || existing.name,
      }));

      if (emailKey) {
        try {
          localStorage.setItem(emailKey, JSON.stringify(profile));
        } catch {}
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('weathergpt_pending_oauth_occupation');
        localStorage.removeItem('weathergpt_pending_oauth_language');
      }

      notifyLocalListeners(profile);
      return { user: credential.user, profile };
    } catch (err) {
      throw new Error(formatAuthError(err));
    }
  }

  // Local fallback
  let profile = getStoredProfile();
  if (!profile || !profile.email) {
    profile = {
      id: 'google_' + Date.now().toString(36),
      email: 'user@gmail.com',
      name: 'Google User',
      occupation: pendingOccupation || 'Farmer',
      language: pendingLanguage || 'en',
      age: null,
    };
  }
  saveProfile(profile);
  notifyLocalListeners(profile);
  return { user: { uid: profile.id, email: profile.email, displayName: profile.name }, profile };
}

export async function signOutUser() {
  try {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {}
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
  const email = user?.email || current.email;
  const updated = saveProfile({
    ...current,
    id: user?.uid || current.id || ('user_' + Date.now().toString(36)),
    email,
    name: name !== undefined ? name : current.name,
    occupation: occupation !== undefined ? occupation : current.occupation,
    language: language !== undefined ? language : current.language,
    age: age !== undefined ? age : current.age,
  });

  if (email) {
    const emailKey = `weathergpt_user_profile_${email.toLowerCase()}`;
    try {
      localStorage.setItem(emailKey, JSON.stringify(updated));
    } catch {}
  }

  notifyLocalListeners(updated);
  return updated;
}

export async function getCurrentUserProfile() {
  if (firebaseAuth?.currentUser) {
    const user = firebaseAuth.currentUser;
    const isGoogle = user.providerData?.some((p) => p.providerId === 'google.com');
    if (!user || (!user.emailVerified && !isGoogle)) return null;

    const emailKey = user.email ? `weathergpt_user_profile_${user.email.toLowerCase()}` : null;
    let stored = {};
    if (emailKey) {
      try {
        stored = JSON.parse(localStorage.getItem(emailKey) || '{}');
      } catch {}
    }
    if (!stored.occupation) {
      stored = getStoredProfile();
    }
    return saveProfile(toProfile(user, stored));
  }
  const stored = getStoredProfile();
  return (stored && stored.id) ? stored : null;
}

export function observeAuthState(callback) {
  if (firebaseAuth) {
    try {
      return onAuthStateChanged(firebaseAuth, (user) => {
        if (!user) {
          callback(null);
          return;
        }

        const isGoogle = user.providerData?.some((p) => p.providerId === 'google.com');
        if (user.emailVerified || isGoogle) {
          const emailKey = user.email ? `weathergpt_user_profile_${user.email.toLowerCase()}` : null;
          let stored = {};
          if (emailKey) {
            try {
              stored = JSON.parse(localStorage.getItem(emailKey) || '{}');
            } catch {}
          }
          if (!stored.occupation) {
            stored = getStoredProfile();
          }

          const pendingOccupation = typeof localStorage !== 'undefined' ? localStorage.getItem('weathergpt_pending_oauth_occupation') : null;
          if (pendingOccupation) {
            stored.occupation = pendingOccupation;
            try {
              localStorage.removeItem('weathergpt_pending_oauth_occupation');
            } catch {}
          }

          const profile = toProfile(user, stored);
          saveProfile(profile);
          if (emailKey) {
            try {
              localStorage.setItem(emailKey, JSON.stringify(profile));
            } catch {}
          }
          callback(profile);
        } else {
          callback(null);
        }
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

/**
 * Returns the current Firebase user's JWT ID token for authenticated server requests.
 * Falls back to null if user is not signed in or Firebase is not configured.
 */
export async function getFirebaseAuthToken() {
  if (!firebaseAuth) return null;
  try {
    const user = firebaseAuth.currentUser;
    if (!user) return null;
    return await getIdToken(user, /* forceRefresh */ false);
  } catch {
    return null;
  }
}
