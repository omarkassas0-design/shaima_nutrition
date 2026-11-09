/**
 * Super Admin — Lists all users with their authoritative clinic assignment and role.
 * Used by the user-assignment UI to select a user + clinic + role.
 *
 * DESIGN (clean rebuild 2026-09-07):
 *   - Platform super_admin: identified by User.role === 'admin'.
 *   - Clinic roles: read from the user's ACTIVE ClinicRoleAssignment (found by
 *     user_id alone — no clinic_id pointer needed).
 *   - No CRA → role: 'unassigned' (explicit, never guessed).
 *
 * Super_admin only. Clinic_admin / doctor / receptionist → 403.
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';
import { getActiveClinicRole, PLATFORM_ROLES, getOwnerEmail } from '../../shared/clinicRoleAssignment.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    const svc = base44.asServiceRole;

    let users = [];
    try {
      users = await svc.entities.User.list('-created_date', 500);
    } catch (e) {
      return Response.json({ error: 'Failed to list users' }, { status: 500 });
    }

    // Fetch all ClinicRoleAssignments and build a map of user_id → active CRA.
    // The active CRA is the most recently updated one per user.
    const activeCraMap = new Map(); // user_id → { role, clinic_id, status }
    try {
      const allCras = await svc.entities.ClinicRoleAssignment.list('-updated_date', 500);
      for (const c of (allCras || [])) {
        if (!activeCraMap.has(c.user_id)) {
          activeCraMap.set(c.user_id, { role: c.role, clinic_id: c.clinic_id, status: c.status || 'active' });
        }
      }
    } catch (_) { /* best-effort enrichment */ }

    // Fetch soft-deleted users (in Recycle Bin) — used to mark users and
    // populate the deletedUsers array for the Recycle Bin dialog.
    const deletedUserMap = new Map(); // user_id → DeletedUser record
    let deletedUsers = [];
    try {
      const allDeleted = await svc.entities.DeletedUser.filter({ status: 'pending' }, '-deleted_at', 200);
      deletedUsers = (allDeleted || []).map(d => ({
        id: d.id,
        user_id: d.user_id,
        email: d.email,
        full_name: d.full_name,
        clinic_id: d.clinic_id,
        role: d.role,
        deleted_at: d.deleted_at,
        deleted_by_name: d.deleted_by_name,
      }));
      for (const d of deletedUsers) {
        deletedUserMap.set(d.user_id, d);
      }
    } catch (_) { /* best-effort */ }

    const enriched = (users || []).map((u) => {
      // 1. Platform super_admin — EXPLICIT owner protection (by email ONLY).
      //    No other account may be super_admin, regardless of User.role.
      if (u.email === getOwnerEmail(svc)) {
        return {
          id: u.id,
          email: u.email,
          full_name: u.full_name || '',
          role: 'super_admin',
          clinic_id: u.clinic_id || u.data?.clinic_id || null,
          signup_status: u.signup_status || null,
        };
      }

      // Check if user is soft-deleted (in Recycle Bin)
      const deletedInfo = deletedUserMap.get(u.id);

      // 2. Clinic role — from the active ClinicRoleAssignment.
      const activeCra = activeCraMap.get(u.id);
      if (activeCra) {
        return {
          id: u.id,
          email: u.email,
          full_name: u.full_name || '',
          role: activeCra.role,
          clinic_id: activeCra.clinic_id,
          status: activeCra.status || 'active',
          signup_status: u.signup_status || null,
          is_deleted: !!deletedInfo,
          deleted_at: deletedInfo?.deleted_at || null,
        };
      }

      // 3. No CRA — explicitly unassigned (never guess from u.role).
      return {
        id: u.id,
        email: u.email,
        full_name: u.full_name || '',
        role: 'unassigned',
        clinic_id: u.clinic_id || u.data?.clinic_id || null,
        signup_status: u.signup_status || null,
        is_deleted: !!deletedInfo,
        deleted_at: deletedInfo?.deleted_at || null,
      };
    });

    return Response.json({ users: enriched, deletedUsers });
  } catch (error) {
    return Response.json({ error: 'Failed to load users' }, { status: 500 });
  }
}
