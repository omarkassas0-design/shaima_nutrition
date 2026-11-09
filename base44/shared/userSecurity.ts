/**
 * Authoritative handling of security-sensitive User MEMBERSHIP fields.
 *
 * ARCHITECTURE (AuraDental Cloud Role System):
 *
 * The AuraDental application role is stored in ClinicRoleAssignment (clinic
 * roles) or identified by the Base44 platform role (super_admin). Role
 * resolution is handled by resolveRole in clinicRoleAssignment.ts — the SINGLE
 * role resolver. This module does NOT resolve or store roles.
 *
 * UserSecurityProfile holds ONLY membership fields:
 *   - clinic_id  (which clinic the user belongs to — membership, not role)
 *   - signup_status (registration/approval state)
 *
 * The role is NEVER stored on or read from UserSecurityProfile. Platform
 * super_admin is identified by the Base44 platform role (User.role), which is
 * set by the platform and cannot be tampered via updateMe.
 *
 * All functions here must be called with a service-role client (svc).
 */

/** Fields a normal user must never be able to change about themselves. */
export const PROTECTED_FIELDS = ['clinic_id', 'signup_status'];

export async function getSecurityProfile(svc, userId) {
  const found = await svc.entities.UserSecurityProfile.filter({ user_id: userId }, '-updated_date', 50);
  if (!found || !found.length) return null;
  if (found.length === 1) return found[0];

  const adminAssigned = found.filter((p) => p.assigned_by_id && p.assigned_by_id !== 'system');
  const candidates = adminAssigned.length > 0 ? adminAssigned : found;
  const chosen = candidates.sort((a, b) =>
    new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)
  )[0];

  for (const p of found) {
    if (p.id !== chosen.id) {
      try { await svc.entities.UserSecurityProfile.delete(p.id); } catch (_) {}
    }
  }
  return chosen;
}

/**
 * Seeds a UserSecurityProfile for a user who doesn't have one yet.
 * Only creates if no profile exists — NEVER overwrites an admin's authorized
 * change. Seeds ONLY clinic_id and signup_status — NEVER role.
 */
export async function seedSecurityProfile(svc, userId, values) {
  const existing = await getSecurityProfile(svc, userId);
  if (existing) return existing;

  const patch = { user_id: userId, assigned_by_id: 'system' };
  if (values.clinic_id !== undefined) patch.clinic_id = values.clinic_id;
  if (values.signup_status !== undefined) patch.signup_status = values.signup_status;
  try {
    return await svc.entities.UserSecurityProfile.create(patch);
  } catch (_) {
    return await getSecurityProfile(svc, userId);
  }
}

/**
 * Records an AUTHORIZED change to a user's clinic_id and signup_status.
 * Only membership fields are written — NEVER role. The role lives exclusively
 * in ClinicRoleAssignment (clinic roles) or the platform User.role (super_admin).
 */
export async function recordAuthorizedChange(svc, userId, values, assignedById) {
  const patch = { user_id: userId, assigned_by_id: assignedById || 'system' };
  if (values.clinic_id !== undefined) patch.clinic_id = values.clinic_id;
  if (values.signup_status !== undefined) patch.signup_status = values.signup_status;

  const existing = await getSecurityProfile(svc, userId);
  if (existing) {
    await svc.entities.UserSecurityProfile.update(existing.id, patch);
    try {
      const all = await svc.entities.UserSecurityProfile.filter({ user_id: userId });
      for (const p of all) {
        if (p.id !== existing.id) {
          try { await svc.entities.UserSecurityProfile.delete(p.id); } catch (_) {}
        }
      }
    } catch (_) {}
    return { ...existing, ...patch };
  }
  return await svc.entities.UserSecurityProfile.create(patch);
}

/**
 * Returns the AUTHORITATIVE clinic_id for a user — from UserSecurityProfile.
 * Never trust user.clinic_id or user.data.clinic_id directly (tamperable).
 */
export async function getAuthoritativeClinicId(svc, userId, userRecord?) {
  const profile = await getSecurityProfile(svc, userId);
  if (profile && profile.clinic_id) {
    return profile.clinic_id;
  }
  if (userRecord) {
    return userRecord.clinic_id || userRecord.data?.clinic_id || null;
  }
  return null;
}