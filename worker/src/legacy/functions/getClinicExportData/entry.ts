/**
 * Fetches ALL clinic-scoped data for export (Excel/PDF).
 *
 * SECURITY MODEL:
 *   - clinic_id is ALWAYS taken from the server-side UserSecurityProfile
 *     (via getAuthenticatedClinicUser). It is NEVER read from the client.
 *   - Only clinic administrators (super_admin, admin, clinic_admin) may export.
 *   - All entity reads are filtered by the authoritative clinic_id.
 *
 * Returns the complete clinic dataset in a single response so the frontend
 * can generate Excel/PDF without additional API calls (minimum credits).
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

const ADMIN_ROLES = ['super_admin', 'admin', 'clinic_admin'];
const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // Safety valve: 50K records per entity

// Entities with a date field that can be filtered by the selected period.
// Entities without a dateField (reference/config data) are always exported in full.
const EXPORT_ENTITIES: { name: string; key: string; dateField?: string }[] = [
  { name: 'Patient', key: 'patients', dateField: 'created_date' },
  { name: 'Doctor', key: 'doctors' },
  { name: 'Staff', key: 'staff' },
  { name: 'Appointment', key: 'appointments', dateField: 'date' },
  { name: 'Treatment', key: 'treatments' },
  { name: 'PatientTreatment', key: 'patientTreatments', dateField: 'treatment_date' },
  { name: 'Laboratory', key: 'laboratories' },
  { name: 'LabCase', key: 'labCases', dateField: 'sent_date' },
  { name: 'Shift', key: 'shifts' },
  { name: 'DoctorPayout', key: 'doctorPayouts', dateField: 'payment_date' },
  { name: 'PatientFile', key: 'patientFiles', dateField: 'created_date' },
  { name: 'Payment', key: 'payments', dateField: 'payment_date' },
  { name: 'Expense', key: 'expenses', dateField: 'expense_date' },
  { name: 'Purchase', key: 'purchases', dateField: 'purchase_date' },
  { name: 'Invoice', key: 'invoices', dateField: 'invoice_date' },
  { name: 'ConsentForm', key: 'consentForms', dateField: 'signed_at' },
  { name: 'MessageLog', key: 'messageLogs', dateField: 'sent_at' },
  { name: 'ReminderLog', key: 'reminderLogs', dateField: 'scheduled_time' },
  { name: 'Notification', key: 'notifications', dateField: 'created_date' },
  { name: 'ScheduledReport', key: 'scheduledReports' },
];

async function fetchAll(svc: any, entityName: string, clinicId: string, dateField?: string, dateFrom?: string, dateTo?: string) {
  const all: any[] = [];
  let skip = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    let batch: any[];
    try {
      const filter: any = { clinic_id: clinicId };
      // DB-level lower bound for date-bearing entities (same pattern as getReportsStats)
      if (dateField && dateFrom) filter[dateField] = { $gte: dateFrom };
      batch = await svc.entities[entityName].filter(
        filter,
        '-created_date',
        PAGE_SIZE,
        skip,
      );
    } catch (e) {
      return all; // partial — return what we have
    }
    if (!Array.isArray(batch)) return all;
    all.push(...batch);
    if (batch.length < PAGE_SIZE) return all;
    skip += PAGE_SIZE;
  }
  return all;
}

export default async function(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const { clinic_id, date_from, date_to } = body;

    const { error, user, base44, clinicId, authoritativeRole } =
      await getAuthenticatedClinicUser(req, clinic_id);
    if (error) return error;

    const role = authoritativeRole;
    if (!ADMIN_ROLES.includes(role)) {
      return Response.json(
        { error: 'Forbidden — admin access required' },
        { status: 403 },
      );
    }

    const rl = enforceRateLimit(user.id, 'getClinicExportData');
    if (rl) return rl;

    const svc = base44.asServiceRole;

    // Date range (optional). When provided, date-bearing entities are filtered
    // to the inclusive [date_from, date_to] period. Reference/config entities
    // (doctors, staff, treatments, laboratories, shifts, scheduledReports) are
    // always exported in full regardless of the selected period.
    const now = new Date();
    const dateTo: string | undefined = date_to || undefined;
    const dateFrom: string | undefined = date_from || undefined;

    // Client-side upper-bound filter (DB only supports $gte)
    const inRange = (rec: any, field: string): boolean => {
      if (!dateTo) return true;
      const d = rec[field];
      if (!d) return true;
      return d <= dateTo;
    };

    // Clinic record
    let clinicRecord: any = null;
    try {
      clinicRecord = await svc.entities.Clinic.get(clinicId);
    } catch (_) {
      /* ignore */
    }

    const result: Record<string, any> = { clinic: clinicRecord };

    for (const { name, key, dateField } of EXPORT_ENTITIES) {
      let records = await fetchAll(svc, name, clinicId, dateField, dateFrom, dateTo);
      // Apply upper-bound date filter for date-bearing entities
      if (dateField && dateTo) {
        records = records.filter((r: any) => inRange(r, dateField));
      }
      result[key] = records;
    }

    result._meta = {
      exported_at: new Date().toISOString(),
      exported_by: user.full_name || user.email || '',
      clinic_id: clinicId,
      date_from: dateFrom || null,
      date_to: dateTo || null,
    };

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: 'Export failed: ' + (error?.message || 'Unknown') },
      { status: 500 },
    );
  }
}