/**
 * Safe, reference-preserving restore logic with deep validation,
 * validate-before-delete, and full rollback on any failure.
 *
 * ARCHITECTURE:
 *   1. Deep validation runs BEFORE any destructive operation.
 *   2. If validation fails, the restore aborts — no data is touched.
 *   3. The caller creates a safety backup BEFORE calling restoreClinicData.
 *   4. Each entity is restored in dependency order (parents before children).
 *   5. If ANY entity fails, ALL entities are rolled back to the safety backup.
 *   6. Post-restore verification checks record counts against the backup.
 *   7. The restore is only considered successful if ALL entities pass.
 *
 * LIMITATION: Base44 does not support database transactions. The staged
 * restore + safety backup + full rollback is the safest possible approach
 * within this constraint. If the rollback itself fails, the safety backup
 * ID is returned for manual recovery via the "recover" action.
 */

// Restore order matters: parents before children.
// If a new entity is added, it MUST be added here AND in backupLogic.ts ENTITY_NAMES.
const RESTORE_PLAN = [
  { entity: 'Patient', key: 'patients', refs: {} },
  { entity: 'Doctor', key: 'doctors', refs: {} },
  { entity: 'Staff', key: 'staff', refs: {} },
  { entity: 'Treatment', key: 'treatments', refs: {} },
  { entity: 'Laboratory', key: 'labs', refs: {} },
  // PatientFile depends on Patient (patient_id). file_url/file_uri are preserved
  // as-is — private storage URIs remain valid after restore.
  { entity: 'PatientFile', key: 'patientFiles', refs: { patient_id: 'Patient' } },
  { entity: 'PatientTreatment', key: 'patientTreatments', refs: { patient_id: 'Patient', treatment_id: 'Treatment', doctor_id: 'Doctor' } },
  { entity: 'Appointment', key: 'appointments', refs: { patient_id: 'Patient', doctor_id: 'Doctor', treatment_id: 'Treatment' } },
  { entity: 'Payment', key: 'payments', refs: { patient_id: 'Patient', doctor_id: 'Doctor', patient_treatment_id: 'PatientTreatment' } },
  { entity: 'LabCase', key: 'labCases', refs: { patient_id: 'Patient', doctor_id: 'Doctor', lab_id: 'Laboratory' } },
  { entity: 'Shift', key: 'shifts', refs: { employee_id: 'Staff' } },
  { entity: 'DoctorPayout', key: 'payouts', refs: { doctor_id: 'Doctor' } },
  { entity: 'Expense', key: 'expenses', refs: {} },
  { entity: 'Purchase', key: 'purchases', refs: {} },
  { entity: 'MessageLog', key: 'messageLogs', refs: { patient_id: 'Patient', appointment_id: 'Appointment' } },
  { entity: 'ReminderLog', key: 'reminderLogs', refs: { patient_id: 'Patient', appointment_id: 'Appointment' } },
  // Notification: user_id points to the built-in User entity, which is NOT
  // recreated during restore (Users persist), so user_id is left as-is.
  { entity: 'Notification', key: 'notifications', refs: {} },
  // Invoice: patient_id and doctor_id are remapped. items/payment_ids are
  // snapshots stored at creation time — they are NOT remapped (they're
  // point-in-time documents, not live references).
  { entity: 'Invoice', key: 'invoices', refs: { patient_id: 'Patient', doctor_id: 'Doctor' } },
  { entity: 'ConsentForm', key: 'consentForms', refs: { patient_id: 'Patient', doctor_id: 'Doctor' } },
  // ScheduledReport: created_by_id is a built-in (not remapped). email_recipients
  // are plain strings, not entity references.
  { entity: 'ScheduledReport', key: 'scheduledReports', refs: {} },
];

export const BACKUP_KEY_MAP = Object.fromEntries(
  RESTORE_PLAN.map(s => [s.entity, s.key])
);

export const RESTORE_ENTITIES = RESTORE_PLAN.map(s => s.entity);

// V2 entities (added in backup version 2.0). V1 backups may not have these.
const V2_ENTITIES = ['Invoice', 'ConsentForm', 'ScheduledReport'];
const V2_KEYS = V2_ENTITIES.map(e => BACKUP_KEY_MAP[e]);

/**
 * Deep validation of backup data BEFORE any destructive operation.
 * Checks: structure, clinic_id, entity completeness, foreign-key references,
 * file references, currency data.
 *
 * Returns { valid, errors, warnings, recordCounts }.
 */
export function validateBackupDeep(backupData) {
  const errors = [];
  const warnings = [];
  const recordCounts = {};

  if (!backupData || typeof backupData !== 'object') {
    return { valid: false, errors: ['Backup data is not a valid object'], warnings: [], recordCounts: {} };
  }

  if (!backupData.backup_version) {
    errors.push('Backup file is missing version information');
  }

  if (!backupData.clinic_id) {
    errors.push('Backup file is missing clinic_id');
  }

  const isV2 = backupData.backup_version === '2.0';

  // Verify each expected key exists and is an array
  for (const step of RESTORE_PLAN) {
    const key = step.key;
    if (backupData[key] === undefined) {
      // V2 entities may be missing in V1 backups — warn, don't fail
      if (V2_KEYS.includes(key) && !isV2) {
        warnings.push(`Entity "${key}" not in V1 backup — will be skipped`);
        recordCounts[step.entity] = 0;
        continue;
      }
      errors.push(`Backup is missing entity key "${key}" (${step.entity})`);
      continue;
    }
    if (!Array.isArray(backupData[key])) {
      errors.push(`Backup key "${key}" is not an array`);
      continue;
    }
    recordCounts[step.entity] = backupData[key].length;
  }

  // Verify clinic_id on all records matches the backup's clinic_id
  if (backupData.clinic_id) {
    for (const step of RESTORE_PLAN) {
      const records = backupData[step.key] || [];
      for (const r of records) {
        if (r.clinic_id && r.clinic_id !== backupData.clinic_id) {
          errors.push(`${step.entity}: record ${r.id} has clinic_id "${r.clinic_id}" that doesn't match backup clinic_id`);
          break; // Report once per entity
        }
      }
    }
  }

  // Verify foreign-key references (warn about dangling refs — they'll be dropped)
  const entityIds = {};
  for (const step of RESTORE_PLAN) {
    entityIds[step.entity] = new Set((backupData[step.key] || []).map(r => r.id).filter(Boolean));
  }

  for (const step of RESTORE_PLAN) {
    const records = backupData[step.key] || [];
    let danglingCount = 0;
    for (const r of records) {
      for (const [field, parentEntity] of Object.entries(step.refs)) {
        const ref = r[field];
        if (ref && entityIds[parentEntity] && !entityIds[parentEntity].has(ref)) {
          danglingCount++;
        }
      }
    }
    if (danglingCount > 0) {
      warnings.push(`${step.entity}: ${danglingCount} dangling foreign-key reference(s) will be dropped`);
    }
  }

  // Verify PatientFile has file references
  const patientFiles = backupData.patientFiles || [];
  let missingFileRefs = 0;
  for (const f of patientFiles) {
    if (!f.file_url && !f.file_uri) {
      missingFileRefs++;
    }
  }
  if (missingFileRefs > 0) {
    warnings.push(`PatientFile: ${missingFileRefs} record(s) have no file_url or file_uri`);
  }

  // Verify payments have currency
  const payments = backupData.payments || [];
  let missingCurrency = 0;
  for (const p of payments) {
    if (!p.currency) missingCurrency++;
  }
  if (missingCurrency > 0) {
    warnings.push(`Payment: ${missingCurrency} record(s) missing currency`);
  }

  return { valid: errors.length === 0, errors, warnings, recordCounts };
}

/**
 * Basic structural validation (kept for backwards compatibility).
 * Use validateBackupDeep for comprehensive validation.
 */
export function validateBackupData(backupData) {
  const errors = [];

  if (!backupData || typeof backupData !== 'object') {
    return { valid: false, errors: ['Backup data is not a valid object'] };
  }

  if (!backupData.backup_version) {
    errors.push('Backup file is missing version information');
  }

  if (!backupData.clinic_id) {
    errors.push('Backup file is missing clinic_id');
  }

  for (const step of RESTORE_PLAN) {
    const key = step.key;
    if (backupData[key] !== undefined && !Array.isArray(backupData[key])) {
      errors.push(`Backup key "${key}" is not an array`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Restores a single entity from backup data, with reference remapping.
 * Does NOT do per-entity rollback — rollback is handled at the clinic level.
 * Returns { entity, deleted, restored, error }.
 */
async function restoreEntity(svc, clinicId, step, backupData, idMaps) {
  const { entity, key, refs } = step;
  idMaps[entity] = idMaps[entity] || {};

  try {
    const records = backupData[key] || [];

    // Delete this clinic's existing records for the entity.
    // This is safe because clinic_id is always forced in the filter.
    await svc.entities[entity].deleteMany({ clinic_id: clinicId });

    if (records.length === 0) {
      return { entity, deleted: true, restored: 0, error: null };
    }

    // Strip built-ins, force clinic_id, and remap every reference field
    const oldIds = [];
    const cleanRecords = records.map(r => {
      const { id, created_date, updated_date, created_by_id, clinic_id, ...rest } = r;
      oldIds.push(id);

      for (const [field, parentEntity] of Object.entries(refs)) {
        const oldRef = rest[field];
        if (oldRef) {
          const newRef = idMaps[parentEntity]?.[oldRef];
          if (newRef) rest[field] = newRef;
          else delete rest[field]; // Drop dangling references
        }
      }

      return { ...rest, clinic_id: clinicId };
    });

    // Create in batches of 500
    let restoredCount = 0;
    for (let i = 0; i < cleanRecords.length; i += 500) {
      const batch = cleanRecords.slice(i, i + 500);
      const created = await svc.entities[entity].bulkCreate(batch);
      const createdList = Array.isArray(created) ? created : (created?.records || []);
      createdList.forEach((rec, idx) => {
        const oldId = oldIds[i + idx];
        if (oldId && rec?.id) idMaps[entity][oldId] = rec.id;
      });
      restoredCount += createdList.length;
    }

    // Verify count matches
    if (restoredCount !== records.length) {
      return {
        entity,
        deleted: true,
        restored: restoredCount,
        error: `Count mismatch: expected ${records.length}, got ${restoredCount}`,
      };
    }

    return { entity, deleted: true, restored: restoredCount, error: null };
  } catch (e) {
    return { entity, deleted: true, restored: 0, error: e?.message || String(e) };
  }
}

/**
 * Rolls back a single entity from the safety backup data.
 * Deletes the newly created records and recreates from the safety backup.
 * Uses a separate idMaps so rollback references are remapped correctly.
 * Returns { entity, rolledBack, restored, error }.
 */
async function rollbackEntity(svc, clinicId, step, safetyBackupData, rollbackIdMaps) {
  const { entity, key, refs } = step;
  rollbackIdMaps[entity] = rollbackIdMaps[entity] || {};

  try {
    const safetyRecords = safetyBackupData[key] || [];

    // Delete the newly created records (from the failed restore)
    await svc.entities[entity].deleteMany({ clinic_id: clinicId });

    if (safetyRecords.length === 0) {
      return { entity, rolledBack: true, restored: 0, error: null };
    }

    // Strip built-ins, force clinic_id, and remap references using rollback idMaps
    const oldIds = [];
    const cleanRecords = safetyRecords.map(r => {
      const { id, created_date, updated_date, created_by_id, clinic_id, ...rest } = r;
      oldIds.push(id);

      for (const [field, parentEntity] of Object.entries(refs)) {
        const oldRef = rest[field];
        if (oldRef) {
          const newRef = rollbackIdMaps[parentEntity]?.[oldRef];
          if (newRef) rest[field] = newRef;
          else delete rest[field];
        }
      }

      return { ...rest, clinic_id: clinicId };
    });

    // Create in batches of 500
    let restoredCount = 0;
    for (let i = 0; i < cleanRecords.length; i += 500) {
      const batch = cleanRecords.slice(i, i + 500);
      const created = await svc.entities[entity].bulkCreate(batch);
      const createdList = Array.isArray(created) ? created : (created?.records || []);
      createdList.forEach((rec, idx) => {
        const oldId = oldIds[i + idx];
        if (oldId && rec?.id) rollbackIdMaps[entity][oldId] = rec.id;
      });
      restoredCount += createdList.length;
    }

    return { entity, rolledBack: true, restored: restoredCount, error: null };
  } catch (e) {
    return { entity, rolledBack: false, restored: 0, error: e?.message || String(e) };
  }
}

/**
 * Verifies restored record counts match the backup.
 * Returns { verified, mismatches }.
 */
async function verifyRestoredCounts(svc, clinicId, backupData) {
  const mismatches = [];
  for (const step of RESTORE_PLAN) {
    const expected = (backupData[step.key] || []).length;
    if (expected === 0) continue; // Skip empty entities

    // Fetch one more than expected to check for duplicates/extra records
    const checkRecords = await svc.entities[step.entity].filter(
      { clinic_id: clinicId },
      '-created_date',
      expected + 1,
      0
    );

    if (checkRecords.length !== expected) {
      mismatches.push({
        entity: step.entity,
        expected,
        actual: checkRecords.length,
      });
    }
  }
  return { verified: mismatches.length === 0, mismatches };
}

/**
 * Restores a clinic's data from a parsed backup object, preserving all
 * record-to-record references. clinicId is always forced onto every record.
 *
 * FLOW:
 *   1. Restore all entities in dependency order.
 *   2. If ANY entity fails, rollback ALL entities from the safety backup.
 *   3. Verify record counts after restore.
 *   4. Only consider successful if ALL entities pass.
 *
 * If safetyBackupData is null and a failure occurs, the failed entities
 * are left in their post-delete state (data loss). The caller should always
 * provide safetyBackupData.
 */
export async function restoreClinicData(svc, clinicId, backupData, safetyBackupData) {
  const results = {};
  const idMaps = {};
  const failedEntities = [];
  const rolledBackEntities = [];

  // Phase 1: Restore all entities in dependency order
  for (const step of RESTORE_PLAN) {
    const result = await restoreEntity(svc, clinicId, step, backupData, idMaps);
    results[result.entity] = {
      deleted: result.deleted,
      restored: result.restored,
      error: result.error,
      rolledBack: false,
    };
    if (result.error) failedEntities.push(result.entity);
  }

  // Phase 2: If any entity failed, rollback ALL entities from safety backup
  if (failedEntities.length > 0 && safetyBackupData) {
    const rollbackIdMaps = {};

    for (const step of RESTORE_PLAN) {
      const rollbackResult = await rollbackEntity(svc, clinicId, step, safetyBackupData, rollbackIdMaps);
      results[step.entity].rolledBack = rollbackResult.rolledBack;
      results[step.entity].restored = rollbackResult.restored;
      if (rollbackResult.error) {
        results[step.entity].rollbackError = rollbackResult.error;
      }
      rolledBackEntities.push(step.entity);
    }

    return {
      results,
      failedEntities,
      rolledBackEntities,
      allSucceeded: false,
      rolledBack: true,
      idMaps,
    };
  }

  // Phase 3: Post-restore verification (only if all entities succeeded)
  if (failedEntities.length === 0) {
    const verification = await verifyRestoredCounts(svc, clinicId, backupData);
    if (!verification.verified) {
      // Count mismatch — this is a failure even though no errors were thrown
      for (const mismatch of verification.mismatches) {
        results[mismatch.entity].error = `Count mismatch: expected ${mismatch.expected}, got ${mismatch.actual}`;
        failedEntities.push(mismatch.entity);
      }

      // Rollback ALL entities from safety backup
      if (safetyBackupData) {
        const rollbackIdMaps = {};
        for (const step of RESTORE_PLAN) {
          const rollbackResult = await rollbackEntity(svc, clinicId, step, safetyBackupData, rollbackIdMaps);
          results[step.entity].rolledBack = rollbackResult.rolledBack;
          results[step.entity].restored = rollbackResult.restored;
          if (rollbackResult.error) {
            results[step.entity].rollbackError = rollbackResult.error;
          }
          rolledBackEntities.push(step.entity);
        }
      }

      return {
        results,
        failedEntities,
        rolledBackEntities,
        allSucceeded: false,
        rolledBack: true,
        countMismatches: verification.mismatches,
        idMaps,
      };
    }
  }

  return {
    results,
    failedEntities,
    rolledBackEntities,
    allSucceeded: failedEntities.length === 0,
    rolledBack: false,
    idMaps,
  };
}