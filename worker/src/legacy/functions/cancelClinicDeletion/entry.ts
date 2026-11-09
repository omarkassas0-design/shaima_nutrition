/**
 * Cancel a pending clinic deletion — SUPER ADMIN ONLY.
 *
 * Marks the PendingClinicDeletion record as 'cancelled'. When the workflow
 * fires after the 60-second wait, executeClinicDeletion will see the
 * 'cancelled' status and skip the deletion entirely.
 *
 * Can only cancel if the deletion is still 'pending'. Once 'executed',
 * the clinic is already gone and cannot be cancelled.
 *
 * Logs "Deletion cancelled" to the Audit Log.
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';
import { recordAudit } from '../../shared/auditLog.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'cancelClinicDeletion');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { pending_deletion_id } = body;

    if (!pending_deletion_id) {
      return Response.json({ error: 'pending_deletion_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Fetch the pending deletion record
    let pendingDeletion;
    try {
      pendingDeletion = await svc.entities.PendingClinicDeletion.get(pending_deletion_id);
    } catch (_) {
      return Response.json({ error: 'Pending deletion not found' }, { status: 404 });
    }
    if (!pendingDeletion) {
      return Response.json({ error: 'Pending deletion not found' }, { status: 404 });
    }

    // Can only cancel if still pending
    if (pendingDeletion.status !== 'pending') {
      return Response.json({
        error: `Cannot cancel deletion — current status is "${pendingDeletion.status}"`,
      }, { status: 400 });
    }

    // Mark as cancelled
    await svc.entities.PendingClinicDeletion.update(pending_deletion_id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    });

    // Audit log: deletion cancelled
    await recordAudit(
      svc,
      pendingDeletion.clinic_id,
      user,
      'update',
      'PendingClinicDeletion',
      pending_deletion_id,
      `Deletion cancelled for clinic "${pendingDeletion.clinic_name}" — no data was deleted`,
      { clinic_id: pendingDeletion.clinic_id, clinic_name: pendingDeletion.clinic_name }
    );

    console.log('cancelClinicDeletion: cancelled', {
      pending_deletion_id,
      clinic_id: pendingDeletion.clinic_id,
      clinic_name: pendingDeletion.clinic_name,
    });

    return Response.json({
      success: true,
      pending_deletion_id,
      status: 'cancelled',
    });
  } catch (error) {
    console.error('cancelClinicDeletion failed', error?.message);
    return Response.json({ error: 'Failed to cancel deletion' }, { status: 500 });
  }
}