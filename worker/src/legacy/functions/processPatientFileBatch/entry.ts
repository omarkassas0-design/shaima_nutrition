import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { processPatientFileBatch } from '../../shared/patientFileBatch.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

/**
 * Processes the next batch of patient file contents for a backup.
 *
 * This function is called repeatedly by the frontend after createClinicBackup
 * returns with needs_more_batches=true. Each call processes one batch of
 * patient files (default 20) and updates the Backup entity with progress.
 *
 * When all files are processed, the backup is finalized:
 *   - Patient file mappings are merged into the backup JSON
 *   - The backup JSON is re-uploaded to Base44 + Google Drive
 *   - The backup status is set to 'completed' (or 'failed' if any files
 *     permanently failed)
 *
 * SECURITY:
 *   - Only clinic_admin, admin, or super_admin can call this function.
 *   - The backup_id must belong to the caller's clinic.
 *   - clinic_id is always derived server-side — never trusted from the client.
 *   - The backup must be in 'pending' status with patient_file_batch_status
 *     'in_progress' to be eligible for batch processing.
 */
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { backup_id, batch_size } = body;

    if (!backup_id) {
      return Response.json({ error: 'backup_id is required' }, { status: 400 });
    }

    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'processPatientFileBatch');
    if (rateLimitResponse) return rateLimitResponse;

    const userRole = authoritativeRole || user.role || user.data?.role;
    if (userRole !== 'clinic_admin' && userRole !== 'super_admin' && userRole !== 'admin') {
      return Response.json({ error: 'Only clinic administrators can process patient file batches' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    // Fetch the backup record and validate ownership
    let backupRecord;
    try {
      backupRecord = await svc.entities.Backup.get(backup_id);
    } catch (e) {
      return Response.json({ error: 'Backup not found' }, { status: 404 });
    }

    if (!backupRecord) {
      return Response.json({ error: 'Backup not found' }, { status: 404 });
    }

    // Clinic isolation — never process another clinic's backup
    if (backupRecord.clinic_id !== clinicId) {
      return Response.json({ error: 'Backup not found' }, { status: 404 });
    }

    // Only process backups that are still pending (patient file batches in progress)
    if (backupRecord.status === 'completed') {
      return Response.json({
        backup_id,
        status: 'completed',
        patient_file_batch_status: backupRecord.patient_file_batch_status || 'completed',
        patient_file_total: backupRecord.patient_file_total || 0,
        patient_file_successful: backupRecord.patient_file_successful || 0,
        patient_file_failed: backupRecord.patient_file_failed || 0,
        patient_file_skipped: backupRecord.patient_file_skipped || 0,
        patient_file_remaining: 0,
        needs_more_batches: false,
        message: 'Backup already completed',
      });
    }

    if (backupRecord.status === 'failed') {
      return Response.json({
        backup_id,
        status: 'failed',
        patient_file_batch_status: backupRecord.patient_file_batch_status || 'failed',
        patient_file_total: backupRecord.patient_file_total || 0,
        patient_file_successful: backupRecord.patient_file_successful || 0,
        patient_file_failed: backupRecord.patient_file_failed || 0,
        patient_file_skipped: backupRecord.patient_file_skipped || 0,
        patient_file_remaining: 0,
        needs_more_batches: false,
        error: 'Backup has failed — cannot process more batches',
      });
    }

    // Process the next batch
    const batchSize = Math.min(Math.max(1, batch_size || 20), 50);
    const result = await processPatientFileBatch(svc, clinicId, backupRecord, batchSize);

    return Response.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return Response.json({
      error: 'Failed to process patient file batch',
      detail: error?.message || String(error),
    }, { status: 500 });
  }
}