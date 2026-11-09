import { en } from './translations/en';
import { ar } from './translations/ar';
import { tr } from './translations/tr';

const translations = { en, ar, tr };

export function getTranslations(lang = 'en') {
  return translations[lang] || translations.en;
}

export function t(key, lang = 'en') {
  const trans = translations[lang] || translations.en;
  return trans[key] || key;
}

export default translations;