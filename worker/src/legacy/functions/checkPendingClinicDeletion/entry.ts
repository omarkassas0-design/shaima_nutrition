/**
 * Check for a pending clinic deletion — SUPER ADMIN ONLY.
 *
 * Returns the latest PendingClinicDeletion record for a clinic (any status)
 * and the remaining seconds until deletion (if status is 'pending').
 *
 * Used by the frontend DeleteClinicDialog to:
 *   - Detect an existing pending deletion on open (e.g. after page refresh)
 *   - Poll for status changes during the 60-second countdown
 *   - Detect when the deletion has been executed or cancelled
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'checkPendingClinicDeletion');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { clinic_id } = body;

    if (!clinic_id) {
      return Response.json({ error: 'clinic_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Find the latest pending deletion for this clinic (any status)
    const records = await svc.entities.PendingClinicDeletion.filter(
      { clinic_id },
      '-requested_at',
      1
    );

    const latest = records && records.length > 0 ? records[0] : null;

    let remainingSeconds = null;
    if (latest && latest.status === 'pending' && latest.expires_at) {
      const expires = new Date(latest.expires_at).getTime();
      const now = Date.now();
      remainingSeconds = Math.max(0, Math.ceil((expires - now) / 1000));
    }

    // Also return the clinic's soft-delete status so the frontend can
    // detect a soft-deleted clinic even when no pending deletion record exists.
    let clinicIsDeleted = false;
    try {
      const clinic = await svc.entities.Clinic.get(clinic_id);
      clinicIsDeleted = !!(clinic?.is_deleted || clinic?.deletion_status === 'soft_deleted');
    } catch (_) {}

    return Response.json({
      pending_deletion: latest ? {
        id: latest.id,
        clinic_id: latest.clinic_id,
        clinic_name: latest.clinic_name,
        status: latest.status,
        expires_at: latest.expires_at,
        requested_at: latest.requested_at,
        requested_by_name: latest.requested_by_name,
      } : null,
      remaining_seconds: remainingSeconds,
      clinic_is_deleted: clinicIsDeleted,
    });
  } catch (error) {
    console.error('checkPendingClinicDeletion failed', error?.message);
    return Response.json({ error: 'Failed to check pending deletion' }, { status: 500 });
  }
}