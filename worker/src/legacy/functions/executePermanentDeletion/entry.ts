/**
 * Execute a pending PERMANENT clinic deletion — SYSTEM CALL (workflow) or SUPER ADMIN.
 *
 * Called automatically by the "Permanent Deletion Countdown" workflow 60 seconds
 * after a PendingPermanentDeletion record is created. Verifies the deletion is
 * still 'pending' (not cancelled) AND the clinic is still soft-deleted before
 * physically destroying ALL clinic data.
 *
 * SECURITY:
 *   - System calls (workflow engine) are identified by the platform-injected
 *     `base44-service-authorization` header. This does NOT expose any secret
 *     in the workflow files.
 *   - If no header is present, the caller must be an authenticated super admin.
 *   - Fallback: a valid `BACKUP_WORKFLOW_SECRET` in the body (for manual
 *     system calls where the caller explicitly provides the shared secret).
 *   - The clinic_id comes from the PendingPermanentDeletion record (NOT from
 *     the client), so a client-supplied clinic_id cannot bypass authorization.
 *   - Verifies the clinic is still soft-deleted (is_deleted=true) before
 *     hard-deleting. Active clinics are rejected.
 *
 * IDEMPOTENCY:
 *   - If the pending record is already 'executed' or 'cancelled', skips.
 *   - If the clinic is already gone (Clinic.get fails), marks as 'executed'.
 *   - A repeated request cannot corrupt other clinic data — all deleteMany
 *     calls are scoped to { clinic_id } from the pending record.
 *
 * FAILURE HANDLING:
 *   - If any entity deletion fails, marks the pending record as 'failed' with
 *     detailed error information for safe recovery/retry. Does NOT report success.
 *   - After hard-delete, verifies no clinic-scoped data remains. If verification
 *     fails, marks as 'failed'.
 *
 * AUDIT:
 *   - The completion audit record is created AFTER the hard-delete (including
 *     AuditLog deleteMany), so it survives as an orphaned record with the
 *     deleted clinic's ID. It does not cause deletion of another clinic's data.
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { resolveRole } from '../../shared/clinicRoleAssignment.ts';
import { hardDeleteClinicData, verifyClinicDataGone } from '../../shared/clinicDeletion.ts';
import { recordAudit } from '../../shared/auditLog.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    // Check for platform-internal service auth header FIRST.
    // The platform injects this on calls from the workflow engine. We validate
    // the token value against BACKUP_WORKFLOW_SECRET so a forged header (any
    // "Bearer ..." value) cannot bypass authorization.
    const expectedSecret = base44.env.BACKUP_WORKFLOW_SECRET;
    const serviceAuth = req.headers.get('x-worker-schedule-secret');
    const isSystemCall = !!(expectedSecret && serviceAuth && serviceAuth === `Bearer ${expectedSecret}`);

    let user = null;
    if (!isSystemCall) {
      // Not a system call — check for a user session
      try { user = await base44.auth.me(); } catch (_) { user = null; }

      if (user) {
        // Authenticated call — verify super admin
        const role = await resolveRole(base44.asServiceRole, user);
        if (role !== 'super_admin') {
          return Response.json({ error: 'Forbidden — admin access required' }, { status: 403 });
        }
      } else {
        // No session, no valid header — check for manual system secret in body
        if (!expectedSecret || body.system_secret !== expectedSecret) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }
    }

    const { pending_deletion_id } = body;
    if (!pending_deletion_id) {
      return Response.json({ error: 'pending_deletion_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Fetch the pending deletion record
    let pendingDeletion;
    try {
      pendingDeletion = await svc.entities.PendingPermanentDeletion.get(pending_deletion_id);
    } catch (_) {
      return Response.json({ error: 'Pending permanent deletion record not found' }, { status: 404 });
    }

    // Verify status is still 'pending'
    if (pendingDeletion.status === 'cancelled') {
      console.log('executePermanentDeletion: was cancelled, skipping', { pending_deletion_id });
      return Response.json({ success: true, skipped: true, reason: 'cancelled' });
    }
    if (pendingDeletion.status === 'executed') {
      console.log('executePermanentDeletion: already executed, skipping', { pending_deletion_id });
      return Response.json({ success: true, skipped: true, reason: 'already_executed' });
    }
    if (pendingDeletion.status === 'failed') {
      console.log('executePermanentDeletion: previously failed, skipping', { pending_deletion_id });
      return Response.json({ success: true, skipped: true, reason: 'previously_failed' });
    }
    if (pendingDeletion.status !== 'pending') {
      console.log('executePermanentDeletion: unexpected status, skipping', { pending_deletion_id, status: pendingDeletion.status });
      return Response.json({ success: true, skipped: true, reason: 'unexpected_status' });
    }

    const clinicId = pendingDeletion.clinic_id;

    // Try to fetch the clinic. If it doesn't exist (already hard-deleted),
    // mark as executed and return (idempotent).
    let clinic;
    try {
      clinic = await svc.entities.Clinic.get(clinicId);
    } catch (_) {
      await svc.entities.PendingPermanentDeletion.update(pending_deletion_id, {
        status: 'executed',
        executed_at: new Date().toISOString(),
      });
      return Response.json({ success: true, skipped: true, reason: 'clinic_already_deleted' });
    }

    // SECURITY: Verify the clinic is still soft-deleted (is_deleted = true).
    // Permanent delete is ONLY allowed for soft-deleted clinics.
    // This prevents a race condition where the clinic was restored between
    // schedule and execute.
    if (!clinic.is_deleted && clinic.deletion_status !== 'soft_deleted') {
      await svc.entities.PendingPermanentDeletion.update(pending_deletion_id, {
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: 'Clinic is not soft-deleted — permanent deletion rejected (clinic is active)',
      });
      return Response.json({
        error: 'Cannot permanently delete an active clinic — clinic must be soft-deleted first',
      }, { status: 400 });
    }

    console.log('executePermanentDeletion: starting permanent deletion', {
      clinic_id: clinicId,
      clinic_name: pendingDeletion.clinic_name,
      pending_deletion_id,
      is_system_call: isSystemCall,
    });

    // HARD-DELETE all clinic-scoped data (NOT the Clinic record yet)
    const { results, errors } = await hardDeleteClinicData(svc, clinicId, pending_deletion_id);

    // If any entity had errors, mark as failed — do NOT report success
    if (errors.length > 0) {
      await svc.entities.PendingPermanentDeletion.update(pending_deletion_id, {
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: errors.map(e => `${e.entity}: ${e.error}`).join('; '),
        deletion_results: results,
      });
      console.error('executePermanentDeletion: hard-delete failed', { errors });
      return Response.json({
        error: 'Permanent deletion failed — some entities could not be deleted',
        details: errors,
      }, { status: 500 });
    }

    // Delete the Clinic record itself (LAST)
    try {
      await svc.entities.Clinic.delete(clinicId);
    } catch (e: any) {
      await svc.entities.PendingPermanentDeletion.update(pending_deletion_id, {
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: `Failed to delete Clinic record: ${e?.message || String(e)}`,
        deletion_results: results,
      });
      console.error('executePermanentDeletion: Clinic.delete failed', e?.message);
      return Response.json({
        error: 'Failed to delete clinic record',
      }, { status: 500 });
    }

    // VERIFICATION: verify no clinic record or clinic-scoped data remains
    const verification = await verifyClinicDataGone(svc, clinicId, pending_deletion_id);
    if (!verification.verified) {
      await svc.entities.PendingPermanentDeletion.update(pending_deletion_id, {
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: `Verification failed: ${verification.errors.join('; ')}`,
        deletion_results: results,
      });
      console.error('executePermanentDeletion: verification failed', verification.errors);
      return Response.json({
        error: 'Permanent deletion verification failed — some data remains',
        details: verification.errors,
      }, { status: 500 });
    }

    // Create completion audit (AFTER hard-delete, so it survives the AuditLog deleteMany)
    const requestingUser = {
      id: pendingDeletion.requested_by_id,
      full_name: pendingDeletion.requested_by_name,
      email: pendingDeletion.requested_by_name,
    };
    await recordAudit(
      svc,
      clinicId, // Orphaned clinic_id — clinic no longer exists, but audit record survives
      requestingUser,
      'delete',
      'Clinic',
      clinicId,
      `Clinic "${pendingDeletion.clinic_name}" PERMANENTLY deleted by ${pendingDeletion.requested_by_name} — all data destroyed`,
      { clinic_name: pendingDeletion.clinic_name, pending_deletion_id, deletion_type: 'permanent' }
    );

    // Mark the pending deletion as executed
    await svc.entities.PendingPermanentDeletion.update(pending_deletion_id, {
      status: 'executed',
      executed_at: new Date().toISOString(),
      deletion_results: results,
    });

    console.log('executePermanentDeletion: permanent deletion complete', {
      clinic_id: clinicId,
      clinic_name: pendingDeletion.clinic_name,
    });

    return Response.json({
      success: true,
      clinic_id: clinicId,
      clinic_name: pendingDeletion.clinic_name,
      permanently_deleted: true,
      deletion_results: results,
    });
  } catch (error) {
    console.error('executePermanentDeletion failed', error?.message);
    return Response.json({ error: 'Failed to execute permanent deletion' }, { status: 500 });
  }
}
