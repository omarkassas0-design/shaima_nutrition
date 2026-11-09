/**
 * Single source of truth for DISPLAY dates and times (English / Arabic / Turkish).
 *
 * WHY THE PREVIOUS APPROACH DID NOT WORK
 *  1. The Arabic branch hand-built "DD/MM/YYYY" with digits only, so Arabic never
 *     showed Arabic month or weekday names at all — there were no month names to
 *     display. Day/month names now ALWAYS come from Intl in the selected language.
 *  2. The returned strings carried invisible bidi control characters
 *     (U+2066 / U+2068 / U+2069). Those characters travelled into Excel cells
 *     and PDF text, where they corrupt content instead of fixing direction.
 *     Formatters now return PLAIN text; direction is a presentation concern and
 *     is handled by CSS (see the bidi utilities in index.css).
 *  3. A date-only string such as "2026-10-10" was parsed as UTC midnight, which
 *     displays as the PREVIOUS day in any timezone west of UTC. Date-only values
 *     are now anchored at local noon.
 *
 * Display only. Never use these strings for persisted values, query filters,
 * comparisons or API payloads — stored values stay untouched ISO strings.
 */

const APP_LANG_KEY = 'auradental_lang';
const VALID_LANGS = ['en', 'ar', 'tr'];

/**
 * Locale per app language:
 *  en-GB → 10 Oct 2026
 *  tr-TR → 10 Eki 2026 / 10 Ekim 2026   (correct Turkish spelling)
 *  ar-EG → 10 أكتوبر 2026               (Arabic month names; Gregorian calendar
 *                                        and readable 0-9 digits, matching the
 *                                        digits used for amounts, phone numbers,
 *                                        IDs and tooth numbers elsewhere)
 */
const LOCALES = {
  en: 'en-GB',
  ar: 'ar-EG-u-ca-gregory-nu-latn',
  tr: 'tr-TR',
};

/** Normalize any accepted language input to 'en' | 'ar' | 'tr'. */
export function normalizeLang(lang) {
  return VALID_LANGS.includes(lang) ? lang : null;
}

/**
 * The language the app is currently displaying in. Explicit `lang` wins;
 * otherwise the saved application language is used, so every existing caller
 * (including exports that run without a language argument) is locale-aware.
 */
export function getAppLanguage(lang) {
  const explicit = normalizeLang(lang);
  if (explicit) return explicit;
  try {
    const saved = normalizeLang(localStorage.getItem(APP_LANG_KEY));
    if (saved) return saved;
  } catch (_) { /* storage unavailable */ }
  if (typeof document !== 'undefined') {
    const docLang = normalizeLang(document.documentElement.getAttribute('lang'));
    if (docLang) return docLang;
  }
  return 'en';
}

/** Intl locale tag for a language. */
export function getLocale(lang) {
  return LOCALES[getAppLanguage(lang)] || LOCALES.en;
}

/**
 * Parse a stored date value without ever shifting the calendar day.
 * Returns a Date, or null when the value is empty/unparseable.
 */
export function parseDateValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const anchored = new Date(`${value}T12:00:00`);
    return Number.isNaN(anchored.getTime()) ? null : anchored;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const STYLES = { long: 'long', short: 'short', narrow: 'narrow' };

/**
 * Format a date for display.
 *
 * @param value   ISO string / timestamp / Date
 * @param lang    'en' | 'ar' | 'tr' (defaults to the app's current language)
 * @param options { time, weekday, month, year, monthOnly }
 */
export function formatDisplayDate(value, lang, options = {}) {
  // Tolerate the older (value, options) call shape used in a few screens.
  if (lang && typeof lang === 'object') {
    options = lang;
    lang = undefined;
  }
  const date = parseDateValue(value);
  if (!date) return '—';

  const locale = getLocale(lang);

  if (options.monthOnly) {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: options.year || 'numeric' }).format(date);
  }

  const parts = {
    day: 'numeric',
    month: STYLES[options.month] || 'short',
    year: options.year || 'numeric',
  };
  if (options.weekday) parts.weekday = STYLES[options.weekday] || 'short';
  if (options.time) {
    parts.hour = '2-digit';
    parts.minute = '2-digit';
    parts.hour12 = false;
  }

  return new Intl.DateTimeFormat(locale, parts).format(date);
}

/** Date plus 24-hour time, in the selected language. */
export function formatDisplayDateTime(value, lang) {
  return formatDisplayDate(value, lang, { time: true });
}

/** Time only, 24-hour, in the selected language. */
export function formatDisplayTime(value, lang) {
  const date = parseDateValue(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(getLocale(lang), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Weekday name in the selected language. */
export function formatWeekday(value, lang, style = 'long') {
  const date = parseDateValue(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(getLocale(lang), {
    weekday: STYLES[style] || 'long',
  }).format(date);
}

/** Month and year in the selected language (long month name). */
export function formatMonthYear(value, lang) {
  return formatDisplayDate(value, lang, { monthOnly: true });
}

/** Short numeric date in the selected language, e.g. 10/10/2026. */
export function formatDateNumeric(value, lang) {
  const date = parseDateValue(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(getLocale(lang), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * The stored calendar date as a plain ISO string (yyyy-mm-dd), independent of
 * language. For form defaults and filters only — never a display value.
 */
export function toISODate(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}