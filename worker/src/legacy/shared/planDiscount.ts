/**
 * Treatment-plan discount engine — the SINGLE source of truth for how a
 * plan-level discount is validated and distributed across PatientTreatment
 * records.
 *
 * WHY IT LIVES ON THE SERVER
 * The plan discount used to be computed in the browser and written as one
 * request per treatment. A plan with many units therefore fired a burst of
 * parallel function invocations; when a response failed after its write had
 * already committed, the plan was left HALF discounted (treatments updated,
 * plan metadata not) and the user saw a generic save error.
 * The whole calculation now runs once, inside the backend action
 * `applyPlanDiscount` (clinicScopedCrud), and is written with one bulk update.
 *
 * RULES
 *   percentage — the same percentage on EVERY treatment, whatever its currency
 *                (a percentage is currency-agnostic).
 *   fixed      — an amount in the CLINIC's currency, distributed proportionally
 *                over the treatment units of that currency. Units in another
 *                currency never carry a fixed discount.
 *   none       — every treatment returns to no discount.
 *
 * A discount is ALWAYS stored as an absolute value (never accumulated), so
 * applying the same discount twice cannot double it.
 */

export type PlanDiscountType = 'none' | 'percentage' | 'fixed';

export interface PlanDiscountError {
  code: string;
  message: string;
}

const round2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;

export function normalizePlanDiscountType(type: any): PlanDiscountType {
  return type === 'percentage' || type === 'fixed' ? type : 'none';
}

/**
 * Validate the requested discount before anything is written.
 * Returns null when valid, or { code, message } — `code` is a translation key
 * the frontend can localize.
 */
export function validatePlanDiscount(type: any, rawValue: any): PlanDiscountError | null {
  if (type !== 'none' && type !== 'percentage' && type !== 'fixed') {
    return { code: 'invalid_discount_value', message: 'Invalid discount type' };
  }
  if (type === 'none') return null;

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return { code: 'invalid_discount_value', message: 'Enter a valid discount value' };
  }
  if (type === 'percentage' && (value <= 0 || value > 100)) {
    return { code: 'invalid_discount_percentage', message: 'Discount percentage must be between 0 and 100' };
  }
  if (type === 'fixed' && value < 0) {
    return { code: 'invalid_discount_value', message: 'Discount amount cannot be negative' };
  }
  return null;
}

/**
 * Build the exact discount to store on every treatment of the patient.
 * Returns { changes, error } — changes is [{ id, discount_type, discount_value }].
 */
export function buildPlanDiscountChanges(
  treatments: any[],
  type: any,
  rawValue: any,
  clinicCurrency: string
): { changes: any[]; error: PlanDiscountError | null } {
  const list = Array.isArray(treatments) ? treatments : [];
  const kind = normalizePlanDiscountType(type);
  const value = round2(rawValue);
  const changes: any[] = [];

  if (list.length === 0) return { changes, error: null };

  if (kind === 'none') {
    list.forEach((pt) => changes.push({ id: pt.id, discount_type: 'none', discount_value: 0 }));
    return { changes, error: null };
  }

  if (kind === 'percentage') {
    list.forEach((pt) => changes.push({ id: pt.id, discount_type: 'percentage', discount_value: value }));
    return { changes, error: null };
  }

  // fixed amount — distributed over the units of the clinic's currency only
  const inCurrency = list.filter((pt) => (pt.currency || 'USD') === clinicCurrency);
  const total = round2(inCurrency.reduce((sum, pt) => sum + (Number(pt.price) || 0), 0));

  if (inCurrency.length > 0 && value > total) {
    return {
      changes: [],
      error: { code: 'discount_exceeds_total', message: 'The discount is larger than the eligible treatment total' },
    };
  }

  let remaining = round2(Math.min(value, total));
  inCurrency.forEach((pt, index) => {
    const price = round2(pt.price);
    const isLast = index === inCurrency.length - 1;
    let share = isLast ? remaining : round2((Math.min(value, total) / (total || 1)) * price);
    // A unit can never be discounted below zero.
    share = Math.max(0, Math.min(share, price));
    remaining = round2(remaining - share);
    changes.push({ id: pt.id, discount_type: 'fixed', discount_value: share });
  });

  // Units in another currency never carry a fixed plan discount.
  list.forEach((pt) => {
    if ((pt.currency || 'USD') !== clinicCurrency) {
      changes.push({ id: pt.id, discount_type: 'none', discount_value: 0 });
    }
  });

  return { changes, error: null };
}