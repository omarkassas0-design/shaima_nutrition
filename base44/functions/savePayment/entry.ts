/**
 * Secure Payment create/update with automatic Doctor commission calculation.
 *
 * Security & business rules:
 *   - clinic_id is ALWAYS taken from the authenticated user (never from the frontend).
 *   - The selected Doctor MUST belong to the same clinic as the authenticated user.
 *   - Doctor commission percentage is ALWAYS read from the Doctor's profile — the
 *     caller cannot supply or override it.
 *   - commission_amount = round(amount × doctor.commission_percentage / 100, 2).
 *   - On update, if the Doctor is unchanged the stored commission percentage is
 *     preserved (historical accuracy); if the Doctor changed, the new Doctor's
 *     current percentage is used.
 *
 * Body (create):  { patient_id, doctor_id, amount, currency?, method?, payment_date?, notes?, patient_treatment_id? }
 * Body (update):  { payment_id, patient_id, doctor_id, amount, currency?, method?, payment_date?, notes?, patient_treatment_id? }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { recordAudit, makeSummary } from '../../shared/auditLog.ts';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Compute the NET amount for a prosthesis/lab payment using the
 * cost-recovery-first model. The lab cost must be recovered before any
 * commission applies. Handles partial payments correctly.
 *
 * Mirrors calcProsthesisNet in src/lib/commissionUtils.js exactly.
 */
function calcProsthesisNet(paymentAmount, cumulativePaidBefore, cost) {
  const amt = Number(paymentAmount) || 0;
  const before = Number(cumulativePaidBefore) || 0;
  const c = Number(cost) || 0;
  if (c <= 0) return amt;
  if (before >= c) return amt;
  const after = before + amt;
  if (after <= c) return 0;
  return round2(after - c);
}

/**
 * Recalculate PatientTreatment.paid_amount from actual Payment records.
 * Only payments in the SAME currency as the treatment reduce its balance.
 * This prevents duplicate payments, stale data, and cross-currency errors.
 */
async function recalcPaidAmount(svc, patientTreatmentId, clinicId) {
  let pt;
  try { pt = await svc.entities.PatientTreatment.get(patientTreatmentId); } catch (_) { return; }
  if (!pt) return;
  // Multi-clinic isolation: never recalculate a treatment outside the caller's clinic.
  if (!clinicId || pt.clinic_id !== clinicId) return;
  const payments = await svc.entities.Payment.filter(
    { patient_treatment_id: patientTreatmentId, clinic_id: pt.clinic_id },
    '-created_date',
    1000
  );
  const sameCurrency = payments.filter(p => (p.currency || 'USD') === (pt.currency || 'USD'));
  const totalPaid = sameCurrency.reduce((sum, p) => sum + (p.amount || 0), 0);
  await svc.entities.PatientTreatment.update(patientTreatmentId, { paid_amount: round2(totalPaid) });
}

export default async function(req) {
  try {
    const { error, base44, clinicId, user, authoritativeRole } = await getAuthenticatedClinicUser(req);
    if (error) return error;

    // Rate limit: prevent double payments and rapid re-submission
    const rateLimitResponse = enforceRateLimit(user.id, 'savePayment');
    if (rateLimitResponse) return rateLimitResponse;

    // Role guard: use AUTHORITATIVE role (not the tamperable User record).
    const userRole = authoritativeRole;
    if (!['super_admin', 'clinic_admin', 'receptionist'].includes(userRole)) {
      return Response.json({ error: 'Forbidden — only clinic administrators and receptionists can manage payments' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const {
      payment_id, patient_id, doctor_id, amount,
      currency, method, payment_date, notes, patient_treatment_id,
    } = body;

    // --- Delete path (before validation — delete only needs payment_id) ---
    if (body.action === 'delete') {
      if (!body.payment_id) return Response.json({ error: 'Payment ID is required' }, { status: 400 });
      let existingPayment;
      try { existingPayment = await svc.entities.Payment.get(body.payment_id); } catch (_) {
        return Response.json({ error: 'Payment not found' }, { status: 404 });
      }
      if (!existingPayment) return Response.json({ error: 'Payment not found' }, { status: 404 });
      if (existingPayment.clinic_id !== clinicId) {
        return Response.json({ error: 'Forbidden — payment belongs to another clinic' }, { status: 403 });
      }
      await recordAudit(svc, clinicId, user, 'delete', 'Payment', body.payment_id, makeSummary('delete', 'Payment', existingPayment), existingPayment);
      await svc.entities.Payment.delete(body.payment_id);
      if (existingPayment.patient_treatment_id) {
        await recalcPaidAmount(svc, existingPayment.patient_treatment_id, clinicId);
      }
      return Response.json({ success: true });
    }

    // --- Validation ---
    if (!patient_id) return Response.json({ error: 'Patient is required' }, { status: 400 });
    if (!doctor_id) return Response.json({ error: 'Doctor is required' }, { status: 400 });

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return Response.json({ error: 'Payment amount must be a valid number greater than zero' }, { status: 400 });
    }

    // --- Fetch the selected Doctor (service role bypasses RLS) ---
    let doctor;
    try {
      doctor = await svc.entities.Doctor.get(doctor_id);
    } catch (_) {
      return Response.json({ error: 'Doctor not found' }, { status: 404 });
    }
    if (!doctor) return Response.json({ error: 'Doctor not found' }, { status: 404 });

    // Multi-clinic isolation: the doctor must belong to the caller's clinic.
    if (doctor.clinic_id !== clinicId) {
      return Response.json({ error: 'Selected doctor does not belong to your clinic' }, { status: 403 });
    }

    // --- Determine commission rate from the patient's source (item #6) ---
    // If the patient was brought by a doctor → use the doctor's "doctor brings" rate.
    // If the patient was brought by the clinic → use the doctor's "clinic brings" rate.
    // If patient_source is not set → fall back to the legacy single commission_percentage.
    let patientRecord = null;
    try {
      patientRecord = await svc.entities.Patient.get(patient_id);
    } catch (_) {
      return Response.json({ error: 'Patient not found' }, { status: 404 });
    }
    if (!patientRecord) return Response.json({ error: 'Patient not found' }, { status: 404 });

    // Multi-clinic isolation: the patient must belong to the caller's clinic.
    if (patientRecord.clinic_id !== clinicId) {
      return Response.json({ error: 'Selected patient does not belong to your clinic' }, { status: 403 });
    }

    // Multi-clinic isolation: a supplied treatment must belong to the caller's
    // clinic AND to the selected patient before it is read or written.
    let patientTreatment = null;
    if (patient_treatment_id) {
      try {
        patientTreatment = await svc.entities.PatientTreatment.get(patient_treatment_id);
      } catch (_) {
        return Response.json({ error: 'Treatment not found' }, { status: 404 });
      }
      if (!patientTreatment) return Response.json({ error: 'Treatment not found' }, { status: 404 });
      if (patientTreatment.clinic_id !== clinicId || patientTreatment.patient_id !== patient_id) {
        return Response.json({ error: 'Selected treatment does not belong to your clinic or patient' }, { status: 403 });
      }
    }

    // Default to 'clinic' when patient_source is empty/missing — a patient
    // without a referring doctor is assumed to be clinic-sourced. This ensures
    // the source-specific commission rate is used instead of falling back to
    // the legacy commission_percentage (which is 0 on new-style doctor profiles
    // that only set commission_percentage_doctor / commission_percentage_clinic).
    // Must mirror getDoctorCommissionPct in src/lib/commissionUtils.js exactly.
    const source = patientRecord?.patient_source || 'clinic';
    let doctorPct;
    if (source === 'doctor') {
      doctorPct = Number(doctor.commission_percentage_doctor) || Number(doctor.commission_percentage) || 0;
    } else if (source === 'clinic') {
      doctorPct = Number(doctor.commission_percentage_clinic) || Number(doctor.commission_percentage) || 0;
    } else {
      doctorPct = Number(doctor.commission_percentage) || 0;
    }
    if (doctorPct < 0 || doctorPct > 100) {
      return Response.json({ error: 'Doctor commission percentage must be between 0 and 100' }, { status: 400 });
    }

    // --- Prosthesis/Lab case: commission on NET amount (payment − lab cost) ---
    // When the payment is for a treatment linked to a LabCase with a cost,
    // commission is calculated on the NET amount, not the full payment. Uses
    // a cost-recovery-first model: the lab cost must be recovered before any
    // commission applies. This is enforced SERVER-SIDE — the client cannot
    // override it. For normal (non-prosthesis) treatments, netForCommission
    // equals the full payment amount and the existing behavior is unchanged.
    let isProsthesis = false;
    let prosthesisCost = 0;
    let netForCommission = amt;

    if (patient_treatment_id) {
      try {
        const labCases = await svc.entities.LabCase.filter(
          { patient_treatment_id, clinic_id: clinicId },
          '-created_date',
          10
        );
        // Match a LabCase in the SAME currency with a positive cost.
        const labCase = labCases.find(
          lc => (lc.currency || 'USD') === (currency || 'USD') && (Number(lc.cost) || 0) > 0
        );
        if (labCase) {
          isProsthesis = true;
          prosthesisCost = round2(Number(labCase.cost) || 0);
          // Sum prior payments for this treatment (same currency, excluding the
          // payment being edited) to get the cumulative paid BEFORE this one.
          const priorPayments = await svc.entities.Payment.filter(
            { patient_treatment_id, clinic_id: clinicId },
            '-created_date',
            1000
          );
          const cumulativeBefore = priorPayments
            .filter(p => (p.currency || 'USD') === (currency || 'USD') && p.id !== payment_id)
            .reduce((s, p) => s + (p.amount || 0), 0);
          netForCommission = calcProsthesisNet(amt, cumulativeBefore, prosthesisCost);
        }
      } catch (_) { /* best-effort — fall back to normal calculation */ }
    }

    const payload = {
      patient_id,
      doctor_id,
      doctor_name: doctor.name,
      amount: round2(amt),
      currency: currency || 'USD',
      method: method || 'cash',
      payment_date: payment_date || new Date().toISOString().slice(0, 10),
      notes: notes || '',
      clinic_id: clinicId,
      is_prosthesis: isProsthesis,
      prosthesis_cost: prosthesisCost,
      net_amount: netForCommission,
    };
    if (patient_treatment_id) payload.patient_treatment_id = patient_treatment_id;

    // --- Update path ---
    if (payment_id) {
      let existing;
      try {
        existing = await svc.entities.Payment.get(payment_id);
      } catch (_) {
        return Response.json({ error: 'Payment not found' }, { status: 404 });
      }
      if (!existing) return Response.json({ error: 'Payment not found' }, { status: 404 });
      if (existing.clinic_id !== clinicId) {
        return Response.json({ error: 'Forbidden — payment belongs to another clinic' }, { status: 403 });
      }

      // Preserve the historically-stored percentage when the doctor is unchanged,
      // so editing a non-doctor field does not retroactively change commission.
      let finalPct = doctorPct;
      if (existing.doctor_id === doctor_id && existing.doctor_commission_percentage != null) {
        finalPct = Number(existing.doctor_commission_percentage) || 0;
      }
      payload.doctor_commission_percentage = finalPct;
      payload.doctor_commission_amount = round2(netForCommission * finalPct / 100);

      await recordAudit(svc, clinicId, user, 'update', 'Payment', payment_id, makeSummary('update', 'Payment', existing));
      const updated = await svc.entities.Payment.update(payment_id, payload);
      if (patient_treatment_id) {
        await recalcPaidAmount(svc, patient_treatment_id, clinicId);
      }
      return Response.json({ success: true, payment: updated });
    }

    // --- Create path ---
    payload.doctor_commission_percentage = doctorPct;
    payload.doctor_commission_amount = round2(netForCommission * doctorPct / 100);

    const created = await svc.entities.Payment.create(payload);
    await recordAudit(svc, clinicId, user, 'create', 'Payment', created.id, makeSummary('create', 'Payment', created));
    if (patient_treatment_id) {
      await recalcPaidAmount(svc, patient_treatment_id, clinicId);
    }

    // --- Auto-create a receipt invoice for this payment (item #14) ---
    // Only create if no existing invoice already references this payment.
    try {
      const existingInvoices = await svc.entities.Invoice.filter(
        { clinic_id: clinicId, patient_id },
        '-created_date',
        500
      );
      const alreadyInvoiced = existingInvoices.some(inv =>
        Array.isArray(inv.payment_ids) && inv.payment_ids.includes(created.id)
      );
      if (!alreadyInvoiced) {
        const pName = patientRecord?.full_name || '';
        const pCurrency = payload.currency || 'USD';
        // Treatment name comes from the clinic-verified record fetched above.
        const treatmentName = patientTreatment?.treatment_name || '';
        await svc.entities.Invoice.create({
          clinic_id: clinicId,
          patient_id,
          patient_name: pName,
          invoice_number: `REC-${Date.now()}-${created.id.slice(-6)}`,
          invoice_date: payload.payment_date || new Date().toISOString().slice(0, 10),
          type: 'receipt',
          doctor_id: doctor_id,
          doctor_name: doctor.name,
          items: [],
          payment_ids: [created.id],
          payments_snapshot: [{
            payment_id: created.id,
            amount: payload.amount,
            currency: pCurrency,
            method: payload.method,
            payment_date: payload.payment_date,
            treatment_name: treatmentName,
            notes: payload.notes || '',
          }],
          totals: { [pCurrency]: { due: 0, paid: payload.amount, remaining: 0 } },
          notes: '',
          status: 'active',
        });
      }
    } catch (e) {
      // Invoice creation is best-effort — must not block the payment.
      console.error('Auto-invoice creation failed:', e?.message);
    }

    return Response.json({ success: true, payment: created });
  } catch (error) {
    return Response.json({ error: 'Failed to save payment: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}