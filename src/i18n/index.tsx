import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { StorageKeys, storage } from '../lib/storage';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import nl from './locales/nl.json';

export const SUPPORTED_LANGUAGES = ['en', 'nl', 'de', 'es'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

export const TRANSLATIONS: Record<Language, unknown> = { en, nl, de, es };

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function getActiveLanguage(): Language {
  const stored = storage.getString(StorageKeys.language);
  return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}

type Params = Record<string, string | number>;

function getNestedValue(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node != null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    dict,
  );
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function translate(language: Language, key: string, params?: Params): string {
  const found = getNestedValue(TRANSLATIONS[language], key) ?? getNestedValue(TRANSLATIONS.en, key);
  if (typeof found !== 'string') return key;
  if (!params) return found;
  let out = found;
  for (const [name, value] of Object.entries(params)) {
    out = out.replace(new RegExp(`\\{\\{?\\s*${escapeRegExp(name)}\\s*\\}\\}?`, 'g'), String(value));
  }
  return out;
}

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Params) => string;
};

export const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getActiveLanguage);

  const setLanguage = useCallback((next: Language) => {
    storage.setString(StorageKeys.language, next);
    setLanguageState(next);
  }, []);

  const t = useCallback((key: string, params?: Params) => translate(language, key, params), [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
