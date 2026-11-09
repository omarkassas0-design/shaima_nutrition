/**
 * Soft-delete a user — SUPER ADMIN ONLY.
 *
 * Creates a DeletedUser record and sets the user's ClinicRoleAssignment
 * status to 'pending' (suspended), which blocks ALL access server-side
 * (enforced by getAuthenticatedClinicUser in clinicAuth.ts).
 *
 * The user appears in the Recycle Bin and can be restored via restoreUser.
 * The User record itself is NOT deleted — only access is disabled.
 *
 * Guards:
 *   - Never delete the owner/super_admin (by email or platform role).
 *   - Never delete a user already in the Recycle Bin.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';
import { getActiveClinicRole, getOwnerEmail } from '../../shared/clinicRoleAssignment.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    const body = await req.json();
    const { user_id } = body;
    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Fetch target user
    let targetUser;
    try {
      targetUser = await svc.entities.User.get(user_id);
    } catch (_) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Guard: never delete super_admin/owner
    if (targetUser.email === getOwnerEmail() || targetUser.role === 'admin') {
      return Response.json({ error: 'Cannot delete a Super Admin account' }, { status: 403 });
    }

    // Check if already soft-deleted
    const existingDeleted = await svc.entities.DeletedUser.filter(
      { user_id, status: 'pending' },
      '-deleted_at',
      1
    );
    if (existingDeleted && existingDeleted.length > 0) {
      return Response.json({ error: 'User is already in the Recycle Bin' }, { status: 400 });
    }

    // Fetch active CRA (if any)
    const cra = await getActiveClinicRole(svc, user_id);

    const now = new Date().toISOString();

    // Create DeletedUser record with snapshot
    await svc.entities.DeletedUser.create({
      user_id,
      email: targetUser.email,
      full_name: targetUser.full_name || '',
      clinic_id: cra?.clinic_id || null,
      role: cra?.role || null,
      status: 'pending',
      deleted_at: now,
      deleted_by: user.id,
      deleted_by_name: user.full_name || user.email,
      cra_snapshot: cra ? { ...cra } : null,
    });

    // Suspend the CRA (set status to 'pending') to block access server-side.
    // This is the same status used for account suspension — getAuthenticatedClinicUser
    // rejects any user whose CRA status is 'pending' or 'not_subscribed'.
    if (cra) {
      try {
        await svc.entities.ClinicRoleAssignment.update(cra.id, { status: 'pending' });
      } catch (e) {
        console.error('softDeleteUser: failed to suspend CRA', e?.message);
      }
    }

    console.log('softDeleteUser: user soft-deleted', {
      user_id,
      email: targetUser.email,
      had_cra: !!cra,
      deleted_by: user.id,
    });

    return Response.json({
      success: true,
      user_id,
      email: targetUser.email,
    });
  } catch (error) {
    console.error('softDeleteUser failed', error?.message);
    return Response.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}