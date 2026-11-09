import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { createBackupForClinic } from '../../shared/backupLogic.ts';
import { processAllPatientFileBatches } from '../../shared/patientFileBatch.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { verifySystemCall } from '../../shared/systemAuth.ts';
import { resolveRole } from '../../shared/clinicRoleAssignment.ts';

/**
 * Automatic daily backup for ALL clinics.
 * Called by a scheduled workflow or manually by an admin.
 * Iterates all clinics, creates a backup for each.
 * If one clinic fails, others still process.
 * Records a Backup entity with status completed or failed.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Secure invocation: either an authorized workflow (no session + valid
    // system_secret) or an authenticated admin. Unauthenticated public HTTP
    // calls are rejected.
    const { authorized, user, error } = await verifySystemCall(req, base44);
    if (!authorized) return error;

    if (user) {
      const role = await resolveRole(base44.asServiceRole, user);
      if (role !== 'admin' && role !== 'super_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const rateLimitResponse = enforceRateLimit(user.id, 'runAutomaticBackups');
      if (rateLimitResponse) return rateLimitResponse;
    }

    const svc = base44.asServiceRole;

    // Fetch all clinics — skip soft-deleted clinics (no point backing up deleted data)
    const allClinics = await svc.entities.Clinic.list('name', 500);
    const clinics = (allClinics || []).filter(c => !c.is_deleted);

    if (clinics.length === 0) {
      return Response.json({ success: true, message: 'No active clinics found', processed: 0 });
    }

    // Automatic backups created today, grouped per clinic. Used to:
    //  - skip clinics already backed up today,
    //  - resume an interrupted backup instead of starting a new one
    //    (a new one would copy every patient file again), and
    //  - cap attempts per clinic per night.
    const MAX_ATTEMPTS_PER_NIGHT = 2;
    const recentBackups = await svc.entities.Backup.list('-created_date', 500);
    const todayStr = new Date().toISOString().split('T')[0];
    const todayByClinic = new Map();
    for (const b of recentBackups || []) {
      if (b.backup_type !== 'automatic' || !b.created_date) continue;
      if (new Date(b.created_date).toISOString().split('T')[0] !== todayStr) continue;
      const list = todayByClinic.get(b.clinic_id) || [];
      list.push(b);
      todayByClinic.set(b.clinic_id, list);
    }

    const clinicsToBackup = clinics.filter(c => {
      const attempts = todayByClinic.get(c.id) || [];
      if (attempts.some(b => b.status === 'completed')) return false; // already done today
      return attempts.length < MAX_ATTEMPTS_PER_NIGHT;               // attempts left tonight
    });

    if (clinicsToBackup.length === 0) {
      return Response.json({ success: true, message: 'All clinics already backed up or out of attempts for today', processed: 0, succeeded: 0, failed: 0, skipped: clinics.length });
    }

    const results = [];
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    // Process clinics with a strict time budget to prevent 504 timeouts.
    // The workflow runs every 30 minutes between 1-5 AM, so remaining
    // clinics are picked up by the next scheduled run.
    const TIME_BUDGET_MS = 240000; // 4 minutes (leaves margin before the 5-min limit)
    const startTime = Date.now();

    for (const clinic of clinicsToBackup) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        skipped++;
        results.push({ clinic_id: clinic.id, clinic_name: clinic.name, status: 'skipped', reason: 'Time budget exceeded — will be processed in next run' });
        continue;
      }
      try {
        // Resume today's interrupted backup when it is the only attempt so far:
        // its stored patient_file_mappings are reused, so files already copied
        // are never uploaded again. Otherwise start a fresh backup.
        const attempts = todayByClinic.get(clinic.id) || [];
        const interrupted = attempts.length === 1 && (attempts[0].status === 'pending' || attempts[0].status === 'in_progress')
          ? attempts[0]
          : null;

        const result = interrupted
          ? { ...(await processAllPatientFileBatches(svc, clinic.id, interrupted)), resumed: true }
          : await createBackupForClinic(
              svc, clinic.id, 'automatic', 'Automatic daily backup',
              false, // isSafetyBackup
              true   // completeInOneCall — process all patient file batches
            );

        const ok = result.status === 'completed';
        results.push({ clinic_id: clinic.id, clinic_name: clinic.name, ...result, status: ok ? 'success' : 'failed' });
        if (ok) succeeded++; else failed++;
      } catch (err) {
        failed++;
        // Record the failure as a Backup entity with status failed
        try {
          await svc.entities.Backup.create({
            clinic_id: clinic.id,
            backup_type: 'automatic',
            file_url: '',
            file_name: `failed-${new Date().toISOString().split('T')[0]}`,
            file_size: 0,
            status: 'failed',
            notes: `Automatic backup failed: ${err?.message || String(err)}`,
          });
        } catch (e) {
          // Even recording the failure failed — log to results
        }
        results.push({
          clinic_id: clinic.id,
          clinic_name: clinic.name,
          status: 'failed',
          error: err?.message || String(err),
        });
      }
    }

    return Response.json({
      success: true,
      processed: succeeded + failed,
      succeeded,
      failed,
      skipped,
      remaining: skipped,
      results,
    });
  } catch (error) {
    return Response.json({
      error: 'Automatic backup run failed',
      detail: error?.message,
    }, { status: 500 });
  }
}