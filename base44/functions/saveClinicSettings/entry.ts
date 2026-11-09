/**
 * Save clinic settings — handles both create (new clinic) and update (existing clinic).
 *
 * - If clinic_id is provided (or user already has one): UPDATE the existing clinic.
 * - If no clinic exists: CREATE a new clinic and link it to the current user.
 * - Super admins can override clinic_id to manage a specific clinic.
 *
 * Uses asServiceRole to bypass RLS, ensuring the save always persists.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { recordAuthorizedChange } from '../../shared/userSecurity.ts';
import { resolveRole, getActiveClinicRole } from '../../shared/clinicRoleAssignment.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limit: prevent rapid settings changes
    const rateLimitResponse = enforceRateLimit(user.id, 'saveClinicSettings');
    if (rateLimitResponse) return rateLimitResponse;

    // Use authoritative role from UserSecurityProfile
    const userRole = await resolveRole(base44.asServiceRole, user);

    const body = await req.json();
    const {
      clinic_id,
      name,
      name_ar,
      address,
      phone,
      email,
      country,
      city,
      whatsapp_number,
      currency,
      language,
      reminder_before,
      logo_url,
    } = body;

    if (!name || !name.trim()) {
      return Response.json({ error: 'Clinic name is required' }, { status: 400 });
    }

    // Only clinic administrators and super admins can manage clinic settings.
    if (!['super_admin', 'admin', 'clinic_admin'].includes(userRole)) {
      return Response.json({ error: 'Forbidden — only clinic administrators can manage clinic settings' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    // Determine target clinic ID — SECURITY: for clinic-role users (admin,
    // clinic_admin, doctor, receptionist), clinic_id is derived from the
    // AUTHORITATIVE ClinicRoleAssignment (CRA), NEVER from the tamperable User
    // record (user.clinic_id / user.data.clinic_id). A clinic_admin could
    // update their own User record to set clinic_id to another clinic's ID,
    // then call this function to modify that clinic's settings via
    // asServiceRole (bypassing RLS). The CRA is the single source of truth
    // and can only be written by the super_admin-only assignUserToClinic
    // function, so it cannot be tampered with.
    // A client-supplied clinic_id is only honored for super_admin
    // (managed-clinic mode). If no CRA exists, this is the initial clinic
    // setup flow (create new clinic).
    const activeCra = await getActiveClinicRole(svc, user.id);

    // SERVER-SIDE ACCOUNT STATUS ENFORCEMENT — same boundary as
    // getAuthenticatedClinicUser: a suspended ('pending') or trial-ended
    // ('not_subscribed') clinic user is blocked from every protected API, so
    // they must not be able to change clinic settings either.
    if (activeCra && (activeCra.status === 'pending' || activeCra.status === 'not_subscribed')) {
      return Response.json({ error: 'Account suspended — contact your administrator' }, { status: 403 });
    }

    let targetClinicId;
    if (userRole === 'super_admin' && clinic_id) {
      // Super admin managed-clinic mode — explicit override
      targetClinicId = clinic_id;
    } else if (activeCra) {
      // Clinic role user (or super_admin with a CRA) — authoritative clinic_id
      targetClinicId = activeCra.clinic_id;
    } else if (userRole === 'super_admin') {
      // Super admin without a CRA — use their User record's clinic_id
      // (system-set on clinic creation; super_admin is a trusted platform
      // role that can already manage any clinic via the override above)
      targetClinicId = user.clinic_id || user.data?.clinic_id || null;
    } else {
      // No CRA and not super_admin — initial clinic setup (create new clinic)
      targetClinicId = null;
    }

    const clinicData = {
      name: name.trim(),
      name_ar: name_ar || '',
      address: address || '',
      phone: phone || '',
      email: email || '',
      country: country || '',
      city: city || '',
      whatsapp_number: whatsapp_number || '',
      currency: currency || 'USD',
      logo_url: logo_url || '',
    };
    // Only include language/reminder_before if explicitly provided (preserves existing values on update)
    if (language !== undefined) clinicData.language = language;
    if (reminder_before !== undefined) clinicData.reminder_before = reminder_before;

    let clinic;
    let created = false;

    if (targetClinicId) {
      // --- UPDATE existing clinic ---
      try {
        clinic = await svc.entities.Clinic.update(targetClinicId, clinicData);
      } catch (e) {
        return Response.json({ error: 'Failed to update clinic: ' + (e?.message || 'Unknown') }, { status: 500 });
      }
    } else {
      // --- CREATE new clinic + link to user ---
      try {
        clinic = await svc.entities.Clinic.create(clinicData);
        created = true;
      } catch (e) {
        return Response.json({ error: 'Failed to create clinic: ' + (e?.message || 'Unknown') }, { status: 500 });
      }

      // Record the AUTHORIZED change FIRST so the integrity reconciler accepts
      // the new clinic_id. Without this, the reconciler sees a mismatch between
      // the User record (clinic_id set) and the profile (still null) and reverts
      // the clinic_id to null on the next sweep — unlinking the user.
      try {
        await recordAuthorizedChange(svc, user.id, {
          clinic_id: clinic.id,
          role: userRole,
          signup_status: 'approved',
        }, user.id);
      } catch (e) {
        try { await svc.entities.Clinic.delete(clinic.id); } catch (_) {}
        return Response.json({ error: 'Failed to authorize clinic assignment: ' + (e?.message || 'Unknown') }, { status: 500 });
      }

      const existingData = (user.data && typeof user.data === 'object') ? user.data : {};
      try {
        await svc.entities.User.update(user.id, {
          clinic_id: clinic.id,
          signup_status: 'approved',
          data: { ...existingData, clinic_id: clinic.id, role: userRole },
        });
      } catch (e) {
        // Rollback: delete the orphaned clinic
        try { await svc.entities.Clinic.delete(clinic.id); } catch (_) {}
        return Response.json({ error: 'Failed to link clinic to your account: ' + (e?.message || 'Unknown') }, { status: 500 });
      }
    }

    return Response.json({
      success: true,
      created,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        name_ar: clinic.name_ar,
        address: clinic.address,
        phone: clinic.phone,
        email: clinic.email,
        country: clinic.country,
        city: clinic.city,
        whatsapp_number: clinic.whatsapp_number,
        currency: clinic.currency,
        language: clinic.language,
        reminder_before: clinic.reminder_before,
        logo_url: clinic.logo_url,
        setup_completed: clinic.setup_completed,
      },
    });
  } catch (error) {
    return Response.json({ error: 'Failed to save clinic settings: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}