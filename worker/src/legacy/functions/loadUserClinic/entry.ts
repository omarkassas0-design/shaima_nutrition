/**
 * Load the calling user's linked clinic.
 *
 * The clinic identity comes from getAuthenticatedClinicUser, which resolves it
 * from the server-only UserSecurityProfile — never from the User record, which
 * the user themselves can write. That helper also repairs a tampered User
 * record on the way through, so this function is the app's first line of
 * defence on every page load.
 *
 * Super admins can pass an override clinic_id to load a managed clinic.
 */
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';

export default async function(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch (_) {}

    const { error, base44, clinicId, authoritativeRole, clinic } = await getAuthenticatedClinicUser(req, body.clinic_id);
    if (error) {
      // No clinic linked yet is a normal state for a fresh account —
      // let the frontend show its setup flow instead of an error.
      if (error.status === 403) return Response.json({ success: true, clinic: null });
      return error;
    }

    // getAuthenticatedClinicUser already fetched and verified the clinic
    // (including the soft-delete check). Return it directly.
    return Response.json({ success: true, clinic });
  } catch (error) {
    return Response.json({ error: 'Failed to load clinic: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}