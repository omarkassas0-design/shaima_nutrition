/**
 * Central role + capability resolution.
 *
 * ARCHITECTURE (AuraDental Cloud Role System):
 *
 * ONE source of truth: ClinicRoleAssignment (per user + clinic) for clinic
 * roles, UserSecurityProfile for the platform super_admin role. Resolved
 * by the getCurrentUserRole backend function — the SINGLE role-resolution
 * function. AuthContext stores the result in `effectiveRole` and mirrors
 * it onto `user.data.role` so this module can read it.
 *
 * getRole(user) reads ONLY user.data.role — the mirror of effectiveRole set
 * by AuthContext from getCurrentUserRole. It NEVER falls back to user.role
 * (the Supabase Auth provider role), which is NOT the AuraDental role. If
 * data.role is missing or null, the user has no assigned role (no permissions).
 *
 * The DOCTOR role is strictly READ-ONLY: it holds no general write capabilities.
 * The ONLY exception is Treatment Plans (capability 'treatmentplans:write')
 * and Consent Forms (capability 'consents:write'). This mirrors the entity
 * RLS rules, which are the real enforcement — this module exists so the UI
 * doesn't offer actions the server will reject.
 *
 * System roles (only 4): super_admin, clinic_admin, doctor, receptionist.
 * 'admin' is a compatibility value from the previous platform, treated as equivalent to
 * super_admin so the app owner has full access. It is NOT an AuraDental role
 * and is never assigned via assignUserToClinic.
 * Staff Position (nurse, receptionist, accountant, cleaner, assistant,
 * technician, call_center, other) is completely separate from System Role.
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  CLINIC_ADMIN: 'clinic_admin',
  RECEPTIONIST: 'receptionist',
  DOCTOR: 'doctor',
};

/**
 * Returns the effective role — the single authoritative role resolved by
 * getCurrentUserRole and stored in AuthContext. Reads user.data.role (the
 * mirror of effectiveRole). NEVER falls back to user.role (JWT role).
 */
export function getRole(user) {
  return user?.data?.role || null;
}

// Capabilities per role. '*' means full access.
const CAPABILITIES = {
  super_admin: ['*'],
  admin: ['*'],
  clinic_admin: ['*'],
  receptionist: [
    'patients:write',
    'patients:delete',
    'appointments:write',
    'payments:write',
    'messagetemplates:write',
    'patientfiles:write',
    'patientfiles:delete',
    'reminders:send',
    'invoices:write',
    'consents:write',
    'patientrecall:write',
    'labcases:write',
    'laboratories:write',
    'settings:view',
    'auditlog:view',
  ],
  // Doctor: can create/edit Treatment Plans, update treatment/procedure statuses,
  // create/void Consent Forms, manage Lab Cases, and upload patient files/X-rays.
  // File deletion remains receptionist/admin-only. Everything else is read-only.
  doctor: [
    'treatmentplans:write',
    'consents:write',
    'labcases:write',
    'patientfiles:write',
    'settings:view',
    'auditlog:view',
  ],
};

export function can(user, capability) {
  const role = getRole(user);
  if (!role) return false;
  const caps = CAPABILITIES[role] || [];
  return caps.includes('*') || caps.includes(capability);
}

export const isSuperAdmin = (user) => getRole(user) === ROLES.SUPER_ADMIN;
export const isDoctor = (user) => getRole(user) === ROLES.DOCTOR;
export const isReceptionist = (user) => getRole(user) === ROLES.RECEPTIONIST;
export const isClinicAdmin = (user) => ['super_admin', 'admin', 'clinic_admin'].includes(getRole(user));

/** Only clinic administrators may see clinic-wide financial data. */
export const canViewClinicFinancials = (user) => isClinicAdmin(user);

/**
 * A doctor has no general write capabilities — they cannot create/edit/delete
 * patients, appointments, payments, etc. The ONLY exception is Treatment Plans
 * (capability 'treatmentplans:write'), which is checked separately via can().
 */
export const isReadOnly = (user) => isDoctor(user);

// ===========================================================================
// ROLE-STRING API — effectiveRole as the SINGLE source of truth
// ===========================================================================
// The functions below take a role STRING (effectiveRole from AuthContext)
// rather than a user object. This is the PRIMARY API for the rebuilt role
// system. Every component derives its behavior from effectiveRole via these
// functions — NOT from getRole(user) / user.data.role / user.role / JWT.
// ===========================================================================

/** Capability check from a role string (the new primary API). */
export function canRole(role, capability) {
  if (!role) return false;
  const caps = CAPABILITIES[role] || [];
  return caps.includes('*') || caps.includes(capability);
}

export const roleIsSuperAdmin = (role) => role === 'super_admin' || role === 'admin';
export const roleIsClinicAdmin = (role) => ['super_admin', 'admin', 'clinic_admin'].includes(role);
export const roleIsDoctor = (role) => role === 'doctor';
export const roleIsReceptionist = (role) => role === 'receptionist';
export const roleIsReadOnly = (role) => role === 'doctor';
export const roleCanViewClinicFinancials = (role) => roleIsClinicAdmin(role);

/**
 * Returns the dashboard type for a role: 'doctor' | 'receptionist' | 'clinic' | 'super_admin'.
 * RoleHome uses this to pick the dashboard component from effectiveRole.
 */
export function getDashboardType(role) {
  if (role === 'doctor') return 'doctor';
  if (role === 'receptionist') return 'receptionist';
  if (role === 'super_admin' || role === 'admin') return 'super_admin';
  if (role === 'clinic_admin') return 'clinic';
  return null; // unknown/null role — no dashboard, fail closed
}

/**
 * Accessible route prefixes per role. `null` means all routes accessible.
 * Used by AppLayout's redirect guard to immediately redirect a user away
 * from a page their new role cannot access when a role changes mid-session.
 */
const ACCESSIBLE_PATHS_BY_ROLE = {
  super_admin: null,
  admin: null,
  clinic_admin: null,
  doctor: [
    '/dashboard', '/patients', '/appointments', '/treatments',
    '/laboratories', '/lab-cases', '/audit-log', '/settings', '/support', '/search',
  ],
  receptionist: [
    '/dashboard', '/patients', '/appointments', '/payments', '/invoices',
    '/patient-recall', '/message-templates', '/laboratories', '/lab-cases', '/audit-log', '/settings', '/support', '/search',
  ],
};

export function isPathAccessible(role, pathname) {
  if (!role || !pathname) return false;
  const allowed = ACCESSIBLE_PATHS_BY_ROLE[role];
  if (allowed === null) return true; // all routes accessible
  return allowed.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
}
