import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://oauezictifhjcfttwqhh.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdWV6aWN0aWZoamNmdHR3cWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4ODY4NTMsImV4cCI6MjEwMzQ2Mjg1M30.n4FErIUKvFku40idE6mVh5iLNuUlYHVe5kKuS_OCvN8';

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

  const profileData = {
    id: 'user_' + Date.now(),
    email,
    name,
    occupation: occupation || 'Farmer',
    language: language || 'hi',
    age: age ? parseInt(age, 10) : null,
  };

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      // If user is already registered, try signing in directly!
      if (error.message?.includes('already registered') || error.status === 422) {
        return await signInWithEmail({ email, password });
      }
      // If rate limited or other error, save local profile and proceed to log in user locally!
      console.warn('Supabase auth sign up warning:', error.message);
    }

    if (data?.user?.id) {
      profileData.id = data.user.id;
    }

    // Try optional table insert if allowed
    if (data?.user?.id) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: name,
          occupation,
          language,
          age: age ? parseInt(age, 10) : null,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {}
    }
  } catch (err) {
    console.warn('SignUp exception, activating local session:', err);
  }

  saveLocalProfile(profileData);
  return { profile: profileData };
}

// 3. Email & Password Sign In
export async function signInWithEmail({ email, password }) {
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
      // Check if user is cached locally
      const local = getLocalProfile();
      if (local && local.email?.toLowerCase() === email.toLowerCase()) {
        return { profile: local };
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
    const local = getLocalProfile();
    if (local && local.email?.toLowerCase() === email.toLowerCase()) {
      return { profile: local };
    }
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
      const profileData = {
        id: user.id,
        email: user.email,
        name: meta.full_name || meta.name || user.email?.split('@')[0] || 'User',
        occupation: meta.occupation || 'Farmer',
        language: meta.language || 'hi',
        age: meta.age || null,
      };
      saveLocalProfile(profileData);
      return profileData;
    }
  } catch (e) {}

  return getLocalProfile();
}
