import { env } from '../config/env';
import { getActiveLanguage } from '../i18n';

// Mirrors the original client (module 781): 12 s timeout, bearer token held in memory,
// `{error:{code,message,details}}` envelopes, and one refresh-and-retry on auth failures.

const REQUEST_TIMEOUT_MS = 12000;
const AUTH_RETRY_CODES = new Set(['TOKEN_EXPIRED', 'UNAUTHENTICATED']);

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let sessionRefresher: (() => Promise<boolean>) | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const setSessionRefresher = (fn: (() => Promise<boolean>) | null) => {
  sessionRefresher = fn;
};

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  skipAuthRetry?: boolean;
  headers?: Record<string, string>;
};

async function sendRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort());

  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': getActiveLanguage(),
    ...options.headers,
  };
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${env.API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Can’t reach the server. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const err = payload?.error;
    throw new ApiError(
      err?.code ?? 'UNKNOWN_ERROR',
      err?.message ?? 'Something went wrong. Please try again.',
      response.status,
      err?.details,
    );
  }
  return payload as T;
}

export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await sendRequest<T>(path, options);
  } catch (error) {
    const authFailure =
      error instanceof ApiError && (error.status === 401 || AUTH_RETRY_CODES.has(error.code));
    if (!authFailure || options.skipAuthRetry || !sessionRefresher) throw error;
    const refreshed = await sessionRefresher();
    if (!refreshed) throw error;
    return sendRequest<T>(path, options);
  }
}
