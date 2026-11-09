import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

/**
 * Returns the backup history for the calling user's clinic.
 * Only shows backups belonging to the caller's clinic — never another clinic's.
 * Sorted by most recent first, paginated.
 */
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { page = 0, page_size = 20 } = body;

    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'getBackupHistory');
    if (rateLimitResponse) return rateLimitResponse;

    const svc = base44.asServiceRole;

    // Only clinic_admin, admin, or super_admin can view backups
    const userRole = authoritativeRole || user.role || user.data?.role;
    if (userRole !== 'clinic_admin' && userRole !== 'super_admin' && userRole !== 'admin') {
      return Response.json({ error: 'Only administrators can view backups' }, { status: 403 });
    }

    const limit = Math.min(page_size, 100);
    const skip = page * limit;

    const backups = await svc.entities.Backup.filter(
      { clinic_id: clinicId },
      '-created_date',
      limit,
      skip
    );

    const nextBatch = await svc.entities.Backup.filter(
      { clinic_id: clinicId },
      '-created_date',
      1,
      skip + limit
    );

    return Response.json({
      backups: backups.map(b => ({
        id: b.id,
        backup_type: b.backup_type,
        file_name: b.file_name,
        file_size: b.file_size,
        status: b.status,
        notes: b.notes,
        record_count: b.record_count || null,
        external_backup_status: b.external_backup_status || null,
        external_file_id: b.external_file_id || null,
        external_patient_file_count: b.external_patient_file_count || 0,
        is_safety_backup: b.is_safety_backup || false,
        patient_file_total: b.patient_file_total || 0,
        patient_file_successful: b.patient_file_successful || 0,
        patient_file_failed: b.patient_file_failed || 0,
        patient_file_skipped: b.patient_file_skipped || 0,
        patient_file_batch_status: b.patient_file_batch_status || 'pending',
        created_date: b.created_date,
      })),
      page,
      page_size: limit,
      has_more: nextBatch.length > 0,
    });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch backups', detail: error?.message }, { status: 500 });
  }
}