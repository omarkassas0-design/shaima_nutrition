import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

/**
 * Returns patients who need to be recalled to the clinic. A patient appears
 * in the recall list when ANY of the following is true:
 *   1. Has a manual recall_date that is overdue or upcoming (within 30 days).
 *   2. No completed appointment in the last N months (default 6) — overdue checkup.
 *   3. Has a completed treatment that is not fully paid — outstanding balance.
 *   4. Has a treatment in 'planned' or 'in_progress' status — unfinished work.
 *
 * Server-side aggregation keeps the clinic's full patient/treatment/appointment
 * collections off the client. Clinic isolation is enforced via the authoritative
 * security profile (never a client-supplied clinic_id).
 *
 * Body: { months?: number, clinic_id?: string (super_admin override) }
 */
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { clinic_id, months = 6 } = body;

    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req, clinic_id);
    if (error) return error;

    const rl = enforceRateLimit(user.id, 'getPatientRecall');
    if (rl) return rl;

    const role = authoritativeRole;
    if (!role) return Response.json({ error: 'Forbidden — no role assigned' }, { status: 403 });
    const isDoctor = role === 'doctor';
    const svc = base44.asServiceRole;

    const cutoff = new Date();
    const m = Number(months) || 6;
    cutoff.setMonth(cutoff.getMonth() - m);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const upcomingLimit = new Date();
    upcomingLimit.setDate(upcomingLimit.getDate() + 30);
    const upcomingLimitStr = upcomingLimit.toISOString().split('T')[0];

    const [patients, completedAppts, treatments] = await Promise.all([
      svc.entities.Patient.filter({ clinic_id: clinicId }, '-created_date', 5000),
      svc.entities.Appointment.filter({ clinic_id: clinicId, status: 'completed' }, '-date', 5000),
      svc.entities.PatientTreatment.filter({ clinic_id: clinicId }, '-created_date', 5000),
    ]);

    // Last completed visit per patient
    const lastVisitByPatient: Record<string, string> = {};
    completedAppts.forEach(a => {
      const cur = lastVisitByPatient[a.patient_id];
      if (!cur || (a.date || '') > cur) lastVisitByPatient[a.patient_id] = a.date;
    });

    // Per-patient signals
    const hasOutstanding: Record<string, boolean> = {};
    const plannedCount: Record<string, number> = {};
    treatments.forEach(t => {
      if (t.status === 'completed') {
        const price = Number(t.price) || 0;
        const paid = Number(t.paid_amount) || 0;
        if (price > paid) hasOutstanding[t.patient_id] = true;
      } else if (t.status === 'planned' || t.status === 'in_progress') {
        plannedCount[t.patient_id] = (plannedCount[t.patient_id] || 0) + 1;
      }
    });

    const recall = patients
      .map(p => {
        const lastVisit = lastVisitByPatient[p.id] || null;
        const reasons: string[] = [];
        // Manual recall date tracking
        if (p.recall_date) {
          if (p.recall_date < today) reasons.push('recall_due');
          else if (p.recall_date <= upcomingLimitStr) reasons.push('recall_upcoming');
        }
        // Auto-detected reasons
        if (!lastVisit) reasons.push('no_visit');
        else if (lastVisit < cutoffStr) reasons.push('overdue');
        if (hasOutstanding[p.id]) reasons.push('outstanding');
        if (plannedCount[p.id]) reasons.push('planned');
        return {
          id: p.id,
          full_name: p.full_name,
          // Doctors must never see patient phone numbers — enforced server-side.
          phone: isDoctor ? '' : p.phone,
          whatsapp_number: isDoctor ? '' : p.whatsapp_number,
          last_visit: lastVisit,
          has_outstanding: !!hasOutstanding[p.id],
          planned_treatments: plannedCount[p.id] || 0,
          recall_date: p.recall_date || null,
          recall_status: p.recall_status || null,
          recall_notes: p.recall_notes || '',
          last_recall_date: p.last_recall_date || null,
          recall_interval_months: p.recall_interval_months || null,
          reasons,
        };
      })
      .filter(r => r.reasons.length > 0)
      .sort((a, b) => {
        // Patients with overdue recall dates appear first, then upcoming recalls
        if (a.recall_date && b.recall_date) return a.recall_date.localeCompare(b.recall_date);
        if (a.recall_date) return -1;
        if (b.recall_date) return 1;
        return b.reasons.length - a.reasons.length ||
          (a.last_visit || '').localeCompare(b.last_visit || '');
      });

    return Response.json({ recall, cutoff: cutoffStr, total: recall.length });
  } catch (error) {
    return Response.json({ error: 'Failed to load recall list: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}