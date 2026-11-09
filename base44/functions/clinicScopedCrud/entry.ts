/**
 * Authoritative, clinic-scoped CRUD for ALL clinic-scoped entities.
 *
 * SECURITY MODEL:
 *   - clinic_id is ALWAYS taken from the server-side UserSecurityProfile
 *     (via getAuthenticatedClinicUser). It is NEVER read from the client.
 *   - The authoritative role is used for permission checks — never the
 *     tamperable User record.
 *   - Super-admin can override clinic_id (managed-clinic mode); all other
 *     roles are locked to their own clinic.
 *   - On update/delete, the existing record is fetched and its clinic_id is
 *     verified against the authoritative clinic_id before any change.
 *
 * This function exists so the frontend NEVER needs direct SDK access to
 * clinic-scoped entities. Direct SDK access relies on RLS, which resolves
 * {{user.data.clinic_id}} — a client-tamperable field. Routing all access
 * through here eliminates the cross-clinic attack path.
 *
 * Body:
 *   action: 'filter' | 'get' | 'create' | 'update' | 'delete'
 *   entity: entity name (e.g. 'Patient', 'Appointment', ...)
 *   filter?: object (for 'filter')
 *   sort?: string (for 'filter')
 *   limit?: number (for 'filter', max 1000)
 *   id?: string (for 'get' | 'update' | 'delete')
 *   record?: object (for 'create')
 *   patch?: object (for 'update')
 *   clinic_id?: string (super_admin override only — ignored for all other roles)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { recordAudit, makeSummary } from '../../shared/auditLog.ts';
import {
  validatePlanDiscount,
  buildPlanDiscountChanges,
  normalizePlanDiscountType,
} from '../../shared/planDiscount.ts';

// System roles: super_admin, clinic_admin, doctor, receptionist (only 4).
// 'admin' is the platform default, treated as equivalent to clinic_admin.
const ALL_ROLES = ['super_admin', 'admin', 'clinic_admin', 'receptionist', 'doctor'];
const ADMIN_ROLES = ['super_admin', 'admin', 'clinic_admin'];
const RECEPTIONIST_WRITE = ['super_admin', 'admin', 'clinic_admin', 'receptionist'];
// Doctor can write PatientTreatment, ConsentForm, and LabCase.
const DOCTOR_WRITE = ['super_admin', 'admin', 'clinic_admin', 'receptionist', 'doctor'];

// Permission map: who can read / write (create+update) / delete each entity.
const ENTITY_PERMS: Record<string, { read: string[]; write: string[]; delete: string[] }> = {
  // Patient delete: clinic_admin + receptionist (doctor excluded). Clinic
  // isolation is enforced by the authoritative clinic_id, and every delete
  // is audit-logged + snapshot-stored for Recycle Bin recovery.
  Patient:           { read: ALL_ROLES,          write: RECEPTIONIST_WRITE,  delete: RECEPTIONIST_WRITE },
  Doctor:            { read: ALL_ROLES,          write: ADMIN_ROLES,         delete: ADMIN_ROLES },
  Staff:             { read: ADMIN_ROLES,       write: ADMIN_ROLES,         delete: ADMIN_ROLES },
  Appointment:       { read: ALL_ROLES,          write: RECEPTIONIST_WRITE,  delete: RECEPTIONIST_WRITE },
  Treatment:         { read: ALL_ROLES,          write: ADMIN_ROLES,         delete: ADMIN_ROLES },
  PatientTreatment:  { read: ALL_ROLES,          write: DOCTOR_WRITE,        delete: DOCTOR_WRITE },
  Laboratory:        { read: ALL_ROLES,          write: RECEPTIONIST_WRITE,  delete: ADMIN_ROLES },
  LabCase:           { read: ALL_ROLES,          write: DOCTOR_WRITE,        delete: RECEPTIONIST_WRITE },
  Shift:             { read: ALL_ROLES,          write: ADMIN_ROLES,         delete: ADMIN_ROLES },
  DoctorPayout:      { read: ADMIN_ROLES,       write: ADMIN_ROLES,         delete: ADMIN_ROLES },
  // Doctors may upload (create/update) patient files & X-rays; delete stays
  // receptionist/admin-only. Clinic isolation is enforced by the authoritative
  // clinic_id, and every upload is audit-logged under the doctor's name.
  PatientFile:       { read: ALL_ROLES,          write: DOCTOR_WRITE,        delete: RECEPTIONIST_WRITE },
  Notification:      { read: ALL_ROLES,          write: ADMIN_ROLES,         delete: ADMIN_ROLES },
  MessageLog:        { read: ALL_ROLES,          write: ADMIN_ROLES,         delete: ADMIN_ROLES },
  ReminderLog:       { read: ALL_ROLES,          write: ADMIN_ROLES,         delete: ADMIN_ROLES },
  Expense:           { read: ADMIN_ROLES,       write: ADMIN_ROLES,         delete: ADMIN_ROLES },
  Purchase:          { read: ADMIN_ROLES,       write: ADMIN_ROLES,         delete: ADMIN_ROLES },
  Payment:           { read: RECEPTIONIST_WRITE, write: RECEPTIONIST_WRITE,  delete: RECEPTIONIST_WRITE },
  Invoice:           { read: RECEPTIONIST_WRITE, write: RECEPTIONIST_WRITE,  delete: ADMIN_ROLES },
  ConsentForm:       { read: ALL_ROLES,          write: DOCTOR_WRITE,        delete: ADMIN_ROLES },
  // AuditLog is a shared clinic resource — every authorized user in the same
  // clinic reads the SAME clinic-scoped audit log. clinic_id isolation is
  // enforced in the filter path (client-supplied clinic_id is always ignored).
  // The Recycle Bin's permanent-delete remains admin-only (see permanentDelete).
  AuditLog:          { read: ALL_ROLES,         write: [],                  delete: [] },
  // ScheduledReport: admin-only configuration for automated email reports.
  // Clinic isolation is enforced by the backend (authoritative clinic_id).
  ScheduledReport:    { read: ADMIN_ROLES,        write: ADMIN_ROLES,         delete: ADMIN_ROLES },
};

/**
 * Doctors must never see patient phone numbers or WhatsApp numbers.
 * This is enforced server-side — the UI hiding is a secondary measure only.
 */
function stripPatientPhone(records: any | any[]): any {
  const strip = (r: any) => { if (r) { r.phone = ''; r.whatsapp_number = ''; } return r; };
  return Array.isArray(records) ? records.map(strip) : strip(records);
}

/**
 * A delete audit entry stores the FULL deleted record in record_snapshot.
 * Snapshot contents must follow the same visibility rules as the live entity:
 * doctors never see Payment amounts/commissions or Patient phone numbers,
 * receptionists never see Staff salaries or admin-only financial records.
 * Only administrative roles receive the snapshot — every other role still
 * reads the audit trail itself (action, entity, summary, user, date).
 */
function stripAuditSnapshot(role: string, records: any | any[]): any {
  if (ADMIN_ROLES.includes(role)) return records;
  const strip = (r: any) => { if (r) delete r.record_snapshot; return r; };
  return Array.isArray(records) ? records.map(strip) : strip(records);
}

const BUILT_IN = ['id', 'created_date', 'updated_date', 'created_by_id'];

/**
 * Fields OWNED BY THE SERVER for an entity — computed by dedicated backend
 * logic (e.g. savePayment) and NEVER accepted from a client through this
 * generic endpoint. Stripping them closes the path where a lower-privileged
 * role could forge financial figures the app promises are server-computed.
 */
const SERVER_OWNED_FIELDS: Record<string, string[]> = {
  Payment: [
    'doctor_commission_percentage',
    'doctor_commission_amount',
    'is_prosthesis',
    'prosthesis_cost',
    'net_amount',
    'doctor_name',
  ],
  Invoice: ['totals'],
};

function stripServerOwned(entity: string, obj: any): any {
  const fields = SERVER_OWNED_FIELDS[entity];
  if (!fields || !obj || typeof obj !== 'object') return obj;
  for (const f of fields) delete obj[f];
  return obj;
}

/**
 * Recompute an Invoice's per-currency totals server-side from its own line
 * items / payment snapshot, so a client cannot supply a summary that diverges
 * from the document's contents.
 */
function computeInvoiceTotals(record: any): any {
  const round2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
  const items = Array.isArray(record.items) ? record.items : [];
  const snapshot = Array.isArray(record.payments_snapshot) ? record.payments_snapshot : [];
  const result: Record<string, { due: number; paid: number; remaining: number }> = {};
  const ensure = (cur: string) => {
    if (!result[cur]) result[cur] = { due: 0, paid: 0, remaining: 0 };
  };

  if (record.type === 'receipt') {
    snapshot.forEach((p: any) => {
      const cur = p.currency || 'USD';
      ensure(cur);
      result[cur].paid = round2(result[cur].paid + (Number(p.amount) || 0));
    });
  } else {
    items.forEach((item: any) => {
      const cur = item.currency || 'USD';
      ensure(cur);
      result[cur].due = round2(result[cur].due + (Number(item.total_price) || 0));
      result[cur].paid = round2(result[cur].paid + (Number(item.paid_amount) || 0));
    });
  }

  Object.keys(result).forEach((cur) => {
    result[cur].remaining = round2(result[cur].due - result[cur].paid);
  });
  return result;
}

function canPerform(role: string, entity: string, op: 'read' | 'write' | 'delete'): boolean {
  const perms = ENTITY_PERMS[entity];
  if (!perms) return false;
  if (role === 'super_admin' || role === 'admin') return true; // platform admins bypass
  return perms[op].includes(role);
}

// When a Patient is restored from the Recycle Bin it gets a NEW id. Re-link
// every child record that referenced the old patient_id so no clinical or
// financial history is orphaned. Best-effort — never throws to the caller.
async function relinkPatientChildren(svc, clinicId, oldPatientId, newPatientId, patientName) {
  const entities = ['Appointment', 'Payment', 'PatientTreatment', 'PatientFile', 'ConsentForm', 'Invoice'];
  for (const ent of entities) {
    try {
      const children = await svc.entities[ent].filter(
        { clinic_id: clinicId, patient_id: oldPatientId }, null, 1000
      );
      if (children.length === 0) continue;
      await svc.entities[ent].bulkUpdate(
        children.map(c => {
          const patch = { id: c.id, patient_id: newPatientId };
          if ('patient_name' in c && patientName) patch.patient_name = patientName;
          return patch;
        })
      );
    } catch (e) {
      console.error(`Re-link ${ent} failed`, e?.message);
    }
  }
}

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, entity, filter, sort, limit, id, record, patch, clinic_id } = body;

    if (!action || !entity) {
      return Response.json({ error: 'action and entity are required' }, { status: 400 });
    }
    if (!ENTITY_PERMS[entity]) {
      return Response.json({ error: 'Unknown or non-clinic entity' }, { status: 400 });
    }

    // Authoritative clinic + role. clinic_id from client is ONLY honored for super_admin.
    const { error, user, base44, clinicId, authoritativeRole, clinic } = await getAuthenticatedClinicUser(req, clinic_id);
    if (error) return error;

    const role = authoritativeRole;
    if (!role) return Response.json({ error: 'Forbidden — no role assigned' }, { status: 403 });

    // Rate limit (uses the shared pagination limit bucket)
    const rl = enforceRateLimit(user.id, 'getPaginatedRecords');
    if (rl) return rl;

    const svc = base44.asServiceRole;
    const entityApi = svc.entities[entity];

    // --- READ ---
    if (action === 'filter') {
      if (!canPerform(role, entity, 'read')) {
        return Response.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 });
      }
      // Never trust a client-supplied clinic_id — always force the authoritative one.
      const safeFilter = { ...(filter || {}) };
      delete safeFilter.clinic_id;
      safeFilter.clinic_id = clinicId;
      // Notifications are personal — never expose a colleague's notifications.
      if (entity === 'Notification') safeFilter.user_id = user.id;
      const lim = Math.min(Number(limit) || 500, 1000);
      const records = await entityApi.filter(safeFilter, sort || '-created_date', lim);
      // Doctors must never see patient phone numbers — enforced server-side.
      if (entity === 'Patient' && role === 'doctor') stripPatientPhone(records);
      if (entity === 'AuditLog') stripAuditSnapshot(role, records);
      return Response.json({ records });
    }

    if (action === 'get') {
      if (!canPerform(role, entity, 'read')) {
        return Response.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 });
      }
      if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
      let rec;
      try { rec = await entityApi.get(id); } catch (_) { return Response.json({ error: 'Not found' }, { status: 404 }); }
      if (!rec || rec.clinic_id !== clinicId) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      // Notifications are personal — only their owner may read one.
      if (entity === 'Notification' && rec.user_id !== user.id) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      // Doctors must never see patient phone numbers — enforced server-side.
      if (entity === 'Patient' && role === 'doctor') stripPatientPhone(rec);
      if (entity === 'AuditLog') stripAuditSnapshot(role, rec);
      return Response.json({ record: rec });
    }

    // --- CREATE ---
    if (action === 'create') {
      if (!canPerform(role, entity, 'write')) {
        return Response.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 });
      }
      const clean = stripServerOwned(entity, { ...(record || {}) });
      BUILT_IN.forEach(f => delete clean[f]);
      delete clean.clinic_id; // never trust client
      clean.clinic_id = clinicId;
      if (entity === 'Invoice') clean.totals = computeInvoiceTotals(clean);
      if (entity === 'Appointment' && clean.start_time && clean.end_time && clean.end_time <= clean.start_time) {
        return Response.json({ error: 'End time must be after start time' }, { status: 400 });
      }
      const created = await entityApi.create(clean);
      await recordAudit(svc, clinicId, user, 'create', entity, created.id, makeSummary('create', entity, created));
      return Response.json({ record: created });
    }

    // --- BULK CREATE ---
    if (action === 'bulkCreate') {
      if (!canPerform(role, entity, 'write')) {
        return Response.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 });
      }
      const records = Array.isArray(record) ? record : [];
      const clean = records.map((r) => {
        const c = stripServerOwned(entity, { ...(r || {}) });
        BUILT_IN.forEach(f => delete c[f]);
        delete c.clinic_id; // never trust client
        c.clinic_id = clinicId;
        if (entity === 'Invoice') c.totals = computeInvoiceTotals(c);
        return c;
      });
      const created = await entityApi.bulkCreate(clean);
      return Response.json({ records: created });
    }

    // --- UPDATE ---
    if (action === 'update') {
      // Doctor medical-info exception: doctors may update ONLY medical_info
      // and dental_history on Patient records — no other Patient fields.
      // This gives doctors edit access to clinical notes without granting
      // general Patient write permission (name, phone, etc. remain restricted).
      if (entity === 'Patient' && role === 'doctor') {
        const allowedMedFields = ['medical_info', 'dental_history'];
        const patchFields = Object.keys(patch || {}).filter(
          (f) => !BUILT_IN.includes(f) && f !== 'clinic_id'
        );
        const isMedicalOnly =
          patchFields.length > 0 &&
          patchFields.every((f) => allowedMedFields.includes(f));
        if (!isMedicalOnly) {
          return Response.json(
            { error: 'Forbidden — doctors may only edit medical information' },
            { status: 403 }
          );
        }
        // proceed with the update — skip the general canPerform check
      } else if (!canPerform(role, entity, 'write')) {
        return Response.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 });
      }
      if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
      let existing;
      try { existing = await entityApi.get(id); } catch (_) { return Response.json({ error: 'Not found' }, { status: 404 }); }
      if (!existing || existing.clinic_id !== clinicId) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      const clean = stripServerOwned(entity, { ...(patch || {}) });
      BUILT_IN.forEach(f => delete clean[f]);
      delete clean.clinic_id; // never allow moving a record to another clinic
      if (entity === 'Invoice' &&
          (clean.items !== undefined || clean.payments_snapshot !== undefined || clean.type !== undefined)) {
        clean.totals = computeInvoiceTotals({ ...existing, ...clean });
      }
      if (entity === 'Appointment' && clean.start_time && clean.end_time && clean.end_time <= clean.start_time) {
        return Response.json({ error: 'End time must be after start time' }, { status: 400 });
      }
      const updated = await entityApi.update(id, clean);
      await recordAudit(svc, clinicId, user, 'update', entity, id, makeSummary('update', entity, existing));
      return Response.json({ record: updated });
    }

    // --- APPLY PLAN DISCOUNT ---
    // One atomic, server-side operation: validate, distribute the discount over
    // the patient's treatments and persist the plan metadata. Replaces the old
    // browser loop that fired one request per treatment (a burst that could
    // fail halfway and leave a plan only partially discounted).
    if (action === 'applyPlanDiscount') {
      const patientId = body.patient_id;
      const rawType = body.discount_type;
      const rawValue = body.discount_value;
      if (!patientId) return Response.json({ error: 'patient_id is required' }, { status: 400 });

      // Same permissions the two writes required before: plan metadata lives on
      // Patient, the amounts live on PatientTreatment.
      if (!canPerform(role, 'Patient', 'write') || !canPerform(role, 'PatientTreatment', 'write')) {
        return Response.json(
          { error: 'Forbidden — insufficient permissions to change the plan discount', code: 'forbidden' },
          { status: 403 }
        );
      }

      const type = normalizePlanDiscountType(rawType);
      const invalid = validatePlanDiscount(rawType, rawValue);
      if (invalid) {
        return Response.json({ error: invalid.message, code: invalid.code }, { status: 400 });
      }

      let patient = null;
      try { patient = await svc.entities.Patient.get(patientId); } catch (_) { patient = null; }
      if (!patient || patient.clinic_id !== clinicId) {
        return Response.json({ error: 'Patient not found', code: 'not_found' }, { status: 404 });
      }

      const treatments = await svc.entities.PatientTreatment.filter(
        { clinic_id: clinicId, patient_id: patientId }, null, 1000
      );
      const clinicCurrency = clinic?.currency || 'USD';
      const { changes, error: buildError } = buildPlanDiscountChanges(
        treatments, rawType, rawValue, clinicCurrency
      );
      if (buildError) {
        return Response.json({ error: buildError.message, code: buildError.code }, { status: 400 });
      }

      if (changes.length > 0) {
        // Absolute values, not increments — re-applying is idempotent.
        await svc.entities.PatientTreatment.bulkUpdate(changes);
      }

      const targetValue = type === 'none' ? 0 : Math.round((Number(rawValue) || 0) * 100) / 100;
      const patientChanged =
        (patient.plan_discount_type || 'none') !== type ||
        Math.abs((Number(patient.plan_discount_value) || 0) - targetValue) > 0.005;

      let updatedPatient = patient;
      if (patientChanged) {
        updatedPatient = await svc.entities.Patient.update(patientId, {
          plan_discount_type: type,
          plan_discount_value: targetValue,
        });
      }

      await recordAudit(
        svc, clinicId, user, 'update', 'Patient', patientId,
        `apply plan discount: ${type} ${targetValue} (${changes.length} treatments)`
      );

      return Response.json({
        patient: updatedPatient,
        updated_treatments: changes.length,
        discount_type: type,
        discount_value: targetValue,
      });
    }

    // --- DELETE ---
    if (action === 'delete') {
      if (!canPerform(role, entity, 'delete')) {
        return Response.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 });
      }
      if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
      let existing;
      try { existing = await entityApi.get(id); } catch (_) { return Response.json({ error: 'Not found' }, { status: 404 }); }
      if (!existing || existing.clinic_id !== clinicId) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      const auditEntry = await recordAudit(svc, clinicId, user, 'delete', entity, id, makeSummary('delete', entity, existing), existing);
      await entityApi.delete(id);
      return Response.json({ success: true, audit_id: auditEntry?.id || null });
    }

    // --- RESTORE (Recycle Bin) ---
    if (action === 'restore') {
      if (!canPerform(role, entity, 'write')) {
        return Response.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 });
      }
      const { audit_id } = body;
      if (!audit_id) return Response.json({ error: 'audit_id is required' }, { status: 400 });
      let audit;
      try { audit = await svc.entities.AuditLog.get(audit_id); } catch (_) {
        return Response.json({ error: 'Audit entry not found' }, { status: 404 });
      }
      if (!audit || audit.clinic_id !== clinicId) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      if (audit.action !== 'delete' || audit.restored) {
        return Response.json({ error: 'Not restorable' }, { status: 400 });
      }
      const entityName = audit.entity_name;
      if (!ENTITY_PERMS[entityName]) {
        return Response.json({ error: 'Unknown entity' }, { status: 400 });
      }
      const snapshot = audit.record_snapshot;
      if (!snapshot) return Response.json({ error: 'No snapshot available' }, { status: 400 });

      const clean = { ...snapshot };
      BUILT_IN.forEach(f => delete clean[f]);
      delete clean.clinic_id;
      clean.clinic_id = clinicId;
      const restored = await svc.entities[entityName].create(clean);

      // Re-link child records so a restored Patient keeps its full history.
      if (entityName === 'Patient') {
        await relinkPatientChildren(svc, clinicId, audit.record_id, restored.id, snapshot.full_name);
      }

      await svc.entities.AuditLog.update(audit_id, { restored: true });
      await recordAudit(svc, clinicId, user, 'restore', entityName, restored.id, makeSummary('restore', entityName, restored));
      return Response.json({ record: restored });
    }

    // --- PERMANENT DELETE (Recycle Bin) ---
    // Removes the AuditLog snapshot so the deleted record is permanently
    // unrecoverable. Admin-only — doctors and receptionists cannot bypass
    // deletion restrictions through this path. Clinic isolation enforced.
    if (action === 'permanentDelete') {
      if (!ADMIN_ROLES.includes(role)) {
        return Response.json({ error: 'Forbidden — admin access required' }, { status: 403 });
      }
      const { audit_id } = body;
      if (!audit_id) return Response.json({ error: 'audit_id is required' }, { status: 400 });
      let audit;
      try { audit = await svc.entities.AuditLog.get(audit_id); } catch (_) {
        return Response.json({ error: 'Audit entry not found' }, { status: 404 });
      }
      if (!audit || audit.clinic_id !== clinicId) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      if (audit.action !== 'delete' || audit.restored) {
        return Response.json({ error: 'Not eligible for permanent deletion' }, { status: 400 });
      }
      await svc.entities.AuditLog.delete(audit_id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: 'Operation failed: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}