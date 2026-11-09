/**
 * Recycle Bin auto-purge.
 *
 * Permanently removes ORDINARY recycle-bin entries 7 days after their original
 * deletion timestamp. An ordinary deleted record is represented by its
 * AuditLog 'delete' entry, which holds the snapshot used to restore it —
 * removing that entry is what makes the deletion permanent.
 *
 * Eligibility is calculated from the entry's own created_date (the moment the
 * record was deleted), never from when this job happens to run, so a delayed
 * or re-run job can neither purge something early nor skip it.
 *
 * NEVER purged here (they keep their existing manual-only permanent deletion):
 *   - the Super Admin CLINIC Recycle Bin  (Clinic / PendingClinicDeletion)
 *   - the Super Admin USER  Recycle Bin   (DeletedUser)
 * Those are stored in their own entities and are therefore structurally out of
 * scope for this function, which only ever looks at AuditLog entries.
 *
 * Entries that were restored before the deadline are skipped — a restore
 * cancels the pending permanent deletion.
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { verifySystemCall } from '../../shared/systemAuth.ts';
import { resolveRole } from '../../shared/clinicRoleAssignment.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

const RETENTION_DAYS = 7;
const BATCH_SIZE = 500;
const MAX_BATCHES = 5;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Secure invocation: an authorized scheduled workflow, or an authenticated
    // admin/super_admin. Public unauthenticated HTTP calls are rejected.
    const { authorized, user, error } = await verifySystemCall(req, base44);
    if (!authorized) return error;

    if (user) {
      const role = await resolveRole(base44.asServiceRole, user);
      if (!['admin', 'super_admin'].includes(role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const rateLimitResponse = enforceRateLimit(user.id, 'purgeRecycleBin');
      if (rateLimitResponse) return rateLimitResponse;
    }

    const svc = base44.asServiceRole;
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    let purged = 0;
    let batches = 0;
    const failures = [];

    // Bounded batching so a large backlog never runs the function into a timeout.
    while (batches < MAX_BATCHES) {
      batches++;

      const expired = await svc.entities.AuditLog.filter(
        {
          action: 'delete',
          restored: { $ne: true },          // restored entries are never purged
          created_date: { $lt: cutoff },    // measured from the deletion timestamp
        },
        'created_date',
        BATCH_SIZE
      );

      if (!expired || expired.length === 0) break;

      for (const entry of expired) {
        try {
          await svc.entities.AuditLog.delete(entry.id);
          purged++;
        } catch (e) {
          failures.push({ id: entry.id, error: e?.message || 'Unknown error' });
        }
      }

      // Fewer than a full batch means the backlog is exhausted.
      if (expired.length < BATCH_SIZE) break;
    }

    if (failures.length > 0) {
      console.error(`purgeRecycleBin: ${failures.length} entr(ies) could not be purged`, JSON.stringify(failures.slice(0, 10)));
    }

    return Response.json({
      success: true,
      purged,
      failed: failures.length,
      retention_days: RETENTION_DAYS,
      cutoff,
    });
  } catch (error) {
    console.error('purgeRecycleBin failed:', error?.message || error);
    return Response.json({ error: 'Failed to purge recycle bin: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}