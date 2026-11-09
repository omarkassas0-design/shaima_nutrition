/**
 * Batched patient file backup system.
 *
 * Processes PatientFile contents in batches across multiple backend function
 * invocations to avoid timeout limits. Tracks progress in the Backup entity
 * and only marks the backup as 'completed' when ALL files are processed.
 *
 * Supports resumption: if the process stops halfway, the next call resumes
 * from where it stopped using stored mappings to avoid duplicates.
 *
 * SECURITY: All operations are clinic-scoped. clinic_id is always derived
 * server-side and never trusted from the client.
 */

import {
  getDriveToken,
  ensureClinicFolder,
  ensureFolder,
  uploadFile,
  uploadPatientFileContent,
  PATIENT_FILES_FOLDER,
} from './googleDriveBackup.ts';

const BATCH_SIZE = 20;       // Files per batch — safe within timeout limits
const MAX_RETRIES = 2;       // Retries per file within a single batch attempt

/**
 * Fetches all PatientFile records for a clinic that have content to back up
 * (i.e. have either file_uri or file_url).
 * Uses pagination to capture ALL records — no truncation.
 */
async function fetchPatientFilesWithContent(svc, clinicId) {
  const allFiles = [];
  let skip = 0;
  const fetchSize = 500;
  let hasMore = true;

  while (hasMore) {
    let batch;
    try {
      batch = await svc.entities.PatientFile.filter(
        { clinic_id: clinicId },
        '-created_date',
        fetchSize,
        skip
      );
    } catch (e) {
      // If we can't fetch all patient files, we can't guarantee completeness
      throw new Error(`Failed to fetch PatientFile records: ${e?.message || String(e)}`);
    }

    if (!Array.isArray(batch)) break;
    allFiles.push(...batch);
    if (batch.length < fetchSize) hasMore = false;
    else skip += fetchSize;
  }

  // Only files with actual content references can be backed up
  return allFiles.filter(f => f.file_uri || f.file_url);
}

/**
 * Processes one batch of patient file contents for a backup.
 *
 * Reads the current Backup record to determine which files have already been
 * processed (via patient_file_mappings). Fetches PatientFile records, filters
 * out already-processed ones, and processes the next batch.
 *
 * Returns {
 *   backup_id, status, patient_file_batch_status,
 *   patient_file_total, patient_file_successful, patient_file_failed,
 *   patient_file_skipped, patient_file_remaining, needs_more_batches,
 *   mappings_added, error
 * }
 */
export async function processPatientFileBatch(svc, clinicId, backupRecord, batchMax) {
  const maxFiles = batchMax || BATCH_SIZE;

  // Get Drive token
  const driveToken = await getDriveToken(svc);
  if (!driveToken) {
    await svc.entities.Backup.update(backupRecord.id, {
      status: 'failed',
      patient_file_batch_status: 'failed',
      notes: (backupRecord.notes || '') + ' | Google Drive not connected — cannot back up patient file contents',
    });
    return {
      backup_id: backupRecord.id,
      status: 'failed',
      patient_file_batch_status: 'failed',
      error: 'Google Drive not connected',
    };
  }

  // Ensure clinic + patient_files folders exist in Google Drive
  let clinicFolderId, patientFilesFolderId;
  try {
    clinicFolderId = await ensureClinicFolder(driveToken, clinicId);
    patientFilesFolderId = await ensureFolder(driveToken, PATIENT_FILES_FOLDER, clinicFolderId);
  } catch (e) {
    await svc.entities.Backup.update(backupRecord.id, {
      status: 'failed',
      patient_file_batch_status: 'failed',
      notes: (backupRecord.notes || '') + ` | Failed to ensure Drive folders: ${e?.message}`,
    });
    return {
      backup_id: backupRecord.id,
      status: 'failed',
      patient_file_batch_status: 'failed',
      error: `Failed to ensure Drive folders: ${e?.message}`,
    };
  }

  // Fetch ALL PatientFile records with content for this clinic
  const allPatientFiles = await fetchPatientFilesWithContent(svc, clinicId);
  const totalFiles = allPatientFiles.length;

  // Get already-processed file IDs from the backup record
  const existingMappings = backupRecord.patient_file_mappings || [];
  const processedIds = new Set(existingMappings.map(m => m.patient_file_id));
  const failedDetails = backupRecord.patient_file_failed_details || [];
  const skippedDetails = backupRecord.patient_file_skipped_details || [];
  const failedIds = new Set(failedDetails.map(f => f.patient_file_id));
  const skippedIds = new Set(skippedDetails.map(s => s.patient_file_id));

  // Files to process: not yet processed, not permanently failed, not skipped
  const filesToProcess = allPatientFiles.filter(f =>
    !processedIds.has(f.id) && !failedIds.has(f.id) && !skippedIds.has(f.id)
  );

  // Process this batch
  const batch = filesToProcess.slice(0, maxFiles);
  const newMappings = [...existingMappings];
  const newFailedDetails = [...failedDetails];
  const newSkippedDetails = [...skippedDetails];

  for (const pf of batch) {
    let retries = 0;
    let success = false;
    let lastError = '';
    let wasSkipped = false;

    while (retries <= MAX_RETRIES && !success) {
      try {
        const result = await uploadPatientFileContent(
          driveToken,
          patientFilesFolderId,
          svc,
          pf.file_uri,
          pf.file_url,
          pf.file_name,
          pf.file_type
        );

        if (result.driveFileId) {
          // Store minimal mapping — file_name/file_type are looked up from
          // the backup JSON during finalize and restore.
          newMappings.push({
            patient_file_id: pf.id,
            drive_file_id: result.driveFileId,
          });
          success = true;
        } else if (result.skipped) {
          // Valid skip reason (empty, too large, no reference) — not a failure
          newSkippedDetails.push({
            patient_file_id: pf.id,
            file_name: pf.file_name,
            reason: result.reason || 'Skipped',
          });
          wasSkipped = true;
          success = true; // Don't retry validly skipped files
        }
      } catch (e) {
        lastError = e?.message || String(e);
        retries++;
      }
    }

    if (!success && !wasSkipped) {
      newFailedDetails.push({
        patient_file_id: pf.id,
        file_name: pf.file_name,
        reason: lastError,
      });
    }
  }

  const successful = newMappings.length;
  const failed = newFailedDetails.length;
  const skipped = newSkippedDetails.length;
  const processed = successful + failed + skipped;
  const remaining = totalFiles - processed;
  const allDone = remaining === 0;

  // Determine batch status
  let batchStatus = 'in_progress';
  if (allDone) {
    batchStatus = failed > 0 ? 'failed' : 'completed';
  }

  // Determine backup status
  let backupStatus = 'pending';
  if (allDone) {
    backupStatus = failed > 0 ? 'failed' : 'completed';
  }

  // Update the Backup entity with progress
  const updateData = {
    patient_file_total: totalFiles,
    patient_file_successful: successful,
    patient_file_failed: failed,
    patient_file_skipped: skipped,
    patient_file_mappings: newMappings,
    patient_file_failed_details: newFailedDetails,
    patient_file_skipped_details: newSkippedDetails,
    patient_file_batch_status: batchStatus,
  };

  if (allDone) {
    updateData.status = backupStatus;
    updateData.external_patient_file_count = successful;
  }

  await svc.entities.Backup.update(backupRecord.id, updateData);

  // If all done and successful, finalize the backup JSON with full mappings
  if (allDone && backupStatus === 'completed') {
    try {
      await finalizeBackupWithMappings(svc, clinicId, backupRecord.id, newMappings, allPatientFiles);
    } catch (e) {
      // Finalization failed — mark backup as failed
      await svc.entities.Backup.update(backupRecord.id, {
        status: 'failed',
        patient_file_batch_status: 'failed',
        notes: (backupRecord.notes || '') + ` | Finalization failed: ${e?.message}`,
      });
      return {
        backup_id: backupRecord.id,
        status: 'failed',
        patient_file_batch_status: 'failed',
        patient_file_total: totalFiles,
        patient_file_successful: successful,
        patient_file_failed: failed,
        patient_file_skipped: skipped,
        patient_file_remaining: 0,
        needs_more_batches: false,
        error: `Finalization failed: ${e?.message}`,
      };
    }
  }

  return {
    backup_id: backupRecord.id,
    status: backupStatus,
    patient_file_batch_status: batchStatus,
    patient_file_total: totalFiles,
    patient_file_successful: successful,
    patient_file_failed: failed,
    patient_file_skipped: skipped,
    patient_file_remaining: remaining,
    needs_more_batches: !allDone,
    mappings_added: newMappings.length - existingMappings.length,
  };
}

/**
 * Finalizes the backup by merging patient file mappings into the backup JSON
 * and re-uploading to both Base44 private storage and Google Drive.
 *
 * Enriches minimal mappings { patient_file_id, drive_file_id } with
 * file_name and file_type looked up from the PatientFile records.
 */
async function finalizeBackupWithMappings(svc, clinicId, backupId, minimalMappings, patientFiles) {
  // Download the existing backup JSON from Base44 private storage
  const backupRecord = await svc.entities.Backup.get(backupId);
  const signedUrlResult = await svc.integrations.Core.CreateFileSignedUrl({
    file_uri: backupRecord.file_url,
    expires_in: 120,
  });
  const response = await fetch(signedUrlResult.signed_url);
  if (!response.ok) {
    throw new Error(`Failed to download backup JSON for finalization: ${response.status}`);
  }
  const text = await response.text();
  const backupData = JSON.parse(text);

  // Build a lookup map for file_name and file_type by patient_file_id
  const pfLookup = {};
  for (const pf of patientFiles) {
    pfLookup[pf.id] = { file_name: pf.file_name, file_type: pf.file_type };
  }

  // Enrich minimal mappings with file_name and file_type
  const fullMappings = minimalMappings.map(m => ({
    patient_file_id: m.patient_file_id,
    drive_file_id: m.drive_file_id,
    file_name: pfLookup[m.patient_file_id]?.file_name || 'unnamed',
    file_type: pfLookup[m.patient_file_id]?.file_type || 'document',
  }));

  // Add mappings to backup JSON
  backupData.external_storage = backupData.external_storage || {};
  backupData.external_storage.patient_file_mappings = fullMappings;
  backupData.external_storage.patient_files_uploaded = fullMappings.length;
  backupData.external_storage.patient_files_skipped = backupRecord.patient_file_skipped || 0;
  backupData.external_storage.patient_files_failed = backupRecord.patient_file_failed || 0;
  backupData.external_storage.patient_files_total = backupRecord.patient_file_total || 0;

  // Re-upload to Base44 private storage
  const jsonStr = JSON.stringify(backupData, null, 2);
  const fileName = backupRecord.file_name;
  const fileObj = new File([jsonStr], fileName, { type: 'application/json' });
  const uploadResult = await svc.integrations.Core.UploadPrivateFile({ file: fileObj });
  const newFileUri = uploadResult.file_uri;

  // Re-upload to Google Drive
  const driveToken = await getDriveToken(svc);
  let newExternalFileId = backupRecord.external_file_id;
  let externalStatus = backupRecord.external_backup_status;

  if (driveToken) {
    try {
      const clinicFolderId = await ensureClinicFolder(driveToken, clinicId);
      newExternalFileId = await uploadFile(driveToken, fileName, jsonStr, clinicFolderId, 'application/json');
      externalStatus = 'uploaded';
    } catch (e) {
      // Drive upload failed — but the Base44 copy has the mappings
      externalStatus = 'failed';
    }
  }

  // Update the Backup entity with the new file URLs and final status
  await svc.entities.Backup.update(backupId, {
    file_url: newFileUri,
    file_size: jsonStr.length,
    external_file_id: newExternalFileId,
    external_backup_status: externalStatus,
  });
}

/**
 * Processes ALL remaining patient file batches in a loop.
 * Used by automatic backups and safety backups where the entire backup
 * must complete in a single function call.
 *
 * Returns the final batch result.
 */
export async function processAllPatientFileBatches(svc, clinicId, backupRecord, batchMax) {
  svc.setClinicScope?.(clinicId);
  let currentRecord = backupRecord;
  let result;

  // Loop until all files are processed or an error occurs
  while (true) {
    result = await processPatientFileBatch(svc, clinicId, currentRecord, batchMax);

    if (!result.needs_more_batches) {
      break;
    }

    // Re-fetch the backup record to get updated mappings for the next batch
    currentRecord = await svc.entities.Backup.get(backupRecord.id);
  }

  return result;
}
