/**
 * Restore a soft-deleted user — SUPER ADMIN ONLY.
 *
 * Sets the user's ClinicRoleAssignment status back to 'active' and marks
 * the DeletedUser record as 'restored'. The user regains access immediately.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    const body = await req.json();
    const { deleted_user_id } = body;
    if (!deleted_user_id) {
      return Response.json({ error: 'deleted_user_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    let deletedUser;
    try {
      deletedUser = await svc.entities.DeletedUser.get(deleted_user_id);
    } catch (_) {
      return Response.json({ error: 'Deleted user record not found' }, { status: 404 });
    }
    if (!deletedUser) {
      return Response.json({ error: 'Deleted user record not found' }, { status: 404 });
    }
    if (deletedUser.status === 'restored') {
      return Response.json({ error: 'User already restored' }, { status: 400 });
    }

    // Restore the CRA status to 'active'
    if (deletedUser.cra_snapshot?.id) {
      try {
        await svc.entities.ClinicRoleAssignment.update(deletedUser.cra_snapshot.id, {
          status: 'active',
        });
        console.log('restoreUser: CRA status restored to active', {
          cra_id: deletedUser.cra_snapshot.id,
          user_id: deletedUser.user_id,
        });
      } catch (e) {
        console.error('restoreUser: failed to restore CRA status', e?.message);
      }
    }

    // Mark as restored
    await svc.entities.DeletedUser.update(deleted_user_id, {
      status: 'restored',
      restored_at: new Date().toISOString(),
      restored_by: user.id,
    });

    console.log('restoreUser: user restored', {
      user_id: deletedUser.user_id,
      restored_by: user.id,
    });

    return Response.json({
      success: true,
      user_id: deletedUser.user_id,
      email: deletedUser.email,
    });
  } catch (error) {
    console.error('restoreUser failed', error?.message);
    return Response.json({ error: 'Failed to restore user' }, { status: 500 });
  }
}