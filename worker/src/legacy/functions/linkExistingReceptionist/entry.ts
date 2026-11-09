/**
 * Link an EXISTING user account (already holding a receptionist
 * ClinicRoleAssignment in this clinic) to a new Staff record — without
 * creating a new User account or duplicating a Staff profile.
 *
 * Mirrors linkExistingDoctor exactly:
 *   - Caller must be clinic_admin (or super_admin in managed-clinic mode).
 *   - clinic_id is ALWAYS derived server-side from the caller's active CRA
 *     (or the super_admin override). It is NEVER read from the client.
 *   - The target user MUST have an active receptionist CRA in the SAME clinic —
 *     verified server-side. A user from another clinic can never be linked.
 *   - Duplicate Staff records (same user_id + clinic_id + position='receptionist')
 *     are prevented.
 *
 * Actions:
 *   'list'  → returns eligible receptionist-role users in this clinic who
 *             don't yet have a Staff record (position='receptionist') linked.
 *   'link'  → creates a Staff record (position='receptionist') linked to the
 *             given user_id.
 *
 * Body:
 *   action: 'list' | 'link'
 *   clinic_id?: string (super_admin override only — ignored for clinic_admin)
 *   user_id?: string (for 'link')
 *   staff_data?: { full_name?, phone?, email?, department?, notes? }
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { recordAudit } from '../../shared/auditLog.ts';

const ADMIN_ROLES = ['super_admin', 'admin', 'clinic_admin'];

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, clinic_id, user_id, staff_data } = body;

    if (!action || !['list', 'link'].includes(action)) {
      return Response.json({ error: 'action must be "list" or "link"' }, { status: 400 });
    }

    // Authoritative clinic + role. clinic_id from client is ONLY honored for super_admin.
    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req, clinic_id);
    if (error) return error;

    if (!ADMIN_ROLES.includes(authoritativeRole)) {
      return Response.json({ error: 'Forbidden — clinic admin access required' }, { status: 403 });
    }

    const rl = enforceRateLimit(user.id, 'linkExistingReceptionist');
    if (rl) return rl;

    const svc = base44.asServiceRole;

    // --- LIST: eligible receptionist-role users in this clinic without a Staff record ---
    if (action === 'list') {
      // Find all CRAs with role='receptionist' in this clinic (authoritative clinic match).
      const receptionistCras = await svc.entities.ClinicRoleAssignment.filter(
        { role: 'receptionist', clinic_id: clinicId }, '-updated_date', 500
      );

      if (!receptionistCras || receptionistCras.length === 0) {
        return Response.json({ eligible: [] });
      }

      // Fetch existing Staff records with position='receptionist' in this clinic to exclude already-linked users.
      const existingStaff = await svc.entities.Staff.filter(
        { clinic_id: clinicId, position: 'receptionist' }, null, 1000
      );
      const linkedUserIds = new Set((existingStaff || []).map(s => s.user_id).filter(Boolean));

      // Fetch User records for the candidate users.
      const candidateIds = receptionistCras.map(c => c.user_id).filter(Boolean);
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

    // --- LINK: create a Staff record (position='receptionist') for an existing user ---
    if (action === 'link') {
      if (!user_id) {
        return Response.json({ error: 'user_id is required' }, { status: 400 });
      }

      // Verify the target user has an active receptionist CRA in THIS clinic.
      // This is the server-side clinic-match enforcement — a user from another
      // clinic can never be linked, regardless of what the client sends.
      const cra = await svc.entities.ClinicRoleAssignment.filter(
        { user_id, role: 'receptionist', clinic_id: clinicId }, '-updated_date', 1
      );
      if (!cra || cra.length === 0) {
        return Response.json({ error: 'User is not a receptionist in this clinic' }, { status: 400 });
      }

      // Prevent duplicate Staff record for the same user_id + clinic_id + position='receptionist'.
      const existing = await svc.entities.Staff.filter(
        { user_id, clinic_id: clinicId, position: 'receptionist' }, null, 1
      );
      if (existing && existing.length > 0) {
        return Response.json({ error: 'Receptionist profile already exists for this user', staff: existing[0] }, { status: 409 });
      }

      // Fetch the target user record for the default name.
      const allUsers = await svc.entities.User.list('-created_date', 500);
      const targetUser = (allUsers || []).find(u => u.id === user_id);

      const sd = staff_data || {};
      const staffRecord = {
        clinic_id: clinicId,
        user_id,
        full_name: (sd.full_name || '').trim() || targetUser?.full_name || targetUser?.email || 'Receptionist',
        position: 'receptionist',
        phone: sd.phone || '',
        email: sd.email || targetUser?.email || '',
        status: 'active',
        department: sd.department || '',
        notes: sd.notes || '',
        hire_date: new Date().toISOString().split('T')[0],
        salary_currency: 'USD',
      };

      const created = await svc.entities.Staff.create(staffRecord);
      await recordAudit(svc, clinicId, user, 'create', 'Staff', created.id, `link Receptionist: ${created.full_name}`);

      return Response.json({ staff: created });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: 'Failed: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}