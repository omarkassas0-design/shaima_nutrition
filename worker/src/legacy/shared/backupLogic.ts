/**
 * Shared backup logic used by both manual and automatic backup functions.
 *
 * THREE-LAYER DATA PROTECTION:
 *   1. Base44 private storage (primary off-platform copy)
 *   2. Central AuraDental Google Drive (mandatory off-platform copy)
 *   3. Patient file contents copied to Google Drive (batched, no truncation)
 *
 * SAFETY GUARANTEES:
 *   1. EVERY clinic-scoped entity is included — audited against entity schemas.
 *   2. Paginated fetching captures ALL records — no 5,000-record truncation.
 *   3. If any entity can't be fully fetched, the backup is marked FAILED.
 *   4. PatientFile storage references (file_url, file_uri) are preserved.
 *   5. PatientFile CONTENTS are copied to Google Drive in BATCHES — no silent
 *      skipping. Processing continues across multiple function calls until
 *      ALL files are backed up. Progress is tracked in the Backup entity.
 *   6. Backup integrity is verified before the backup JSON is uploaded.
 *   7. A backup is only 'completed' if BOTH Base44 AND Google Drive uploads
 *      succeed AND all patient file batches are processed.
 *   8. Detailed record counts and external file IDs are returned for verification.
 *
 * BATCHED PATIENT FILE BACKUP:
 *   The first batch is processed in createBackupForClinic. If more files
 *   remain, the backup is left in 'pending' status with patient_file_batch_status
 *   = 'in_progress'. The caller (frontend or runAutomaticBackups) must call
 *   processPatientFileBatch repeatedly until needs_more_batches is false.
 *   For safety backups and automatic backups, set completeInOneCall=true to
 *   process all batches within this function call.
 *
 * If a new clinic-scoped entity is added to the app, it MUST be added to
 * ENTITY_NAMES here AND to RESTORE_PLAN in restoreLogic.ts.
 */

import {
  getDriveToken,
  ensureClinicFolder,
  ensureFolder,
  uploadFile,
  PATIENT_FILES_FOLDER,
} from './googleDriveBackup.ts';
import {
  processPatientFileBatch,
  processAllPatientFileBatches,
} from './patientFileBatch.ts';

// Every clinic-scoped entity that must survive a restore.
const ENTITY_NAMES = [
  'Patient', 'Doctor', 'Staff', 'Appointment', 'Treatment',
  'PatientTreatment', 'Payment', 'Laboratory', 'LabCase', 'Shift',
  'DoctorPayout', 'PatientFile', 'Notification', 'MessageLog', 'ReminderLog',
  'Expense', 'Purchase', 'Invoice', 'ConsentForm', 'ScheduledReport',
];

// Maps entity names to backup JSON keys (must match RESTORE_PLAN in restoreLogic.ts).
const BACKUP_KEYS = {
  Patient: 'patients',
  Doctor: 'doctors',
  Staff: 'staff',
  Appointment: 'appointments',
  Treatment: 'treatments',
  PatientTreatment: 'patientTreatments',
  Payment: 'payments',
  Laboratory: 'labs',
  LabCase: 'labCases',
  Shift: 'shifts',
  DoctorPayout: 'payouts',
  PatientFile: 'patientFiles',
  Notification: 'notifications',
  MessageLog: 'messageLogs',
  ReminderLog: 'reminderLogs',
  Expense: 'expenses',
  Purchase: 'purchases',
  Invoice: 'invoices',
  ConsentForm: 'consentForms',
  ScheduledReport: 'scheduledReports',
};

const FETCH_BATCH_SIZE = 1000;
const MAX_FETCH_ITERATIONS = 10000; // Safety valve: 10M records per entity

/**
 * Fetches ALL records for an entity+clinic using skip-based pagination.
 * Returns { records, complete, error, fetched }.
 * If any page fails or max iterations is reached, complete=false.
 */
async function fetchAllRecords(svc, entityName, clinicId) {
  const allRecords = [];
  let skip = 0;
  let hasMore = true;
  let iterations = 0;

  while (hasMore && iterations < MAX_FETCH_ITERATIONS) {
    let batch;
    try {
      batch = await svc.entities[entityName].filter(
        { clinic_id: clinicId },
        '-created_date',
        FETCH_BATCH_SIZE,
        skip
      );
    } catch (e) {
      return {
        records: allRecords,
        complete: false,
        error: e?.message || String(e),
        fetched: allRecords.length,
      };
    }

    if (!Array.isArray(batch)) {
      return {
        records: allRecords,
        complete: false,
        error: `Non-array response from ${entityName}`,
        fetched: allRecords.length,
      };
    }

    allRecords.push(...batch);

    if (batch.length < FETCH_BATCH_SIZE) {
      hasMore = false;
    } else {
      skip += FETCH_BATCH_SIZE;
    }
    iterations++;
  }

  const complete = !hasMore;
  return {
    records: allRecords,
    complete,
    error: complete ? null : 'Max iterations reached — possible truncation',
    fetched: allRecords.length,
  };
}

/**
 * Verifies backup integrity: clinic_id consistency, entity completeness.
 * Returns { valid, errors }.
 */
function verifyBackupIntegrity(backupData, fetchResults) {
  const errors = [];

  if (!backupData.clinic_id) {
    errors.push('Missing clinic_id');
  }

  for (const name of ENTITY_NAMES) {
    const result = fetchResults[name];
    if (!result || !result.complete) {
      errors.push(`${name}: ${result?.error || 'incomplete fetch'} (${result?.fetched || 0} records)`);
    }
  }

  for (const name of ENTITY_NAMES) {
    const key = BACKUP_KEYS[name];
    const records = backupData[key] || [];
    for (const r of records) {
      if (r.clinic_id && r.clinic_id !== backupData.clinic_id) {
        errors.push(`${name}: record ${r.id} has mismatched clinic_id`);
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Creates a full backup of a clinic's data.
 *
 * Flow:
 *   1. Fetch ALL entity records with pagination (no truncation).
 *   2. Verify backup integrity.
 *   3. Get Google Drive token (mandatory for off-platform copy).
 *   4. Upload backup JSON (without patient file mappings) to Base44 + Drive.
 *   5. Create Backup entity with status 'pending' (patient file batches pending).
 *   6. Process first batch of patient file contents.
 *   7. If completeInOneCall=true, process ALL remaining batches in a loop.
 *   8. If all files processed, finalize backup JSON with mappings.
 *
 * A backup is only 'completed' if BOTH Base44 AND Google Drive uploads succeed
 * AND all patient file batches are processed successfully.
 *
 * Parameters:
 *   svc           — base44.asServiceRole SDK client
 *   clinicId      — clinic to back up
 *   backupType    — 'manual', 'automatic', etc.
 *   notes         — backup notes
 *   isSafetyBackup — true for pre-restore safety backups
 *   completeInOneCall — if true, process ALL patient file batches in this call
 *                       (used by automatic backups and safety backups)
 *
 * Returns {
 *   backup_id, file_name, file_size, status, record_count,
 *   external_backup_status, external_file_id, external_patient_file_count,
 *   patient_file_batch_status, patient_file_total, patient_file_successful,
 *   patient_file_failed, patient_file_skipped, patient_file_remaining,
 *   needs_more_batches, error
 * }
 */
export async function createBackupForClinic(svc, clinicId, backupType = 'manual', notes = '', isSafetyBackup = false, completeInOneCall = false) {
  svc.setClinicScope?.(clinicId);
  // Fetch clinic record
  const clinicRecords = await svc.entities.Clinic.filter({ id: clinicId }, null, 1);
  const clinic = clinicRecords[0] || null;

  // Fetch ALL entity records with pagination (no 5,000 limit)
  const fetchResults = {};
  await Promise.all(ENTITY_NAMES.map(async (name) => {
    fetchResults[name] = await fetchAllRecords(svc, name, clinicId);
  }));

  // Build backup data object
  const backupData = {
    backup_created_at: new Date().toISOString(),
    backup_version: '3.0',
    clinic_id: clinicId,
    clinic,
  };

  for (const name of ENTITY_NAMES) {
    backupData[BACKUP_KEYS[name]] = fetchResults[name].records;
  }

  // Verify backup integrity
  const verification = verifyBackupIntegrity(backupData, fetchResults);

  // Build record counts
  const recordCount = {};
  for (const name of ENTITY_NAMES) {
    recordCount[BACKUP_KEYS[name]] = fetchResults[name].records.length;
  }

  if (!verification.valid) {
    const errorDetails = verification.errors.join('; ');
    const fileName = `failed-backup-${clinicId.slice(-6)}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    await svc.entities.Backup.create({
      clinic_id: clinicId,
      backup_type: backupType,
      file_url: '',
      file_name: fileName,
      file_size: 0,
      status: 'failed',
      notes: `Backup FAILED: ${errorDetails}. ${notes || ''}`,
      is_safety_backup: isSafetyBackup,
    });

    return {
      backup_id: null,
      file_name: fileName,
      file_size: 0,
      status: 'failed',
      error: errorDetails,
      record_count: recordCount,
    };
  }

  // --- Google Drive off-platform backup (mandatory) ---

  const driveToken = await getDriveToken(svc);
  let externalStatus = 'failed';
  let externalFileId = null;

  if (!driveToken) {
    // No Drive connection — cannot guarantee off-platform copy
    const fileName = `failed-backup-${clinicId.slice(-6)}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await svc.entities.Backup.create({
      clinic_id: clinicId,
      backup_type: backupType,
      file_url: '',
      file_name: fileName,
      file_size: 0,
      status: 'failed',
      notes: `Backup FAILED: Google Drive not connected. ${notes}`,
      external_backup_status: 'failed',
      is_safety_backup: isSafetyBackup,
    });
    return {
      backup_id: null,
      file_name: fileName,
      file_size: 0,
      status: 'failed',
      error: 'Google Drive not connected — off-platform backup is mandatory',
      record_count: recordCount,
    };
  }

  // Ensure clinic folder exists in Google Drive
  let clinicFolderId;
  try {
    clinicFolderId = await ensureClinicFolder(driveToken, clinicId);
  } catch (e) {
    const fileName = `failed-backup-${clinicId.slice(-6)}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await svc.entities.Backup.create({
      clinic_id: clinicId,
      backup_type: backupType,
      file_url: '',
      file_name: fileName,
      file_size: 0,
      status: 'failed',
      notes: `Backup FAILED: Could not create Google Drive folder: ${e?.message}. ${notes}`,
      external_backup_status: 'failed',
      is_safety_backup: isSafetyBackup,
    });
    return {
      backup_id: null,
      file_name: fileName,
      file_size: 0,
      status: 'failed',
      error: `Could not create Google Drive folder: ${e?.message}`,
      record_count: recordCount,
    };
  }

  // --- Upload backup JSON (without patient file mappings) to Base44 private storage ---
  // Patient file mappings are merged in during finalization after all batches complete.
  backupData.external_storage = {
    provider: 'google_drive',
    patient_file_mappings: [], // Will be populated during finalization
    patient_files_uploaded: 0,
    patient_files_skipped: 0,
    patient_files_failed: 0,
    patient_files_total: 0,
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const fileName = `AuraDental_Clinic_${clinicId.slice(-8)}_${dateStr}.backup.json`;
  const fileObj = new File([jsonStr], fileName, { type: 'application/json' });

  let base44FileUri;
  try {
    const uploadResult = await svc.integrations.Core.UploadPrivateFile({ file: fileObj });
    base44FileUri = uploadResult.file_uri;
  } catch (e) {
    // Base44 upload failed — backup fails
    await svc.entities.Backup.create({
      clinic_id: clinicId,
      backup_type: backupType,
      file_url: '',
      file_name: fileName,
      file_size: 0,
      status: 'failed',
      notes: `Backup FAILED: Base44 upload error: ${e?.message}. ${notes}`,
      external_backup_status: 'failed',
      is_safety_backup: isSafetyBackup,
    });
    return {
      backup_id: null,
      file_name: fileName,
      file_size: 0,
      status: 'failed',
      error: `Base44 upload failed: ${e?.message}`,
      record_count: recordCount,
    };
  }

  // --- Upload backup JSON to Google Drive (mandatory) ---
  try {
    externalFileId = await uploadFile(driveToken, fileName, jsonStr, clinicFolderId, 'application/json');
    externalStatus = 'uploaded';
  } catch (e) {
    // Drive upload failed — backup fails (off-platform copy is mandatory)
    await svc.entities.Backup.create({
      clinic_id: clinicId,
      backup_type: backupType,
      file_url: base44FileUri,
      file_name: fileName,
      file_size: jsonStr.length,
      status: 'failed',
      notes: `Backup FAILED: Google Drive upload error: ${e?.message}. ${notes}`,
      external_backup_status: 'failed',
      is_safety_backup: isSafetyBackup,
    });
    return {
      backup_id: null,
      file_name: fileName,
      file_size: jsonStr.length,
      status: 'failed',
      error: `Google Drive upload failed: ${e?.message}`,
      record_count: recordCount,
      external_backup_status: 'failed',
    };
  }

  // --- Create Backup entity with status 'pending' (patient file batches pending) ---
  const backupRecord = await svc.entities.Backup.create({
    clinic_id: clinicId,
    backup_type: backupType,
    file_url: base44FileUri,
    file_name: fileName,
    file_size: jsonStr.length,
    status: 'pending',
    notes,
    record_count: recordCount,
    external_file_id: externalFileId,
    external_backup_status: externalStatus,
    external_patient_file_count: 0,
    is_safety_backup: isSafetyBackup,
    patient_file_total: 0,
    patient_file_successful: 0,
    patient_file_failed: 0,
    patient_file_skipped: 0,
    patient_file_batch_status: 'pending',
    patient_file_mappings: [],
    patient_file_failed_details: [],
    patient_file_skipped_details: [],
  });

  // --- Process patient file contents in batches ---
  let batchResult;
  if (completeInOneCall) {
    // Process ALL batches in a loop (for automatic backups and safety backups)
    batchResult = await processAllPatientFileBatches(svc, clinicId, backupRecord);
  } else {
    // Process only the first batch — caller must continue with processPatientFileBatch
    batchResult = await processPatientFileBatch(svc, clinicId, backupRecord);
  }

  return {
    backup_id: backupRecord.id,
    file_name: fileName,
    file_size: jsonStr.length,
    status: batchResult.status,
    record_count: recordCount,
    external_backup_status: externalStatus,
    external_file_id: externalFileId,
    external_patient_file_count: batchResult.patient_file_successful || 0,
    patient_file_batch_status: batchResult.patient_file_batch_status,
    patient_file_total: batchResult.patient_file_total || 0,
    patient_file_successful: batchResult.patient_file_successful || 0,
    patient_file_failed: batchResult.patient_file_failed || 0,
    patient_file_skipped: batchResult.patient_file_skipped || 0,
    patient_file_remaining: batchResult.patient_file_remaining || 0,
    needs_more_batches: batchResult.needs_more_batches || false,
    error: batchResult.error,
  };
}
