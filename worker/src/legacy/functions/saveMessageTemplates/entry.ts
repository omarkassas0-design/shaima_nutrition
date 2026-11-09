/**
 * Save message templates — updates ONLY clinic.settings.message_templates.
 *
 * Security model:
 *   - clinic_id is ALWAYS taken from the server-side UserSecurityProfile
 *     (via getAuthenticatedClinicUser). Never from the client.
 *   - Allowed roles: super_admin, admin, clinic_admin, receptionist.
 *   - This function NEVER touches core clinic fields (name, currency, contact,
 *     ownership, etc.) — receptionists can manage templates without gaining
 *     any control over sensitive clinic configuration.
 *   - Existing settings keys are preserved; only message_templates is replaced.
 *
 * Body:
 *   clinic_id?: string (super_admin override only — ignored for all other roles)
 *   templates: object — the message_templates map to persist
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

const ALLOWED_ROLES = ['super_admin', 'admin', 'clinic_admin', 'receptionist'];

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req, body.clinic_id);
    if (error) return error;

    const rl = enforceRateLimit(user.id, 'saveClinicSettings');
    if (rl) return rl;

    const role = authoritativeRole || user.role || user.data?.role;
    if (!ALLOWED_ROLES.includes(role)) {
      return Response.json({ error: 'Forbidden — insufficient permissions to manage message templates' }, { status: 403 });
    }

    const templates = body.templates;
    if (!templates || typeof templates !== 'object' || Array.isArray(templates)) {
      return Response.json({ error: 'templates object is required' }, { status: 400 });
    }

    const lang = ['ar', 'tr'].includes(body.lang) ? body.lang : 'en';

    const svc = base44.asServiceRole;

    // Fetch the existing clinic to merge settings without wiping other keys.
    let clinic;
    try {
      const found = await svc.entities.Clinic.filter({ id: clinicId }, '-created_date', 1);
      clinic = found[0];
    } catch (e) {
      return Response.json({ error: 'Failed to load clinic: ' + (e?.message || 'Unknown') }, { status: 500 });
    }
    if (!clinic) {
      return Response.json({ error: 'Clinic not found' }, { status: 404 });
    }

    const existingSettings = clinic.settings || {};
    const existingTemplates = existingSettings.message_templates || {};
    // Backward compat: old flat { [key]: "text" } format → treat as { en: {...} }
    const normalizedTemplates = (existingTemplates.en || existingTemplates.ar || existingTemplates.tr)
      ? existingTemplates
      : { en: existingTemplates };
    const newMessageTemplates = { ...normalizedTemplates, [lang]: templates };
    const newSettings = { ...existingSettings, message_templates: newMessageTemplates };

    await svc.entities.Clinic.update(clinicId, { settings: newSettings });

    return Response.json({ success: true, settings: newSettings });
  } catch (error) {
    return Response.json({ error: 'Failed to save message templates: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}