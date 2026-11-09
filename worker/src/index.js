import { bindEnvironment } from './compat/environment.js';
import { createClientFromRequest, uploadForAuthenticatedUser } from './compat/platform-sdk.js';
import { handlers } from './handler-map.js';

function jsonError(message, status = 500) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function dispatchFunction(request, env) {
  const url = new URL(request.url);
  const name = decodeURIComponent(url.pathname.slice('/api/functions/'.length));
  const handler = handlers[name];
  if (!handler) return jsonError('Function not found.', 404);
  bindEnvironment(request, env);
  try {
    const auth = await createClientFromRequest(request).auth.me();
    if (auth?.mfa_required) {
      return Response.json({ error: 'Complete multi-factor authentication before continuing.', code: 'mfa_required' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }
    const response = await handler(request);
    if (!(response instanceof Response)) return jsonError('Backend function returned an invalid response.');
    return response;
  } catch (error) {
    console.error(`Worker function ${name} failed:`, error?.stack || error?.message || error);
    return jsonError(error?.message || 'Internal server error.', 500);
  }
}

async function dispatchUpload(request, env) {
  bindEnvironment(request, env);
  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonError('A multipart file upload is required.', 400);
  }
  const file = form.get('file');
  const kind = String(form.get('kind') || 'patient-file');
  const clinicId = form.get('clinic_id') ? String(form.get('clinic_id')) : undefined;
  const patientId = form.get('patient_id') ? String(form.get('patient_id')) : undefined;
  return uploadForAuthenticatedUser(request, { file, kind, clinicId, patientId });
}

async function invokeScheduledFunction(name, payload, env) {
  const request = new Request(`https://internal.invalid/api/functions/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Schedule-Secret': env.BACKUP_WORKFLOW_SECRET ? `Bearer ${env.BACKUP_WORKFLOW_SECRET}` : '',
    },
    body: JSON.stringify(payload || {}),
  });
  return dispatchFunction(request, env);
}

async function processExpiredDeletions(env) {
  if (!env.BACKUP_WORKFLOW_SECRET) {
    console.error('Deletion countdowns are not configured; BACKUP_WORKFLOW_SECRET is missing.');
    return;
  }
  const request = new Request('https://internal.invalid/api/functions/scheduled-deletion-scan', { method: 'POST' });
  bindEnvironment(request, env);
  const service = createClientFromRequest(request).asServiceRole;
  const now = Date.now();
  for (const [entity, functionName] of [
    ['PendingClinicDeletion', 'executeClinicDeletion'],
    ['PendingPermanentDeletion', 'executePermanentDeletion'],
  ]) {
    const due = await service.entities[entity].filter({ status: 'pending' }, 'expires_at', 1000);
    for (const record of due) {
      if (!record.expires_at || Date.parse(record.expires_at) > now) continue;
      try {
        const response = await invokeScheduledFunction(functionName, { pending_deletion_id: record.id }, env);
        if (!response.ok) console.error(`${functionName} returned ${response.status} for ${record.id}.`);
      } catch (error) {
        console.error(`${functionName} failed for ${record.id}:`, error?.message || error);
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (url.pathname === '/api/storage/upload' && request.method === 'POST') return dispatchUpload(request, env);
    if (url.pathname.startsWith('/api/functions/') && request.method === 'POST') return dispatchFunction(request, env);
    if (url.pathname.startsWith('/api/')) return jsonError('Not found.', 404);
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    const cron = controller.cron;
    const jobs = {
      '*/30 22,23,0,1,2 * * *': 'runAutomaticBackups',
      '0 * * * *': 'generateNotifications',
      '0 0 * * *': 'purgeRecycleBin',
      '0 5 * * *': 'sendScheduledReports',
    };
    if (cron === '* * * * *') {
      ctx.waitUntil(processExpiredDeletions(env));
      return;
    }
    const functionName = jobs[cron];
    if (!functionName) return;
    ctx.waitUntil(invokeScheduledFunction(functionName, {}, env).then(async (response) => {
      if (!response.ok) console.error(`Scheduled ${functionName} returned ${response.status}: ${await response.text()}`);
    }).catch((error) => console.error(`Scheduled ${functionName} failed:`, error?.message || error)));
  },
};
