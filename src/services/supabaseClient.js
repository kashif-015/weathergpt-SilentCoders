import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://iujimmoonhfgooryhgvd.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1amltbW9vbmhmZ29vcnloZ3ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MTk4MTYsImV4cCI6MjEwNzA5NTgxNn0.UDffJy5aKdWIK7J-3eFVkPKIGf1_2kgnqFZ2Gsnk4Dw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Local Profile Storage Helpers
export function saveLocalProfile(profileData) {
  try {
    const existing = getLocalProfile() || {};
    const updated = { ...existing, ...profileData };
    localStorage.setItem('weathergpt_user_profile', JSON.stringify(updated));
    return updated;
  } catch {
    return profileData;
  }
}

export function getLocalProfile() {
  try {
    const saved = localStorage.getItem('weathergpt_user_profile');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function clearLocalProfile() {
  try {
    localStorage.removeItem('weathergpt_user_profile');
  } catch {}
}

// 1. Google OAuth Sign-In
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) throw error;
  return data;
}

// 2. Email & Password Registration
export async function signUpWithEmail({ email, password, name, occupation, language, age }) {
  const metadata = {
    full_name: name,
    occupation: occupation || 'Farmer',
    language: language || 'hi',
    age: age ? parseInt(age, 10) : null,
  };

  const redirectUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    if (error.message?.includes('already registered') || error.status === 422) {
      throw new Error(
        language === 'hi'
          ? 'यह ईमेल पहले से पंजीकृत है। कृपया लॉगिन करें।'
          : 'This email is already registered. Please sign in.'
      );
    }
    if (error.code === 'over_email_send_rate_limit' || error.message?.includes('rate limit')) {
      throw new Error(
        language === 'hi'
          ? 'ईमेल भेजने की सीमा पार हो गई है (Supabase 3-4 ईमेल प्रति घंटा अनुमति देता है)। कृपया 5-10 मिनट बाद प्रयास करें या Google से लॉगिन करें।'
          : 'Email send rate limit reached (Supabase limit is ~3-4 emails/hr). Please wait a few minutes, check Spam, or sign in with Google.'
      );
    }
    if (error.message?.includes('invalid')) {
      throw new Error(
        language === 'hi'
          ? 'अमान्य ईमेल पता। कृपया एक असली ईमेल पता (जैसे Gmail) दर्ज करें।'
          : 'Invalid email address. Please use a valid real email provider (e.g. Gmail).'
      );
    }
    throw error;
  }

  // If user already exists, Supabase returns identities: [] to prevent email enumeration
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error(
      language === 'hi'
        ? 'यह ईमेल पहले से पंजीकृत है। कृपया लॉगिन करें।'
        : 'This email is already registered. Please sign in instead.'
    );
  }

  const profileData = {
    id: data?.user?.id || 'user_' + Date.now(),
    email,
    name,
    occupation: occupation || 'Farmer',
    language: language || 'hi',
    age: age ? parseInt(age, 10) : null,
  };

  // If email confirmation is enabled in Supabase, session will be null until user clicks the link
  const verificationRequired = !data?.session;

  if (!verificationRequired) {
    saveLocalProfile(profileData);
  }

  return {
    user: data?.user,
    session: data?.session,
    profile: profileData,
    verificationRequired,
  };
}

// 2b. Resend Confirmation Email
export async function resendConfirmationEmail(email) {
  const redirectUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    if (error.code === 'over_email_send_rate_limit' || error.message?.includes('rate limit')) {
      throw new Error('Rate limit reached: Please wait 60 seconds before requesting another email.');
    }
    throw error;
  }
  return data;
}

// 3. Email & Password Sign In
export async function signInWithEmail({ email, password, language = 'en' }) {
  const profileData = {
    email,
    name: email.split('@')[0],
    occupation: 'Farmer',
    language: 'hi',
    age: 25,
  };

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message?.includes('Email not confirmed') || error.code === 'email_not_confirmed') {
        throw new Error(
          language === 'hi'
            ? 'आपका ईमेल अभी सत्यापित नहीं हुआ है! कृपया अपने इनबॉक्स और स्पैम फ़ोल्डर में पुष्टिकरण लिंक जांचें।'
            : 'Your email is not verified yet! Please check your inbox and Spam folder for the confirmation link.'
        );
      }
      if (error.message?.includes('Invalid login credentials')) {
        throw new Error(
          language === 'hi'
            ? 'गलत ईमेल या पासवर्ड। कृपया पुनः प्रयास करें।'
            : 'Invalid email or password. Please try again.'
        );
      }
      throw error;
    }

    const userMeta = data.user?.user_metadata || {};
    profileData.id = data.user?.id;
    profileData.name = userMeta.full_name || userMeta.name || email.split('@')[0];
    profileData.occupation = userMeta.occupation || 'Farmer';
    profileData.language = userMeta.language || 'hi';
    profileData.age = userMeta.age || 25;

    saveLocalProfile(profileData);
    return { user: data.user, session: data.session, profile: profileData };
  } catch (err) {
    throw err;
  }
}

// 4. Sign Out
export async function signOutUser() {
  clearLocalProfile();
  try {
    await supabase.auth.signOut();
  } catch (e) {}
}

// 5. Update Profile
export async function updateUserProfile({ name, occupation, language, age }) {
  const updates = {
    full_name: name,
    occupation,
    language,
    age: age ? parseInt(age, 10) : null,
  };

  try {
    await supabase.auth.updateUser({
      data: updates,
    });
  } catch (e) {}

  const local = getLocalProfile() || {};
  const updatedProfile = saveLocalProfile({
    ...local,
    name: name || local.name,
    occupation: occupation || local.occupation,
    language: language || local.language,
    age: age ? parseInt(age, 10) : local.age,
  });

  return updatedProfile;
}

// 6. Get Current User & Profile
export async function getCurrentUserProfile() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const user = session.user;
      const meta = user.user_metadata || {};
      const pendingOccupation = typeof localStorage !== 'undefined' ? localStorage.getItem('weathergpt_pending_oauth_occupation') : null;
      const finalOccupation = pendingOccupation || meta.occupation || getLocalProfile()?.occupation || null;

      if (pendingOccupation) {
        localStorage.removeItem('weathergpt_pending_oauth_occupation');
        try {
          supabase.auth.updateUser({ data: { occupation: pendingOccupation } });
        } catch (e) {}
      }

      const profileData = {
        id: user.id,
        email: user.email,
        name: meta.full_name || meta.name || user.email?.split('@')[0] || 'User',
        occupation: finalOccupation,
        language: meta.language || 'hi',
        age: meta.age || null,
      };
      saveLocalProfile(profileData);
      return profileData;
    }
  } catch (e) {}

  return getLocalProfile();
}

// 7. Observe Auth State Changes (replaces Firebase onAuthStateChanged)
export function observeAuthState(callback) {
  // Check existing session first
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      const user = session.user;
      const meta = user.user_metadata || {};
      const pendingOccupation = typeof localStorage !== 'undefined' ? localStorage.getItem('weathergpt_pending_oauth_occupation') : null;
      const finalOccupation = pendingOccupation || meta.occupation || getLocalProfile()?.occupation || null;

      if (pendingOccupation) {
        localStorage.removeItem('weathergpt_pending_oauth_occupation');
        try {
          supabase.auth.updateUser({ data: { occupation: pendingOccupation } });
        } catch (e) {}
      }

      const profile = {
        id: user.id,
        email: user.email,
        name: meta.full_name || meta.name || user.email?.split('@')[0] || 'User',
        occupation: finalOccupation,
        language: meta.language || 'hi',
        age: meta.age || null,
      };
      saveLocalProfile(profile);
      callback(profile);
    } else {
      // Check local profile as fallback
      const local = getLocalProfile();
      callback(local && local.id ? local : null);
    }
  }).catch(() => {
    const local = getLocalProfile();
    callback(local && local.id ? local : null);
  });

  // Listen for future auth changes (sign in, sign out, token refresh)
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      clearLocalProfile();
      callback(null);
    } else if (session?.user) {
      const user = session.user;
      const meta = user.user_metadata || {};
      const pendingOccupation = typeof localStorage !== 'undefined' ? localStorage.getItem('weathergpt_pending_oauth_occupation') : null;
      const finalOccupation = pendingOccupation || meta.occupation || getLocalProfile()?.occupation || null;

      if (pendingOccupation) {
        localStorage.removeItem('weathergpt_pending_oauth_occupation');
        try {
          supabase.auth.updateUser({ data: { occupation: pendingOccupation } });
        } catch (e) {}
      }

      const profile = {
        id: user.id,
        email: user.email,
        name: meta.full_name || meta.name || user.email?.split('@')[0] || 'User',
        occupation: finalOccupation,
        language: meta.language || 'hi',
        age: meta.age || null,
      };
      saveLocalProfile(profile);
      callback(profile);
    }
  });

  // Return unsubscribe function (same API as Firebase's onAuthStateChanged)
  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Returns active user JWT token for authenticated API requests
 */
export async function getAuthToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

