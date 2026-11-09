/**
 * Shared clinic deletion logic.
 *
 * TWO DELETION MODES:
 *
 * 1. SOFT-DELETE (softDeleteClinic):
 *    Marks the Clinic record with is_deleted=true. ALL data is preserved.
 *    The clinic becomes inaccessible via normal operations. Can be restored.
 *
 * 2. PERMANENT DELETE (hardDeleteClinicData):
 *    Physically destroys ALL clinic-scoped data. IRREVERSIBLE.
 *    Only available for soft-deleted clinics, from the Recycle Bin.
 *    This is the ONLY place where clinic data is physically deleted.
 */

/**
 * All clinic-scoped entities that must be hard-deleted when a clinic is
 * permanently deleted. This list MUST stay in sync with the entity schemas
 * and the backup ENTITY_NAMES list in backupLogic.ts.
 *
 * The Clinic record itself is NOT in this list — it is deleted separately
 * (last) by the caller. PendingPermanentDeletion is also handled separately
 * (the current record is preserved for audit; others are deleted).
 */
const CLINIC_SCOPED_ENTITIES = [
  'Patient', 'Doctor', 'Staff', 'Appointment', 'Treatment',
  'PatientTreatment', 'Payment', 'Laboratory', 'LabCase', 'Shift',
  'DoctorPayout', 'PatientFile', 'Notification', 'MessageLog', 'ReminderLog',
  'Expense', 'Purchase', 'Invoice', 'ConsentForm', 'ScheduledReport',
  'VerificationOTP', 'UserSecurityProfile', 'ClinicRoleAssignment',
  'AuditLog', 'Backup', 'RestoreLock', 'PendingClinicDeletion',
];

/**
 * Soft-delete a clinic — mark it as deleted without removing any data.
 * Idempotent: if the clinic is already soft-deleted, returns success.
 */
export async function softDeleteClinic(
  svc: any,
  clinicId: string,
  deletedBy: string,
  deletedByName: string
): Promise<{ success: boolean }> {
  let clinic;
  try {
    clinic = await svc.entities.Clinic.get(clinicId);
  } catch (_) {
    throw new Error('Clinic not found');
  }
  if (!clinic) {
    throw new Error('Clinic not found');
  }

  if (clinic.is_deleted || clinic.deletion_status === 'soft_deleted') {
    return { success: true };
  }

  await svc.entities.Clinic.update(clinicId, {
    is_deleted: true,
    deletion_status: 'soft_deleted',
    deleted_at: new Date().toISOString(),
    deleted_by: deletedBy,
    deleted_by_name: deletedByName,
  });

  return { success: true };
}

/**
 * Delete all records for a single entity+clinic using deleteMany in a loop.
 * Handles potential batch limits by checking for remaining records after
 * each deleteMany call.
 */
async function deleteAllClinicRecords(svc: any, entityName: string, clinicId: string) {
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (iterations < MAX_ITERATIONS) {
    try {
      await svc.entities[entityName].deleteMany({ clinic_id: clinicId });
    } catch (e: any) {
      throw new Error(`${entityName}.deleteMany failed: ${e?.message || String(e)}`);
    }

    // Check if any records remain
    let remaining;
    try {
      remaining = await svc.entities[entityName].filter({ clinic_id: clinicId }, null, 1);
    } catch (_) {
      remaining = [];
    }

    if (!remaining || remaining.length === 0) return;
    iterations++;
  }

  throw new Error(`${entityName}: max iterations reached — records may remain`);
}

/**
 * HARD-DELETE all clinic-scoped data. Physically destroys ALL records
 * belonging to the specified clinic across ALL clinic-scoped entities.
 *
 * This is the ONLY function that physically deletes clinic data.
 * IRREVERSIBLE. Only called by executePermanentDeletion.
 *
 * The Clinic record itself is NOT deleted here — the caller deletes it
 * last (after verifying all other data is gone).
 *
 * @param svc                — base44.asServiceRole SDK client
 * @param clinicId           — the clinic to hard-delete
 * @param excludePendingId   — PendingPermanentDeletion record to preserve (the current one)
 * @returns { results, errors }
 */
export async function hardDeleteClinicData(
  svc: any,
  clinicId: string,
  excludePendingId: string | null = null
): Promise<{ results: Record<string, any>; errors: Array<{ entity: string; error: string }> }> {
  const results: Record<string, any> = {};
  const errors: Array<{ entity: string; error: string }> = [];

  // Delete all clinic-scoped entities
  for (const entityName of CLINIC_SCOPED_ENTITIES) {
    try {
      await deleteAllClinicRecords(svc, entityName, clinicId);
      results[entityName] = { deleted: true };
    } catch (e: any) {
      errors.push({ entity: entityName, error: e?.message || String(e) });
      results[entityName] = { deleted: false, error: e?.message || String(e) };
    }
  }

  // Delete PendingPermanentDeletion records for this clinic (except the current one)
  try {
    const allPending = await svc.entities.PendingPermanentDeletion.filter(
      { clinic_id: clinicId },
      '-requested_at',
      500
    );
    for (const p of allPending || []) {
      if (excludePendingId && p.id === excludePendingId) continue;
      try {
        await svc.entities.PendingPermanentDeletion.delete(p.id);
      } catch (_) {}
    }
    results['PendingPermanentDeletion'] = { deleted: true };
  } catch (e: any) {
    errors.push({ entity: 'PendingPermanentDeletion', error: e?.message || String(e) });
    results['PendingPermanentDeletion'] = { deleted: false, error: e?.message || String(e) };
  }

  return { results, errors };
}

/**
 * Verify that no clinic-scoped data remains for a clinic.
 * Called after hardDeleteClinicData + Clinic.delete to confirm
 * the permanent deletion is complete.
 *
 * @returns { verified: boolean, errors: string[] }
 */
export async function verifyClinicDataGone(
  svc: any,
  clinicId: string,
  excludePendingId: string | null = null
): Promise<{ verified: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Check if Clinic record still exists
  try {
    const clinic = await svc.entities.Clinic.get(clinicId);
    if (clinic) {
      errors.push('Clinic record still exists');
    }
  } catch (_) {
    // Clinic not found — good
  }

  // Check each clinic-scoped entity for remaining records
  for (const entityName of CLINIC_SCOPED_ENTITIES) {
    try {
      const remaining = await svc.entities[entityName].filter({ clinic_id: clinicId }, null, 1);
      if (remaining && remaining.length > 0) {
        errors.push(`${entityName}: records still exist`);
      }
    } catch (_) {}
  }

  // Check PendingPermanentDeletion (should only have the current record)
  try {
    const remaining = await svc.entities.PendingPermanentDeletion.filter({ clinic_id: clinicId }, null, 500);
    const filtered = (remaining || []).filter((r: any) => r.id !== excludePendingId);
    if (filtered.length > 0) {
      errors.push(`PendingPermanentDeletion: ${filtered.length} extra records still exist`);
    }
  } catch (_) {}

  return { verified: errors.length === 0, errors };
}