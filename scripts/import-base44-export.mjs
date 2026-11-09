import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const inputPath = arg('--input');
const userMapPath = arg('--user-map');
if (!inputPath) throw new Error('Usage: node scripts/import-base44-export.mjs --input <export.json> [--user-map <legacy-to-supabase-user-ids.json>]');

const source = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
const sourceEntities = source.entities || source;
const schemaDir = path.join(root, 'migration', 'source-entities');
const schemas = fs.readdirSync(schemaDir).filter((file) => file.endsWith('.jsonc')).map((file) => {
  const value = JSON.parse(fs.readFileSync(path.join(schemaDir, file), 'utf8'));
  return [value.name, value];
});
const schemaByName = new Map(schemas);
const tableFor = (name) => {
  const value = name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  if (name === 'User') return 'users';
  return value.endsWith('y') && !/[aeiou]y$/.test(value) ? `${value.slice(0, -1)}ies` : `${value}s`;
};
const nameByInput = new Map(schemas.flatMap(([name]) => [[name.toLowerCase(), name], [tableFor(name).toLowerCase(), name]]));
const suppliedMap = userMapPath ? JSON.parse(fs.readFileSync(path.resolve(userMapPath), 'utf8')) : {};
const userMap = suppliedMap.users || suppliedMap;
const userRefs = new Set(['user_id', 'assigned_by_id', 'created_by_id', 'deleted_by_id', 'approved_by_id', 'invited_by_id', 'requested_by_id', 'locked_by_user_id']);
const relationTargets = {
  clinic_id: 'Clinic', patient_id: 'Patient', doctor_id: 'Doctor', treatment_id: 'Treatment',
  laboratory_id: 'Laboratory', lab_id: 'Laboratory', lab_case_id: 'LabCase', appointment_id: 'Appointment',
  patient_treatment_id: 'PatientTreatment', invoice_id: 'Invoice', payment_id: 'Payment', purchase_id: 'Purchase',
  staff_id: 'Staff', shift_id: 'Shift', referring_doctor_id: 'Doctor', assigned_doctor_id: 'Doctor',
  user_id: 'User', assigned_by_id: 'User', created_by_id: 'User', deleted_by_id: 'User', approved_by_id: 'User',
  invited_by_id: 'User', requested_by_id: 'User', locked_by_user_id: 'User',
};
const order = [
  'Clinic', 'User', 'ClinicRoleAssignment', 'UserSecurityProfile', 'Doctor', 'Staff', 'Treatment', 'Laboratory',
  'Patient', 'Appointment', 'PatientTreatment', 'LabCase', 'ConsentForm', 'PatientFile', 'Payment', 'Invoice',
  'Expense', 'Purchase', 'DoctorPayout', 'Shift', 'MessageLog', 'Notification', 'ReminderLog', 'ScheduledReport',
  'Backup', 'AuditLog', 'DeletedUser', 'PendingClinicDeletion', 'PendingPermanentDeletion', 'RestoreLock', 'VerificationOTP',
];
const suppliedNames = Object.keys(sourceEntities).filter((name) => Array.isArray(sourceEntities[name]));
const normalized = new Map();
const errors = [];
for (const suppliedName of suppliedNames) {
  const name = nameByInput.get(suppliedName.toLowerCase());
  if (!name) {
    errors.push({ entity: suppliedName, record_id: null, stage: 'parse', error: 'Unknown entity name; no source schema was found.' });
    continue;
  }
  if (normalized.has(name)) {
    errors.push({ entity: suppliedName, record_id: null, stage: 'parse', error: `Duplicate entity data for ${name}.` });
    continue;
  }
  normalized.set(name, sourceEntities[suppliedName]);
}
for (const [name, value] of Object.entries(sourceEntities)) {
  if (!Array.isArray(value) && value !== undefined && !['metadata', 'entities'].includes(name)) {
    errors.push({ entity: name, record_id: null, stage: 'parse', error: 'Entity payload must be an array of records.' });
  }
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the operator environment.');
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const counts = {};
const importedIds = new Map();
const failedIds = new Map();
for (const name of schemaByName.keys()) {
  if (normalized.has(name)) continue;
  counts[name] = { source: null, imported: 0, errors: 1, source_status: 'entity_array_missing_from_export' };
  errors.push({ entity: name, record_id: null, stage: 'parse', error: 'No entity array was present in the supplied export; source count is unknown.' });
}

function targetUserId(sourceId) {
  if (sourceId == null || sourceId === '') return sourceId;
  if (userMap[sourceId]) return userMap[sourceId];
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(sourceId))) return sourceId;
  return null;
}

function prepareRecord(entity, record) {
  const copy = structuredClone(record);
  if (entity === 'User') {
    const mapped = targetUserId(copy.id);
    if (!mapped) throw new Error('No Supabase Auth user ID mapping exists for this legacy user.');
    copy.legacy_user_id = copy.id;
    copy.id = mapped;
  }
  for (const [field, targetEntity] of Object.entries(relationTargets)) {
    if (copy[field] == null || copy[field] === '') continue;
    if (userRefs.has(field) || targetEntity === 'User') {
      const mapped = targetUserId(copy[field]);
      if (!mapped && copy[field] !== 'system') throw new Error(`No Supabase Auth user ID mapping exists for ${field}=${copy[field]}.`);
      if (mapped) copy[field] = mapped;
    }
  }
  for (const field of userRefs) {
    if (copy[field] == null || copy[field] === '' || copy[field] === 'system') continue;
    const mapped = targetUserId(copy[field]);
    if (!mapped) throw new Error(`No Supabase Auth user ID mapping exists for ${field}=${copy[field]}.`);
    copy[field] = mapped;
  }
  if (!copy.id) throw new Error('Source record has no id; import cannot preserve its identity safely.');
  return copy;
}

async function importEntity(name) {
  if (!normalized.has(name)) return;
  const rows = normalized.get(name);
  counts[name] = { source: rows.length, imported: 0, errors: 0 };
  importedIds.set(name, new Set());
  failedIds.set(name, new Set());
  const prepared = [];
  for (const record of rows) {
    try {
      prepared.push({ recordId: record?.id ?? null, value: prepareRecord(name, record) });
    } catch (error) {
      counts[name].errors += 1;
      failedIds.get(name).add(record?.id ?? '');
      errors.push({ entity: name, record_id: record?.id ?? null, stage: 'prepare', error: error.message });
    }
  }
  const table = tableFor(name);
  for (let start = 0; start < prepared.length; start += 100) {
    const batch = prepared.slice(start, start + 100);
    const { error } = await supabase.from(table).upsert(batch.map((item) => item.value), { onConflict: 'id' });
    if (!error) {
      counts[name].imported += batch.length;
      batch.forEach((item) => importedIds.get(name).add(item.value.id));
      continue;
    }
    // Isolate row-level failures after a rejected batch so every skipped record is explicit.
    for (const item of batch) {
      const { error: rowError } = await supabase.from(table).upsert(item.value, { onConflict: 'id' });
      if (rowError) {
        counts[name].errors += 1;
        failedIds.get(name).add(item.recordId ?? '');
        errors.push({ entity: name, record_id: item.recordId, stage: 'insert', error: rowError.message, code: rowError.code });
      } else {
        counts[name].imported += 1;
        importedIds.get(name).add(item.value.id);
      }
    }
  }
}

for (const name of [...order, ...schemaByName.keys()].filter((name, index, all) => all.indexOf(name) === index)) await importEntity(name);

for (const name of schemaByName.keys()) {
  const { count, error } = await supabase.from(tableFor(name)).select('id', { count: 'exact', head: true });
  if (error) {
    errors.push({ entity: name, record_id: null, stage: 'reconciliation', error: `Could not count destination ${tableFor(name)}: ${error.message}` });
    counts[name].destination_total = null;
  } else {
    counts[name].destination_total = count;
  }
}

const relationshipChecks = [];
for (const [name, rows] of normalized) {
  const schema = schemaByName.get(name);
  const fields = Object.keys(schema?.properties || {}).filter((field) => relationTargets[field]);
  for (const field of fields) {
    const targetName = relationTargets[field];
    const ids = new Set(rows.map((record) => {
      if (userRefs.has(field)) return targetUserId(record[field]);
      return record[field];
    }).filter((value) => value != null && value !== '' && value !== 'system'));
    if (!ids.size || !schemaByName.has(targetName)) continue;
    const table = tableFor(targetName);
    const found = new Set();
    const list = [...ids];
    for (let start = 0; start < list.length; start += 500) {
      const { data, error } = await supabase.from(table).select('id').in('id', list.slice(start, start + 500));
      if (error) {
        errors.push({ entity: name, record_id: null, stage: 'reconciliation', error: `Could not verify ${field} references in ${table}: ${error.message}` });
        break;
      }
      (data || []).forEach((row) => found.add(row.id));
    }
    const missing = list.filter((id) => !found.has(id));
    relationshipChecks.push({ entity: name, field, target: targetName, references: list.length, missing: missing.length, missing_ids: missing });
  }
}

const report = {
  generated_at: new Date().toISOString(),
  source_file: path.basename(path.resolve(inputPath)),
  destination_project: new URL(url).host,
  operation: 'non-destructive upsert by id; no target rows were deleted; destination_total includes any pre-existing rows',
  user_id_mapping_file: userMapPath ? path.basename(path.resolve(userMapPath)) : null,
  counts,
  relationships: relationshipChecks,
  errors,
};
const reportDir = path.join(root, 'migration', 'reports');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, `import-reconciliation-${new Date().toISOString().replaceAll(':', '').replaceAll('.', '-')}.json`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Import reconciliation: ${path.relative(root, reportPath)}. Imported rows: ${Object.values(counts).reduce((sum, value) => sum + value.imported, 0)}; errors: ${errors.length}.`);
