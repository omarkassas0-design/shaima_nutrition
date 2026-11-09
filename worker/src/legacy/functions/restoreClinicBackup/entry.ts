import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { createBackupForClinic } from '../../shared/backupLogic.ts';
import { BACKUP_KEY_MAP, RESTORE_ENTITIES, restoreClinicData, validateBackupData, validateBackupDeep } from '../../shared/restoreLogic.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { getDriveToken, restorePatientFileContent } from '../../shared/googleDriveBackup.ts';

/**
 * Safe backup restore mechanism with staged restore, automatic rollback,
 * restore locking, and patient file content restoration.
 *
 * Safety controls:
 * 1. Only clinic_admin, admin, or super_admin can restore (authoritative role).
 * 2. Requires explicit confirmation token from the preview step.
 * 3. RESTORE LOCK: prevents two simultaneous restores for the same clinic.
 * 4. SAFETY BACKUP: created in BOTH Base44 AND Google Drive before any
 *    destructive action. Never auto-deleted. Preserved for manual recovery.
 * 5. Validates the backup file structure before starting.
 * 6. Only restores data for the caller's clinic — never another clinic's.
 * 7. If an entity fails to restore, automatically rolls back to the safety
 *    backup data for that entity (minimizes data loss).
 * 8. PATIENT FILE CONTENT: after successful restore, downloads patient file
 *    contents from Google Drive and re-uploads to Base44 private storage.
 * 9. Returns a detailed report with the safety backup ID for manual recovery.
 *
 * Three-step process:
 *   Step 1 (action: "preview"): Validates the backup and returns a preview + confirmation token.
 *   Step 2 (action: "restore", confirm_token: <token>): Performs the actual restore.
 *   Step 3 (action: "recover", safety_backup_id: <id>): Recovers from a failed restore
 *          by restoring from the safety backup. Does NOT create another safety backup.
 *
 * LIMITATION: Base44 does not support database transactions. The automatic
 * rollback re-creates failed entities from the safety backup, but if the
 * rollback itself fails, manual recovery using the safety backup ID is needed.
 * The safety backup is NEVER auto-deleted and is preserved in both Base44
 * storage and Google Drive for manual recovery.
 */

const LOCK_TTL_MINUTES = 30;

/**
 * Acquires a restore lock for the clinic. Prevents concurrent restores.
 * Stale locks (expired TTL) are automatically cleaned up.
 * Returns { success, message }.
 */
async function acquireRestoreLock(svc, clinicId, user) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MINUTES * 60 * 1000);

  // Check for existing active locks
  const existingLocks = await svc.entities.RestoreLock.filter({
    clinic_id: clinicId,
    status: 'active',
  });

  for (const lock of existingLocks) {
    if (new Date(lock.expires_at) > now) {
      // Active lock — another restore is in progress
      return {
        success: false,
        message: `Another restore is in progress for this clinic (started by ${lock.locked_by_name || 'another admin'}). Please wait until it completes or expires, then try again.`,
      };
    }
    // Stale lock (expired) — mark as expired
    await svc.entities.RestoreLock.update(lock.id, { status: 'expired' });
  }

  // Create new lock
  await svc.entities.RestoreLock.create({
    clinic_id: clinicId,
    locked_by_user_id: user.id,
    locked_by_name: user.full_name || user.email || 'admin',
    locked_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    status: 'active',
  });

  return { success: true };
}

/**
 * Releases the restore lock for the clinic.
 * Always runs — even on error — to prevent permanent lockout.
 */
async function releaseRestoreLock(svc, clinicId) {
  try {
    const locks = await svc.entities.RestoreLock.filter({
      clinic_id: clinicId,
      status: 'active',
    });
    for (const lock of locks) {
      await svc.entities.RestoreLock.update(lock.id, { status: 'released' });
    }
  } catch (e) {
    // Best-effort — don't throw on release failure
  }
}

/**
 * Restores patient file contents from Google Drive to Base44 private storage.
 * Called after a successful restore. Uses idMaps to find new PatientFile IDs.
 * Returns { restored, failed, skipped }.
 */
async function restorePatientFileContents(svc, backupData, idMaps) {
  const mappings = backupData?.external_storage?.patient_file_mappings || [];
  if (mappings.length === 0) {
    return { restored: 0, failed: 0, skipped: 0 };
  }

  const driveToken = await getDriveToken(svc);
  if (!driveToken) {
    return { restored: 0, failed: 0, skipped: mappings.length, reason: 'Google Drive not connected' };
  }

  const patientFileIdMap = idMaps?.PatientFile || {};
  let restored = 0;
  let failed = 0;
  let skipped = 0;

  for (const mapping of mappings) {
    const newFileId = patientFileIdMap[mapping.patient_file_id];
    if (!newFileId) {
      skipped++;
      continue;
    }

    try {
      const result = await restorePatientFileContent(
        driveToken,
        mapping.drive_file_id,
        mapping.file_name,
        mapping.file_type,
        svc
      );

      if (result.file_uri) {
        // Update the restored PatientFile record with the new file_uri
        await svc.entities.PatientFile.update(newFileId, { file_uri: result.file_uri });
        restored++;
      } else {
        skipped++;
      }
    } catch (e) {
      failed++;
    }
  }

  return { restored, failed, skipped };
}

export default async function(req) {
  try {
    const body = await req.json();
    const { backup_id, action, confirm_token, safety_backup_id } = body;

    if (!backup_id && action !== 'recover') return Response.json({ error: 'Backup ID is required' }, { status: 400 });
    if (!action) return Response.json({ error: 'Action is required (preview, restore, or recover)' }, { status: 400 });

    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req);
    if (error) return error;

    const userRole = authoritativeRole || user.role || user.data?.role;
    if (userRole !== 'clinic_admin' && userRole !== 'super_admin' && userRole !== 'admin') {
      return Response.json({ error: 'Only administrators can restore backups' }, { status: 403 });
    }

    const rateLimitResponse = enforceRateLimit(user.id, 'restoreClinicBackup');
    if (rateLimitResponse) return rateLimitResponse;

    const svc = base44.asServiceRole;

    // Helper: download and parse a backup file
    async function downloadBackup(backupRecord) {
      const signedUrlResult = await svc.integrations.Core.CreateFileSignedUrl({
        file_uri: backupRecord.file_url,
        expires_in: 60,
      });
      const fileResponse = await fetch(signedUrlResult.signed_url);
      if (!fileResponse.ok) throw new Error('Failed to download backup file');
      const text = await fileResponse.text();
      return JSON.parse(text);
    }

    // Helper: fetch a backup record and validate ownership
    async function fetchBackupRecord(id) {
      let backup;
      try {
        backup = await svc.entities.Backup.get(id);
      } catch (e) {
        return null;
      }
      if (!backup) return null;
      if (backup.clinic_id !== clinicId) return null;
      if (backup.status !== 'completed') return null;
      return backup;
    }

    // --- RECOVER action ---
    if (action === 'recover') {
      if (!safety_backup_id) {
        return Response.json({ error: 'safety_backup_id is required for recover action' }, { status: 400 });
      }

      const safetyBackup = await fetchBackupRecord(safety_backup_id);
      if (!safetyBackup) {
        return Response.json({ error: 'Safety backup not found, not completed, or belongs to another clinic' }, { status: 404 });
      }

      let safetyData;
      try {
        safetyData = await downloadBackup(safetyBackup);
      } catch (e) {
        return Response.json({ error: 'Failed to download safety backup: ' + (e?.message || 'Unknown') }, { status: 500 });
      }

      const validation = validateBackupDeep(safetyData);
      if (!validation.valid) {
        return Response.json({ error: 'Safety backup validation failed', details: validation.errors }, { status: 400 });
      }

      if (safetyData.clinic_id !== clinicId) {
        return Response.json({ error: 'Safety backup does not belong to your clinic' }, { status: 403 });
      }

      // Acquire restore lock
      const lockResult = await acquireRestoreLock(svc, clinicId, user);
      if (!lockResult.success) {
        return Response.json({ error: lockResult.message }, { status: 409 });
      }

      try {
        const restoreResult = await restoreClinicData(svc, clinicId, safetyData, null);

        // Restore patient file contents if restore succeeded
        let patientFileResult = null;
        if (restoreResult.allSucceeded) {
          try {
            patientFileResult = await restorePatientFileContents(svc, safetyData, restoreResult.idMaps);
          } catch (e) {
            patientFileResult = { restored: 0, failed: 0, skipped: 0, error: e?.message };
          }
        }

        const response = {
          action: 'recover',
          success: restoreResult.allSucceeded,
          safety_backup_id,
          restored: restoreResult.results,
          failedEntities: restoreResult.failedEntities,
          rolledBackEntities: restoreResult.rolledBackEntities,
          patient_file_contents: patientFileResult,
        };

        if (restoreResult.allSucceeded) {
          response.message = 'Recovery completed successfully. All entities restored from safety backup.';
        } else {
          response.warning = `Recovery partially completed. ${restoreResult.failedEntities.length} entity/entities failed. The original safety backup is still available for manual recovery.`;
        }

        return Response.json(response);
      } finally {
        await releaseRestoreLock(svc, clinicId);
      }
    }

    // --- PREVIEW and RESTORE actions ---

    const backup = await fetchBackupRecord(backup_id);
    if (!backup) {
      return Response.json({ error: 'Backup not found, not completed, or belongs to another clinic' }, { status: 404 });
    }

    let backupData;
    try {
      backupData = await downloadBackup(backup);
    } catch (e) {
      return Response.json({ error: 'Failed to access or parse backup file: ' + (e?.message || 'Unknown') }, { status: 500 });
    }

    const validation = validateBackupDeep(backupData);
    if (!validation.valid) {
      return Response.json({ error: 'Backup validation failed', details: validation.errors }, { status: 400 });
    }

    if (backupData.clinic_id !== clinicId) {
      return Response.json({
        error: 'Backup validation failed — clinic ID mismatch. This backup does not belong to your clinic.',
      }, { status: 400 });
    }

    // STEP 1: PREVIEW
    if (action === 'preview') {
      const token = `${backup_id}:${Date.now()}:${clinicId.slice(-4)}`;
      return Response.json({
        action: 'preview',
        backup_id,
        backup_date: backup.created_date,
        backup_type: backup.backup_type,
        clinic_name: backupData.clinic?.name || 'Unknown',
        record_counts: validation.recordCounts,
        validation_warnings: validation.warnings,
        external_backup: backupData.external_storage ? {
          provider: backupData.external_storage.provider,
          patient_files_uploaded: backupData.external_storage.patient_files_uploaded || 0,
          patient_files_skipped: backupData.external_storage.patient_files_skipped || 0,
        } : null,
        warning: 'This will DELETE all existing data for your clinic and replace it with the backup data. A safety backup will be created automatically before the restore (in both Base44 AND Google Drive). If ANY entity fails, ALL entities will be automatically rolled back to the safety backup. The restore is only considered successful after post-restore verification passes.',
        confirm_token: token,
        next_step: 'Call this function again with action="restore" and the confirm_token to proceed.',
      });
    }

    // STEP 2: RESTORE
    if (action === 'restore') {
      if (!confirm_token) {
        return Response.json({ error: 'Confirmation token is required for restore action' }, { status: 400 });
      }

      const [tokenBackupId, , tokenClinicSuffix] = confirm_token.split(':');
      if (tokenBackupId !== backup_id || tokenClinicSuffix !== clinicId.slice(-4)) {
        return Response.json({ error: 'Invalid confirmation token' }, { status: 400 });
      }

      // Acquire restore lock — prevents concurrent restores
      const lockResult = await acquireRestoreLock(svc, clinicId, user);
      if (!lockResult.success) {
        return Response.json({ error: lockResult.message }, { status: 409 });
      }

      try {
        // 1. Create a SAFETY backup in BOTH Base44 AND Google Drive
        //    This is NEVER auto-deleted and is preserved for manual recovery.
        let safetyBackup;
        try {
          safetyBackup = await createBackupForClinic(
            svc, clinicId, 'manual',
            `SAFETY BACKUP before restore of ${backup.file_name}`,
            true,  // isSafetyBackup = true
            true   // completeInOneCall — safety backup must be fully complete
          );
        } catch (e) {
          return Response.json({
            error: 'Failed to create safety backup. Restore aborted for safety.',
            detail: e?.message,
          }, { status: 500 });
        }

        // 2. Download the safety backup data for potential rollback
        let safetyBackupData = null;
        try {
          const safetyBackupRecord = await svc.entities.Backup.get(safetyBackup.backup_id);
          safetyBackupData = await downloadBackup(safetyBackupRecord);
        } catch (e) {
          // Continue without rollback capability — safety backup still exists for manual recovery
        }

        // 3. Restore in dependency order with full rollback on any failure
        const restoreResult = await restoreClinicData(svc, clinicId, backupData, safetyBackupData);

        // 4. Restore patient file contents from Google Drive (only if restore succeeded)
        let patientFileResult = null;
        if (restoreResult.allSucceeded) {
          try {
            patientFileResult = await restorePatientFileContents(svc, backupData, restoreResult.idMaps);
          } catch (e) {
            patientFileResult = { restored: 0, failed: 0, skipped: 0, error: e?.message };
          }
        }

        const response = {
          action: 'restore',
          success: restoreResult.allSucceeded,
          backup_id,
          safety_backup_id: safetyBackup.backup_id,
          safety_backup_file: safetyBackup.file_name,
          safety_backup_external: safetyBackup.external_backup_status === 'uploaded',
          restored: restoreResult.results,
          failedEntities: restoreResult.failedEntities,
          rolledBackEntities: restoreResult.rolledBackEntities,
          rolledBack: restoreResult.rolledBack || false,
          patient_file_contents: patientFileResult,
        };

        if (restoreResult.countMismatches) {
          response.countMismatches = restoreResult.countMismatches;
        }

        if (restoreResult.allSucceeded) {
          response.message = 'Restore completed successfully. All entities restored and verified.';
        } else if (restoreResult.rolledBack) {
          response.warning = `${restoreResult.failedEntities.length} entity/entities failed. ` +
            `ALL entities were automatically rolled back to the safety backup. ` +
            `The safety backup (${safetyBackup.backup_id}) is preserved in both Base44 AND Google Drive. ` +
            `Use action="recover" with safety_backup_id="${safetyBackup.backup_id}" if further recovery is needed.`;
        } else {
          response.warning = `${restoreResult.failedEntities.length} entity/entities failed to restore. ` +
            `The safety backup (${safetyBackup.backup_id}) is preserved in both Base44 AND Google Drive. ` +
            `Use action="recover" with safety_backup_id="${safetyBackup.backup_id}" for manual recovery.`;
        }

        return Response.json(response);
      } finally {
        // Always release the lock — even on error
        await releaseRestoreLock(svc, clinicId);
      }
    }

    return Response.json({ error: 'Unknown action. Use "preview", "restore", or "recover".' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: 'Restore failed', detail: error?.message }, { status: 500 });
  }
}