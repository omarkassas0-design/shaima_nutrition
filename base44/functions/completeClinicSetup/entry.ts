/**
 * Complete the mandatory one-time clinic setup.
 *
 * Called exclusively by clinic_admin users (NOT doctors, receptionists, or
 * super admins) to fill in the required clinic information and mark setup as
 * completed. Once setup_completed is true, the frontend guard never shows
 * the setup form again — this persists across refresh, logout/login, and
 * device changes because the flag lives on the Clinic record (server-side).
 *
 * SECURITY:
 * - Uses getAuthenticatedClinicUser to resolve the clinic_id from the
 *   authoritative ClinicRoleAssignment (never from the tamperable User record).
 * - Only clinic_admin role is allowed (explicitly NOT doctor/receptionist).
 * - Super admins managing a clinic are also excluded — they use the normal
 *   Settings page, not this mandatory flow.
 * - Validates ALL required fields before writing, then atomically sets
 *   setup_completed: true in the same update.
 */
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';

export default async function(req) {
  try {
    const { error, base44, clinicId, authoritativeRole, clinic } = await getAuthenticatedClinicUser(req);
    if (error) return error;

    // ONLY clinic_admin can complete the mandatory setup.
    // Super admins, doctors, and receptionists are explicitly excluded.
    if (authoritativeRole !== 'clinic_admin') {
      return Response.json(
        { error: 'Only clinic administrators can complete clinic setup' },
        { status: 403 }
      );
    }

    if (!clinicId) {
      return Response.json({ error: 'No clinic linked to this account' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      name_ar,
      phone,
      address,
      country,
      city,
      currency,
      language,
    } = body;

    // Validate ALL required fields — this is the server-side enforcement.
    const missing = [];
    if (!name || !name.trim()) missing.push('name');
    if (!phone || !phone.trim()) missing.push('phone');
    if (!address || !address.trim()) missing.push('address');
    if (!country || !country.trim()) missing.push('country');
    if (!city || !city.trim()) missing.push('city');
    if (!currency) missing.push('currency');
    if (!language) missing.push('language');

    if (missing.length > 0) {
      return Response.json(
        { error: 'Missing required fields', missing },
        { status: 400 }
      );
    }

    // Validate enum values
    const validCurrencies = ['USD', 'SYP', 'TRY', 'EUR'];
    const validLanguages = ['en', 'ar', 'tr'];
    if (!validCurrencies.includes(currency)) {
      return Response.json({ error: 'Invalid currency' }, { status: 400 });
    }
    if (!validLanguages.includes(language)) {
      return Response.json({ error: 'Invalid language' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Atomically update all fields AND mark setup as completed.
    const updated = await svc.entities.Clinic.update(clinicId, {
      name: name.trim(),
      name_ar: name_ar || '',
      phone: phone.trim(),
      address: address.trim(),
      country: country.trim(),
      city: city.trim(),
      currency,
      language,
      setup_completed: true,
    });

    return Response.json({
      success: true,
      clinic: updated,
    });
  } catch (error) {
    return Response.json(
      { error: 'Failed to complete clinic setup: ' + (error?.message || 'Unknown') },
      { status: 500 }
    );
  }
}