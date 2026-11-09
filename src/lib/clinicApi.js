/**
 * Frontend wrapper for the clinicScopedCrud backend function.
 *
 * ALL clinic-scoped entity access from the frontend MUST go through this
 * module — never appClient.entities.X directly. The backend function derives
 * the clinic_id from the server-side UserSecurityProfile (authoritative),
 * so a user who tampers their client-side data.clinic_id cannot redirect
 * reads or writes to another clinic.
 *
 * overrideClinicId is ONLY honored for super_admin (managed-clinic mode);
 * for every other role the backend ignores it and uses their own clinic.
 *
 * Usage (mirrors the entity SDK interface):
 *   clinicApi.filter('Patient', { status: 'active' }, '-created_date', 200) → array
 *   clinicApi.get('Patient', id) → record
 *   clinicApi.create('Patient', { full_name, phone, ... }) → record
 *   clinicApi.update('Patient', id, { notes }) → record
 *   clinicApi.delete('Patient', id) → { success }
 */
import { appClient } from '@/api/appClient';

/**
 * The backend answers business errors with a JSON body ({ error, code }), but
 * the SDK's HTTP layer throws on every non-2xx response, which used to hide the
 * real reason behind a generic "Request failed with status code 400". The
 * server's own message and translation code are restored here so the UI can
 * show something useful and localized.
 */
function serverFailure(payload) {
  const err = new Error(payload.error);
  if (payload.code) err.code = payload.code;
  return err;
}

async function invoke(payload) {
  try {
    const res = await appClient.functions.invoke('clinicScopedCrud', payload);
    const data = res.data || res;
    if (data?.error) throw serverFailure(data);
    return data;
  } catch (e) {
    const body = e?.response?.data;
    if (body && typeof body === 'object' && body.error) throw serverFailure(body);
    throw e;
  }
}

export const clinicApi = {
  filter: async (entity, filter = {}, sort, limit, overrideClinicId) => {
    const data = await invoke({ action: 'filter', entity, filter, sort, limit, clinic_id: overrideClinicId });
    return data.records || [];
  },
  get: async (entity, id, overrideClinicId) => {
    const data = await invoke({ action: 'get', entity, id, clinic_id: overrideClinicId });
    return data.record;
  },
  create: async (entity, record, overrideClinicId) => {
    const data = await invoke({ action: 'create', entity, record, clinic_id: overrideClinicId });
    return data.record;
  },
  update: async (entity, id, patch, overrideClinicId) => {
    const data = await invoke({ action: 'update', entity, id, patch, clinic_id: overrideClinicId });
    return data.record;
  },
  delete: async (entity, id, overrideClinicId) => {
    return invoke({ action: 'delete', entity, id, clinic_id: overrideClinicId });
  },
  restore: async (entity, auditId, overrideClinicId) => {
    const data = await invoke({ action: 'restore', entity, audit_id: auditId, clinic_id: overrideClinicId });
    return data.record;
  },
  permanentDelete: async (auditId, overrideClinicId) => {
    return invoke({ action: 'permanentDelete', entity: 'AuditLog', audit_id: auditId, clinic_id: overrideClinicId });
  },
  bulkCreate: async (entity, records, overrideClinicId) => {
    const data = await invoke({ action: 'bulkCreate', entity, record: records, clinic_id: overrideClinicId });
    return data.records || [];
  },
  /**
   * Apply (or clear) a plan-level discount in ONE server operation: the backend
   * validates it, distributes it over the patient's treatments and persists the
   * plan metadata. No per-treatment requests.
   */
  applyPlanDiscount: async ({ patientId, type, value }, overrideClinicId) => {
    return invoke({
      action: 'applyPlanDiscount',
      entity: 'Patient',
      patient_id: patientId,
      discount_type: type,
      discount_value: value,
      clinic_id: overrideClinicId,
    });
  },
};