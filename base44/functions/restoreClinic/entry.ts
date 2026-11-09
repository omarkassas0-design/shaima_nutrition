/**
 * Restore a soft-deleted clinic — SUPER ADMIN ONLY.
 *
 * Reverses the soft-delete state by clearing is_deleted, deletion_status,
 * deleted_at, deleted_by, and deleted_by_name on the Clinic record.
 *
 * NO data is recreated — all clinic-scoped entities (patients, appointments,
 * payments, doctors, etc.) remained in the database during soft-deletion.
 * Restoration simply makes the clinic accessible again. All IDs and
 * relationships are intact.
 *
 * Idempotent: if the clinic is already active, returns success.
 *
 * Updates the latest 'executed' PendingClinicDeletion record to 'restored'.
 * Logs "Clinic restored" to the Audit Log.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';
import { recordAudit } from '../../shared/auditLog.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'restoreClinic');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { clinic_id } = body;

    if (!clinic_id) {
      return Response.json({ error: 'clinic_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Fetch the clinic
    let clinic;
    try {
      clinic = await svc.entities.Clinic.get(clinic_id);
    } catch (_) {
      return Response.json({ error: 'Clinic not found' }, { status: 404 });
    }
    if (!clinic) {
      return Response.json({ error: 'Clinic not found' }, { status: 404 });
    }

    // Idempotent — if already active, return success
    if (!clinic.is_deleted && clinic.deletion_status !== 'soft_deleted') {
      return Response.json({
        success: true,
        clinic_id,
        message: 'Clinic is already active',
      });
    }

    // Restore — reverse the soft-delete state. All data was preserved.
    await svc.entities.Clinic.update(clinic_id, {
      is_deleted: false,
      deletion_status: 'active',
      deleted_at: null,
      deleted_by: null,
      deleted_by_name: null,
    });

    // Update the latest 'executed' PendingClinicDeletion record to 'restored'
    try {
      const pendingDeletions = await svc.entities.PendingClinicDeletion.filter(
        { clinic_id, status: 'executed' },
        '-executed_at',
        1
      );
      if (pendingDeletions && pendingDeletions.length > 0) {
        await svc.entities.PendingClinicDeletion.update(pendingDeletions[0].id, {
          status: 'restored',
          restored_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('restoreClinic: failed to update PendingClinicDeletion', e?.message);
    }

    // Audit log: clinic restored
    await recordAudit(
      svc,
      clinic_id,
      user,
      'restore',
      'Clinic',
      clinic_id,
      `Clinic "${clinic.name}" restored by ${user.full_name || user.email} — all data intact`,
      { clinic_id, clinic_name: clinic.name }
    );

    console.log('restoreClinic: restored', {
      clinic_id,
      clinic_name: clinic.name,
    });

    return Response.json({
      success: true,
      clinic_id,
      clinic_name: clinic.name,
    });
  } catch (error) {
    console.error('restoreClinic failed', error?.message);
    return Response.json({ error: 'Failed to restore clinic' }, { status: 500 });
  }
}