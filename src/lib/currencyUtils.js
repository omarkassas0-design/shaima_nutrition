/**
 * Frontend currency and number formatting helpers.
 *
 * Currencies are NEVER mixed — every total is a per-currency map
 * ({ USD: number, SYP: number, TRY: number }).
 *
 * NUMBER FORMATTING ROOT CAUSE
 * Every amount used to be rendered with `value.toLocaleString()` with no locale
 * argument, which formats using the DEVICE/OS locale rather than the language the
 * user selected in the app. An Arabic user on an English phone therefore saw
 * English grouping, and TRY amounts were formatted inconsistently. All numbers
 * now go through Intl.NumberFormat with the app's own locale.
 */
import { getLocale, getAppLanguage } from '@/lib/dateFormat';

export const CURRENCY_SYMBOLS = { USD: '$', TRY: '₺', SYP: '£S', EUR: '€' };

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'SYP', label: 'SYP (£S)' },
  { value: 'TRY', label: 'TRY (₺)' },
  { value: 'EUR', label: 'EUR (€)' },
];

export function getCurrencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || '';
}

/**
 * Locale-aware number formatting.
 *
 * @param value   number (or numeric string)
 * @param lang    'en' | 'ar' | 'tr' — defaults to the app's current language
 * @param options optional Intl.NumberFormat overrides
 *
 * en → 17,650.5   tr → 17.650,5   ar → 17,650.5
 */
export function formatNumber(value, lang, options = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat(getLocale(lang), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(n);
}

/**
 * Money with its currency symbol, locale-aware: ₺17.650 / $17,650.5
 * A negative amount keeps its sign in front of the symbol ("-₺450,25"), the
 * unambiguous convention, instead of leaving the minus adrift after the symbol.
 */
export function formatMoney(amount, currency, lang) {
  const n = Number(amount) || 0;
  const symbol = getCurrencySymbol(currency);
  const formatted = formatNumber(Math.abs(n), lang);
  return n < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/**
 * Percentage, locale-aware. Turkish writes the sign first with a decimal comma
 * (%12,5); English and Arabic put it after the number (12.5%). Built by hand
 * because Intl's Arabic percent output embeds invisible direction marks.
 */
export function formatPercent(value, lang, maxDigits = 2) {
  const n = Number(value);
  const digits = Number.isFinite(n)
    ? formatNumber(n, lang, { minimumFractionDigits: 0, maximumFractionDigits: maxDigits })
    : '0';
  return getAppLanguage(lang) === 'tr' ? `%${digits}` : `${digits}%`;
}

/**
 * Converts a per-currency totals object to a display array.
 * Example: { USD: 5000, SYP: 100000000 } =>
 *   [{ currency: 'USD', amount: 5000, symbol: '$' }, { currency: 'SYP', amount: 100000000, symbol: '£S' }]
 *
 * This is the DATA path (Excel/PDF exports) and therefore stays plain text.
 */
export function currencyTotalsToArray(totals) {
  if (!totals) return [];
  return Object.entries(totals)
    .filter(([, amount]) => Math.abs(Number(amount) || 0) > 0)
    .map(([currency, amount]) => ({
      currency,
      amount: Number(amount) || 0,
      symbol: getCurrencySymbol(currency),
    }));
}

/**
 * SCREEN-ONLY multi-currency line: "$5,000 USD · £S100,000,000 SYP".
 *
 * Each value is wrapped in a left-to-right isolate (U+2066 … U+2069) because the
 * symbol, the digits and the currency code are one left-to-right unit. Without
 * the isolate, the neutral " · " separator lets a right-to-left paragraph reorder
 * the currencies, and a Latin currency code such as TRY/USD detaches from its
 * amount and jumps to the wrong side of the value.
 *
 * These control characters are deliberately confined to this display helper —
 * the export path uses currencyTotalsToArray / formatCurrencyTotalsPlain, which
 * return clean text for Excel and PDF.
 */
export function formatCurrencyTotals(totals, lang) {
  const arr = currencyTotalsToArray(totals);
  if (arr.length === 0) return '$0 USD';
  return arr
    .map(({ symbol, amount, currency }) => `\u2066${symbol}${formatNumber(amount, lang)} ${currency}\u2069`)
    .join(' · ');
}

/** Same as formatCurrencyTotals but WITHOUT isolates — for Excel/PDF output. */
export function formatCurrencyTotalsPlain(totals, lang) {
  const arr = currencyTotalsToArray(totals);
  if (arr.length === 0) return '$0 USD';
  return arr.map(({ symbol, amount, currency }) => `${symbol}${formatNumber(amount, lang)} ${currency}`).join(' · ');
}

/**
 * Compute outstanding balance per currency from patient treatments.
 * ONLY completed treatments contribute to the outstanding balance —
 * planned, in_progress, and cancelled treatments are excluded entirely.
 * Payments are only deducted from completed (payable) treatments.
 *
 * Returns { dueByCurrency, paidByCurrency, remainingByCurrency }
 * where remainingByCurrency only includes positive (>0) balances.
 */
export function computeOutstandingBalance(treatments) {
  const dueByCurrency = {};
  const paidByCurrency = {};

  (treatments || []).forEach(pt => {
    if (pt.status !== 'completed') return;
    const cur = pt.currency || 'USD';
    const price = Number(pt.price) || 0;
    const paid = Number(pt.paid_amount) || 0;
    const disc = pt.discount_type === 'percentage'
      ? price * (Number(pt.discount_value) || 0) / 100
      : pt.discount_type === 'fixed'
        ? (Number(pt.discount_value) || 0)
        : 0;
    const final = price - disc;
    dueByCurrency[cur] = Math.round(((dueByCurrency[cur] || 0) + final) * 100) / 100;
    paidByCurrency[cur] = Math.round(((paidByCurrency[cur] || 0) + paid) * 100) / 100;
  });

  // Outstanding Balance = aggregate(completed due) - aggregate(completed paid) per currency.
  // Overpayments on one treatment ARE treated as clinic credit that offsets
  // other treatments' unpaid balances in the same currency. This is the
  // CURRENT amount owed by the patient — distinct from the remaining treatment
  // plan value, which also includes planned (not-yet-performed) treatments.
  const remainingByCurrency = {};
  for (const cur of Object.keys(dueByCurrency)) {
    const rem = Math.round(((dueByCurrency[cur] || 0) - (paidByCurrency[cur] || 0)) * 100) / 100;
    if (rem > 0) remainingByCurrency[cur] = rem;
  }

  return { dueByCurrency, paidByCurrency, remainingByCurrency };
}

/**
 * Ledger-authoritative outstanding balance.
 *
 * "Due" comes from COMPLETED treatments; "paid" comes from the actual Payment
 * records — the payment ledger — instead of the denormalised paid_amount
 * stored on each treatment.
 *
 * This is what makes a recorded payment ALWAYS reduce the patient's remaining
 * balance, including payments that are not linked to a specific treatment,
 * and it makes double-counting impossible (a manual paid_amount edit can no
 * longer disagree with the payments that were actually taken).
 *
 * Overpayment in a currency is never returned as a negative balance.
 */
export function computeLedgerBalance(treatments, payments) {
  const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const dueByCurrency = {};
  const paidByCurrency = {};

  (treatments || []).forEach(pt => {
    if (pt.status !== 'completed') return;
    const cur = pt.currency || 'USD';
    const price = Number(pt.price) || 0;
    const disc = pt.discount_type === 'percentage'
      ? price * (Number(pt.discount_value) || 0) / 100
      : pt.discount_type === 'fixed'
        ? (Number(pt.discount_value) || 0)
        : 0;
    dueByCurrency[cur] = round((dueByCurrency[cur] || 0) + price - disc);
  });

  (payments || []).forEach(p => {
    const cur = p.currency || 'USD';
    paidByCurrency[cur] = round((paidByCurrency[cur] || 0) + (Number(p.amount) || 0));
  });

  const remainingByCurrency = {};
  const currencies = new Set([...Object.keys(dueByCurrency), ...Object.keys(paidByCurrency)]);
  currencies.forEach(cur => {
    const rem = round((dueByCurrency[cur] || 0) - (paidByCurrency[cur] || 0));
    if (rem > 0) remainingByCurrency[cur] = rem;
  });

  return { dueByCurrency, paidByCurrency, remainingByCurrency };
}