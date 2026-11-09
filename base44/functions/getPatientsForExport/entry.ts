/**
 * Fetches complete patient data for PDF/Excel export.
 * Returns patients + their treatments + their payments + the clinic's doctors
 * (patients store their doctor as an ID — the doctors list is the authoritative
 * source for the names shown in the export), all scoped to the caller's clinic.
 * Supports either a specific list of patient_ids or all clinic patients.
 *
 * Body:
 *   patient_ids?: string[]  — specific patients to export
 *   all?: boolean            — export ALL clinic patients (ignores patient_ids)
 *   clinic_id?: string       — super_admin override only
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';

const SAFETY_LIMIT = 50000;

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { patient_ids, all } = body;
    const { error, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req, body.clinic_id);
    if (error) return error;

    // Export exposes full clinic patient, treatment, and payment data —
    // restrict to administrative roles (super_admin, admin, clinic_admin).
    if (authoritativeRole !== 'super_admin' && authoritativeRole !== 'admin' && authoritativeRole !== 'clinic_admin') {
      return Response.json({ error: 'Forbidden — administrative access required' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    // --- Fetch patients ---
    let patients = [];
    if (all) {
      let skip = 0;
      const batch = 500;
      while (skip < SAFETY_LIMIT) {
        const result = await svc.entities.Patient.filter({ clinic_id: clinicId }, '-created_date', batch, skip);
        patients = patients.concat(result);
        if (result.length < batch) break;
        skip += batch;
      }
    } else if (patient_ids && patient_ids.length > 0) {
      // Fetch specific patients — use $in for efficiency when possible
      if (patient_ids.length <= 200) {
        patients = await svc.entities.Patient.filter(
          { id: { $in: patient_ids }, clinic_id: clinicId },
          '-created_date',
          1000
        );
      } else {
        for (const id of patient_ids) {
          try {
            const p = await svc.entities.Patient.get(id);
            if (p && p.clinic_id === clinicId) patients.push(p);
          } catch (_) { /* skip invalid */ }
        }
      }
    }

    // Clinic's doctors — resolves each patient's assigned doctor by ID.
    let doctors = [];
    try {
      doctors = await svc.entities.Doctor.filter({ clinic_id: clinicId }, '-created_date', 1000);
    } catch (_) {
      doctors = []; // name falls back to the value cached on the patient
    }

    if (patients.length === 0) {
      return Response.json({ patients: [], treatments: [], payments: [], doctors });
    }

    const patientIdSet = new Set(patients.map(p => p.id));
    const patientIdArr = Array.from(patientIdSet);

    // --- Fetch treatments for these patients ---
    let treatments = [];
    if (patientIdArr.length <= 200) {
      treatments = await svc.entities.PatientTreatment.filter(
        { patient_id: { $in: patientIdArr }, clinic_id: clinicId },
        '-created_date',
        1000
      );
    } else {
      let skip = 0;
      while (skip < SAFETY_LIMIT) {
        const batch = await svc.entities.PatientTreatment.filter({ clinic_id: clinicId }, '-created_date', 500, skip);
        treatments = treatments.concat(batch.filter(pt => patientIdSet.has(pt.patient_id)));
        if (batch.length < 500) break;
        skip += 500;
      }
    }

    // --- Fetch payments for these patients ---
    let payments = [];
    if (patientIdArr.length <= 200) {
      payments = await svc.entities.Payment.filter(
        { patient_id: { $in: patientIdArr }, clinic_id: clinicId },
        '-created_date',
        1000
      );
    } else {
      let skip = 0;
      while (skip < SAFETY_LIMIT) {
        const batch = await svc.entities.Payment.filter({ clinic_id: clinicId }, '-created_date', 500, skip);
        payments = payments.concat(batch.filter(p => patientIdSet.has(p.patient_id)));
        if (batch.length < 500) break;
        skip += 500;
      }
    }

    return Response.json({ patients, treatments, payments, doctors });
  } catch (error) {
    return Response.json({ error: 'Export failed: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}