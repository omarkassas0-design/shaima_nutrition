/**
 * Schedule a clinic deletion — SUPER ADMIN ONLY.
 *
 * Creates a PendingClinicDeletion record with a 60-second countdown.
 * A workflow triggers on creation, waits 60 seconds, then calls
 * executeClinicDeletion which verifies the deletion is still pending
 * before permanently destroying all clinic data.
 *
 * The Super Admin can cancel at any time during the 60 seconds via
 * cancelClinicDeletion.
 *
 * Prevents duplicate deletion requests for the same clinic.
 * Logs "Deletion requested" to the Audit Log.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';
import { recordAudit } from '../../shared/auditLog.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'scheduleClinicDeletion');
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

    // Prevent duplicate deletion requests — check for existing pending deletion
    const existing = await svc.entities.PendingClinicDeletion.filter(
      { clinic_id, status: 'pending' },
      '-requested_at',
      1
    );
    if (existing && existing.length > 0) {
      return Response.json({
        error: 'A deletion is already pending for this clinic',
        pending_deletion: {
          id: existing[0].id,
          expires_at: existing[0].expires_at,
          requested_at: existing[0].requested_at,
        },
      }, { status: 409 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 1000); // 60 seconds

    const pending = await svc.entities.PendingClinicDeletion.create({
      clinic_id,
      clinic_name: clinic.name,
      requested_by_id: user.id,
      requested_by_name: user.full_name || user.email || user.id,
      requested_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'pending',
    });

    // Audit log: deletion requested
    await recordAudit(
      svc,
      clinic_id,
      user,
      'create',
      'PendingClinicDeletion',
      pending.id,
      `Deletion requested for clinic "${clinic.name}" — 60-second countdown started`,
      { clinic_id, clinic_name: clinic.name, expires_at: expiresAt.toISOString() }
    );

    console.log('scheduleClinicDeletion: scheduled', {
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
    console.error('scheduleClinicDeletion failed', error?.message);
    return Response.json({ error: 'Failed to schedule clinic deletion' }, { status: 500 });
  }
}