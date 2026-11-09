/**
 * THE SINGLE ROLE RESOLUTION FUNCTION (frontend entry point).
 *
 * Returns the authoritative role for the authenticated user by calling
 * resolveRole — the shared role resolver used by both this function and all
 * backend authorization guards.
 *
 * DESIGN (clean rebuild 2026-09-07):
 *   - Role and clinic_id BOTH come from the user's active ClinicRoleAssignment.
 *     We do NOT depend on UserSecurityProfile.clinic_id, User.clinic_id, or
 *     User.data.clinic_id — those can be stale or corrupted.
 *   - Platform super_admin: identified by User.role === 'admin'.
 *   - No CRA → role: null, clinic_id: null (fail closed — NEVER super_admin
 *     for non-platform-identity users).
 *
 * Response: { role, clinic_id, user_id }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveRole, getActiveClinicRole } from '../../shared/clinicRoleAssignment.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const svc = base44.asServiceRole;

    // Resolve the authoritative role. resolveRole finds the active CRA by
    // user_id alone — no clinic_id pointer needed.
    const role = await resolveRole(svc, user);

    // Derive clinic_id and account_status from the active CRA — the
    // authoritative source. For super_admin, there is no CRA (they use
    // managed-clinic mode), so clinic_id is null and account_status is
    // always 'active'. The frontend handles this via SuperAdminContext.
    let clinicId = null;
    let accountStatus = 'active';
    if (role && role !== 'super_admin') {
      const assignment = await getActiveClinicRole(svc, user.id);
      clinicId = assignment?.clinic_id || null;
      accountStatus = assignment?.status || 'active';
    }

    return Response.json({ role, clinic_id: clinicId, user_id: user.id, account_status: accountStatus });
  } catch (error) {
    return Response.json(
      { error: 'Failed to resolve role: ' + (error?.message || 'Unknown') },
      { status: 500 }
    );
  }
}