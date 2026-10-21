import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { storage } from '../lib/storage';

export const SUPABASE_URL = 'https://fvgkqztdovqzxhskhxkn.supabase.co';
// The public anon key. It can only reach rows the signed-in user owns (row level security in
// supabase/migrations), so shipping it in the APK does not expose anyone's ACs.
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2Z2txenRkb3Zxenhoc2toeGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0OTI5MDAsImV4cCI6MjEwODA2ODkwMH0.YkuB06l6RGZiq2EdWqRWWrEnxSdTWBAuYX9m2UArE3s';

// Keeps the Supabase session in MMKV so the user stays signed in across app restarts.
const sessionStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.setString(key, value),
  removeItem: (key: string) => storage.remove(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// React Native has no visibility events, so token refresh is tied to the app being in front.
AppState.addEventListener('change', state => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
