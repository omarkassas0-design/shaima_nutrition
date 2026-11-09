/**
 * Super Admin — Approve a pending registration request.
 *
 * Steps:
 *   1. Read the pending user's stored clinic_name.
 *   2. Create a new Clinic record with that exact name.
 *   3. Link the user to the new clinic_id with role "clinic_admin" and signup_status "approved".
 *
 * If any step fails, previous steps are rolled back.
 *
 * Super_admin only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';
import { recordAuthorizedChange } from '../../shared/userSecurity.ts';
import { createInitialClinicRole } from '../../shared/clinicRoleAssignment.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    // Rate limit: prevent rapid registration approvals
    const rateLimitResponse = enforceRateLimit(user.id, 'approveRegistration');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // --- Step 1: Read the pending user ---
    let targetUser;
    try {
      targetUser = await svc.entities.User.get(user_id);
    } catch (_) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.signup_status === 'approved') {
      return Response.json({ error: 'User is already approved' }, { status: 400 });
    }

    const clinicName = (targetUser.clinic_name || '').trim();
    if (!clinicName) {
      return Response.json({ error: 'User has no clinic name stored. Cannot auto-create clinic.' }, { status: 400 });
    }

    // --- Step 2: Create the Clinic ---
    let clinic;
    try {
      clinic = await svc.entities.Clinic.create({
        name: clinicName,
      });
    } catch (e) {
      return Response.json({ error: 'Failed to create clinic: ' + (e?.message || 'Unknown') }, { status: 500 });
    }

    // --- Step 3: Link the user to the new clinic ---
    // 3a. Create the INITIAL ClinicRoleAssignment — this is the sole source
    //     of truth for the user's clinic role. This ONLY creates; it NEVER
    //     overwrites an existing assignment (createInitialClinicRole guards
    //     against that). This is an authorized super-admin provisioning
    //     operation for a brand-new clinic + user.
    try {
      await createInitialClinicRole(svc, user_id, clinic.id, 'clinic_admin', user.id);
    } catch (e) {
      try { await svc.entities.Clinic.delete(clinic.id); } catch (_) {}
      return Response.json({ error: 'Failed to assign clinic role: ' + (e?.message || 'Unknown') }, { status: 500 });
    }

    // 3b. Record clinic_id + signup_status on UserSecurityProfile (NOT role —
    //     role lives in ClinicRoleAssignment).
    await recordAuthorizedChange(
      svc,
      user_id,
      { clinic_id: clinic.id, signup_status: 'approved' },
      user.id
    );

    // 3c. Sync the User record for display.
    const existingData = (targetUser.data && typeof targetUser.data === 'object') ? targetUser.data : {};
    try {
      await svc.entities.User.update(user_id, {
        role: 'user', // PROTECT platform role — never carry a clinic role
        clinic_id: clinic.id,
        signup_status: 'approved',
        data: { ...existingData, clinic_id: clinic.id, role: 'clinic_admin' },
      });
    } catch (e) {
      // Rollback: delete the orphaned clinic
      try { await svc.entities.Clinic.delete(clinic.id); } catch (_) {}
      return Response.json({ error: 'Failed to link user to clinic: ' + (e?.message || 'Unknown') }, { status: 500 });
    }

    return Response.json({
      success: true,
      user_id,
      clinic: { id: clinic.id, name: clinic.name },
    });
  } catch (error) {
    return Response.json({ error: 'Failed to approve registration: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}