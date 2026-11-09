/**
 * Link an EXISTING user account (already holding a doctor ClinicRoleAssignment
 * in this clinic) to a new Doctor profile — without creating a new User account
 * or duplicating a Doctor profile.
 *
 * SECURITY MODEL:
 *   - Caller must be clinic_admin (or super_admin in managed-clinic mode).
 *   - clinic_id is ALWAYS derived server-side from the caller's active CRA
 *     (or the super_admin override). It is NEVER read from the client.
 *   - The target user MUST have an active doctor CRA in the SAME clinic —
 *     verified server-side. A user from another clinic can never be linked.
 *   - Duplicate Doctor profiles (same user_id + clinic_id) are prevented.
 *
 * Actions:
 *   'list'  → returns eligible doctor-role users in this clinic who don't yet
 *            have a Doctor profile.
 *   'link'  → creates a Doctor profile linked to the given user_id.
 *
 * Body:
 *   action: 'list' | 'link'
 *   clinic_id?: string (super_admin override only — ignored for clinic_admin)
 *   user_id?: string (for 'link')
 *   doctor_data?: { name?, specialty?, phone?, calendar_color?, schedule?, commission_percentage_doctor?, commission_percentage_clinic? }
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { recordAudit } from '../../shared/auditLog.ts';

const ADMIN_ROLES = ['super_admin', 'admin', 'clinic_admin'];

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, clinic_id, user_id, doctor_data } = body;

    if (!action || !['list', 'link'].includes(action)) {
      return Response.json({ error: 'action must be "list" or "link"' }, { status: 400 });
    }

    // Authoritative clinic + role. clinic_id from client is ONLY honored for super_admin.
    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req, clinic_id);
    if (error) return error;

    if (!ADMIN_ROLES.includes(authoritativeRole)) {
      return Response.json({ error: 'Forbidden — clinic admin access required' }, { status: 403 });
    }

    const rl = enforceRateLimit(user.id, 'linkExistingDoctor');
    if (rl) return rl;

    const svc = base44.asServiceRole;

    // --- LIST: eligible doctor-role users in this clinic without a Doctor profile ---
    if (action === 'list') {
      // Find all CRAs with role='doctor' in this clinic (authoritative clinic match).
      const doctorCras = await svc.entities.ClinicRoleAssignment.filter(
        { role: 'doctor', clinic_id: clinicId }, '-updated_date', 500
      );

      if (!doctorCras || doctorCras.length === 0) {
        return Response.json({ eligible: [] });
      }

      // Fetch existing Doctor profiles in this clinic to exclude already-linked users.
      const existingDoctors = await svc.entities.Doctor.filter(
        { clinic_id: clinicId }, null, 1000
      );
      const linkedUserIds = new Set((existingDoctors || []).map(d => d.user_id).filter(Boolean));

      // Fetch User records for the candidate users.
      const candidateIds = doctorCras.map(c => c.user_id).filter(Boolean);
      const allUsers = await svc.entities.User.list('-created_date', 500);
      const userMap = new Map((allUsers || []).map(u => [u.id, u]));

      const eligible = candidateIds
        .filter(uid => !linkedUserIds.has(uid))
        .map(uid => {
          const u = userMap.get(uid);
          if (!u) return null;
          return {
            user_id: uid,
            full_name: u.full_name || '',
            email: u.email || '',
          };
        })
        .filter(Boolean);

      return Response.json({ eligible });
    }

    // --- LINK: create a Doctor profile for an existing user ---
    if (action === 'link') {
      if (!user_id) {
        return Response.json({ error: 'user_id is required' }, { status: 400 });
      }

      // Verify the target user has an active doctor CRA in THIS clinic.
      // This is the server-side clinic-match enforcement — a user from another
      // clinic can never be linked, regardless of what the client sends.
      const cra = await svc.entities.ClinicRoleAssignment.filter(
        { user_id, role: 'doctor', clinic_id: clinicId }, '-updated_date', 1
      );
      if (!cra || cra.length === 0) {
        return Response.json({ error: 'User is not a doctor in this clinic' }, { status: 400 });
      }

      // Prevent duplicate Doctor profile for the same user_id + clinic_id.
      const existing = await svc.entities.Doctor.filter(
        { user_id, clinic_id: clinicId }, null, 1
      );
      if (existing && existing.length > 0) {
        return Response.json({ error: 'Doctor profile already exists for this user', doctor: existing[0] }, { status: 409 });
      }

      // Fetch the target user record for the default name.
      const allUsers = await svc.entities.User.list('-created_date', 500);
      const targetUser = (allUsers || []).find(u => u.id === user_id);

      const dd = doctor_data || {};
      // Validate commission percentages server-side (0-100). Never trust client values.
      const pctDoctor = Math.max(0, Math.min(100, Number(dd.commission_percentage_doctor) || 0));
      const pctClinic = Math.max(0, Math.min(100, Number(dd.commission_percentage_clinic) || 0));
      const doctorRecord = {
        clinic_id: clinicId,
        user_id,
        name: (dd.name || '').trim() || targetUser?.full_name || targetUser?.email || 'Doctor',
        specialty: dd.specialty || '',
        phone: dd.phone || '',
        calendar_color: dd.calendar_color || '#0ea5e9',
        commission_percentage: 0,
        commission_percentage_doctor: pctDoctor,
        commission_percentage_clinic: pctClinic,
        monthly_salary: 0,
        salary_currency: 'USD',
        schedule: dd.schedule || {
          working_days: ['mon','tue','wed','thu','fri'],
          start_hour: '09:00', end_hour: '17:00',
          break_start: '13:00', break_end: '14:00',
        },
      };

      const created = await svc.entities.Doctor.create(doctorRecord);
      await recordAudit(svc, clinicId, user, 'create', 'Doctor', created.id, `link Doctor: ${created.name}`);

      return Response.json({ doctor: created });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: 'Failed: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}