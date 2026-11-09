/**
 * THE SINGLE ROLE RESOLVER + authoritative clinic-role assignment helpers.
 *
 * DESIGN (clean rebuild 2026-09-07):
 *
 * The user's ACTIVE ClinicRoleAssignment is the SINGLE source of truth for
 * both their role AND their current clinic. There is exactly ONE active CRA
 * per user (assignUserToClinic deletes orphan CRAs in other clinics). We find
 * it by user_id ALONE — we do NOT depend on any external clinic_id pointer
 * (UserSecurityProfile.clinic_id, User.clinic_id, User.data.clinic_id) because
 * those can be stale or corrupted.
 *
 * Resolution order:
 *   1. Platform super_admin: identified by User.role === 'admin' (the Base44
 *      platform role field, set by the platform, cannot be tampered via
 *      updateMe). Returns 'super_admin'.
 *   2. Clinic role: find the active CRA by user_id. Return its role.
 *   3. No CRA → null (fail closed — NEVER falls back to any default).
 *
 * WRITE RULE:
 *   ONLY assignUserToClinic (super_admin only) may create or update CRAs,
 *   via upsertClinicRole. No other code path may write here.
 */

/** Clinic roles that can be assigned per (user, clinic) pair. */
export const CLINIC_ROLES = ['clinic_admin', 'doctor', 'receptionist'];

/** Platform-level roles stored on the User record (not per-clinic). */
export const PLATFORM_ROLES = ['admin', 'super_admin'];


/**
 * The EXPLICIT application owner — the ONLY account that may resolve as
 * super_admin. This is email-based (not user_id) so it survives database
 * resets. The owner's User.role may be 'admin' (platform-set) or
 * 'super_admin' (legacy) — both are accepted, but ONLY for this email.
 * No other account may carry super_admin privileges, regardless of what
 * User.role value it has.
 *
 * SECURITY: The owner email is stored as a server-side environment variable
 * (OWNER_EMAIL) and read via the platform secrets API at runtime. It is
 * NEVER hardcoded in source code and NEVER exposed to client code.
 */
export function getOwnerEmail(client) {
  return client?.env?.OWNER_EMAIL || '';
}

/**
 * THE SINGLE ROLE RESOLVER — shared by getCurrentUserRole (frontend) and all
 * backend authorization guards (requireSuperAdmin, requireRole, etc.).
 *
 * overrideClinicId is IGNORED for clinic roles — the active CRA determines
 * both the role and the clinic. It is ONLY used by getAuthenticatedClinicUser
 * for super_admin managed-clinic mode (handled there, not here).
 */
export async function resolveRole(svc, user, overrideClinicId) {
  if (!user || !user.id) return null;

  // 1. Platform super_admin — EXPLICIT owner protection (by email ONLY).
  //    ONLY the real owner (by email) resolves as super_admin. No other
  //    account may be super_admin, regardless of User.role or legacy data.
  //    The legacy 'super_admin' role value is NOT an independent path —
  //    it is normalized to 'user' for non-owner accounts.
  if (user.email?.toLowerCase() === getOwnerEmail(svc).toLowerCase()) {
    return 'super_admin';
  }

  // 2. Clinic role — find the active CRA by user_id ALONE. We do NOT pass a
  //    clinic_id because the active CRA IS the clinic pointer. This eliminates
  //    the stale-clinic_id bug where resolveRole looked in the wrong clinic.
  const assignment = await getActiveClinicRole(svc, user.id);
  return assignment?.role || null;
}

/**
 * Returns the user's ACTIVE ClinicRoleAssignment — the most recently updated
 * CRA for this user. Since assignUserToClinic maintains exactly ONE active
 * CRA per user (deleting orphans in other clinics), this is the user's
 * current role + clinic.
 *
 * If duplicate CRAs exist (e.g. test-pollution leftovers), the most recently
 * updated one is returned — which is the one created/updated by the latest
 * assignUserToClinic call.
 */
export async function getActiveClinicRole(svc, userId) {
  if (!userId) return null;
  const found = await svc.entities.ClinicRoleAssignment.filter(
    { user_id: userId },
    '-updated_date',
    1
  );
  return found && found.length > 0 ? found[0] : null;
}

/**
 * Returns the user's active clinic_id — from their active CRA.
 * This is the authoritative clinic pointer, never stale.
 */
export async function getActiveClinicId(svc, userId) {
  const assignment = await getActiveClinicRole(svc, userId);
  return assignment?.clinic_id || null;
}

/**
 * Returns the authoritative ClinicRoleAssignment record for a user within a
 * SPECIFIC clinic. Returns null if no assignment exists — NEVER falls back.
 * Used by getSuperAdminUsers to display the role for a user's current clinic.
 */
export async function getClinicRole(svc, userId, clinicId) {
  if (!userId || !clinicId) return null;
  const found = await svc.entities.ClinicRoleAssignment.filter(
    { user_id: userId, clinic_id: clinicId },
    '-updated_date',
    1
  );
  return found && found.length > 0 ? found[0] : null;
}

/**
 * Returns the authoritative clinic role VALUE (string) for a user+clinic.
 * Returns null if no assignment exists — NEVER falls back.
 */
export async function getClinicRoleValue(svc, userId, clinicId) {
  const assignment = await getClinicRole(svc, userId, clinicId);
  return assignment?.role || null;
}

/**
 * UPSERT a clinic role assignment. This is the ONLY function that writes to
 * ClinicRoleAssignment. It must ONLY be called from assignUserToClinic
 * (which requires super_admin).
 *
 * If an assignment already exists for (user_id, clinic_id), it is updated —
 * this is how a super admin CHANGES a role. If none exists, a new one is
 * created — this is how a super admin ASSIGNS a role.
 */
export async function upsertClinicRole(svc, userId, clinicId, role, assignedById, status) {
  if (!userId || !clinicId || !role) {
    throw new Error('upsertClinicRole: userId, clinicId, and role are required');
  }
  if (!CLINIC_ROLES.includes(role)) {
    throw new Error(`upsertClinicRole: invalid role "${role}". Allowed: ${CLINIC_ROLES.join(', ')}`);
  }

  const now = new Date().toISOString();
  const existing = await getClinicRole(svc, userId, clinicId);

  if (existing) {
    const updatePayload = {
      role,
      assigned_by_id: assignedById,
      assigned_at: now,
    };
    if (status) updatePayload.status = status;
    await svc.entities.ClinicRoleAssignment.update(existing.id, updatePayload);
    return { ...existing, role, assigned_by_id: assignedById, assigned_at: now, ...(status ? { status } : {}) };
  }

  const created = await svc.entities.ClinicRoleAssignment.create({
    user_id: userId,
    clinic_id: clinicId,
    role,
    assigned_by_id: assignedById,
    assigned_at: now,
    status: status || 'active',
  });
  return created;
}

/**
 * Create an INITIAL clinic role assignment — used ONLY by authorized
 * provisioning workflows (approveRegistration, createNewClinic).
 *
 * Unlike upsertClinicRole, this NEVER overwrites an existing assignment.
 * If an assignment already exists for (user_id, clinic_id), it is returned
 * as-is and NO write occurs.
 */
export async function createInitialClinicRole(svc, userId, clinicId, role, assignedById) {
  if (!userId || !clinicId || !role) {
    throw new Error('createInitialClinicRole: userId, clinicId, and role are required');
  }
  if (!CLINIC_ROLES.includes(role)) {
    throw new Error(`createInitialClinicRole: invalid role "${role}". Allowed: ${CLINIC_ROLES.join(', ')}`);
  }

  const existing = await getClinicRole(svc, userId, clinicId);
  if (existing) {
    return { assignment: existing, created: false };
  }

  const now = new Date().toISOString();
  const created = await svc.entities.ClinicRoleAssignment.create({
    user_id: userId,
    clinic_id: clinicId,
    role,
    assigned_by_id: assignedById,
    assigned_at: now,
  });
  return { assignment: created, created: true };
}
