import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

/**
 * Generic server-side paginated query for clinic-scoped entities.
 * Supports real skip/limit pagination, search, and sort.
 * Always filters by the caller's clinic_id for data isolation.
 *
 * Body:
 *   entity: entity name (patients, appointments, payments, lab_cases,
 *           patient_treatments, staff, doctors, laboratories)
 *   page: 0-based page number
 *   page_size: items per page (max 100)
 *   sort: sort field (default: -created_date)
 *   search: optional search term
 *   filters: optional additional filter object (merged with clinic_id)
 */
const ENTITY_MAP = {
  patients: 'Patient',
  appointments: 'Appointment',
  payments: 'Payment',
  lab_cases: 'LabCase',
  patient_treatments: 'PatientTreatment',
  staff: 'Staff',
  doctors: 'Doctor',
  laboratories: 'Laboratory',
  purchases: 'Purchase',
  audit_logs: 'AuditLog',
};

const SEARCH_CONFIG = {
  Patient: { fields: ['full_name', 'phone'], regex: true },
  Appointment: { fields: ['patient_name', 'doctor_name', 'treatment_name'], regex: true },
  Payment: { fields: ['notes'], regex: true },
  LabCase: { fields: ['case_type', 'patient_name', 'lab_name', 'description'], regex: true },
  PatientTreatment: { fields: ['treatment_name', 'description'], regex: true },
  Staff: { fields: ['full_name', 'phone', 'email', 'employee_id'], regex: true },
  Doctor: { fields: ['name', 'specialty', 'phone'], regex: true },
  Laboratory: { fields: ['name', 'contact_person', 'phone', 'email'], regex: true },
  Purchase: { fields: ['name', 'supplier', 'category', 'notes'], regex: true },
  AuditLog: { fields: ['entity_name', 'summary', 'user_name', 'action'], regex: true },
};

export default async function(req) {
  try {
    const body = await req.json();
    const {
      entity,
      page = 0,
      page_size = 20,
      sort = '-created_date',
      search,
      filters = {},
    } = body;

    if (!entity || !ENTITY_MAP[entity]) {
      return Response.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req, body.clinic_id);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'getPaginatedRecords');
    if (rateLimitResponse) return rateLimitResponse;

    const role = authoritativeRole;
    if (!role) return Response.json({ error: 'Forbidden — no role assigned' }, { status: 403 });

    // Restrict financial/staff entities to clinic admins and platform admins
    const isFinancialAdmin = ['super_admin', 'admin', 'clinic_admin'].includes(role);
    const RESTRICTED_ENTITIES = ['payments', 'staff'];
    if (RESTRICTED_ENTITIES.includes(entity) && !isFinancialAdmin) {
      return Response.json({ error: 'Forbidden — admin access required for this data' }, { status: 403 });
    }

    // Purchases are admin-only (receptionists cannot access)
    if (entity === 'purchases' && !isFinancialAdmin) {
      return Response.json({ error: 'Forbidden — admin access required for this data' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const entityName = ENTITY_MAP[entity];
    const entityApi = svc.entities[entityName];

    const limit = Math.min(page_size, 100);
    const skip = page * limit;

    // Build query — clinic_id enforced LAST to prevent override via user-supplied filters
    const sanitizedFilters = { ...filters };
    delete sanitizedFilters.clinic_id; // never trust client-supplied clinic_id
    const query = { ...sanitizedFilters, clinic_id: clinicId };

    // Apply search if provided
    if (search && search.trim()) {
      const config = SEARCH_CONFIG[entityName];
      if (config && config.regex) {
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = config.fields.map(f => ({
          [f]: { $regex: escaped, $options: 'i' },
        }));
      }
    }

    // Fetch the page
    const results = await entityApi.filter(query, sort, limit, skip);

    // Audit delete entries carry the FULL deleted record in record_snapshot.
    // Snapshots inherit the visibility of the live entity, so only
    // administrative roles may receive them — otherwise a doctor could read
    // deleted Payment amounts/commissions or Patient phone numbers here.
    if (entityName === 'AuditLog' && !isFinancialAdmin) {
      results.forEach((r) => { delete r.record_snapshot; });
    }

    // Check if there are more results
    const nextBatch = await entityApi.filter(query, sort, 1, skip + limit);
    const hasMore = nextBatch.length > 0;

    // Doctors must never see patient phone numbers — enforced server-side.
    let safeResults = results;
    if (entityName === 'Patient' && role === 'doctor') {
      safeResults = results.map(r => { const c = { ...r }; c.phone = ''; c.whatsapp_number = ''; return c; });
    }

    return Response.json({
      records: safeResults,
      page,
      page_size: limit,
      has_more: hasMore,
    });
  } catch (error) {
    return Response.json({
      error: 'Failed to fetch records',
      detail: error?.message,
    }, { status: 500 });
  }
}