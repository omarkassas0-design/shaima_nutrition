/**
 * Execute a pending clinic deletion — SYSTEM CALL (workflow) or SUPER ADMIN.
 *
 * Called automatically by the "Clinic Deletion Countdown" workflow 60 seconds
 * after a PendingClinicDeletion record is created. Verifies the deletion is
 * still 'pending' (not cancelled) before permanently destroying all clinic
 * data via deleteAllClinicData.
 *
 * SECURITY:
 *   - System calls (workflow engine) are identified by the platform-injected
 *     `base44-service-authorization` header. This does NOT expose any secret
 *     in the workflow files.
 *   - If no header is present, the caller must be an authenticated super admin.
 *   - Fallback: a valid `BACKUP_WORKFLOW_SECRET` in the body (for manual
 *     system calls where the caller explicitly provides the shared secret).
 *
 * Logs "Clinic permanently deleted" to the Audit Log.
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { resolveRole } from '../../shared/clinicRoleAssignment.ts';
import { softDeleteClinic } from '../../shared/clinicDeletion.ts';
import { recordAudit } from '../../shared/auditLog.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Parse body once
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
      pendingDeletion = await svc.entities.PendingClinicDeletion.get(pending_deletion_id);
    } catch (_) {
      return Response.json({ error: 'Pending deletion record not found' }, { status: 404 });
    }
    if (!pendingDeletion) {
      return Response.json({ error: 'Pending deletion record not found' }, { status: 404 });
    }

    // Verify the deletion is still pending (not cancelled or already executed)
    if (pendingDeletion.status === 'cancelled') {
      console.log('executeClinicDeletion: deletion was cancelled, skipping', { pending_deletion_id });
      return Response.json({ success: true, skipped: true, reason: 'cancelled' });
    }

    if (pendingDeletion.status === 'executed') {
      console.log('executeClinicDeletion: deletion already executed, skipping', { pending_deletion_id });
      return Response.json({ success: true, skipped: true, reason: 'already_executed' });
    }

    if (pendingDeletion.status !== 'pending') {
      console.log('executeClinicDeletion: unexpected status, skipping', {
        pending_deletion_id, status: pendingDeletion.status,
      });
      return Response.json({ success: true, skipped: true, reason: 'unexpected_status' });
    }

    // Verify the clinic still exists (might have been deleted by another path)
    let clinic;
    try {
      clinic = await svc.entities.Clinic.get(pendingDeletion.clinic_id);
    } catch (_) {
      // Clinic already gone — mark as executed
      await svc.entities.PendingClinicDeletion.update(pending_deletion_id, {
        status: 'executed',
        executed_at: new Date().toISOString(),
      });
      return Response.json({ success: true, skipped: true, reason: 'clinic_already_deleted' });
    }

    console.log('executeClinicDeletion: starting permanent deletion', {
      clinic_id: pendingDeletion.clinic_id,
      clinic_name: pendingDeletion.clinic_name,
      pending_deletion_id,
      is_system_call: isSystemCall,
    });

    // SOFT-DELETE the clinic — mark it as deleted without removing any data.
    // All clinic-scoped entities (patients, appointments, payments, etc.)
    // remain in the database. The clinic becomes inaccessible via normal
    // operations (enforced by getAuthenticatedClinicUser's soft-delete check).
    await softDeleteClinic(
      svc,
      pendingDeletion.clinic_id,
      pendingDeletion.requested_by_id,
      pendingDeletion.requested_by_name
    );

    // Mark the pending deletion as executed (soft-deleted)
    await svc.entities.PendingClinicDeletion.update(pending_deletion_id, {
      status: 'executed',
      executed_at: new Date().toISOString(),
    });

    // Audit log: clinic soft-deleted
    const requestingUser = {
      id: pendingDeletion.requested_by_id,
      full_name: pendingDeletion.requested_by_name,
      email: pendingDeletion.requested_by_name,
    };
    await recordAudit(
      svc,
      pendingDeletion.clinic_id,
      requestingUser,
      'delete',
      'Clinic',
      pendingDeletion.clinic_id,
      `Clinic "${pendingDeletion.clinic_name}" soft-deleted (requested by ${pendingDeletion.requested_by_name}) — data preserved, clinic deactivated`,
      {
        clinic_name: pendingDeletion.clinic_name,
        pending_deletion_id,
      }
    );

    console.log('executeClinicDeletion: soft-delete complete', {
      clinic_id: pendingDeletion.clinic_id,
      clinic_name: pendingDeletion.clinic_name,
    });

    return Response.json({
      success: true,
      clinic_id: pendingDeletion.clinic_id,
      clinic_name: pendingDeletion.clinic_name,
      soft_deleted: true,
    });
  } catch (error) {
    console.error('executeClinicDeletion failed', error?.message);
    return Response.json({ error: 'Failed to execute clinic deletion' }, { status: 500 });
  }
}
