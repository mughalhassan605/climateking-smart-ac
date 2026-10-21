import type { Session as SupabaseSession } from '@supabase/supabase-js';
import { env } from '../../config/env';
import { supabase } from '../../config/supabase';
import { apiRequest, setAccessToken, setSessionRefresher } from '../../lib/api';
import { logger } from '../../lib/logger';
import { StorageKeys, storage } from '../../lib/storage';

// In demo mode there is no server, so auth accepts any input and mints a local session
// (mirrors the original's createMockAuthService, module 1244).
function demoSession(account?: string): Session {
  const email = account?.includes('@') ? account : 'demo@climateking.eu';
  setAccessToken('demo-token');
  storage.setString(StorageKeys.authRefreshToken, 'demo-refresh');
  return { user: { id: 'user-1', name: email.split('@')[0] || 'Guest', email, avatarUrl: null }, accessToken: 'demo-token' };
}

// Same endpoints and payloads as the original createHttpAuthService (module 1246).

export type SessionUser = { id: string; name: string; email: string; avatarUrl: string | null };
export type Session = { user: SessionUser; accessToken: string };

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string; email: string; avatarUrl?: string | null };
};

export type LoginInput = { account: string; password: string };
export type RegisterInput = { username: string; email: string; password: string; region?: string };
export type ResetPasswordInput = { email: string; code: string; newPassword: string };

function adoptSession(res: AuthResponse): Session {
  setAccessToken(res.accessToken);
  storage.setString(StorageKeys.authRefreshToken, res.refreshToken);
  return {
    user: { id: res.user.id, name: res.user.username, email: res.user.email, avatarUrl: res.user.avatarUrl ?? null },
    accessToken: res.accessToken,
  };
}

function clearSession() {
  setAccessToken(null);
  storage.remove(StorageKeys.authRefreshToken);
}

function fromSupabase(session: SupabaseSession): Session {
  const { user } = session;
  const email = user.email ?? '';
  const name = (user.user_metadata?.username as string | undefined) || email.split('@')[0] || 'Guest';
  setAccessToken(session.access_token);
  logger.setUserId(user.id);
  return { user: { id: user.id, name, email, avatarUrl: null }, accessToken: session.access_token };
}

// Supabase Auth: the session is persisted and refreshed by the Supabase client itself.
const supabaseAuth = {
  async login(input: LoginInput): Promise<Session> {
    const { data, error } = await supabase.auth.signInWithPassword({ email: input.account, password: input.password });
    if (error || !data.session) throw new Error(error?.message ?? 'Sign-in failed.');
    return fromSupabase(data.session);
  },
  async register(input: RegisterInput): Promise<Session> {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { username: input.username, region: input.region } },
    });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Check your email and confirm your account, then sign in.');
    return fromSupabase(data.session);
  },
  async sendPasswordReset(email: string): Promise<undefined> {
    // The reset email must show the {{ .Token }} code (Supabase: Auth -> Email Templates -> Reset Password).
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
    return undefined;
  },
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const verified = await supabase.auth.verifyOtp({ email: input.email, token: input.code, type: 'recovery' });
    if (verified.error) throw new Error(verified.error.message);
    const updated = await supabase.auth.updateUser({ password: input.newPassword });
    if (updated.error) throw new Error(updated.error.message);
    await supabase.auth.signOut();
  },
  async restoreSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session ? fromSupabase(data.session) : null;
  },
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    setAccessToken(null);
  },
};

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && session) setAccessToken(session.access_token);
  if (event === 'SIGNED_OUT' && env.SUPABASE_AUTH) onSessionLost?.();
});

let refreshInFlight: Promise<Session | null> | null = null;

async function performRefresh(): Promise<Session | null> {
  const refreshToken = storage.getString(StorageKeys.authRefreshToken);
  if (!refreshToken) return null;
  if (env.DEMO_MODE) return demoSession();
  try {
    const res = await apiRequest<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipAuthRetry: true,
    });
    return adoptSession(res);
  } catch {
    clearSession();
    return null;
  }
}

// Concurrent 401s share one refresh call instead of racing the single-use refresh token.
function refreshOnce(): Promise<Session | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

let onSessionLost: (() => void) | null = null;
export const setOnSessionLost = (fn: (() => void) | null) => {
  onSessionLost = fn;
};

setSessionRefresher(async () => {
  const session = await refreshOnce();
  if (!session) onSessionLost?.();
  return session !== null;
});

const httpAuth = {
  async login(input: LoginInput) {
    if (env.DEMO_MODE) return demoSession(input.account);
    const res = await apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input, skipAuthRetry: true });
    return adoptSession(res);
  },
  async register(input: RegisterInput) {
    if (env.DEMO_MODE) return demoSession(input.email);
    const res = await apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: input, skipAuthRetry: true });
    return adoptSession(res);
  },
  sendPasswordReset(email: string) {
    return apiRequest<{ devCode?: string } | undefined>('/auth/password-reset/send', { method: 'POST', body: { email } });
  },
  resetPassword(input: ResetPasswordInput) {
    return apiRequest<void>('/auth/password-reset/confirm', { method: 'POST', body: input });
  },
  restoreSession: () => refreshOnce(),
  async signOut() {
    const refreshToken = storage.getString(StorageKeys.authRefreshToken);
    try {
      if (refreshToken) {
        await apiRequest('/auth/logout', { method: 'POST', body: { refreshToken }, skipAuthRetry: true });
      }
    } finally {
      clearSession();
    }
  },
};

export const authService = env.SUPABASE_AUTH ? supabaseAuth : httpAuth;
