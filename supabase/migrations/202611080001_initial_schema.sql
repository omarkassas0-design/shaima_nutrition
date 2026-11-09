-- Generated from Base44 JSONC entity schemas; see docs/migration-inventory.md.
-- IDs remain TEXT to preserve imported source identifiers. Historical dates and audit fields are retained.
BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_owners (
  user_id text PRIMARY KEY,
  provisioned_at timestamptz NOT NULL DEFAULT now(),
  provisioned_by text
);
ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.appointments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  treatment_room numeric DEFAULT 1 CHECK (treatment_room IN (1, 2, 3, 4, 5)),
  patient_id text NOT NULL,
  doctor_id text NOT NULL,
  date date NOT NULL,
  start_time text NOT NULL,
  end_time text,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'waiting', 'completed', 'no_show', 'cancelled')),
  treatment_id text,
  treatment_name text,
  notes text,
  reminder_sent boolean DEFAULT false,
  patient_name text,
  doctor_name text,
  doctor_color text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  entity_name text NOT NULL,
  record_id text,
  record_snapshot jsonb,
  summary text,
  user_id text,
  user_name text,
  restored boolean DEFAULT false,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.backups (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  backup_type text DEFAULT 'manual' CHECK (backup_type IN ('manual', 'automatic', 'google_drive')),
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size numeric,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  notes text,
  record_count jsonb,
  external_file_id text,
  external_backup_status text DEFAULT 'pending' CHECK (external_backup_status IN ('pending', 'uploaded', 'failed', 'skipped')),
  external_patient_file_count numeric DEFAULT 0,
  is_safety_backup boolean DEFAULT false,
  patient_file_total numeric DEFAULT 0,
  patient_file_successful numeric DEFAULT 0,
  patient_file_failed numeric DEFAULT 0,
  patient_file_skipped numeric DEFAULT 0,
  patient_file_batch_status text DEFAULT 'pending' CHECK (patient_file_batch_status IN ('pending', 'in_progress', 'completed', 'failed', 'not_applicable')),
  patient_file_mappings jsonb DEFAULT '[]'::jsonb,
  patient_file_failed_details jsonb DEFAULT '[]'::jsonb,
  patient_file_skipped_details jsonb DEFAULT '[]'::jsonb,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.clinics (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  name_ar text,
  logo_url text,
  address text,
  phone text,
  email text,
  country text,
  city text,
  currency text DEFAULT 'USD' CHECK (currency IN ('USD', 'SYP', 'TRY', 'EUR')),
  language text DEFAULT 'en' CHECK (language IN ('en', 'ar', 'tr')),
  setup_completed boolean DEFAULT false,
  reminder_before numeric,
  settings jsonb,
  whatsapp_number text,
  whatsapp_display_name text,
  phone_verified boolean DEFAULT false,
  whatsapp_reminders_enabled boolean DEFAULT false,
  reminder_1h_enabled boolean DEFAULT false,
  reminder_3h_enabled boolean DEFAULT true,
  reminder_24h_enabled boolean DEFAULT true,
  reminder_custom_minutes numeric,
  reminder_custom_enabled boolean DEFAULT false,
  reminder_template text DEFAULT 'Hello {patient_name},

This is a reminder from {clinic_name}.

You have an appointment with Dr. {doctor_name} on {appointment_date} at {appointment_time}.

Please contact us if you need to reschedule.

{clinic_phone}',
  sms_enabled boolean DEFAULT false,
  email_enabled boolean DEFAULT false,
  email_from_name text,
  email_from_address text,
  messaging_provider text DEFAULT 'twilio' CHECK (messaging_provider IN ('twilio', 'meta')),
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by text,
  deleted_by_name text,
  deletion_status text DEFAULT 'active' CHECK (deletion_status IN ('active', 'soft_deleted')),
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.clinic_role_assignments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  clinic_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('clinic_admin', 'doctor', 'receptionist')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'not_subscribed')),
  assigned_by_id text,
  assigned_at timestamptz,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.consent_forms (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  patient_name text,
  template_key text NOT NULL,
  template_name text,
  procedure_name text,
  procedure_date date,
  doctor_id text,
  doctor_name text,
  consent_body text NOT NULL,
  patient_signature text,
  signed_at timestamptz,
  status text DEFAULT 'signed' NOT NULL CHECK (status IN ('signed', 'void')),
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.deleted_users (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  email text,
  full_name text,
  clinic_id text,
  role text CHECK (role IN ('clinic_admin', 'doctor', 'receptionist')),
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'restored')),
  deleted_at timestamptz NOT NULL,
  deleted_by text,
  deleted_by_name text,
  restored_at timestamptz,
  restored_by text,
  cra_snapshot jsonb,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.doctors (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  name text NOT NULL,
  specialty text,
  phone text,
  calendar_color text,
  schedule jsonb,
  user_id text,
  commission_percentage numeric DEFAULT 0,
  commission_percentage_doctor numeric DEFAULT 0,
  commission_percentage_clinic numeric DEFAULT 0,
  monthly_salary numeric DEFAULT 0,
  salary_currency text DEFAULT 'USD' CHECK (salary_currency IN ('USD', 'SYP', 'TRY', 'EUR')),
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.doctor_payouts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  doctor_id text NOT NULL,
  doctor_name text,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD' NOT NULL CHECK (currency IN ('USD', 'SYP', 'TRY', 'EUR')),
  payment_date date NOT NULL,
  notes text,
  period_start date,
  period_end date,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.expenses (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD' CHECK (currency IN ('USD', 'SYP', 'TRY', 'EUR')),
  expense_date date NOT NULL,
  category text,
  notes text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.invoices (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  patient_name text,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  type text NOT NULL CHECK (type IN ('invoice', 'receipt')),
  doctor_id text,
  doctor_name text,
  items jsonb,
  payment_ids jsonb,
  payments_snapshot jsonb,
  totals jsonb,
  notes text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'void')),
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.lab_cases (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  patient_name text,
  patient_treatment_id text,
  patient_treatment_ids jsonb DEFAULT '[]'::jsonb,
  doctor_id text,
  doctor_name text,
  lab_id text NOT NULL,
  lab_name text,
  case_type text NOT NULL,
  description text,
  due_date date,
  sent_date date,
  received_date date,
  cost numeric,
  patient_price numeric DEFAULT 0,
  patient_paid_amount numeric DEFAULT 0,
  currency text DEFAULT 'USD' CHECK (currency IN ('USD', 'SYP', 'TRY', 'EUR')),
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'in_progress', 'ready', 'delivered', 'cancelled')),
  notes text,
  attachments jsonb,
  net_amount numeric DEFAULT 0,
  doctor_commission_percentage numeric DEFAULT 0,
  doctor_commission_amount numeric DEFAULT 0,
  clinic_share numeric DEFAULT 0,
  is_finalized boolean DEFAULT false,
  finalized_at timestamptz,
  finalized_by text,
  finalized_by_name text,
  expense_id text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.laboratories (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  name text NOT NULL,
  contact_person text,
  phone text,
  whatsapp text,
  email text,
  address text,
  notes text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.message_logs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email')),
  message_type text DEFAULT 'custom' CHECK (message_type IN ('appointment_reminder', 'appointment_confirmation', 'invoice', 'treatment_plan', 'custom', 'verification_otp')),
  recipient text NOT NULL,
  recipient_name text,
  patient_id text,
  appointment_id text,
  subject text,
  body text NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'undelivered')),
  provider text CHECK (provider IN ('twilio', 'resend', 'meta_whatsapp')),
  provider_message_id text,
  error_code text,
  error_message text,
  sent_at timestamptz,
  template_variables jsonb,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.notifications (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  user_id text,
  type text NOT NULL CHECK (type IN ('lab_ready', 'appointment_reminder', 'payment_received', 'xray_uploaded', 'schedule_changed')),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.patients (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  whatsapp_number text,
  whatsapp_opt_in boolean DEFAULT false,
  patient_source text CHECK (patient_source IN ('doctor', 'clinic')),
  referring_doctor_id text,
  referring_doctor_name text,
  assigned_doctor_id text,
  assigned_doctor_name text,
  gender text CHECK (gender IN ('male', 'female')),
  birth_date date,
  address text,
  notes text,
  phone_verified boolean DEFAULT false,
  medical_info jsonb,
  dental_history jsonb,
  recall_date date,
  recall_interval_months numeric,
  recall_status text DEFAULT 'pending' CHECK (recall_status IN ('pending', 'contacted', 'scheduled', 'not_interested')),
  recall_notes text,
  last_recall_date date,
  plan_discount_type text DEFAULT 'none' CHECK (plan_discount_type IN ('none', 'percentage', 'fixed')),
  plan_discount_value numeric DEFAULT 0,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.patient_files (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  file_url text NOT NULL,
  file_uri text,
  file_name text NOT NULL,
  file_type text CHECK (file_type IN ('image', 'pdf', 'xray', 'document')),
  before_after_tag text CHECK (before_after_tag IN ('before', 'after')),
  associated_treatment_id text,
  notes text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.patient_treatments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  treatment_id text,
  treatment_name text NOT NULL,
  description text,
  price numeric NOT NULL,
  currency text DEFAULT 'USD' CHECK (currency IN ('USD', 'SYP', 'TRY', 'EUR')),
  paid_amount numeric DEFAULT 0,
  discount_type text DEFAULT 'none' CHECK (discount_type IN ('percentage', 'fixed', 'none')),
  discount_value numeric DEFAULT 0,
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  tooth_numbers jsonb,
  tooth_surfaces jsonb DEFAULT '{}'::jsonb,
  doctor_id text,
  doctor_name text,
  doctor_commission_percentage numeric DEFAULT 0,
  doctor_commission_amount numeric DEFAULT 0,
  treatment_date date,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.payments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  patient_treatment_id text,
  doctor_id text NOT NULL,
  doctor_name text,
  doctor_commission_percentage numeric DEFAULT 0,
  doctor_commission_amount numeric DEFAULT 0,
  is_prosthesis boolean DEFAULT false,
  prosthesis_cost numeric DEFAULT 0,
  net_amount numeric DEFAULT 0,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD' CHECK (currency IN ('USD', 'SYP', 'TRY', 'EUR')),
  method text DEFAULT 'cash' CHECK (method IN ('cash', 'card', 'transfer', 'other')),
  notes text,
  payment_date date,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.pending_clinic_deletions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  clinic_name text,
  requested_by_id text NOT NULL,
  requested_by_name text,
  requested_at timestamptz,
  expires_at timestamptz NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'cancelled', 'executed', 'restored')),
  executed_at timestamptz,
  cancelled_at timestamptz,
  restored_at timestamptz,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.pending_permanent_deletions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  clinic_name text,
  requested_by_id text NOT NULL,
  requested_by_name text,
  requested_at timestamptz,
  expires_at timestamptz NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'cancelled', 'executed', 'failed')),
  executed_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  deletion_results jsonb,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.purchases (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  name text NOT NULL,
  category text,
  supplier text,
  quantity numeric DEFAULT 1,
  unit text,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD' CHECK (currency IN ('USD', 'SYP', 'TRY', 'EUR')),
  purchase_date date NOT NULL,
  notes text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  patient_name text,
  patient_phone text NOT NULL,
  appointment_id text NOT NULL,
  message text,
  reminder_type text NOT NULL CHECK (reminder_type IN ('24h', '12h', '2h')),
  scheduled_time timestamptz NOT NULL,
  sent_time timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.restore_locks (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  locked_by_user_id text NOT NULL,
  locked_by_name text,
  locked_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'released', 'expired')),
  backup_id text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('daily_summary', 'weekly_summary', 'monthly_summary', 'revenue_summary', 'expense_summary', 'payment_summary', 'outstanding_balances', 'appointment_statistics', 'clinic_performance')),
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  email_recipients jsonb NOT NULL,
  enabled boolean DEFAULT true,
  last_sent_at timestamptz,
  next_send_at timestamptz,
  created_by_id text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.shifts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  employee_id text NOT NULL,
  employee_name text,
  employee_position text,
  shift_type text DEFAULT 'morning' CHECK (shift_type IN ('morning', 'evening', 'split', 'custom')),
  days_of_week jsonb NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  break_duration_minutes numeric DEFAULT 60,
  weekly_off_days jsonb,
  notes text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.staffs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  user_id text,
  full_name text NOT NULL,
  employee_id text,
  phone text,
  email text,
  address text,
  national_id text,
  position text NOT NULL CHECK (position IN ('nurse', 'receptionist', 'accountant', 'cleaner', 'assistant', 'technician', 'call_center', 'other')),
  department text,
  hire_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'suspended', 'resigned')),
  notes text,
  salary numeric,
  salary_currency text DEFAULT 'USD' CHECK (salary_currency IN ('USD', 'SYP', 'TRY', 'EUR')),
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.treatments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  name text NOT NULL,
  category text,
  description text,
  notes text,
  applicable_surfaces jsonb,
  default_price numeric,
  currency text DEFAULT 'USD' CHECK (currency IN ('USD', 'SYP', 'TRY', 'EUR')),
  duration_minutes numeric,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  email text,
  full_name text,
  legacy_user_id text UNIQUE,
  role text DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  clinic_id text,
  clinic_role text CHECK (clinic_role IN ('clinic_admin', 'doctor', 'receptionist')),
  preferred_language text DEFAULT 'en' CHECK (preferred_language IN ('en', 'ar', 'tr')),
  phone text,
  clinic_name text,
  signup_status text DEFAULT 'pending' CHECK (signup_status IN ('pending', 'approved', 'rejected')),
  data jsonb,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.user_security_profiles (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  clinic_id text,
  role text,
  signup_status text,
  assigned_by_id text,
  last_revert_at timestamptz,
  revert_count numeric DEFAULT 0,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);
CREATE TABLE IF NOT EXISTS public.verification_otps (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clinic_id text NOT NULL,
  phone_number text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts numeric DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'blocked')),
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  created_by_id text,
  created_by text
);

CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_owners p WHERE p.user_id = auth.uid()::text)
$$;

CREATE OR REPLACE FUNCTION public.app_user_role(target_clinic_id text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.platform_owners p WHERE p.user_id = auth.uid()::text) THEN 'super_admin'
    ELSE (SELECT a.role FROM public.clinic_role_assignments a
          WHERE a.user_id = auth.uid()::text AND a.clinic_id = target_clinic_id AND a.status = 'active'
          ORDER BY a.assigned_at DESC NULLS LAST, a.updated_date DESC NULLS LAST LIMIT 1)
  END
$$;

CREATE OR REPLACE FUNCTION public.app_can_access_clinic(target_clinic_id text, allowed_roles text[] DEFAULT ARRAY['clinic_admin', 'doctor', 'receptionist']::text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT target_clinic_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.platform_owners p WHERE p.user_id = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM public.clinic_role_assignments a
              WHERE a.user_id = auth.uid()::text AND a.clinic_id = target_clinic_id
                AND a.status = 'active' AND a.role = ANY(allowed_roles))
  )
$$;

CREATE OR REPLACE FUNCTION public.app_mfa_access_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  SELECT ARRAY[COALESCE(auth.jwt()->>'aal', 'aal1')] <@ (
    SELECT CASE WHEN count(id) > 0 THEN ARRAY['aal2'] ELSE ARRAY['aal1', 'aal2'] END
    FROM auth.mfa_factors WHERE user_id = auth.uid() AND status = 'verified'
  )
$$;
REVOKE ALL ON FUNCTION public.app_user_role(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_platform_owner() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_can_access_clinic(text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_mfa_access_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_user_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_can_access_clinic(text, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_mfa_access_allowed() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.apply_patient_plan_discount(p_clinic_id text, p_patient_id text, p_discount_type text, p_discount_value numeric, p_changes jsonb)
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
$$;
REVOKE ALL ON FUNCTION public.apply_patient_plan_discount(text, text, text, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_patient_plan_discount(text, text, text, numeric, jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.commit_payment_mutation(p_action text, p_clinic_id text, p_payment_id text, p_payload jsonb)
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
$$;
REVOKE ALL ON FUNCTION public.commit_payment_mutation(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_payment_mutation(text, text, text, jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.commit_lab_case_finalization(p_action text, p_clinic_id text, p_lab_case_id text, p_fields jsonb, p_expense jsonb DEFAULT NULL)
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
$$;
REVOKE ALL ON FUNCTION public.commit_lab_case_finalization(text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_lab_case_finalization(text, text, text, jsonb, jsonb) TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS clinic_role_assignments_user_clinic_uq ON public.clinic_role_assignments(user_id, clinic_id);
CREATE INDEX IF NOT EXISTS clinic_role_assignments_user_status_idx ON public.clinic_role_assignments(user_id, status, assigned_at DESC);
CREATE INDEX IF NOT EXISTS appointments_clinic_id_idx ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS appointments_patient_id_idx ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS appointments_doctor_id_idx ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS appointments_treatment_id_idx ON public.appointments(treatment_id);
CREATE INDEX IF NOT EXISTS audit_logs_clinic_id_idx ON public.audit_logs(clinic_id);
CREATE INDEX IF NOT EXISTS audit_logs_record_id_idx ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS backups_clinic_id_idx ON public.backups(clinic_id);
CREATE INDEX IF NOT EXISTS backups_external_file_id_idx ON public.backups(external_file_id);
CREATE INDEX IF NOT EXISTS clinic_role_assignments_clinic_id_idx ON public.clinic_role_assignments(clinic_id);
CREATE INDEX IF NOT EXISTS clinic_role_assignments_user_id_idx ON public.clinic_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS clinic_role_assignments_assigned_by_id_idx ON public.clinic_role_assignments(assigned_by_id);
CREATE INDEX IF NOT EXISTS consent_forms_clinic_id_idx ON public.consent_forms(clinic_id);
CREATE INDEX IF NOT EXISTS consent_forms_patient_id_idx ON public.consent_forms(patient_id);
CREATE INDEX IF NOT EXISTS consent_forms_doctor_id_idx ON public.consent_forms(doctor_id);
CREATE INDEX IF NOT EXISTS deleted_users_clinic_id_idx ON public.deleted_users(clinic_id);
CREATE INDEX IF NOT EXISTS deleted_users_user_id_idx ON public.deleted_users(user_id);
CREATE INDEX IF NOT EXISTS doctors_clinic_id_idx ON public.doctors(clinic_id);
CREATE INDEX IF NOT EXISTS doctors_user_id_idx ON public.doctors(user_id);
CREATE INDEX IF NOT EXISTS doctor_payouts_clinic_id_idx ON public.doctor_payouts(clinic_id);
CREATE INDEX IF NOT EXISTS doctor_payouts_doctor_id_idx ON public.doctor_payouts(doctor_id);
CREATE INDEX IF NOT EXISTS expenses_clinic_id_idx ON public.expenses(clinic_id);
CREATE INDEX IF NOT EXISTS invoices_clinic_id_idx ON public.invoices(clinic_id);
CREATE INDEX IF NOT EXISTS invoices_patient_id_idx ON public.invoices(patient_id);
CREATE INDEX IF NOT EXISTS invoices_doctor_id_idx ON public.invoices(doctor_id);
CREATE INDEX IF NOT EXISTS lab_cases_clinic_id_idx ON public.lab_cases(clinic_id);
CREATE INDEX IF NOT EXISTS lab_cases_patient_id_idx ON public.lab_cases(patient_id);
CREATE INDEX IF NOT EXISTS lab_cases_patient_treatment_id_idx ON public.lab_cases(patient_treatment_id);
CREATE INDEX IF NOT EXISTS lab_cases_doctor_id_idx ON public.lab_cases(doctor_id);
CREATE INDEX IF NOT EXISTS lab_cases_lab_id_idx ON public.lab_cases(lab_id);
CREATE INDEX IF NOT EXISTS lab_cases_expense_id_idx ON public.lab_cases(expense_id);
CREATE INDEX IF NOT EXISTS laboratories_clinic_id_idx ON public.laboratories(clinic_id);
CREATE INDEX IF NOT EXISTS message_logs_clinic_id_idx ON public.message_logs(clinic_id);
CREATE INDEX IF NOT EXISTS message_logs_patient_id_idx ON public.message_logs(patient_id);
CREATE INDEX IF NOT EXISTS message_logs_appointment_id_idx ON public.message_logs(appointment_id);
CREATE INDEX IF NOT EXISTS message_logs_provider_message_id_idx ON public.message_logs(provider_message_id);
CREATE INDEX IF NOT EXISTS notifications_clinic_id_idx ON public.notifications(clinic_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS patients_clinic_id_idx ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS patients_referring_doctor_id_idx ON public.patients(referring_doctor_id);
CREATE INDEX IF NOT EXISTS patients_assigned_doctor_id_idx ON public.patients(assigned_doctor_id);
CREATE INDEX IF NOT EXISTS patient_files_clinic_id_idx ON public.patient_files(clinic_id);
CREATE INDEX IF NOT EXISTS patient_files_patient_id_idx ON public.patient_files(patient_id);
CREATE INDEX IF NOT EXISTS patient_files_associated_treatment_id_idx ON public.patient_files(associated_treatment_id);
CREATE INDEX IF NOT EXISTS patient_treatments_clinic_id_idx ON public.patient_treatments(clinic_id);
CREATE INDEX IF NOT EXISTS patient_treatments_patient_id_idx ON public.patient_treatments(patient_id);
CREATE INDEX IF NOT EXISTS patient_treatments_treatment_id_idx ON public.patient_treatments(treatment_id);
CREATE INDEX IF NOT EXISTS patient_treatments_doctor_id_idx ON public.patient_treatments(doctor_id);
CREATE INDEX IF NOT EXISTS payments_clinic_id_idx ON public.payments(clinic_id);
CREATE INDEX IF NOT EXISTS payments_patient_id_idx ON public.payments(patient_id);
CREATE INDEX IF NOT EXISTS payments_patient_treatment_id_idx ON public.payments(patient_treatment_id);
CREATE INDEX IF NOT EXISTS payments_doctor_id_idx ON public.payments(doctor_id);
CREATE INDEX IF NOT EXISTS pending_clinic_deletions_clinic_id_idx ON public.pending_clinic_deletions(clinic_id);
CREATE INDEX IF NOT EXISTS pending_clinic_deletions_requested_by_id_idx ON public.pending_clinic_deletions(requested_by_id);
CREATE INDEX IF NOT EXISTS pending_permanent_deletions_clinic_id_idx ON public.pending_permanent_deletions(clinic_id);
CREATE INDEX IF NOT EXISTS pending_permanent_deletions_requested_by_id_idx ON public.pending_permanent_deletions(requested_by_id);
CREATE INDEX IF NOT EXISTS purchases_clinic_id_idx ON public.purchases(clinic_id);
CREATE INDEX IF NOT EXISTS reminder_logs_clinic_id_idx ON public.reminder_logs(clinic_id);
CREATE INDEX IF NOT EXISTS reminder_logs_patient_id_idx ON public.reminder_logs(patient_id);
CREATE INDEX IF NOT EXISTS reminder_logs_appointment_id_idx ON public.reminder_logs(appointment_id);
CREATE INDEX IF NOT EXISTS restore_locks_clinic_id_idx ON public.restore_locks(clinic_id);
CREATE INDEX IF NOT EXISTS restore_locks_locked_by_user_id_idx ON public.restore_locks(locked_by_user_id);
CREATE INDEX IF NOT EXISTS restore_locks_backup_id_idx ON public.restore_locks(backup_id);
CREATE INDEX IF NOT EXISTS scheduled_reports_clinic_id_idx ON public.scheduled_reports(clinic_id);
CREATE INDEX IF NOT EXISTS scheduled_reports_created_by_id_idx ON public.scheduled_reports(created_by_id);
CREATE INDEX IF NOT EXISTS shifts_clinic_id_idx ON public.shifts(clinic_id);
CREATE INDEX IF NOT EXISTS shifts_employee_id_idx ON public.shifts(employee_id);
CREATE INDEX IF NOT EXISTS staffs_clinic_id_idx ON public.staffs(clinic_id);
CREATE INDEX IF NOT EXISTS staffs_user_id_idx ON public.staffs(user_id);
CREATE INDEX IF NOT EXISTS staffs_employee_id_idx ON public.staffs(employee_id);
CREATE INDEX IF NOT EXISTS staffs_national_id_idx ON public.staffs(national_id);
CREATE INDEX IF NOT EXISTS treatments_clinic_id_idx ON public.treatments(clinic_id);
CREATE INDEX IF NOT EXISTS users_clinic_id_idx ON public.users(clinic_id);
CREATE INDEX IF NOT EXISTS user_security_profiles_clinic_id_idx ON public.user_security_profiles(clinic_id);
CREATE INDEX IF NOT EXISTS user_security_profiles_user_id_idx ON public.user_security_profiles(user_id);
CREATE INDEX IF NOT EXISTS user_security_profiles_assigned_by_id_idx ON public.user_security_profiles(assigned_by_id);
CREATE INDEX IF NOT EXISTS verification_otps_clinic_id_idx ON public.verification_otps(clinic_id);

-- clinic_id is intentionally not a physical FK: permanent deletion retains an orphaned completion audit and pending-deletion record by design.
-- Clinic membership and record scope are enforced by Worker authorization and RLS; imports report missing clinic references for reconciliation.

-- User profile mirror. Auth users remain the authentication authority; profile role fields are display-only.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.users(id, email, full_name, phone, clinic_name, preferred_language, signup_status, data, created_date, updated_date)
  VALUES (NEW.id::text, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'clinic_name', COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en'), 'pending', COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) - 'role' - 'clinic_id' - 'clinic_role' - 'signup_status', now(), now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, clinic_name = EXCLUDED.clinic_name, preferred_language = EXCLUDED.preferred_language, data = COALESCE(public.users.data, '{}'::jsonb) || (EXCLUDED.data - 'role' - 'clinic_id' - 'clinic_role' - 'signup_status'), updated_date = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Apply row-level security to every application entity.
CREATE OR REPLACE FUNCTION public.guard_notification_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (to_jsonb(NEW) - 'read') IS DISTINCT FROM (to_jsonb(OLD) - 'read') THEN
    RAISE EXCEPTION 'Only the read flag may be changed by a notification owner' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY appointments_read_clinic ON public.appointments FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY appointments_insert_clinic ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY appointments_update_clinic ON public.appointments FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY appointments_delete_clinic ON public.appointments FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY appointments_require_mfa_for_enrolled ON public.appointments AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_read_clinic ON public.audit_logs FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY audit_logs_require_mfa_for_enrolled ON public.audit_logs AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY backups_read_clinic ON public.backups FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY backups_insert_clinic ON public.backups FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY backups_update_clinic ON public.backups FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY backups_delete_clinic ON public.backups FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY backups_require_mfa_for_enrolled ON public.backups AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinics_read_member ON public.clinics FOR SELECT TO authenticated USING (public.app_can_access_clinic(id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY clinics_update_admin ON public.clinics FOR UPDATE TO authenticated USING (public.app_can_access_clinic(id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(id, ARRAY['clinic_admin']::text[]));
CREATE POLICY clinics_require_mfa_for_enrolled ON public.clinics AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.clinic_role_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinic_role_assignments_read_self ON public.clinic_role_assignments FOR SELECT TO authenticated USING (user_id = auth.uid()::text OR public.is_platform_owner());
CREATE POLICY clinic_role_assignments_owner_write ON public.clinic_role_assignments FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());
CREATE POLICY clinic_role_assignments_require_mfa_for_enrolled ON public.clinic_role_assignments AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.consent_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY consent_forms_read_clinic ON public.consent_forms FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY consent_forms_insert_clinic ON public.consent_forms FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY consent_forms_update_clinic ON public.consent_forms FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY consent_forms_delete_clinic ON public.consent_forms FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY consent_forms_require_mfa_for_enrolled ON public.consent_forms AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.deleted_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY deleted_users_owner_only ON public.deleted_users FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());
CREATE POLICY deleted_users_require_mfa_for_enrolled ON public.deleted_users AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY doctors_read_clinic ON public.doctors FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY doctors_insert_clinic ON public.doctors FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY doctors_update_clinic ON public.doctors FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY doctors_delete_clinic ON public.doctors FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY doctors_require_mfa_for_enrolled ON public.doctors AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.doctor_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY doctor_payouts_read_clinic ON public.doctor_payouts FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY doctor_payouts_insert_clinic ON public.doctor_payouts FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY doctor_payouts_update_clinic ON public.doctor_payouts FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY doctor_payouts_delete_clinic ON public.doctor_payouts FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY doctor_payouts_require_mfa_for_enrolled ON public.doctor_payouts AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_read_clinic ON public.expenses FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY expenses_insert_clinic ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY expenses_update_clinic ON public.expenses FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY expenses_delete_clinic ON public.expenses FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY expenses_require_mfa_for_enrolled ON public.expenses AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_read_clinic ON public.invoices FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY invoices_insert_clinic ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY invoices_update_clinic ON public.invoices FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY invoices_delete_clinic ON public.invoices FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY invoices_require_mfa_for_enrolled ON public.invoices AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.lab_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_cases_read_clinic ON public.lab_cases FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY lab_cases_insert_clinic ON public.lab_cases FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY lab_cases_update_clinic ON public.lab_cases FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY lab_cases_delete_clinic ON public.lab_cases FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY lab_cases_require_mfa_for_enrolled ON public.lab_cases AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.laboratories ENABLE ROW LEVEL SECURITY;
CREATE POLICY laboratories_read_clinic ON public.laboratories FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY laboratories_insert_clinic ON public.laboratories FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY laboratories_update_clinic ON public.laboratories FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY laboratories_delete_clinic ON public.laboratories FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY laboratories_require_mfa_for_enrolled ON public.laboratories AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_logs_read_clinic ON public.message_logs FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY message_logs_insert_clinic ON public.message_logs FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY message_logs_update_clinic ON public.message_logs FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY message_logs_delete_clinic ON public.message_logs FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY message_logs_require_mfa_for_enrolled ON public.message_logs AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_read_own ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid()::text AND public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()::text AND public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[])) WITH CHECK (user_id = auth.uid()::text AND public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE TRIGGER guard_notification_update BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.guard_notification_update();
CREATE POLICY notifications_require_mfa_for_enrolled ON public.notifications AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
-- No direct browser policy: the Worker strips phone and WhatsApp fields for doctors before returning patient records.
CREATE POLICY patients_require_mfa_for_enrolled ON public.patients AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY patient_files_read_clinic ON public.patient_files FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY patient_files_insert_clinic ON public.patient_files FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY patient_files_update_clinic ON public.patient_files FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY patient_files_delete_clinic ON public.patient_files FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY patient_files_require_mfa_for_enrolled ON public.patient_files AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.patient_treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY patient_treatments_read_clinic ON public.patient_treatments FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY patient_treatments_insert_clinic ON public.patient_treatments FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY patient_treatments_update_clinic ON public.patient_treatments FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY patient_treatments_delete_clinic ON public.patient_treatments FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY patient_treatments_require_mfa_for_enrolled ON public.patient_treatments AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_read_clinic ON public.payments FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY payments_insert_clinic ON public.payments FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY payments_update_clinic ON public.payments FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY payments_delete_clinic ON public.payments FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','receptionist']::text[]));
CREATE POLICY payments_require_mfa_for_enrolled ON public.payments AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.pending_clinic_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pending_clinic_deletions_owner_only ON public.pending_clinic_deletions FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());
CREATE POLICY pending_clinic_deletions_require_mfa_for_enrolled ON public.pending_clinic_deletions AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.pending_permanent_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pending_permanent_deletions_owner_only ON public.pending_permanent_deletions FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());
CREATE POLICY pending_permanent_deletions_require_mfa_for_enrolled ON public.pending_permanent_deletions AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchases_read_clinic ON public.purchases FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY purchases_insert_clinic ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY purchases_update_clinic ON public.purchases FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY purchases_delete_clinic ON public.purchases FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY purchases_require_mfa_for_enrolled ON public.purchases AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminder_logs_read_clinic ON public.reminder_logs FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY reminder_logs_insert_clinic ON public.reminder_logs FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY reminder_logs_update_clinic ON public.reminder_logs FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY reminder_logs_delete_clinic ON public.reminder_logs FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY reminder_logs_require_mfa_for_enrolled ON public.reminder_logs AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.restore_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY restore_locks_read_clinic ON public.restore_locks FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY restore_locks_insert_clinic ON public.restore_locks FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY restore_locks_update_clinic ON public.restore_locks FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY restore_locks_delete_clinic ON public.restore_locks FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY restore_locks_require_mfa_for_enrolled ON public.restore_locks AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY scheduled_reports_read_clinic ON public.scheduled_reports FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY scheduled_reports_insert_clinic ON public.scheduled_reports FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY scheduled_reports_update_clinic ON public.scheduled_reports FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY scheduled_reports_delete_clinic ON public.scheduled_reports FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY scheduled_reports_require_mfa_for_enrolled ON public.scheduled_reports AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY shifts_read_clinic ON public.shifts FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY shifts_insert_clinic ON public.shifts FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY shifts_update_clinic ON public.shifts FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY shifts_delete_clinic ON public.shifts FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY shifts_require_mfa_for_enrolled ON public.shifts AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.staffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY staffs_read_clinic ON public.staffs FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY staffs_insert_clinic ON public.staffs FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY staffs_update_clinic ON public.staffs FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY staffs_delete_clinic ON public.staffs FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY staffs_require_mfa_for_enrolled ON public.staffs AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY treatments_read_clinic ON public.treatments FOR SELECT TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY treatments_insert_clinic ON public.treatments FOR INSERT TO authenticated WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY treatments_update_clinic ON public.treatments FOR UPDATE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[])) WITH CHECK (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY treatments_delete_clinic ON public.treatments FOR DELETE TO authenticated USING (public.app_can_access_clinic(clinic_id, ARRAY['clinic_admin']::text[]));
CREATE POLICY treatments_require_mfa_for_enrolled ON public.treatments AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_read_self ON public.users FOR SELECT TO authenticated USING (id = auth.uid()::text OR public.is_platform_owner());
CREATE POLICY users_owner_write ON public.users FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());
CREATE POLICY users_require_mfa_for_enrolled ON public.users AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.user_security_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_security_profile_read_self ON public.user_security_profiles FOR SELECT TO authenticated USING (user_id = auth.uid()::text OR public.is_platform_owner());
CREATE POLICY user_security_profile_owner_write ON public.user_security_profiles FOR ALL TO authenticated USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());
CREATE POLICY user_security_profiles_require_mfa_for_enrolled ON public.user_security_profiles AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());
ALTER TABLE public.verification_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY verification_otps_require_mfa_for_enrolled ON public.verification_otps AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());


-- A single private bucket stores patient documents. Names are clinic_id/patient_id/object; do not expose public URLs.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types) VALUES ('patient-files', 'patient-files', false, 20971520, ARRAY['image/jpeg','image/png','image/webp','application/pdf','image/dicom','application/dicom']) ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types) VALUES ('clinic-assets', 'clinic-assets', true, 10485760, ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types) VALUES ('import-staging', 'import-staging', false, 20971520, ARRAY['text/csv','application/json','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel']) ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY patient_files_read_member ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'patient-files' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY patient_files_insert_member ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'patient-files' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY patient_files_update_admin ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'patient-files' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY['clinic_admin']::text[])) WITH CHECK (bucket_id = 'patient-files' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY['clinic_admin']::text[]));
CREATE POLICY patient_files_delete_admin ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'patient-files' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY['clinic_admin']::text[]));
CREATE POLICY import_staging_member ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'import-staging' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY['clinic_admin','doctor','receptionist']::text[])) WITH CHECK (bucket_id = 'import-staging' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY['clinic_admin','doctor','receptionist']::text[]));
CREATE POLICY clinic_assets_write_admin ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'clinic-assets' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY['clinic_admin']::text[])) WITH CHECK (bucket_id = 'clinic-assets' AND public.app_can_access_clinic((storage.foldername(name))[1], ARRAY['clinic_admin']::text[]));
CREATE POLICY storage_require_mfa_for_enrolled ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING (public.app_mfa_access_allowed()) WITH CHECK (public.app_mfa_access_allowed());

-- Explicit table grants are paired with RLS; anonymous roles cannot query application records.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;


-- Owner principals have no client policy. Provision the one authorized platform owner with scripts/bootstrap-owner.mjs.
COMMIT;
