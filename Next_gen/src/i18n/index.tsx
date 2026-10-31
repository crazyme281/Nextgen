/**
 * App-wide language support.
 *
 *  - Visible text is written in English in the source and passed through `tr('English text')`.
 *    The English text is the lookup key, so a string with no translation simply shows in English.
 *  - The chosen language is saved on the device and applied to the whole app at once: the screens
 *    below the provider are re-created when it changes, so every menu, button, placeholder and
 *    message switches immediately — no restart.
 *  - Arabic switches the layout to right-to-left.
 *
 * Add a language: add it to LANGUAGES and give it a block in translations.ts.
 */
import React, { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TRANSLATIONS } from './translations';

export type LangCode = 'en' | 'fr' | 'es' | 'pt' | 'ar' | 'ha' | 'yo' | 'ig';

export const LANGUAGES: { code: LangCode; label: string; rtl?: boolean }[] = [
  { code: 'en', label: 'English (US)' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية', rtl: true },
  { code: 'ha', label: 'Hausa' },
  { code: 'yo', label: 'Yorùbá' },
  { code: 'ig', label: 'Igbo' },
];

const STORAGE_KEY = 'nextgen_language';

function readStoredLang(): LangCode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'en';
    // Older builds stored the display label ("Français"); newer ones store the code.
    const match = LANGUAGES.find((l) => l.code === raw || l.label === raw);
    return match ? match.code : 'en';
  } catch {
    return 'en';
  }
}

let currentLang: LangCode = readStoredLang();

/** Translate a piece of UI text. Safe to call anywhere (components, helpers, handlers). */
export function tr(text: string, vars?: Record<string, string | number>): string {
  const dict = currentLang === 'en' ? undefined : TRANSLATIONS[currentLang];
  let out = dict?.[text] ?? text;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => { out = out.split(`{${k}}`).join(String(v)); });
  }
  return out;
}

export function getLanguage(): LangCode {
  return currentLang;
}

interface I18nValue {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  label: string;
  tr: typeof tr;
}

const I18nContext = createContext<I18nValue>({
  lang: currentLang,
  setLang: () => undefined,
  label: 'English (US)',
  tr,
});

export const useI18n = (): I18nValue => useContext(I18nContext);

function applyDocumentLanguage(code: LangCode) {
  const info = LANGUAGES.find((l) => l.code === code);
  document.documentElement.lang = code;
  document.documentElement.dir = info?.rtl ? 'rtl' : 'ltr';
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LangCode>(currentLang);

  useEffect(() => { applyDocumentLanguage(lang); }, [lang]);

  const setLang = useCallback((code: LangCode) => {
    currentLang = code;
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* storage unavailable */ }
    setLangState(code);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, label: LANGUAGES.find((l) => l.code === lang)?.label ?? 'English (US)', tr }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

/**
 * Wrap the screens in this: when the language changes the subtree is re-created, so text that was
 * produced by tr() during an earlier render is produced again in the new language everywhere.
 */
export const LanguageBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang } = useI18n();
  return <Fragment key={lang}>{children}</Fragment>;
};
