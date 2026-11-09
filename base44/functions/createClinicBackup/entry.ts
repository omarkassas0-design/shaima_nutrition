import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { createBackupForClinic } from '../../shared/backupLogic.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

/**
 * Creates a full backup of the calling user's clinic data.
 * Delegates to the shared createBackupForClinic helper so manual and
 * automatic backups use identical logic.
 *
 * Only clinic_admin, admin, or super_admin can trigger backups.
 */
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req);
    if (error) return error;

    const isAutomatic = body.automatic === true;
    // Rate limit: automatic backups have a separate, stricter limit
    const rateLimitResponse = enforceRateLimit(user.id, isAutomatic ? 'runAutomaticBackups' : 'createClinicBackup');
    if (rateLimitResponse) return rateLimitResponse;

    const userRole = authoritativeRole || user.role || user.data?.role;
    if (userRole !== 'clinic_admin' && userRole !== 'super_admin' && userRole !== 'admin') {
      return Response.json({ error: 'Only clinic administrators can create backups' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    const result = await createBackupForClinic(
      svc,
      clinicId,
      isAutomatic ? 'automatic' : 'manual',
      isAutomatic
        ? 'Automatic daily backup'
        : `Manual backup by ${user.full_name || user.email}`
    );

    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({
      error: 'Failed to create backup',
      detail: error?.message || String(error),
    }, { status: 500 });
  }
}