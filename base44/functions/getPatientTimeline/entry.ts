import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

/**
 * Returns a merged, reverse-chronological timeline of ALL clinical and
 * financial events for a single patient (appointments, treatments, payments,
 * files, consents, invoices, lab cases, recall events). Server-side
 * aggregation avoids multiple round-trips from the client and enforces
 * clinic isolation.
 *
 * Doctors do not see payment amounts, currencies, or invoice events —
 * enforced server-side.
 *
 * Body: { patient_id: string, clinic_id?: string (super_admin override) }
 */
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { patient_id, clinic_id } = body;
    if (!patient_id) {
      return Response.json({ error: 'patient_id is required' }, { status: 400 });
    }

    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req, clinic_id);
    if (error) return error;

    const rl = enforceRateLimit(user.id, 'getPatientTimeline');
    if (rl) return rl;

    const role = authoritativeRole;
    if (!role) return Response.json({ error: 'Forbidden — no role assigned' }, { status: 403 });
    const isDoctor = role === 'doctor';
    const svc = base44.asServiceRole;

    const [appointments, treatments, payments, files, consents, invoices, labCases] = await Promise.all([
      svc.entities.Appointment.filter({ clinic_id: clinicId, patient_id }, '-date', 1000),
      svc.entities.PatientTreatment.filter({ clinic_id: clinicId, patient_id }, '-created_date', 1000),
      svc.entities.Payment.filter({ clinic_id: clinicId, patient_id }, '-payment_date', 1000),
      svc.entities.PatientFile.filter({ clinic_id: clinicId, patient_id }, '-created_date', 500),
      svc.entities.ConsentForm.filter({ clinic_id: clinicId, patient_id }, '-signed_at', 500),
      svc.entities.Invoice.filter({ clinic_id: clinicId, patient_id }, '-invoice_date', 500),
      svc.entities.LabCase.filter({ clinic_id: clinicId, patient_id }, '-created_date', 500),
    ]);

    // Fetch patient record for recall events (best-effort, clinic-scoped)
    let patient = null;
    try {
      patient = await svc.entities.Patient.get(patient_id);
      if (patient && patient.clinic_id !== clinicId) patient = null;
    } catch (_) { patient = null; }

    const events: any[] = [];

    appointments.forEach(a => events.push({
      type: 'appointment',
      date: a.date,
      time: a.start_time,
      title: a.treatment_name || a.notes || 'Appointment',
      subtitle: a.doctor_name || '',
      status: a.status,
      id: a.id,
    }));

    treatments.forEach(tr => {
      // 1. Treatment Plan event — when the treatment was added to the plan.
      //    This represents the "Treatment Plan" aspect (all treatments start as planned).
      const toothNum = (tr.tooth_numbers || [])[0];
      const surfaces = toothNum ? (tr.tooth_surfaces?.[String(toothNum)] || []) : [];
      events.push({
        type: 'treatment_plan',
        date: tr.created_date,
        title: tr.treatment_name || 'Treatment Planned',
        subtitle: tr.doctor_name || '',
        status: 'planned',
        tooth_number: toothNum,
        surfaces: surfaces.length > 0 ? surfaces : undefined,
        amount: isDoctor ? undefined : tr.price,
        currency: isDoctor ? undefined : tr.currency,
        id: `${tr.id}-plan`,
      });
      // 2. Treatment/Procedure event — when the treatment was performed or
      //    its status changed from "planned". Only shown for treatments that
      //    have progressed beyond "planned" (completed, in_progress, cancelled).
      //    This represents the "Treatment/Procedure" and "Status Change" aspects.
      if (tr.status && tr.status !== 'planned') {
        events.push({
          type: 'treatment',
          date: tr.treatment_date || tr.updated_date || tr.created_date,
          title: tr.treatment_name || 'Treatment',
          subtitle: tr.doctor_name || '',
          status: tr.status,
          tooth_number: toothNum,
          surfaces: surfaces.length > 0 ? surfaces : undefined,
          amount: isDoctor ? undefined : tr.price,
          currency: isDoctor ? undefined : tr.currency,
          id: `${tr.id}-procedure`,
        });
      }
    });

    payments.forEach(p => events.push({
      type: 'payment',
      date: p.payment_date || p.created_date,
      title: 'Payment',
      subtitle: p.method || '',
      amount: isDoctor ? undefined : p.amount,
      currency: isDoctor ? undefined : p.currency,
      id: p.id,
    }));

    files.forEach(f => events.push({
      type: 'file',
      date: f.created_date,
      title: f.file_name || 'File',
      subtitle: f.file_type || '',
      id: f.id,
    }));

    consents.forEach(c => events.push({
      type: 'consent',
      date: c.signed_at || c.created_date,
      title: c.template_name || c.procedure_name || 'Consent',
      subtitle: c.doctor_name || '',
      status: c.status,
      id: c.id,
    }));

    // Doctors do not see invoice events (financial data restriction)
    if (!isDoctor) {
      invoices.forEach(inv => events.push({
        type: 'invoice',
        date: inv.invoice_date || inv.created_date,
        title: inv.invoice_number || 'Invoice',
        subtitle: inv.type || '',
        id: inv.id,
      }));
    }

    labCases.forEach(lc => events.push({
      type: 'lab_case',
      date: lc.sent_date || lc.created_date,
      title: lc.case_type || 'Lab Case',
      subtitle: lc.lab_name || '',
      status: lc.status,
      id: lc.id,
    }));

    // Recall events from patient record
    if (patient) {
      if (patient.last_recall_date) {
        events.push({
          type: 'recall',
          date: patient.last_recall_date,
          title: 'Recall Contact',
          subtitle: patient.recall_status || '',
          status: patient.recall_status,
          id: `recall-contact-${patient.last_recall_date}`,
        });
      }
      if (patient.recall_date) {
        events.push({
          type: 'recall',
          date: patient.recall_date,
          title: 'Recall Scheduled',
          subtitle: patient.recall_status || '',
          status: patient.recall_status,
          id: `recall-scheduled-${patient.recall_date}`,
        });
      }
    }

    // Sort by timestamp descending (most recent first).
    // Uses Date objects to correctly compare date-only strings (YYYY-MM-DD)
    // with ISO datetime strings (YYYY-MM-DDThh:mm:ss) — localeCompare on
    // mixed formats produces incorrect ordering because 'T' (ASCII 84)
    // sorts after digits and '-' (ASCII 45).
    const getTimestamp = (dateStr, timeStr) => {
      if (!dateStr) return 0;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 0;
      let ts = d.getTime();
      // Only add time component for date-only strings (appointments have
      // separate date + time fields). Datetime strings already include time.
      if (timeStr && !String(dateStr).includes('T')) {
        const [h, m] = timeStr.split(':').map(Number);
        if (!isNaN(h)) ts += h * 3600000 + (m || 0) * 60000;
      }
      return ts;
    };
    events.sort((a, b) => getTimestamp(b.date, b.time) - getTimestamp(a.date, a.time));

    return Response.json({ events });
  } catch (error) {
    return Response.json({ error: 'Failed to load timeline: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}