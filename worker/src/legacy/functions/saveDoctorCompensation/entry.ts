/**
 * Secure Doctor compensation update (commission + monthly salary).
 *
 * Security & business rules:
 *   - Only clinic_admin (and super_admin) can manage doctor compensation.
 *   - clinic_id is ALWAYS taken from the authenticated user (never from the frontend).
 *   - The doctor MUST belong to the same clinic as the authenticated user.
 *   - Two commission rates are stored:
 *       commission_percentage_doctor — applied when the DOCTOR brought the patient
 *       commission_percentage_clinic — applied when the CLINIC brought the patient
 *     A legacy single commission_percentage is kept as a fallback.
 *   - monthly_salary is independent from commission and stored with its own currency.
 *
 * Body: { doctor_id, commission_percentage_doctor?, commission_percentage_clinic?,
 *         commission_percentage?, monthly_salary, salary_currency }
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { recordAudit, makeSummary } from '../../shared/auditLog.ts';

function validatePct(v) {
  const n = Number(v) || 0;
  if (n < 0 || n > 100) return null;
  return n;
}

export default async function(req) {
  try {
    const { error, base44, clinicId, user, authoritativeRole } = await getAuthenticatedClinicUser(req);
    if (error) return error;

    // Rate limit: prevent rapid compensation changes
    const rateLimitResponse = enforceRateLimit(user.id, 'saveDoctorCompensation');
    if (rateLimitResponse) return rateLimitResponse;

    // Only clinic administrators can manage doctor compensation (authoritative role).
    const userRole = authoritativeRole;
    if (!['super_admin', 'clinic_admin'].includes(userRole)) {
      return Response.json({ error: 'Forbidden — only clinic administrators can manage doctor compensation' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const {
      doctor_id,
      commission_percentage_doctor,
      commission_percentage_clinic,
      commission_percentage,
      monthly_salary,
      salary_currency,
    } = body;

    if (!doctor_id) return Response.json({ error: 'Doctor ID is required' }, { status: 400 });

    // Fetch the doctor and verify clinic isolation.
    let doctor;
    try {
      doctor = await svc.entities.Doctor.get(doctor_id);
    } catch (_) {
      return Response.json({ error: 'Doctor not found' }, { status: 404 });
    }
    if (!doctor) return Response.json({ error: 'Doctor not found' }, { status: 404 });
    if (doctor.clinic_id !== clinicId) {
      return Response.json({ error: 'Doctor does not belong to your clinic' }, { status: 403 });
    }

    // Validate commission percentages (0-100).
    const pctDoctor = validatePct(commission_percentage_doctor);
    const pctClinic = validatePct(commission_percentage_clinic);
    const pctLegacy = validatePct(commission_percentage);
    if (pctDoctor === null || pctClinic === null || pctLegacy === null) {
      return Response.json({ error: 'Commission percentage must be between 0 and 100' }, { status: 400 });
    }

    const salary = Number(monthly_salary) || 0;
    const currency = ['USD', 'SYP', 'TRY', 'EUR'].includes(salary_currency) ? salary_currency : 'USD';

    const updatePayload = {
      monthly_salary: salary,
      salary_currency: currency,
    };
    // Only update the commission fields that were provided.
    if (commission_percentage_doctor !== undefined) updatePayload.commission_percentage_doctor = pctDoctor;
    if (commission_percentage_clinic !== undefined) updatePayload.commission_percentage_clinic = pctClinic;
    if (commission_percentage !== undefined) updatePayload.commission_percentage = pctLegacy;

    const updated = await svc.entities.Doctor.update(doctor_id, updatePayload);
    await recordAudit(svc, clinicId, user, 'update', 'Doctor', doctor_id, makeSummary('update', 'Doctor', doctor));

    return Response.json({ success: true, doctor: updated });
  } catch (error) {
    return Response.json({ error: 'Failed to save compensation: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}