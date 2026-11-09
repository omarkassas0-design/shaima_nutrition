import { useState, useEffect, createContext, useContext } from 'react';
import { t as translate } from './i18n';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('auradental_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('auradental_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key) => translate(key, lang);
  const isRTL = lang === 'ar';
  const toggleLanguage = () => setLang(prev => prev === 'en' ? 'ar' : prev === 'ar' ? 'tr' : 'en');

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRTL, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}