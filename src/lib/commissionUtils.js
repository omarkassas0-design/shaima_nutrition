/**
 * Compute the doctor commission percentage based on the patient's source.
 * Mirrors the server-side logic in worker/src/legacy/functions/savePayment/entry.ts.
 *
 * - patient_source === 'doctor' → doctor's referral commission rate (commission_percentage_doctor)
 * - patient_source === 'clinic' → doctor's clinic-sourced commission rate (commission_percentage_clinic)
 * - otherwise                    → legacy single commission_percentage
 *
 * Falls back to the legacy `commission_percentage` when the source-specific
 * rate is not set, so older doctor profiles keep working.
 *
 * @param {object} doctor  - The Doctor record (must include commission fields)
 * @param {object} patient - The Patient record (must include patient_source)
 * @returns {number} Commission percentage 0–100
 */
export function getDoctorCommissionPct(doctor, patient) {
  if (!doctor) return 0;
  // Default to 'clinic' when patient_source is empty/missing — a patient
  // without a referring doctor is assumed to be clinic-sourced. This ensures
  // the source-specific commission rate is used instead of falling back to
  // the legacy commission_percentage (which is 0 on new-style doctor profiles
  // that only set commission_percentage_doctor / commission_percentage_clinic).
  const source = patient?.patient_source || 'clinic';
  if (source === 'doctor') {
    return Number(doctor.commission_percentage_doctor) || Number(doctor.commission_percentage) || 0;
  }
  if (source === 'clinic') {
    return Number(doctor.commission_percentage_clinic) || Number(doctor.commission_percentage) || 0;
  }
  return Number(doctor.commission_percentage) || 0;
}

/**
 * Calculate the commission monetary amount from a payment amount and
 * commission percentage. Rounds to 2 decimal places.
 *
 * @param {number|string} amount - Payment amount (or net amount for prosthesis)
 * @param {number|string} pct    - Commission percentage 0–100
 * @returns {number} Commission amount
 */
export function calcCommissionAmount(amount, pct) {
  return Math.round((Number(amount || 0) * Number(pct || 0) / 100) * 100) / 100;
}

/**
 * Compute the NET amount for a prosthesis/lab payment using the
 * cost-recovery-first model. The lab cost must be recovered before any
 * commission applies. Handles partial payments correctly:
 *
 *   - cumulativePaidBefore >= cost  →  net = paymentAmount (cost already recovered)
 *   - cumulativePaidBefore + payment <= cost  →  net = 0 (still covering the cost)
 *   - otherwise  →  net = cumulativePaidBefore + payment − cost (partial recovery)
 *
 * @param {number} paymentAmount       - This payment's amount
 * @param {number} cumulativePaidBefore - Sum of prior payments for this treatment (same currency)
 * @param {number} cost                - The LabCase cost
 * @returns {number} Net amount (≥ 0) that commission should be calculated on
 */
export function calcProsthesisNet(paymentAmount, cumulativePaidBefore, cost) {
  const amt = Number(paymentAmount) || 0;
  const before = Number(cumulativePaidBefore) || 0;
  const c = Number(cost) || 0;
  if (c <= 0) return amt;
  if (before >= c) return amt;
  const after = before + amt;
  if (after <= c) return 0;
  return Math.round((after - c) * 100) / 100;
}
