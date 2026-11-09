import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const entityDirectory = path.join(root, 'migration', 'source-entities');
const migrationDirectory = path.join(root, 'supabase', 'migrations');
const output = path.join(migrationDirectory, '202611080001_initial_schema.sql');

const snake = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const tableFor = (name) => {
  const value = snake(name);
  if (name === 'User') return 'users';
  return value.endsWith('y') && !/[aeiou]y$/.test(value) ? `${value.slice(0, -1)}ies` : `${value}s`;
};
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sqlType = (property) => {
  if (property.format === 'date-time') return 'timestamptz';
  if (property.format === 'date') return 'date';
  switch (property.type) {
    case 'string': return 'text';
    case 'number': return 'numeric';
    case 'integer': return 'integer';
    case 'boolean': return 'boolean';
    case 'array':
    case 'object': return 'jsonb';
    default: throw new Error(`Unsupported property type: ${property.type}`);
  }
};
const defaultSql = (property) => {
  if (!Object.hasOwn(property, 'default')) return '';
  if (property.type === 'string') return ` DEFAULT ${quote(property.default)}`;
  if (property.type === 'boolean') return ` DEFAULT ${property.default ? 'true' : 'false'}`;
  if (property.type === 'array' || property.type === 'object') return ` DEFAULT ${quote(JSON.stringify(property.default))}::jsonb`;
  return ` DEFAULT ${Number(property.default)}`;
};

const schemas = fs.readdirSync(entityDirectory).filter((file) => file.endsWith('.jsonc')).map((file) => {
  const value = JSON.parse(fs.readFileSync(path.join(entityDirectory, file), 'utf8'));
  return { ...value, table: tableFor(value.name), source: file };
}).sort((a, b) => a.name.localeCompare(b.name));

const permissions = {
  Appointment: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin', 'receptionist'], ['clinic_admin', 'receptionist']],
  AuditLog: [['clinic_admin', 'doctor', 'receptionist'], [], []],
  Backup: [['clinic_admin'], ['clinic_admin'], ['clinic_admin']],
  ConsentForm: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin']],
  Doctor: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin'], ['clinic_admin']],
  DoctorPayout: [['clinic_admin'], ['clinic_admin'], ['clinic_admin']],
  Expense: [['clinic_admin'], ['clinic_admin'], ['clinic_admin']],
  Invoice: [['clinic_admin', 'receptionist'], ['clinic_admin', 'receptionist'], ['clinic_admin']],
  LabCase: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin', 'receptionist']],
  Laboratory: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin', 'receptionist'], ['clinic_admin']],
  MessageLog: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin'], ['clinic_admin']],
  Notification: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin'], ['clinic_admin']],
  Patient: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin', 'receptionist'], ['clinic_admin', 'receptionist']],
  PatientFile: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin', 'receptionist']],
  PatientTreatment: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin', 'doctor', 'receptionist']],
  Payment: [['clinic_admin', 'receptionist'], ['clinic_admin', 'receptionist'], ['clinic_admin', 'receptionist']],
  Purchase: [['clinic_admin'], ['clinic_admin'], ['clinic_admin']],
  ReminderLog: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin'], ['clinic_admin']],
  ScheduledReport: [['clinic_admin'], ['clinic_admin'], ['clinic_admin']],
  Shift: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin'], ['clinic_admin']],
  Staff: [['clinic_admin'], ['clinic_admin'], ['clinic_admin']],
  Treatment: [['clinic_admin', 'doctor', 'receptionist'], ['clinic_admin'], ['clinic_admin']],
};

const lines = [
  '-- Generated from Base44 JSONC entity schemas; see docs/migration-inventory.md.',
  '-- IDs remain TEXT to preserve imported source identifiers. Historical dates and audit fields are retained.',
  'BEGIN;',
  '',
  `CREATE TABLE IF NOT EXISTS public.platform_owners (\n  user_id text PRIMARY KEY,\n  provisioned_at timestamptz NOT NULL DEFAULT now(),\n  provisioned_by text\n);`,
  'ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;',
  '',
  ...schemas.map((schema) => {
    const required = new Set(schema.required || []);
    const columns = [
      `  id text PRIMARY KEY DEFAULT gen_random_uuid()::text`,
      ...Object.entries(schema.properties || {}).map(([name, property]) => {
        const notNull = required.has(name) ? ' NOT NULL' : '';
        const def = defaultSql(property);
        const enumCheck = property.enum ? ` CHECK (${snake(name)} IN (${property.enum.map((item) => typeof item === 'number' ? String(item) : quote(item)).join(', ')}))` : '';
        return `  ${snake(name)} ${sqlType(property)}${def}${notNull}${enumCheck}`;
      }),
      '  created_date timestamptz NOT NULL DEFAULT now()',
      '  updated_date timestamptz NOT NULL DEFAULT now()',
      '  created_by_id text',
      '  created_by text',
    ];
    if (schema.name === 'User') {
      columns.splice(1, 0, '  email text', '  full_name text', '  legacy_user_id text UNIQUE');
      columns[0] = '  id text PRIMARY KEY';
    }
    return `CREATE TABLE IF NOT EXISTS public.${schema.table} (\n${columns.join(',\n')}\n);`;
  }),
  '',
  'CREATE OR REPLACE FUNCTION public.is_platform_owner()',
  'RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$',
  '  SELECT EXISTS (SELECT 1 FROM public.platform_owners p WHERE p.user_id = auth.uid()::text)',
  '$$;',
  '',
  'CREATE OR REPLACE FUNCTION public.app_user_role(target_clinic_id text)',
  'RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$',
  '  SELECT CASE',
  '    WHEN EXISTS (SELECT 1 FROM public.platform_owners p WHERE p.user_id = auth.uid()::text) THEN \'super_admin\'',
  '    ELSE (SELECT a.role FROM public.clinic_role_assignments a',
  '          WHERE a.user_id = auth.uid()::text AND a.clinic_id = target_clinic_id AND a.status = \'active\'',
  '          ORDER BY a.assigned_at DESC NULLS LAST, a.updated_date DESC NULLS LAST LIMIT 1)',
  '  END',
  '$$;',
  '',
  'CREATE OR REPLACE FUNCTION public.app_can_access_clinic(target_clinic_id text, allowed_roles text[] DEFAULT ARRAY[\'clinic_admin\', \'doctor\', \'receptionist\']::text[])',
  'RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$',
  '  SELECT target_clinic_id IS NOT NULL AND (',
  '    EXISTS (SELECT 1 FROM public.platform_owners p WHERE p.user_id = auth.uid()::text)',
  '    OR EXISTS (SELECT 1 FROM public.clinic_role_assignments a',
  '              WHERE a.user_id = auth.uid()::text AND a.clinic_id = target_clinic_id',
  '                AND a.status = \'active\' AND a.role = ANY(allowed_roles))',
  '  )',
  '$$;',
  '',
  'CREATE OR REPLACE FUNCTION public.app_mfa_access_allowed()',
  'RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$',
  '  SELECT ARRAY[COALESCE(auth.jwt()->>\'aal\', \'aal1\')] <@ (',
  '    SELECT CASE WHEN count(id) > 0 THEN ARRAY[\'aal2\'] ELSE ARRAY[\'aal1\', \'aal2\'] END',
  '    FROM auth.mfa_factors WHERE user_id = auth.uid() AND status = \'verified\'',
  '  )',
  '$$;',
  'REVOKE ALL ON FUNCTION public.app_user_role(text) FROM PUBLIC, anon;',
  'REVOKE ALL ON FUNCTION public.is_platform_owner() FROM PUBLIC, anon;',
  'REVOKE ALL ON FUNCTION public.app_can_access_clinic(text, text[]) FROM PUBLIC, anon;',
  'REVOKE ALL ON FUNCTION public.app_mfa_access_allowed() FROM PUBLIC, anon;',
  'GRANT EXECUTE ON FUNCTION public.app_user_role(text) TO authenticated, service_role;',
  'GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated, service_role;',
  'GRANT EXECUTE ON FUNCTION public.app_can_access_clinic(text, text[]) TO authenticated, service_role;',
  'GRANT EXECUTE ON FUNCTION public.app_mfa_access_allowed() TO authenticated, service_role;',
  `CREATE OR REPLACE FUNCTION public.apply_patient_plan_discount(p_clinic_id text, p_patient_id text, p_discount_type text, p_discount_value numeric, p_changes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_patient public.patients%ROWTYPE;
  v_expected integer;
  v_unique_changes integer;
  v_updated integer := 0;
  v_row_count integer;
  v_change jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'array' THEN
    RAISE EXCEPTION 'Discount changes must be an array' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id AND clinic_id = p_clinic_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Patient not found in clinic' USING ERRCODE = 'P0002'; END IF;
  SELECT count(*) INTO v_expected FROM public.patient_treatments WHERE clinic_id = p_clinic_id AND patient_id = p_patient_id;
  SELECT count(DISTINCT item.value->>'id') INTO v_unique_changes FROM jsonb_array_elements(p_changes) AS item(value);
  IF v_unique_changes <> v_expected OR jsonb_array_length(p_changes) <> v_expected THEN
    RAISE EXCEPTION 'Treatment list changed; refresh and retry' USING ERRCODE = '40001';
  END IF;
  FOR v_change IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    UPDATE public.patient_treatments
       SET discount_type = v_change->>'discount_type',
           discount_value = (v_change->>'discount_value')::numeric,
           updated_date = now()
     WHERE id = v_change->>'id' AND clinic_id = p_clinic_id AND patient_id = p_patient_id;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count <> 1 THEN RAISE EXCEPTION 'Treatment not found in patient clinic' USING ERRCODE = 'P0002'; END IF;
    v_updated := v_updated + v_row_count;
  END LOOP;
  UPDATE public.patients
     SET plan_discount_type = p_discount_type, plan_discount_value = p_discount_value, updated_date = now()
   WHERE id = p_patient_id AND clinic_id = p_clinic_id
   RETURNING * INTO v_patient;
  RETURN jsonb_build_object('patient', to_jsonb(v_patient), 'updated_treatments', v_updated);
END;
$$;`,
  'REVOKE ALL ON FUNCTION public.apply_patient_plan_discount(text, text, text, numeric, jsonb) FROM PUBLIC, anon, authenticated;',
  'GRANT EXECUTE ON FUNCTION public.apply_patient_plan_discount(text, text, text, numeric, jsonb) TO service_role;',
  `CREATE OR REPLACE FUNCTION public.commit_payment_mutation(p_action text, p_clinic_id text, p_payment_id text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_existing public.payments%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_old_treatment_id text;
  v_new_treatment_id text;
  v_cost numeric;
  v_before numeric;
  v_amount numeric;
  v_net numeric;
  v_rate numeric;
  v_deleted_id text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('create', 'update', 'delete') THEN
    RAISE EXCEPTION 'Invalid payment action' USING ERRCODE = '22023';
  END IF;

  IF p_action IN ('update', 'delete') THEN
    SELECT * INTO v_existing FROM public.payments WHERE id = p_payment_id AND clinic_id = p_clinic_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found in clinic' USING ERRCODE = 'P0002'; END IF;
    v_old_treatment_id := v_existing.patient_treatment_id;
  END IF;

  IF p_action = 'delete' THEN
    DELETE FROM public.payments WHERE id = p_payment_id AND clinic_id = p_clinic_id;
    UPDATE public.patient_treatments pt
       SET paid_amount = round(COALESCE((
             SELECT sum(p.amount) FROM public.payments p
              WHERE p.clinic_id = pt.clinic_id AND p.patient_treatment_id = pt.id
                AND COALESCE(p.currency, 'USD') = COALESCE(pt.currency, 'USD')
           ), 0), 2),
           updated_date = now()
     WHERE pt.id = v_old_treatment_id AND pt.clinic_id = p_clinic_id;
    RETURN jsonb_build_object('action', 'delete', 'payment_id', p_payment_id, 'previous', to_jsonb(v_existing));
  END IF;

  IF p_action = 'update' AND NOT (v_payload ? 'patient_treatment_id') THEN
    v_payload := jsonb_set(v_payload, '{patient_treatment_id}', COALESCE(to_jsonb(v_existing.patient_treatment_id), 'null'::jsonb), true);
  END IF;
  v_payment := jsonb_populate_record(NULL::public.payments, v_payload);
  IF v_payment.clinic_id IS DISTINCT FROM p_clinic_id THEN RAISE EXCEPTION 'Clinic scope mismatch' USING ERRCODE = '42501'; END IF;
  IF p_action = 'update' THEN v_payment.id := p_payment_id; ELSE v_payment.id := COALESCE(NULLIF(v_payment.id, ''), gen_random_uuid()::text); END IF;
  v_new_treatment_id := v_payment.patient_treatment_id;

  PERFORM 1 FROM public.patient_treatments pt
   WHERE pt.clinic_id = p_clinic_id AND pt.id = ANY(array_remove(ARRAY[v_old_treatment_id, v_new_treatment_id], NULL))
   ORDER BY pt.id FOR UPDATE;
  IF v_new_treatment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.patient_treatments pt
     WHERE pt.id = v_new_treatment_id AND pt.clinic_id = p_clinic_id AND pt.patient_id = v_payment.patient_id
  ) THEN
    RAISE EXCEPTION 'Treatment does not belong to the payment patient and clinic' USING ERRCODE = '42501';
  END IF;

  IF v_payment.is_prosthesis AND v_new_treatment_id IS NOT NULL THEN
    v_amount := COALESCE(v_payment.amount, 0);
    v_cost := COALESCE(v_payment.prosthesis_cost, 0);
    SELECT COALESCE(sum(p.amount), 0) INTO v_before FROM public.payments p
     WHERE p.clinic_id = p_clinic_id AND p.patient_treatment_id = v_new_treatment_id
       AND COALESCE(p.currency, 'USD') = COALESCE(v_payment.currency, 'USD')
       AND (p_action <> 'update' OR p.id <> p_payment_id);
    IF v_cost <= 0 OR v_before >= v_cost THEN v_net := v_amount;
    ELSIF v_before + v_amount <= v_cost THEN v_net := 0;
    ELSE v_net := round(v_before + v_amount - v_cost, 2);
    END IF;
    v_payment.net_amount := v_net;
    v_rate := COALESCE(v_payment.doctor_commission_percentage, 0);
    v_payment.doctor_commission_amount := round(v_net * v_rate / 100, 2);
  END IF;

  v_payment.updated_date := now();
  IF p_action = 'create' THEN
    v_payment.created_date := COALESCE(v_payment.created_date, now());
    INSERT INTO public.payments SELECT (v_payment).* RETURNING * INTO v_payment;
  ELSE
    v_payment.created_date := v_existing.created_date;
    v_payment.created_by_id := v_existing.created_by_id;
    v_payment.created_by := v_existing.created_by;
    UPDATE public.payments SET
      patient_id = v_payment.patient_id,
      patient_treatment_id = v_payment.patient_treatment_id,
      doctor_id = v_payment.doctor_id,
      doctor_name = v_payment.doctor_name,
      doctor_commission_percentage = v_payment.doctor_commission_percentage,
      doctor_commission_amount = v_payment.doctor_commission_amount,
      is_prosthesis = v_payment.is_prosthesis,
      prosthesis_cost = v_payment.prosthesis_cost,
      net_amount = v_payment.net_amount,
      amount = v_payment.amount,
      currency = v_payment.currency,
      method = v_payment.method,
      notes = v_payment.notes,
      payment_date = v_payment.payment_date,
      updated_date = v_payment.updated_date
    WHERE id = p_payment_id AND clinic_id = p_clinic_id
    RETURNING * INTO v_payment;
  END IF;

  UPDATE public.patient_treatments pt
     SET paid_amount = round(COALESCE((
           SELECT sum(p.amount) FROM public.payments p
            WHERE p.clinic_id = pt.clinic_id AND p.patient_treatment_id = pt.id
              AND COALESCE(p.currency, 'USD') = COALESCE(pt.currency, 'USD')
         ), 0), 2),
         updated_date = now()
   WHERE pt.clinic_id = p_clinic_id AND pt.id = ANY(array_remove(ARRAY[v_old_treatment_id, v_new_treatment_id], NULL));
  RETURN jsonb_build_object('action', p_action, 'payment', to_jsonb(v_payment), 'previous', CASE WHEN p_action = 'update' THEN to_jsonb(v_existing) ELSE NULL END);
END;
$$;`,
  'REVOKE ALL ON FUNCTION public.commit_payment_mutation(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;',
  'GRANT EXECUTE ON FUNCTION public.commit_payment_mutation(text, text, text, jsonb) TO service_role;',
  `CREATE OR REPLACE FUNCTION public.commit_lab_case_finalization(p_action text, p_clinic_id text, p_lab_case_id text, p_fields jsonb, p_expense jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_case public.lab_cases%ROWTYPE;
  v_expense public.expenses%ROWTYPE;
  v_action text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('finalize', 'unfinalize') THEN
    RAISE EXCEPTION 'Invalid lab case action' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_case FROM public.lab_cases WHERE id = p_lab_case_id AND clinic_id = p_clinic_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lab case not found in clinic' USING ERRCODE = 'P0002'; END IF;

  IF p_action = 'finalize' THEN
    IF v_case.status <> 'delivered' OR v_case.is_finalized THEN
      RETURN jsonb_build_object('action', 'noop', 'lab_case', to_jsonb(v_case));
    END IF;
    v_expense := jsonb_populate_record(NULL::public.expenses, p_expense);
    IF v_expense.clinic_id IS DISTINCT FROM p_clinic_id THEN RAISE EXCEPTION 'Clinic scope mismatch' USING ERRCODE = '42501'; END IF;
    v_expense.id := COALESCE(NULLIF(v_expense.id, ''), gen_random_uuid()::text);
    v_expense.created_date := COALESCE(v_expense.created_date, now());
    v_expense.updated_date := now();
    INSERT INTO public.expenses SELECT (v_expense).* RETURNING * INTO v_expense;
    UPDATE public.lab_cases SET
      net_amount = (p_fields->>'net_amount')::numeric,
      doctor_commission_percentage = (p_fields->>'doctor_commission_percentage')::numeric,
      doctor_commission_amount = (p_fields->>'doctor_commission_amount')::numeric,
      clinic_share = (p_fields->>'clinic_share')::numeric,
      is_finalized = true,
      finalized_at = (p_fields->>'finalized_at')::timestamptz,
      finalized_by = p_fields->>'finalized_by',
      finalized_by_name = p_fields->>'finalized_by_name',
      expense_id = v_expense.id,
      updated_date = now()
    WHERE id = p_lab_case_id AND clinic_id = p_clinic_id
    RETURNING * INTO v_case;
    v_action := 'finalized';
  ELSE
    IF NOT v_case.is_finalized OR v_case.status = 'delivered' THEN
      RETURN jsonb_build_object('action', 'noop', 'lab_case', to_jsonb(v_case));
    END IF;
    IF v_case.expense_id IS NOT NULL THEN
      DELETE FROM public.expenses WHERE id = v_case.expense_id AND clinic_id = p_clinic_id;
    END IF;
    UPDATE public.lab_cases SET
      is_finalized = false,
      finalized_at = NULL,
      finalized_by = NULL,
      finalized_by_name = NULL,
      expense_id = NULL,
      net_amount = 0,
      doctor_commission_percentage = 0,
      doctor_commission_amount = 0,
      clinic_share = 0,
      updated_date = now()
    WHERE id = p_lab_case_id AND clinic_id = p_clinic_id
    RETURNING * INTO v_case;
    v_action := 'unfinalized';
  END IF;
  RETURN jsonb_build_object('action', v_action, 'lab_case', to_jsonb(v_case), 'expense_id', v_expense.id);
END;
$$;`,
  'REVOKE ALL ON FUNCTION public.commit_lab_case_finalization(text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;',
  'GRANT EXECUTE ON FUNCTION public.commit_lab_case_finalization(text, text, text, jsonb, jsonb) TO service_role;',
  '',
  'CREATE UNIQUE INDEX IF NOT EXISTS clinic_role_assignments_user_clinic_uq ON public.clinic_role_assignments(user_id, clinic_id);',
  'CREATE INDEX IF NOT EXISTS clinic_role_assignments_user_status_idx ON public.clinic_role_assignments(user_id, status, assigned_at DESC);',
  ...schemas.flatMap((schema) => {
    const props = schema.properties || {};
    const indexes = [];
    if (props.clinic_id) indexes.push(`CREATE INDEX IF NOT EXISTS ${schema.table}_clinic_id_idx ON public.${schema.table}(clinic_id);`);
    for (const name of Object.keys(props)) {
      if (name.endsWith('_id') && name !== 'clinic_id') indexes.push(`CREATE INDEX IF NOT EXISTS ${schema.table}_${snake(name)}_idx ON public.${schema.table}(${snake(name)});`);
    }
    if (props.created_date) indexes.push(`CREATE INDEX IF NOT EXISTS ${schema.table}_created_date_idx ON public.${schema.table}(created_date DESC);`);
    return indexes;
  }),
  '',
  '-- clinic_id is intentionally not a physical FK: permanent deletion retains an orphaned completion audit and pending-deletion record by design.',
  '-- Clinic membership and record scope are enforced by Worker authorization and RLS; imports report missing clinic references for reconciliation.',
  '',
  '-- User profile mirror. Auth users remain the authentication authority; profile role fields are display-only.',
  'CREATE OR REPLACE FUNCTION public.handle_new_auth_user()',
  'RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$',
  'BEGIN',
  '  INSERT INTO public.users(id, email, full_name, phone, clinic_name, preferred_language, signup_status, data, created_date, updated_date)',
  '  VALUES (NEW.id::text, NEW.email, COALESCE(NEW.raw_user_meta_data->>\'full_name\', NEW.raw_user_meta_data->>\'name\'), NEW.raw_user_meta_data->>\'phone\', NEW.raw_user_meta_data->>\'clinic_name\', COALESCE(NEW.raw_user_meta_data->>\'preferred_language\', \'en\'), \'pending\', COALESCE(NEW.raw_user_meta_data, \'{}\'::jsonb) - \'role\' - \'clinic_id\' - \'clinic_role\' - \'signup_status\', now(), now())',
  '  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, clinic_name = EXCLUDED.clinic_name, preferred_language = EXCLUDED.preferred_language, data = COALESCE(public.users.data, \'{}\'::jsonb) || (EXCLUDED.data - \'role\' - \'clinic_id\' - \'clinic_role\' - \'signup_status\'), updated_date = now();',
  '  RETURN NEW;',
  'END;',
  '$$;',
  'DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;',
  'CREATE TRIGGER on_auth_user_created_profile AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();',
  '',
  '-- Apply row-level security to every application entity.',
  'CREATE OR REPLACE FUNCTION public.guard_notification_update()',
  'RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$',
  'BEGIN',
  '  IF auth.role() <> \'service_role\' AND (to_jsonb(NEW) - \'read\') IS DISTINCT FROM (to_jsonb(OLD) - \'read\') THEN',
  '    RAISE EXCEPTION \'Only the read flag may be changed by a notification owner\' USING ERRCODE = \'42501\';',
  '  END IF;',
  '  RETURN NEW;',
  'END;',
  '$$;',
  ...schemas.flatMap((schema) => {
    const statements = [`ALTER TABLE public.${schema.table} ENABLE ROW LEVEL SECURITY;`];
    if (schema.name === 'Clinic') {
      statements.push(`CREATE POLICY clinics_read_member ON public.clinics FOR SELECT TO authenticated USING (public.app_can_access_clinic(id, ARRAY['clinic_admin','doctor','receptionist']::text[]));`);
      statements.push(`CREATE POLICY clinics_update_admin ON public.clinics FOR UPDATE TO authenticated USING (public.app_can_access_clinic(id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(id, ARRAY['clinic_admin']::text[]));`);
    } else if (schema.name === 'ClinicRoleAssignment') {
      statements.push(`CREATE POLICY clinic_role_assignments_read_self ON public.clinic_role_assignments FOR SELECT TO authenticated USING (user_id = auth.uid()::text OR public.is_platform_owner());`);
      statements.push(`CREATE POLICY clinic_role_assignments_owner_write ON public.clinic_role_assignments FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());`);
    } else if (schema.name === 'UserSecurityProfile') {
      statements.push(`CREATE POLICY user_security_profile_read_self ON public.user_security_profiles FOR SELECT TO authenticated USING (user_id = auth.uid()::text OR public.is_platform_owner());`);
      statements.push(`CREATE POLICY user_security_profile_owner_write ON public.user_security_profiles FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());`);
    } else if (schema.name === 'User') {
      statements.push(`CREATE POLICY users_read_self ON public.users FOR SELECT TO authenticated USING (id = auth.uid()::text OR public.is_platform_owner());`);
      statements.push(`CREATE POLICY users_owner_write ON public.users FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());`);
    } else if (['DeletedUser', 'PendingClinicDeletion', 'PendingPermanentDeletion'].includes(schema.name)) {
      statements.push(`CREATE POLICY ${schema.table}_owner_only ON public.${schema.table} FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());`);
    } else if (schema.name === 'VerificationOTP') {
      // No authenticated browser access. OTP operations use server-side service credentials only.
    } else if (schema.name === 'Patient') {
      statements.push('-- No direct browser policy: the Worker strips phone and WhatsApp fields for doctors before returning patient records.');
    } else if (schema.properties?.clinic_id) {
      const [readRoles, writeRoles, deleteRoles] = permissions[schema.name] || [['clinic_admin'], ['clinic_admin'], ['clinic_admin']];
      if (schema.name === 'Notification') {
        statements.push(`CREATE POLICY notifications_read_own ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid()::text AND public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));`);
        statements.push(`CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()::text AND public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[])) WITH CHECK (user_id = auth.uid()::text AND public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));`);
        statements.push(`CREATE TRIGGER guard_notification_update BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.guard_notification_update();`);
      } else {
        if (readRoles.length) statements.push(`CREATE POLICY ${schema.table}_read_clinic ON public.${schema.table} FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY[${readRoles.map(quote).join(',')}]::text[]));`);
        if (writeRoles.length) statements.push(`CREATE POLICY ${schema.table}_insert_clinic ON public.${schema.table} FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY[${writeRoles.map(quote).join(',')}]::text[]));`);
        if (writeRoles.length) statements.push(`CREATE POLICY ${schema.table}_update_clinic ON public.${schema.table} FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY[${writeRoles.map(quote).join(',')}]::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY[${writeRoles.map(quote).join(',')}]::text[]));`);
        if (deleteRoles.length) statements.push(`CREATE POLICY ${schema.table}_delete_clinic ON public.${schema.table} FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY[${deleteRoles.map(quote).join(',')}]::text[]));`);
      }
    }
    statements.push(`CREATE POLICY ${schema.table}_require_mfa_for_enrolled ON public.${schema.table} AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());`);
    return statements;
  }),
  '',
  '',
  '-- A single private bucket stores patient documents. Names are clinic_id/patient_id/object; do not expose public URLs.',
  `INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types) VALUES ('patient-files', 'patient-files', false, 20971520, ARRAY['image/jpeg','image/png','image/webp','application/pdf','image/dicom','application/dicom']) ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;`,
  `INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types) VALUES ('clinic-assets', 'clinic-assets', true, 10485760, ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;`,
  `INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types) VALUES ('import-staging', 'import-staging', false, 20971520, ARRAY['text/csv','application/json','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel']) ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;`,
  'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;',
  'CREATE POLICY patient_files_read_member ON storage.objects FOR SELECT TO authenticated USING (bucket_id = \'patient-files\' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY[\'clinic_admin\',\'doctor\',\'receptionist\']::text[]));',
  'CREATE POLICY patient_files_insert_member ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = \'patient-files\' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY[\'clinic_admin\',\'doctor\',\'receptionist\']::text[]));',
  'CREATE POLICY patient_files_update_admin ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = \'patient-files\' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY[\'clinic_admin\']::text[])) WITH CHECK (bucket_id = \'patient-files\' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY[\'clinic_admin\']::text[]));',
  'CREATE POLICY patient_files_delete_admin ON storage.objects FOR DELETE TO authenticated USING (bucket_id = \'patient-files\' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY[\'clinic_admin\']::text[]));',
  'CREATE POLICY import_staging_member ON storage.objects FOR ALL TO authenticated USING (bucket_id = \'import-staging\' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY[\'clinic_admin\',\'doctor\',\'receptionist\']::text[])) WITH CHECK (bucket_id = \'import-staging\' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY[\'clinic_admin\',\'doctor\',\'receptionist\']::text[]));',
  'CREATE POLICY clinic_assets_write_admin ON storage.objects FOR ALL TO authenticated USING (bucket_id = \'clinic-assets\' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY[\'clinic_admin\']::text[])) WITH CHECK (bucket_id = \'clinic-assets\' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY[\'clinic_admin\']::text[]));',
  'CREATE POLICY storage_require_mfa_for_enrolled ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());',
  '',
  '-- Explicit table grants are paired with RLS; anonymous roles cannot query application records.',
  'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;',
  'REVOKE ALL ON SCHEMA public FROM anon;',
  'GRANT USAGE ON SCHEMA public TO authenticated, service_role;',
  'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;',
  'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;',
  'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;',
  'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;',
  'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;',
  '',
  '',
  '-- Owner principals have no client policy. Provision the one authorized platform owner with scripts/bootstrap-owner.mjs.',
  'COMMIT;',
  '',
];

fs.mkdirSync(migrationDirectory, { recursive: true });
fs.writeFileSync(output, lines.join('\n'), 'utf8');
console.log(`Wrote ${path.relative(root, output)} (${schemas.length} entity tables).`);
