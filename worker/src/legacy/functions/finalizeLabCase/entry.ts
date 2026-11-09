/**
 * Finalize / unfinalize a Lab (Prosthesis) Case.
 *
 * Called after a LabCase is created or updated. It inspects the current status
 * and performs the correct transition server-side:
 *
 *   - status === 'delivered'  && !is_finalized  → FINALIZE
 *       • revenue    = patient_price (falls back to patient_paid_amount)
 *       • net_amount = MAX(0, revenue − cost)   ← the commissionable base
 *       • doctor_commission_amount = net_amount × doctor_commission_pct / 100
 *         (commission is NEVER calculated on the lab cost; when the lab cost
 *          equals or exceeds revenue the base is 0 and the clinic absorbs it)
 *       • clinic_share = net_amount − doctor_commission_amount
 *       • Creates an Expense record (category 'prosthesis_lab') for the lab cost
 *       • Stores finalized fields + expense_id + is_finalized=true on the case
 *
 *   - status !== 'delivered'  && is_finalized   → UNFINALIZE (reverse)
 *       • Deletes the Expense record created at finalization
 *       • Clears all finalized fields (is_finalized, expense_id, amounts, etc.)
 *       • Allows a clean re-finalization if the case is delivered again later
 *
 *   - otherwise → no-op (idempotent). Prevents duplicate expense/commission
 *     calculations if the case is updated or Delivered again while already
 *     finalized.
 *
 * Security:
 *   - clinic_id is ALWAYS derived from the authenticated user (never frontend).
 *   - The LabCase MUST belong to the caller's clinic.
 *   - The Doctor MUST belong to the caller's clinic.
 *   - Doctor commission percentage is ALWAYS read from the Doctor's profile
 *     based on the patient's source — the caller cannot supply or override it.
 *   - Only roles with labcases:write (clinic_admin, receptionist, doctor,
 *     super_admin) can call this function.
 *
 * Body: { lab_case_id: string }
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { recordAudit, makeSummary } from '../../shared/auditLog.ts';
import { computeProsthesisCaseCommission } from '../../shared/commission.ts';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export default async function(req) {
  try {
    const { error, base44, clinicId, user, authoritativeRole } = await getAuthenticatedClinicUser(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'finalizeLabCase');
    if (rateLimitResponse) return rateLimitResponse;

    // Role guard — same roles that can manage lab cases (labcases:write).
    const userRole = authoritativeRole;
    if (!['super_admin', 'clinic_admin', 'receptionist', 'doctor'].includes(userRole)) {
      return Response.json({ error: 'Forbidden — insufficient permissions to finalize lab cases' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { lab_case_id } = body;
    if (!lab_case_id) return Response.json({ error: 'lab_case_id is required' }, { status: 400 });

    // --- Load the LabCase ---
    let labCase;
    try { labCase = await svc.entities.LabCase.get(lab_case_id); } catch (_) {
      return Response.json({ error: 'Lab case not found' }, { status: 404 });
    }
    if (!labCase) return Response.json({ error: 'Lab case not found' }, { status: 404 });
    if (labCase.clinic_id !== clinicId) {
      return Response.json({ error: 'Forbidden — lab case belongs to another clinic' }, { status: 403 });
    }

    const status = labCase.status;
    const isFinalized = !!labCase.is_finalized;

    // --- No-op: already in the correct state ---
    if (status === 'delivered' && isFinalized) {
      return Response.json({ success: true, lab_case: labCase, action: 'noop', message: 'Already finalized' });
    }
    if (status !== 'delivered' && !isFinalized) {
      return Response.json({ success: true, lab_case: labCase, action: 'noop', message: 'Not delivered — nothing to finalize' });
    }

    // --- UNFINALIZE: reverse a previous finalization ---
    if (status !== 'delivered' && isFinalized) {
      const { data: transactionResult, error: transactionError } = await svc.rpc('commit_lab_case_finalization', {
        p_action: 'unfinalize',
        p_clinic_id: clinicId,
        p_lab_case_id: lab_case_id,
        p_fields: {},
        p_expense: null,
      });
      if (transactionError) throw new Error(transactionError.message || 'Unable to unfinalize lab case.');
      if (transactionResult?.action === 'noop') {
        return Response.json({ success: true, lab_case: transactionResult.lab_case, action: 'noop', message: 'Lab case state changed before unfinalization.' });
      }
      await recordAudit(svc, clinicId, user, 'update', 'LabCase', lab_case_id, 'Unfinalized lab case — reversed expense and commission');
      return Response.json({ success: true, lab_case: transactionResult?.lab_case, action: 'unfinalized' });
    }

    // --- FINALIZE: status === 'delivered' && !isFinalized ---
    const cost = Number(labCase.cost) || 0;
    const patientPaid = Number(labCase.patient_paid_amount) || 0;
    const currency = labCase.currency || 'USD';

    // A meaningful finalization requires a cost and a doctor to compute commission.
    if (!labCase.doctor_id) {
      return Response.json({ error: 'Cannot finalize — doctor is required to calculate commission' }, { status: 400 });
    }

    // --- Fetch the Doctor (must belong to the same clinic) ---
    let doctor;
    try { doctor = await svc.entities.Doctor.get(labCase.doctor_id); } catch (_) {
      return Response.json({ error: 'Doctor not found' }, { status: 404 });
    }
    if (!doctor) return Response.json({ error: 'Doctor not found' }, { status: 404 });
    if (doctor.clinic_id !== clinicId) {
      return Response.json({ error: 'Selected doctor does not belong to your clinic' }, { status: 403 });
    }

    // --- Determine commission rate from the patient's source ---
    // Mirrors savePayment / getDoctorCommissionPct exactly.
    let patientRecord = null;
    try { patientRecord = await svc.entities.Patient.get(labCase.patient_id); } catch (_) {}
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

    // --- Calculate net, commission, clinic share ---
    // Revenue − Lab Cost = commissionable base (clamped at 0), then × the doctor
    // rate. Revenue is the case price the patient is charged; cases created before
    // patient_price existed fall back to what has actually been collected.
    // The shared helper guarantees the doctor is never charged for a loss-making
    // case and that the clinic share can never go negative.
    const revenue = Number(labCase.patient_price) > 0 ? Number(labCase.patient_price) : patientPaid;
    const calc = computeProsthesisCaseCommission({ revenue, labCost: cost, ratePercent: doctorPct });
    const netAmount = calc.base;
    const doctorCommissionAmount = calc.doctorCommissionAmount;
    const clinicShare = calc.clinicShare;

    // --- Create the Expense record (Prosthesis/Lab Costs) ---
    const patientName = labCase.patient_name || patientRecord?.full_name || '';
    const expenseName = `Prosthesis/Lab: ${labCase.case_type || 'Case'}${patientName ? ' — ' + patientName : ''}`;
    const expenseDate = labCase.received_date || new Date().toISOString().split('T')[0];
    const expenseNotes = `Auto-created from lab case finalization. Case ID: ${lab_case_id}`;

    const expense = {
      clinic_id: clinicId,
      name: expenseName,
      amount: round2(cost),
      currency,
      expense_date: expenseDate,
      category: 'prosthesis_lab',
      notes: expenseNotes,
    };

    // --- Update the LabCase with finalized fields ---
    const finalizedFields = {
      net_amount: netAmount,
      doctor_commission_percentage: doctorPct,
      doctor_commission_amount: doctorCommissionAmount,
      clinic_share: clinicShare,
      is_finalized: true,
      finalized_at: new Date().toISOString(),
      finalized_by: user.id,
      finalized_by_name: user.full_name || user.email || '',
    };

    const { data: transactionResult, error: transactionError } = await svc.rpc('commit_lab_case_finalization', {
      p_action: 'finalize',
      p_clinic_id: clinicId,
      p_lab_case_id: lab_case_id,
      p_fields: finalizedFields,
      p_expense: expense,
    });
    if (transactionError) throw new Error(transactionError.message || 'Unable to finalize lab case.');
    if (transactionResult?.action === 'noop') {
      return Response.json({ success: true, lab_case: transactionResult.lab_case, action: 'noop', message: 'Lab case state changed before finalization.' });
    }
    const updated = transactionResult?.lab_case;
    const expenseId = transactionResult?.expense_id;
    await recordAudit(svc, clinicId, user, 'update', 'LabCase', lab_case_id, makeSummary('update', 'LabCase', labCase));

    return Response.json({
      success: true,
      lab_case: updated,
      action: 'finalized',
      summary: {
        cost: round2(cost),
        patient_paid: round2(patientPaid),
        net_amount: netAmount,
        doctor_commission_percentage: doctorPct,
        doctor_commission_amount: doctorCommissionAmount,
        clinic_share: clinicShare,
        expense_id: expenseId,
      },
    });
  } catch (error) {
    console.error('finalizeLabCase error:', error?.stack || error?.message || error);
    return Response.json({ error: 'Failed to finalize lab case: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}
