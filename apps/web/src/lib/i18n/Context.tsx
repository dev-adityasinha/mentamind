"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import en from "./en.json";
import es from "./es.json";

type Language = "en" | "es";
type Translations = Record<string, string>;

interface I18nContextType {
  locale: Language;
  setLocale: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const dictionaries: Record<Language, Translations> = {
  en,
  es,
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("app_lang") as Language;
    if (saved && (saved === "en" || saved === "es")) {
      setLocaleState(saved);
    }
    setMounted(true);
  }, []);

  const setLocale = (lang: Language) => {
    setLocaleState(lang);
    localStorage.setItem("app_lang", lang);
  };

  const t = (key: string): string => {
    const dict = dictionaries[locale] || dictionaries["en"];
    return dict[key] || key;
  };

  if (!mounted) {
    // Avoid hydration mismatch by rendering nothing or default until mounted
    return null;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
