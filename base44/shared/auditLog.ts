/**
 * Shared audit-logging helpers for backend functions.
 *
 * Every entity mutation (create / update / delete / restore) MUST go through
 * recordAudit so the clinic-scoped AuditLog captures who did what, when, and
 * (for deletes) a snapshot for the Recycle Bin.
 *
 * The audit entry always uses:
 *   - clinic_id: the authenticated user's authoritative clinic_id (from CRA)
 *   - user_id / user_name: the authenticated user's id and display name
 *
 * All users in the same clinic see the SAME shared audit entries (clinic-scoped,
 * never per-user). Cross-clinic isolation is enforced by the caller passing the
 * correct clinicId and by clinicScopedCrud's filter path.
 */

/**
 * Best-effort audit logging. NEVER throws to the caller — a failed audit write
 * must not block the operation it is recording. Returns the created entry (or null).
 */
export async function recordAudit(svc, clinicId, user, action, entity, recordId, summary, snapshot) {
  try {
    const entry = await svc.entities.AuditLog.create({
      clinic_id: clinicId,
      action,
      entity_name: entity,
      record_id: recordId || null,
      record_snapshot: snapshot || null,
      summary: summary || `${action} ${entity}`,
      user_id: user.id,
      user_name: user.full_name || user.email || user.id,
      restored: false,
    });
    return entry;
  } catch (e) {
    console.error('Audit log write failed', e?.message);
    return null;
  }
}

/**
 * Builds a human-readable summary from the most identifying field on the record.
 */
export function makeSummary(action, entity, record) {
  const label =
    (record?.full_name) ||
    (record?.name) ||
    (record?.patient_name) ||
    (record?.invoice_number) ||
    (record?.file_name) ||
    (record?.case_type) ||
    '';
  return `${action} ${entity}${label ? ': ' + label : ''}`;
}