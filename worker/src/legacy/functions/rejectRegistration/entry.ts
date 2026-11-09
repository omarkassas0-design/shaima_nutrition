/**
 * Super Admin — Reject a pending registration request.
 * Sets the user's signup_status to "rejected" so they cannot log in.
 *
 * Super_admin only.
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'rejectRegistration');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    try {
      await svc.entities.User.update(user_id, {
        signup_status: 'rejected',
      });
    } catch (_) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({ success: true, user_id });
  } catch (error) {
    return Response.json({ error: 'Failed to reject registration: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}