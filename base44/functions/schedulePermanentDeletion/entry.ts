/**
 * Schedule a PERMANENT clinic deletion — SUPER ADMIN ONLY.
 *
 * Creates a PendingPermanentDeletion record with a 60-second countdown.
 * A workflow triggers on creation, waits 60 seconds, then calls
 * executePermanentDeletion which verifies the deletion is still pending
 * AND the clinic is still soft-deleted before physically destroying ALL
 * clinic data.
 *
 * SECURITY:
 *   - Super admin only (requireSuperAdmin).
 *   - The clinic MUST be soft-deleted (is_deleted=true) before a permanent
 *     deletion can be scheduled. Active clinics are rejected.
 *   - Prevents duplicate permanent deletion requests for the same clinic.
 *
 * The Super Admin can cancel at any time during the 60 seconds via
 * cancelPermanentDeletion.
 *
 * Logs "Permanent deletion requested" to the Audit Log.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';
import { recordAudit } from '../../shared/auditLog.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'schedulePermanentDeletion');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { clinic_id } = body;

    if (!clinic_id) {
      return Response.json({ error: 'clinic_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Verify clinic exists
    let clinic;
    try {
      clinic = await svc.entities.Clinic.get(clinic_id);
    } catch (_) {
      return Response.json({ error: 'Clinic not found' }, { status: 404 });
    }
    if (!clinic) {
      return Response.json({ error: 'Clinic not found' }, { status: 404 });
    }

    // SECURITY: Permanent delete is ONLY allowed for soft-deleted clinics.
    // An active clinic must be soft-deleted first.
    if (!clinic.is_deleted && clinic.deletion_status !== 'soft_deleted') {
      return Response.json({
        error: 'Cannot permanently delete an active clinic — soft-delete it first',
      }, { status: 400 });
    }

    // Prevent duplicate permanent deletion requests
    const existing = await svc.entities.PendingPermanentDeletion.filter(
      { clinic_id, status: 'pending' },
      '-requested_at',
      1
    );
    if (existing && existing.length > 0) {
      return Response.json({
        error: 'A permanent deletion is already pending for this clinic',
        pending_deletion: {
          id: existing[0].id,
          expires_at: existing[0].expires_at,
          requested_at: existing[0].requested_at,
        },
      }, { status: 409 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 1000); // 60 seconds

    const pending = await svc.entities.PendingPermanentDeletion.create({
      clinic_id,
      clinic_name: clinic.name,
      requested_by_id: user.id,
      requested_by_name: user.full_name || user.email || user.id,
      requested_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'pending',
    });

    // Audit log: permanent deletion requested
    await recordAudit(
      svc,
      clinic_id,
      user,
      'create',
      'PendingPermanentDeletion',
      pending.id,
      `Permanent deletion requested for clinic "${clinic.name}" — 60-second countdown started`,
      { clinic_id, clinic_name: clinic.name, expires_at: expiresAt.toISOString() }
    );

    console.log('schedulePermanentDeletion: scheduled', {
      clinic_id, clinic_name: clinic.name, pending_deletion_id: pending.id,
      expires_at: expiresAt.toISOString(),
    });

    return Response.json({
      success: true,
      pending_deletion: {
        id: pending.id,
        clinic_id,
        clinic_name: clinic.name,
        expires_at: expiresAt.toISOString(),
        requested_at: now.toISOString(),
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('schedulePermanentDeletion failed', error?.message);
    return Response.json({ error: 'Failed to schedule permanent deletion' }, { status: 500 });
  }
}