/**
 * Single source of truth for the PROSTHESIS / LAB CASE commission formula.
 *
 *   Commissionable Base = Revenue − Lab Cost     (never below zero)
 *   Doctor Commission   = Base × Doctor Rate %
 *   Clinic Share        = Base − Doctor Commission
 *
 * WHY THE BASE IS CLAMPED AT ZERO
 * The laboratory bill is a cost the clinic has already incurred. When the lab
 * cost equals or exceeds the case revenue (revised case, discount, remake,
 * wrong price), the arithmetic base is negative — but a negative base would
 * turn a commission into a debt charged to the doctor, and a negative clinic
 * share would report the clinic "earning" a negative amount. Neither is real.
 * At or below break-even the base is therefore 0: the doctor earns no
 * commission on that case and the clinic absorbs the loss, which is exactly
 * what `costExceedsRevenue` reports to the UI.
 *
 * Percentages are clamped to 0–100 so a bad profile value can never produce a
 * commission larger than the base.
 */

export const round2 = (n: number) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

export interface ProsthesisCaseCommission {
  revenue: number;
  labCost: number;
  /** Raw Revenue − Lab Cost, may be negative (kept for diagnosis/reporting). */
  rawBase: number;
  /** Clamped commissionable base — never negative. */
  base: number;
  rate: number;
  doctorCommissionAmount: number;
  clinicShare: number;
  /** True when lab cost is equal to or greater than revenue. */
  costExceedsRevenue: boolean;
}

export function computeProsthesisCaseCommission({
  revenue,
  labCost,
  ratePercent,
}: {
  revenue: number;
  labCost: number;
  ratePercent: number;
}): ProsthesisCaseCommission {
  const rev = round2(revenue);
  const cost = round2(labCost);
  const rate = Math.min(100, Math.max(0, Number(ratePercent) || 0));

  const rawBase = round2(rev - cost);
  const base = rawBase > 0 ? rawBase : 0;

  const doctorCommissionAmount = base > 0 ? round2((base * rate) / 100) : 0;
  const clinicShare = round2(base - doctorCommissionAmount);

  return {
    revenue: rev,
    labCost: cost,
    rawBase,
    base,
    rate,
    doctorCommissionAmount,
    clinicShare,
    costExceedsRevenue: rawBase <= 0,
  };
}