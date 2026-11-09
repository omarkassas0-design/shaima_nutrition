/**
 * Patient → doctor resolution for exports.
 *
 * A patient stores their doctor twice: as an assignment ID (the authoritative
 * link written by the patient form) and as a cached display name. Exports
 * resolve the IDs against the clinic's Doctor records every time they are
 * generated, so a doctor who was renamed appears under the current name and an
 * out-of-date cached name can never reach an export.
 */
import { t } from '@/lib/i18n';

/** Index the clinic's doctors by id — the authoritative source for names. */
export function indexDoctors(doctors) {
  const map = {};
  (doctors || []).forEach((d) => {
    if (d?.id) map[d.id] = d;
  });
  return map;
}

/**
 * The doctor actually attached to a patient, following the same relationship
 * the rest of the app uses: assigned_doctor_id for clinic-sourced patients and
 * referring_doctor_id for doctor-sourced ones (identical to the doctor
 * dashboard's own-patient query).
 *
 * The cached name is only a fallback for a record whose linked doctor can no
 * longer be found (deleted or never linked), and the localised "Unassigned"
 * label is the last resort — an empty cell or the clinic administrator is never
 * shown in its place.
 */
export function resolveAssignedDoctorName(patient, doctorsById, lang = 'en') {
  if (!patient) return t('unassigned', lang);
  const byId = doctorsById || {};
  const nameOf = (id) => (id && byId[id]?.name ? byId[id].name : '');
  const name = nameOf(patient.assigned_doctor_id)
    || nameOf(patient.referring_doctor_id)
    || (patient.assigned_doctor_name || '').trim()
    || (patient.referring_doctor_name || '').trim();
  return name || t('unassigned', lang);
}