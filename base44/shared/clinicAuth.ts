/**
 * Shared clinic authorization helpers for backend functions.
 *
 * SECURITY MODEL (clean rebuild 2026-09-07):
 *
 * The user's ACTIVE ClinicRoleAssignment is the SINGLE source of truth for
 * both their role AND their current clinic. resolveRole finds it by user_id
 * alone — no external clinic_id pointer needed.
 *
 * getAuthenticatedClinicUser derives clinic_id from the active CRA (not from
 * UserSecurityProfile or User record, which can be stale). Super admins
 * receive clinic_id only via the managed-clinic override.
 *
 * The User record's role/data.role fields are a READ-ONLY mirror synced by
 * assignUserToClinic — never used for authorization decisions.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveRole, getActiveClinicRole } from './clinicRoleAssignment.ts';

/**
 * Returns the user's role from the User record (NOT authoritative — for
 * display only). Use resolveRole() for any security-sensitive decision.
 */
export function getUserRole(user) {
  if (!user) return null;
  return user.role || user.data?.role || null;
}

/**
 * Returns true if the user is a platform super_admin.
 * Uses resolveRole — the authoritative role from the platform role or
 * ClinicRoleAssignment.
 */
export async function isPlatformAdminAsync(svc, user) {
  const role = await resolveRole(svc, user);
  return role === 'super_admin';
}

/**
 * Returns true if the user can view financial data for their clinic
 * (super_admin or clinic_admin). Uses resolveRole.
 */
export async function isFinancialAdminAsync(svc, user) {
  const role = await resolveRole(svc, user);
  return role === 'super_admin' || role === 'clinic_admin';
}

/**
 * Verifies the calling user is authenticated and returns their clinic_id and
 * authoritative role.
 *
 * clinic_id is derived from the user's ACTIVE ClinicRoleAssignment — the
 * authoritative source, never stale. For super_admin, clinic_id comes from
 * the overrideClinicId parameter (managed-clinic mode).
 *
 * `overrideClinicId` is ONLY honored for super_admin users. Non-super-admin
 * users can NEVER override — their clinic_id is always from their active CRA.
 */
export async function getAuthenticatedClinicUser(req, overrideClinicId) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }), user: null, base44: null, clinicId: null };
  }

  const svc = base44.asServiceRole;
  const authoritativeRole = await resolveRole(svc, user);

  // Super admin — managed-clinic mode: use override clinic_id if provided.
  if (authoritativeRole === 'super_admin') {
    if (overrideClinicId) {
      // Reject access to soft-deleted clinics through normal operations.
      // The super admin must restore the clinic first via restoreClinic.
      let clinic = null;
      try { clinic = await svc.entities.Clinic.get(overrideClinicId); } catch (_) {}
      if (!clinic || clinic.is_deleted || clinic.deletion_status === 'soft_deleted') {
        return { error: Response.json({ error: 'Clinic is deleted' }, { status: 403 }), user: null, base44: null, clinicId: null };
      }
      return { error: null, user, base44, clinicId: overrideClinicId, authoritativeRole, clinic };
    }
    // Super admin without a managed clinic — no clinic linked.
    return { error: Response.json({ error: 'No clinic linked to this account' }, { status: 403 }), user: null, base44: null, clinicId: null };
  }

  // Clinic role — derive clinic_id from the active CRA (authoritative).
  if (authoritativeRole) {
    const assignment = await getActiveClinicRole(svc, user.id);

    // SERVER-SIDE ACCOUNT STATUS ENFORCEMENT — block suspended/not_subscribed
    // users from ALL protected APIs. This is the authoritative check that
    // persists across logout/login. The frontend AuthContext also checks
    // this (via getCurrentUserRole) for UX, but THIS is the security boundary.
    if (assignment?.status === 'pending' || assignment?.status === 'not_subscribed') {
      return { error: Response.json({ error: 'Account suspended — contact your administrator' }, { status: 403 }), user: null, base44: null, clinicId: null };
    }

    const clinicId = assignment?.clinic_id || null;
    if (!clinicId) {
      return { error: Response.json({ error: 'No clinic linked to this account' }, { status: 403 }), user: null, base44: null, clinicId: null };
    }
    // Reject access to soft-deleted clinics — the clinic is inactive and
    // inaccessible to all normal operations. Data is preserved for restore.
    let clinic = null;
    try { clinic = await svc.entities.Clinic.get(clinicId); } catch (_) {}
    if (!clinic || clinic.is_deleted || clinic.deletion_status === 'soft_deleted') {
      return { error: Response.json({ error: 'Clinic is deleted' }, { status: 403 }), user: null, base44: null, clinicId: null };
    }
    return { error: null, user, base44, clinicId, authoritativeRole, clinic };
  }

  // No role assigned — fail closed (null, never super_admin).
  return { error: Response.json({ error: 'No clinic linked to this account' }, { status: 403 }), user: null, base44: null, clinicId: null };
}

/**
 * Requires the calling user to be a platform super_admin.
 * Uses resolveRole — a user who escalates themselves via updateMe will be
 * REJECTED here because their authoritative role is unchanged.
 */
export async function requireSuperAdmin(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }), user: null, base44: null };
  }

  const svc = base44.asServiceRole;
  const role = await resolveRole(svc, user);

  if (role !== 'super_admin') {
    return { error: Response.json({ error: 'Forbidden — admin access required' }, { status: 403 }), user: null, base44: null };
  }
  return { error: null, user, base44, authoritativeRole: role };
}

/**
 * Requires the calling user to have one of the specified roles.
 * Uses resolveRole — the authoritative role from ClinicRoleAssignment or
 * platform role.
 */
export async function requireRole(req, allowedRoles) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }), user: null, base44: null };
  }

  const svc = base44.asServiceRole;
  const role = await resolveRole(svc, user);

  if (!role || !allowedRoles.includes(role)) {
    return { error: Response.json({ error: 'Forbidden — insufficient permissions' }, { status: 403 }), user: null, base44: null };
  }
  return { error: null, user, base44, authoritativeRole: role };
}