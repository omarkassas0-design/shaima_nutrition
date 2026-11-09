/**
 * Shared currency helpers for backend functions.
 *
 * Currencies are NEVER mixed — every total is a per-currency map
 * ({ USD: number, SYP: number, TRY: number }).
 */

export const SUPPORTED_CURRENCIES = ['USD', 'SYP', 'TRY', 'EUR'];

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Sums records by currency, returning { USD: number, SYP: number, ... }.
 * Records with no currency field default to 'USD'.
 */
export function sumByCurrency(
  records: any[],
  amountField: string,
  currencyField: string = 'currency'
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const r of records) {
    const cur = r[currencyField] || 'USD';
    const amt = Number(r[amountField]) || 0;
    totals[cur] = round2((totals[cur] || 0) + amt);
  }
  return totals;
}

/**
 * Adds two per-currency total maps together (currencies stay separate).
 */
export function addCurrencyTotals(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = { ...a };
  for (const [cur, amt] of Object.entries(b)) {
    result[cur] = round2((result[cur] || 0) + Number(amt));
  }
  return result;
}