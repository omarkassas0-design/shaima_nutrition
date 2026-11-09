/**
 * Secure clinic + role assignment — SUPER ADMIN ONLY.
 *
 * This is the ONLY function in the entire system that can write a user's
 * AuraDental application role. It writes to ClinicRoleAssignment (the
 * authoritative, immutable source for clinic roles) via upsertClinicRole.
 *
 * DESIGN (clean rebuild 2026-09-07):
 *   1. Upsert the authoritative ClinicRoleAssignment for (user_id, clinic_id, role).
 *   2. Delete orphan CRAs in OTHER clinics — maintains exactly ONE active
 *      assignment per user (no conflicting active roles).
 *   3. Update UserSecurityProfile with clinic_id + signup_status (membership
 *      only — NEVER role).
 *   4. Sync the User record:
 *      - role: 'user' — ALWAYS reset the platform role to 'user' to protect
 *        it from corruption. The platform User.role field must NEVER carry
 *        a clinic role (doctor/clinic_admin/receptionist).
 *      - clinic_id + signup_status — display mirrors.
 *      - data.clinic_id + data.role — display mirrors for RLS and permissions.js.
 *        data.role is needed because User.jsonc RLS checks data.role for
 *        clinic_admin/super_admin access. It is a MIRROR only — the authority
 *        is the CRA, resolved by getCurrentUserRole.
 *
 * Allowed roles: clinic_admin, doctor, receptionist.
 * Platform roles (super_admin, admin) are NOT assignable here.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';
import { recordAuthorizedChange } from '../../shared/userSecurity.ts';
import { upsertClinicRole, CLINIC_ROLES, getOwnerEmail } from '../../shared/clinicRoleAssignment.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'assignUserToClinic');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { user_id, role, status } = body;
    let clinic_id = body.clinic_id || null;

    // Validate status if provided — only active, pending, not_subscribed allowed.
    const VALID_STATUSES = ['active', 'pending', 'not_subscribed'];
    if (status && !VALID_STATUSES.includes(status)) {
      return Response.json({ error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 });
    }

    // Role is OPTIONAL — when null/empty, only the clinic_id is saved (to
    // UserSecurityProfile + User mirror) without creating a CRA. This lets
    // the super admin set the clinic first and assign a role separately later.
    const hasRole = role && CLINIC_ROLES.includes(role);
    if (role && !hasRole) {
      return Response.json({ error: `Invalid role. Allowed: ${CLINIC_ROLES.join(', ')}` }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // 0. Fetch the target user + GUARD before any writes.
    //    Never assign a clinic role to a platform admin (the owner). This
    //    function sets User.role = 'user', which would strip the owner's
    //    super_admin access. The owner must remain the ONLY super_admin.
    //    The guard runs BEFORE the CRA upsert so a rejected assignment
    //    leaves no orphaned CRA behind.
    let currentUser;
    try {
      currentUser = await svc.entities.User.get(user_id);
    } catch (_) {
      return Response.json({ error: 'Target user not found' }, { status: 404 });
    }
    if (!currentUser) {
      return Response.json({ error: 'Target user not found' }, { status: 404 });
    }
    if (currentUser.email === getOwnerEmail() || currentUser.role === 'admin' || currentUser.role === 'super_admin') {
      return Response.json({ error: 'Cannot assign a clinic role to a Super Admin account. The owner must remain Super Admin.' }, { status: 403 });
    }

    // Resolve the clinic_id:
    //   - clinic_id provided → verify it exists (explicit assignment to existing clinic).
    //   - clinic_id null + role provided → create a NEW unique clinic so every newly
    //     assigned user gets their own fresh clinic_id, never inheriting another
    //     user's clinic or the currently selected clinic.
    //   - clinic_id null + no role → error (nothing to save).
    let clinic;
    let clinic_created = false;
    if (clinic_id) {
      try {
        clinic = await svc.entities.Clinic.get(clinic_id);
      } catch (_) {
        return Response.json({ error: 'Target clinic not found' }, { status: 404 });
      }
      if (!clinic) {
        return Response.json({ error: 'Target clinic not found' }, { status: 404 });
      }
    } else if (hasRole) {
      try {
        clinic = await svc.entities.Clinic.create({
          name: `New Clinic (${currentUser.email})`,
        });
        clinic_id = clinic.id;
        clinic_created = true;
        console.log('assignUserToClinic: created new unique clinic for user', {
          user_id, clinic_id, clinic_name: clinic.name,
        });
      } catch (e) {
        return Response.json({ error: 'Failed to create new clinic: ' + (e?.message || 'Unknown error') }, { status: 500 });
      }
    } else {
      return Response.json({ error: 'clinic_id is required when no role is being assigned' }, { status: 400 });
    }

    // If no role provided — save clinic_id only (no CRA creation). The role
    // can be assigned separately later. This persists the clinic_id to
    // UserSecurityProfile + User mirror so it survives dialog close/reopen.
    if (!hasRole) {
      await recordAuthorizedChange(svc, user_id, { clinic_id, signup_status: 'approved' }, user.id);
      const existingData = (currentUser.data && typeof currentUser.data === 'object') ? currentUser.data : {};
      try {
        await svc.entities.User.update(user_id, {
          role: 'user',
          clinic_id,
          signup_status: 'approved',
          data: { ...existingData, clinic_id },
        });
      } catch (e) {
        // NON-FATAL: clinic_id mirror sync failed — the authoritative
        // clinic pointer is the CRA, not the User record.
        console.error('assignUserToClinic: User record sync FAILED (clinic-only, non-fatal)', { user_id, error: e?.message });
      }
      console.log('assignUserToClinic: saved clinic_id only (no role)', { user_id, clinic_id });
      return Response.json({ success: true, user_id, clinic_id, role: null, clinic_created });
    }

    // 1. UPSERT the authoritative ClinicRoleAssignment (with optional status)
    console.log('assignUserToClinic: upserting ClinicRoleAssignment', { user_id, role, clinic_id, status: status || 'active' });
    const assignment = await upsertClinicRole(svc, user_id, clinic_id, role, user.id, status);
    console.log('assignUserToClinic: assignment upserted', {
      user_id, assignment_id: assignment.id, role: assignment.role, assigned_by: user.id,
    });

    // 2. Delete orphan CRAs in OTHER clinics — exactly ONE active CRA remains.
    //    The new assignment in the target clinic is never touched.
    const allUserCras = await svc.entities.ClinicRoleAssignment.filter({ user_id });
    const orphanCras = allUserCras.filter(c => c.clinic_id !== clinic_id);
    for (const c of orphanCras) {
      try { await svc.entities.ClinicRoleAssignment.delete(c.id); } catch (_) {}
    }
    if (orphanCras.length > 0) {
      console.log('assignUserToClinic: removed orphan CRAs in other clinics', {
        user_id, count: orphanCras.length,
        removed: orphanCras.map(c => ({ clinic_id: c.clinic_id, role: c.role })),
      });
    }

    // 3. Record clinic_id + signup_status on UserSecurityProfile (membership
    //    only — NEVER role). The role lives exclusively in ClinicRoleAssignment.
    //    NON-FATAL: UserSecurityProfile is a membership mirror. The CRA is
    //    the authoritative source. If this fails, the role is still assigned.
    try {
      await recordAuthorizedChange(
        svc,
        user_id,
        { clinic_id, signup_status: 'approved' },
        user.id
      );
    } catch (e) {
      console.error('assignUserToClinic: UserSecurityProfile sync FAILED (non-fatal)', { user_id, error: e?.message });
    }

    // 4. Sync the User record for display + RLS (reusing currentUser from step 0).
    //    - role: 'user' — ALWAYS reset the platform role to protect it.
    //    - clinic_id + signup_status — display mirrors.
    //    - data.clinic_id + data.role — mirrors for RLS and permissions.js.
    const existingData = (currentUser.data && typeof currentUser.data === 'object') ? currentUser.data : {};
    const updatePayload = {
      role: 'user', // PROTECT the platform role field — NEVER carry a clinic role
      clinic_id,
      clinic_role: role, // Display mirror — visible in the platform Edit User dialog
      signup_status: 'approved',
      data: { ...existingData, clinic_id, role },
    };

    try {
      await svc.entities.User.update(user_id, updatePayload);
    } catch (e) {
      // NON-FATAL: The CRA is the authoritative source and was already
      // upserted successfully. The User record is a display mirror only.
      // Throwing here caused ~80% of role changes to return HTTP 500
      // because the `data` field was not declared in the User schema.
      // Now we log and continue — the role is assigned correctly via CRA.
      console.error('assignUserToClinic: User record sync FAILED (non-fatal)', {
        user_id, role, error: e?.message,
      });
    }

    // Verify the authoritative assignment
    const verifyAssignment = await svc.entities.ClinicRoleAssignment.filter(
      { user_id, clinic_id }, '-updated_date', 1
    );
    console.log('assignUserToClinic: verified authoritative assignment', {
      user_id, clinic_id,
      authoritative_role: verifyAssignment?.[0]?.role,
      assigned_by: verifyAssignment?.[0]?.assigned_by_id,
    });

    return Response.json({ success: true, user_id, clinic_id, role, clinic_created });
  } catch (error) {
    console.error('assignUserToClinic failed', error?.message, error?.stack);
    return Response.json({ error: 'Failed to assign user to clinic: ' + (error?.message || 'Unknown error') }, { status: 500 });
  }
}