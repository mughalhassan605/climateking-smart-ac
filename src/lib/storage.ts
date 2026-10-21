import { createMMKV } from 'react-native-mmkv';

// Same MMKV id and keys as the original app, so an in-place upgrade keeps the user's
// onboarding state, language, paired Gree devices and their keys.
const mmkv = createMMKV({ id: 'climate.app' });

export const StorageKeys = {
  onboardingComplete: 'onboarding.complete',
  authRefreshToken: 'auth.refreshToken',
  themeMode: 'app.themeMode',
  language: 'app.language',
  discoverNearby: 'settings.discoverNearby',
  reduceMotion: 'settings.reduceMotion',
  greeCredentials: 'gree.credentials',
  greeForgotten: 'gree.forgotten',
  wifiMemory: 'pairing.wifiMemory',
  schedules: 'schedules.items',
} as const;

export const storage = {
  getString: (key: string) => mmkv.getString(key),
  setString: (key: string, value: string) => mmkv.set(key, value),
  getBoolean: (key: string) => mmkv.getBoolean(key),
  setBoolean: (key: string, value: boolean) => mmkv.set(key, value),
  getObject<T>(key: string): T | undefined {
    const raw = mmkv.getString(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },
  setObject: (key: string, value: unknown) => mmkv.set(key, JSON.stringify(value)),
  remove: (key: string) => {
    mmkv.remove(key);
  },
  clearAll: () => mmkv.clearAll(),
};
