/**
 * Super Admin — Create a new clinic + invite/link the clinic owner in one transaction.
 *
 * Steps:
 *   1. Create the Clinic record.
 *   2. Invite the owner user (or find existing by email).
 *   3. Assign the owner to the new clinic_id with role "clinic_admin".
 *
 * If any step fails, previous steps are rolled back so no partial
 * clinic or orphaned user is left behind.
 *
 * Super_admin only. Clinic_admin / doctor / receptionist / assistant → 403.
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';
import { recordAuthorizedChange } from '../../shared/userSecurity.ts';
import { createInitialClinicRole, upsertClinicRole } from '../../shared/clinicRoleAssignment.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'createNewClinic');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const {
      clinic_name,
      clinic_name_ar,
      owner_email,
      phone,
      address,
      currency,
      language,
      existing_clinic_id,
    } = body;

    // --- Validation ---
    if (!owner_email || !owner_email.trim()) {
      return Response.json({ error: 'Owner email is required' }, { status: 400 });
    }
    if (!existing_clinic_id && (!clinic_name || !clinic_name.trim())) {
      return Response.json({ error: 'Clinic name is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const email = owner_email.trim().toLowerCase();

    // --- Step 1: Create a new clinic OR use an existing one ---
    let clinic;
    if (existing_clinic_id) {
      // Use an existing clinic — assign the owner to it
      try {
        clinic = await svc.entities.Clinic.get(existing_clinic_id);
      } catch (_) {
        return Response.json({ error: 'Selected clinic not found' }, { status: 404 });
      }
      if (!clinic) {
        return Response.json({ error: 'Selected clinic not found' }, { status: 404 });
      }
    } else {
      try {
        clinic = await svc.entities.Clinic.create({
          name: clinic_name.trim(),
          name_ar: clinic_name_ar || '',
          phone: phone || '',
          address: address || '',
          currency: currency || 'USD',
          language: language || 'en',
        });
      } catch (e) {
        return Response.json({ error: 'Failed to create clinic: ' + (e?.message || 'Unknown error') }, { status: 500 });
      }
    }

    // --- Step 2: Find existing user OR invite a new one ---
    let ownerUser = null;

    // Try to find an existing user by email
    try {
      const existing = await svc.entities.User.filter({ email });
      if (existing && existing.length > 0) {
        ownerUser = existing[0];
      }
    } catch (_) {
      // Ignore — fall through to invite
    }

    if (!ownerUser) {
      try {
        // Invite as platform 'user'. The clinic role (clinic_admin) is
        // assigned via ClinicRoleAssignment — NEVER via the platform role.
        // Inviting as 'admin' would grant super_admin via resolveRole.
        await base44.users.inviteUser(email, 'user');
      } catch (e) {
        // Rollback: delete the clinic we just created (only for new clinics)
        if (!existing_clinic_id) { try { await svc.entities.Clinic.delete(clinic.id); } catch (_) {} }
        return Response.json({ error: 'Failed to invite owner: ' + (e?.message || 'Unknown error') }, { status: 500 });
      }

      // inviteUser doesn't return a usable user object — re-query by email.
      try {
        const users = await svc.entities.User.filter({ email });
        if (users && users.length > 0) {
          ownerUser = users[0];
        }
      } catch (_) {}
    }

    // --- Step 3: Assign owner to the new clinic + ensure role ---
    // If the owner user entity exists, assign it to the clinic.
    // If it doesn't exist yet (invitation pending), the clinic is still valid —
    // the owner can be assigned later via assignUserToClinic after accepting.
    if (ownerUser) {
      // 3a. Create/upsert the ClinicRoleAssignment — sole source of truth.
      //     For a new clinic: createInitialClinicRole (fails if exists, protecting new clinics).
      //     For an existing clinic: upsertClinicRole (handles owners who may already have a role).
      try {
        if (existing_clinic_id) {
          await upsertClinicRole(svc, ownerUser.id, clinic.id, 'clinic_admin', user.id);
        } else {
          await createInitialClinicRole(svc, ownerUser.id, clinic.id, 'clinic_admin', user.id);
        }
      } catch (e) {
        if (!existing_clinic_id) { try { await svc.entities.Clinic.delete(clinic.id); } catch (_) {} }
        return Response.json({ error: 'Failed to assign owner clinic role: ' + (e?.message || 'Unknown') }, { status: 500 });
      }

      // 3b. Record clinic_id + signup_status on UserSecurityProfile (NOT role).
      try {
        await recordAuthorizedChange(
          svc,
          ownerUser.id,
          { clinic_id: clinic.id, signup_status: 'approved' },
          user.id
        );
      } catch (e) {
        if (!existing_clinic_id) { try { await svc.entities.Clinic.delete(clinic.id); } catch (_) {} }
        return Response.json({ error: 'Failed to authorize owner assignment: ' + (e?.message || 'Unknown') }, { status: 500 });
      }

      // 3c. Sync the User record for display.
      const existingOwnerData = (ownerUser.data && typeof ownerUser.data === 'object') ? ownerUser.data : {};
      try {
        await svc.entities.User.update(ownerUser.id, {
          role: 'user', // PROTECT platform role — never carry a clinic role
          clinic_id: clinic.id,
          clinic_role: 'clinic_admin', // Display mirror
          signup_status: 'approved',
          data: { ...existingOwnerData, clinic_id: clinic.id, role: 'clinic_admin' },
        });
      } catch (e) {
        if (!existing_clinic_id) { try { await svc.entities.Clinic.delete(clinic.id); } catch (_) {} }
        return Response.json({ error: 'Failed to assign owner to clinic: ' + (e?.message || 'Unknown') }, { status: 500 });
      }
    }

    return Response.json({
      success: true,
      clinic: { id: clinic.id, name: clinic.name },
      owner: { id: ownerUser?.id || null, email, assigned: !!ownerUser },
    });
  } catch (error) {
    return Response.json({ error: 'Failed to create clinic: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}