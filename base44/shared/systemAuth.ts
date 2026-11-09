/**
 * Shared helper to secure backend functions invoked BOTH by scheduled
 * workflows (no user session) AND by authenticated admins.
 *
 * SECURITY MODEL:
 *   - If a user session exists → it's a manual/admin call. The caller must
 *     be an admin (checked by the calling function via the authoritative role).
 *   - If NO user session → check for the platform-internal service auth header.
 *     The platform injects `base44-service-authorization` on calls from the
 *     workflow engine and test tool. This is the platform's designated mechanism
 *     for identifying internal calls — it does NOT expose any secret in the
 *     workflow files (unlike passing system_secret in the args).
 *   - Fallback: a valid `BACKUP_WORKFLOW_SECRET` in the body (for manual
 *     system calls where the caller explicitly provides the shared secret).
 *
 * This stops:
 *   - Logged-in non-admin users (they have a session → admin check → 403).
 *   - Unauthenticated public callers (no session, no header, no secret → 403).
 *
 * The body is parsed ONCE here and returned so the calling function does not
 * re-consume req.json().
 */
import { secrets } from 'base44:runtime';

export async function verifySystemCall(req, base44) {
  let body = {};
  try { body = await req.json(); } catch (_) { body = {}; }

  let user = null;
  try { user = await base44.auth.me(); } catch (_) { user = null; }

  if (user) {
    // Authenticated HTTP call — caller is a user, not a workflow.
    return { authorized: true, user, isSystem: false, body };
  }

  // No session — check for the platform-internal service auth header.
  // The platform injects `base44-service-authorization` on calls from the
  // workflow engine. We validate the token value against BACKUP_WORKFLOW_SECRET
  // so that a forged header (any "Bearer ..." value) cannot bypass auth.
  const expectedSecret = secrets.get('BACKUP_WORKFLOW_SECRET');
  const serviceAuth = req.headers.get('base44-service-authorization');
  if (expectedSecret && serviceAuth && serviceAuth === `Bearer ${expectedSecret}`) {
    return { authorized: true, user: null, isSystem: true, body };
  }

  // Fallback: valid system secret (for manual system calls where the caller
  // explicitly provides the shared secret in the request body).
  if (expectedSecret && body.system_secret && body.system_secret === expectedSecret) {
    return { authorized: true, user: null, isSystem: true, body };
  }

  return {
    authorized: false,
    error: Response.json({ error: 'Forbidden — unauthorized system invocation' }, { status: 403 }),
    body,
  };
}