/**
 * One-time owner-role normalization — OWNER / SYSTEM ONLY.
 *
 * This function enforces the EXPLICIT owner rule: exactly ONE super_admin,
 * identified by email (OWNER_EMAIL env var). Every other account is
 * normalized to User.role = 'user' regardless of any legacy 'admin' or
 * 'super_admin' value.
 *
 * It also optionally assigns clinic roles (via the same upsertClinicRole
 * used by assignUserToClinic) for users that need a clinic role after
 * normalization.
 *
 * Authentication:
 *   - System call (test tool, workflow) via verifySystemCall.
 *   - Manual call by the owner (email matches OWNER_EMAIL env var).
 *   - Any other authenticated user → 403.
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { verifySystemCall } from '../../shared/systemAuth.ts';
import { getOwnerEmail, upsertClinicRole, CLINIC_ROLES } from '../../shared/clinicRoleAssignment.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, user, error, body } = await verifySystemCall(req, base44);
    if (!authorized) return error;

    // If a user is calling (not system), they must be the owner
    if (user && user.email !== getOwnerEmail(base44.asServiceRole)) {
      return Response.json({ error: 'Forbidden — owner only' }, { status: 403 });
    }

    // System calls (no user session) MUST provide the shared secret.
    // This prevents privilege escalation via spoofed service-authorization
    // headers: normalizeOwnerRoles can create ClinicRoleAssignments with
    // attacker-controlled user_id/clinic_id/role, so the header alone is
    // insufficient trust. The owner calling manually is identified by their
    // user session (checked above) and does not need the secret.
    if (!user) {
      const expectedSecret = base44.env.BACKUP_WORKFLOW_SECRET;
      if (!expectedSecret || body.system_secret !== expectedSecret) {
        return Response.json({ error: 'Forbidden — system secret required' }, { status: 403 });
      }
    }

    const svc = base44.asServiceRole;

    // ── 1. Normalize all non-owner users ──────────────────────────────
    const users = await svc.entities.User.list('-created_date', 500);
    const normalized = [];
    const ownerRecord = [];
    const alreadyClean = [];

    for (const u of users) {
      // Never touch the owner
      if (u.email === getOwnerEmail(svc)) {
        ownerRecord.push({ email: u.email, role: u.role });
        continue;
      }
      // Normalize legacy 'admin' / 'super_admin' → 'user'
      if (u.role === 'admin' || u.role === 'super_admin') {
        const existingData = (u.data && typeof u.data === 'object') ? u.data : {};
        // Clear data.role if it was 'super_admin' (stale mirror). Keep clinic
        // roles — they'll be overwritten by the assignment step if needed.
        const newDataRole = existingData.role === 'super_admin' ? null : existingData.role;
        await svc.entities.User.update(u.id, {
          role: 'user',
          data: { ...existingData, role: newDataRole },
        });
        normalized.push({ email: u.email, old_role: u.role, new_role: 'user' });
      } else {
        alreadyClean.push({ email: u.email, role: u.role });
      }
    }

    // ── 2. Clean up orphan CRAs (pointing to deleted users) ───────────
    const allCras = await svc.entities.ClinicRoleAssignment.list('-updated_date', 500);
    const userIds = new Set(users.map((u) => u.id));
    const orphanCras = allCras.filter((c) => !userIds.has(c.user_id));
    for (const c of orphanCras) {
      try { await svc.entities.ClinicRoleAssignment.delete(c.id); } catch (_) {}
    }

    // ── 3. Sync clinic_role display mirror for ALL users ──────────────
    const craByUserId = new Map();
    for (const c of allCras) {
      if (!craByUserId.has(c.user_id)) craByUserId.set(c.user_id, c);
    }
    const syncedMirrors = [];
    for (const u of users) {
      if (u.email === getOwnerEmail(svc)) continue;
      const cra = craByUserId.get(u.id);
      const expectedRole = cra ? cra.role : null;
      if (u.clinic_role !== expectedRole || u.clinic_id !== (cra?.clinic_id ?? u.clinic_id)) {
        const existingData = (u.data && typeof u.data === 'object') ? u.data : {};
        await svc.entities.User.update(u.id, {
          clinic_role: expectedRole || undefined,
          clinic_id: cra?.clinic_id || u.clinic_id,
          data: { ...existingData, clinic_id: cra?.clinic_id ?? existingData.clinic_id, role: expectedRole || existingData.role },
        });
        syncedMirrors.push({ email: u.email, clinic_role: expectedRole });
      }
    }

    // ── 4. Optional clinic-role assignments ──────────────────────────
    const assignments = body.assignments || [];
    const assignmentResults = [];
    for (const a of assignments) {
      if (!a.user_id || !a.clinic_id || !a.role || !CLINIC_ROLES.includes(a.role)) {
        assignmentResults.push({ user_id: a.user_id, error: 'invalid assignment params' });
        continue;
      }
      // Never assign a clinic role to the owner
      const targetUser = users.find((u) => u.id === a.user_id);
      if (targetUser && targetUser.email === getOwnerEmail(svc)) {
        assignmentResults.push({ user_id: a.user_id, error: 'cannot assign to owner' });
        continue;
      }
      // Upsert the authoritative CRA
      const assignment = await upsertClinicRole(svc, a.user_id, a.clinic_id, a.role, 'system');

      // Delete orphan CRAs in OTHER clinics — exactly ONE active CRA remains
      const allUserCras = await svc.entities.ClinicRoleAssignment.filter({ user_id: a.user_id });
      const orphanCras = allUserCras.filter((c) => c.clinic_id !== a.clinic_id);
      for (const c of orphanCras) {
        try { await svc.entities.ClinicRoleAssignment.delete(c.id); } catch (_) {}
      }

      // Sync the User record (display + RLS mirror)
      if (targetUser) {
        const existingData = (targetUser.data && typeof targetUser.data === 'object') ? targetUser.data : {};
        await svc.entities.User.update(a.user_id, {
          role: 'user',
          clinic_id: a.clinic_id,
          clinic_role: a.role,
          signup_status: 'approved',
          data: { ...existingData, clinic_id: a.clinic_id, role: a.role },
        });
      }

      assignmentResults.push({
        user_id: a.user_id, clinic_id: a.clinic_id, role: a.role,
        cra_id: assignment.id, success: true,
      });
    }

    return Response.json({
      owner: ownerRecord,
      normalized,
      already_clean: alreadyClean,
      synced_mirrors: syncedMirrors.length,
      assignments: assignmentResults,
    });
  } catch (error) {
    return Response.json(
      { error: 'Failed to normalize roles: ' + (error?.message || 'Unknown') },
      { status: 500 }
    );
  }
}
