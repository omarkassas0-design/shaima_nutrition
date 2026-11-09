# AuraDental Cloud migration inventory

Generated from the checked-out source on 2026-11-08 by `scripts/build-migration-inventory.mjs`.

> This inventory describes source dependencies and replacement boundaries. It is not evidence that a provider, production database, migrated data set, or live workflow has been verified.

## Source scope

- Frontend source files scanned: 251.
- Entity definitions scanned: 31.
- Backend functions scanned: 53.
- Scheduled workflow definitions scanned: 6.
- Build configuration and package manifests: `vite.config.js`, `package.json`, `package-lock.json`, `README.md`, `.gitignore`.
- No `.git` metadata was present in the supplied checkout, so a trustworthy original file-change diff cannot be produced.

## Frontend dependency map

| Current dependency | Responsibilities and data | Current access checks | Replacement boundary |
|---|---|---|---|
| Legacy SDK client / `@base44/sdk` | Previously initialized auth, entity, function, and integration APIs to the UI. | Session checks plus per-handler checks. | Removed from the browser. `src/api/appClient.js` uses Supabase Auth and sends entity/function operations to authenticated Worker routes; only Clinic and own Notification queries use RLS directly. |
| `src/lib/AuthContext.jsx`, `authMfa.js`, `authMfaFlow.js`, auth pages | Session restore, sign-in/out, registration, OTP, Google OAuth, password reset, current role refresh, account status gating. | `getCurrentUserRole` is authoritative; role assignment and status are not trusted from profile data. | Supabase Auth plus Worker role resolution against `ClinicRoleAssignment` and server-owned platform owner records. |
| `src/lib/clinicApi.js`, `src/hooks/usePaginatedQuery.js`, pages and components invoking functions | Clinic CRUD, server pagination, search, reports, dashboards, payment workflows, export, backup, deletion, role management. | Per-function role checks; clinic ID is resolved server-side from the active assignment (owner may select a managed clinic). | Preserve function names and JSON contracts behind Cloudflare Worker routes; map database operations to Supabase PostgreSQL/RLS. |
| Direct entity API calls in pages and components | Clinic and appointment lookup; CRUD, filtering, user notifications and read status. | Clinic entity authorization in Worker; Notification direct access is restricted to the signed-in user by RLS. | `appClient.entities.*` routes clinic-scoped CRUD to Worker authorization, with direct RLS access limited to Clinic lookup and own Notification rows. |
| File integrations and signed URLs | Clinic assets, patient attachments, imports, and private-file access. | Worker verifies clinic membership, role, size, and MIME type; patient files use a private bucket. | Worker upload API plus Supabase Storage and short-lived signed URLs. Legacy-file migration is a separate authenticated operation and needs source URLs to remain reachable. |
| Base44-hosted static media | Product metadata, tooth imagery, welcome banner, promotion email assets. | Public assets; no patient data authorization. | Rehosted under `public/assets` and `public/icons`; the Worker PWA manifest references local icons. |
| Runtime parameters, PWA, offline queue, auth diagnostics | Previous platform URLs, SDK session cleanup, offline entity retries, and platform assumptions. | Supabase Auth and Worker API checks. | Replaced runtime configuration with Vite Supabase settings and Worker PWA routes; queued CRUD operations use the new client. |

### Frontend client entry points found after migration

- `appClient.auth.loginViaEmailPassword`
- `appClient.auth.loginWithProvider`
- `appClient.auth.logout`
- `appClient.auth.me`
- `appClient.auth.register`
- `appClient.auth.resendOtp`
- `appClient.auth.resetPassword`
- `appClient.auth.resetPasswordRequest`
- `appClient.auth.setToken`
- `appClient.auth.updateMe`
- `appClient.auth.verifyOtp`
- `appClient.entities.Appointment.filter`
- `appClient.entities.Clinic.list`
- `appClient.entities.Notification.filter`
- `appClient.entities.Notification.update`
- `appClient.entities.X`
- `appClient.functions`
- `appClient.functions.invoke`
- `appClient.integrations.Core.UploadFile`
- `appClient.integrations.Core.UploadImportFile`
- `appClient.integrations.Core.UploadPrivateFile`
- `supabase.auth.getUser`

## Entity data model

| Entity | Source definition | Defined fields |
|---|---|---|
| `Appointment` | `migration/source-entities/Appointment.jsonc` | clinic_id:string, treatment_room:number, patient_id:string, doctor_id:string, date:string, start_time:string, end_time:string, status:string, treatment_id:string, treatment_name:string, notes:string, reminder_sent:boolean, patient_name:string, doctor_name:string, doctor_color:string |
| `AuditLog` | `migration/source-entities/AuditLog.jsonc` | clinic_id:string, action:string, entity_name:string, record_id:string, record_snapshot:object, summary:string, user_id:string, user_name:string, restored:boolean |
| `Backup` | `migration/source-entities/Backup.jsonc` | clinic_id:string, backup_type:string, file_url:string, file_name:string, file_size:number, status:string, notes:string, record_count:object, external_file_id:string, external_backup_status:string, external_patient_file_count:number, is_safety_backup:boolean, patient_file_total:number, patient_file_successful:number, patient_file_failed:number, patient_file_skipped:number, patient_file_batch_status:string, patient_file_mappings:array, patient_file_failed_details:array, patient_file_skipped_details:array |
| `Clinic` | `migration/source-entities/Clinic.jsonc` | name:string, name_ar:string, logo_url:string, address:string, phone:string, email:string, country:string, city:string, currency:string, language:string, setup_completed:boolean, reminder_before:number, settings:object, whatsapp_number:string, whatsapp_display_name:string, phone_verified:boolean, whatsapp_reminders_enabled:boolean, reminder_1h_enabled:boolean, reminder_3h_enabled:boolean, reminder_24h_enabled:boolean, reminder_custom_minutes:number, reminder_custom_enabled:boolean, reminder_template:string, sms_enabled:boolean, email_enabled:boolean, email_from_name:string, email_from_address:string, messaging_provider:string, is_deleted:boolean, deleted_at:string, deleted_by:string, deleted_by_name:string, deletion_status:string |
| `ClinicRoleAssignment` | `migration/source-entities/ClinicRoleAssignment.jsonc` | user_id:string, clinic_id:string, role:string, status:string, assigned_by_id:string, assigned_at:string |
| `ConsentForm` | `migration/source-entities/ConsentForm.jsonc` | clinic_id:string, patient_id:string, patient_name:string, template_key:string, template_name:string, procedure_name:string, procedure_date:string, doctor_id:string, doctor_name:string, consent_body:string, patient_signature:string, signed_at:string, status:string |
| `DeletedUser` | `migration/source-entities/DeletedUser.jsonc` | user_id:string, email:string, full_name:string, clinic_id:string, role:string, status:string, deleted_at:string, deleted_by:string, deleted_by_name:string, restored_at:string, restored_by:string, cra_snapshot:object |
| `Doctor` | `migration/source-entities/Doctor.jsonc` | clinic_id:string, name:string, specialty:string, phone:string, calendar_color:string, schedule:object, user_id:string, commission_percentage:number, commission_percentage_doctor:number, commission_percentage_clinic:number, monthly_salary:number, salary_currency:string |
| `DoctorPayout` | `migration/source-entities/DoctorPayout.jsonc` | clinic_id:string, doctor_id:string, doctor_name:string, amount:number, currency:string, payment_date:string, notes:string, period_start:string, period_end:string |
| `Expense` | `migration/source-entities/Expense.jsonc` | clinic_id:string, name:string, amount:number, currency:string, expense_date:string, category:string, notes:string |
| `Invoice` | `migration/source-entities/Invoice.jsonc` | clinic_id:string, patient_id:string, patient_name:string, invoice_number:string, invoice_date:string, type:string, doctor_id:string, doctor_name:string, items:array, payment_ids:array, payments_snapshot:array, totals:object, notes:string, status:string |
| `LabCase` | `migration/source-entities/LabCase.jsonc` | clinic_id:string, patient_id:string, patient_name:string, patient_treatment_id:string, patient_treatment_ids:array, doctor_id:string, doctor_name:string, lab_id:string, lab_name:string, case_type:string, description:string, due_date:string, sent_date:string, received_date:string, cost:number, patient_price:number, patient_paid_amount:number, currency:string, status:string, notes:string, attachments:array, net_amount:number, doctor_commission_percentage:number, doctor_commission_amount:number, clinic_share:number, is_finalized:boolean, finalized_at:string, finalized_by:string, finalized_by_name:string, expense_id:string |
| `Laboratory` | `migration/source-entities/Laboratory.jsonc` | clinic_id:string, name:string, contact_person:string, phone:string, whatsapp:string, email:string, address:string, notes:string, status:string |
| `MessageLog` | `migration/source-entities/MessageLog.jsonc` | clinic_id:string, channel:string, message_type:string, recipient:string, recipient_name:string, patient_id:string, appointment_id:string, subject:string, body:string, status:string, provider:string, provider_message_id:string, error_code:string, error_message:string, sent_at:string, template_variables:object |
| `Notification` | `migration/source-entities/Notification.jsonc` | clinic_id:string, user_id:string, type:string, title:string, message:string, link:string, read:boolean |
| `Patient` | `migration/source-entities/Patient.jsonc` | clinic_id:string, full_name:string, phone:string, whatsapp_number:string, whatsapp_opt_in:boolean, patient_source:string, referring_doctor_id:string, referring_doctor_name:string, assigned_doctor_id:string, assigned_doctor_name:string, gender:string, birth_date:string, address:string, notes:string, phone_verified:boolean, medical_info:object, dental_history:object, recall_date:string, recall_interval_months:number, recall_status:string, recall_notes:string, last_recall_date:string, plan_discount_type:string, plan_discount_value:number |
| `PatientFile` | `migration/source-entities/PatientFile.jsonc` | clinic_id:string, patient_id:string, file_url:string, file_uri:string, file_name:string, file_type:string, before_after_tag:string, associated_treatment_id:string, notes:string |
| `PatientTreatment` | `migration/source-entities/PatientTreatment.jsonc` | clinic_id:string, patient_id:string, treatment_id:string, treatment_name:string, description:string, price:number, currency:string, paid_amount:number, discount_type:string, discount_value:number, status:string, tooth_numbers:array, tooth_surfaces:object, doctor_id:string, doctor_name:string, doctor_commission_percentage:number, doctor_commission_amount:number, treatment_date:string |
| `Payment` | `migration/source-entities/Payment.jsonc` | clinic_id:string, patient_id:string, patient_treatment_id:string, doctor_id:string, doctor_name:string, doctor_commission_percentage:number, doctor_commission_amount:number, is_prosthesis:boolean, prosthesis_cost:number, net_amount:number, amount:number, currency:string, method:string, notes:string, payment_date:string |
| `PendingClinicDeletion` | `migration/source-entities/PendingClinicDeletion.jsonc` | clinic_id:string, clinic_name:string, requested_by_id:string, requested_by_name:string, requested_at:string, expires_at:string, status:string, executed_at:string, cancelled_at:string, restored_at:string |
| `PendingPermanentDeletion` | `migration/source-entities/PendingPermanentDeletion.jsonc` | clinic_id:string, clinic_name:string, requested_by_id:string, requested_by_name:string, requested_at:string, expires_at:string, status:string, executed_at:string, cancelled_at:string, failed_at:string, failure_reason:string, deletion_results:object |
| `Purchase` | `migration/source-entities/Purchase.jsonc` | clinic_id:string, name:string, category:string, supplier:string, quantity:number, unit:string, amount:number, currency:string, purchase_date:string, notes:string |
| `ReminderLog` | `migration/source-entities/ReminderLog.jsonc` | clinic_id:string, patient_id:string, patient_name:string, patient_phone:string, appointment_id:string, message:string, reminder_type:string, scheduled_time:string, sent_time:string, status:string, error_message:string |
| `RestoreLock` | `migration/source-entities/RestoreLock.jsonc` | clinic_id:string, locked_by_user_id:string, locked_by_name:string, locked_at:string, expires_at:string, status:string, backup_id:string |
| `ScheduledReport` | `migration/source-entities/ScheduledReport.jsonc` | clinic_id:string, report_type:string, frequency:string, email_recipients:array, enabled:boolean, last_sent_at:string, next_send_at:string, created_by_id:string |
| `Shift` | `migration/source-entities/Shift.jsonc` | clinic_id:string, employee_id:string, employee_name:string, employee_position:string, shift_type:string, days_of_week:array, start_time:string, end_time:string, break_duration_minutes:number, weekly_off_days:array, notes:string |
| `Staff` | `migration/source-entities/Staff.jsonc` | clinic_id:string, user_id:string, full_name:string, employee_id:string, phone:string, email:string, address:string, national_id:string, position:string, department:string, hire_date:string, status:string, notes:string, salary:number, salary_currency:string |
| `Treatment` | `migration/source-entities/Treatment.jsonc` | clinic_id:string, name:string, category:string, description:string, notes:string, applicable_surfaces:array, default_price:number, currency:string, duration_minutes:number, status:string |
| `User` | `migration/source-entities/User.jsonc` | role:string, clinic_id:string, clinic_role:string, preferred_language:string, phone:string, clinic_name:string, signup_status:string, data:object |
| `UserSecurityProfile` | `migration/source-entities/UserSecurityProfile.jsonc` | user_id:string, clinic_id:string, role:string, signup_status:string, assigned_by_id:string, last_revert_at:string, revert_count:number |
| `VerificationOTP` | `migration/source-entities/VerificationOTP.jsonc` | clinic_id:string, phone_number:string, otp_code:string, expires_at:string, attempts:number, status:string |

All source entities rely on platform-provided `id`, `created_date`, `updated_date`, and (where applicable) `created_by_id` values that are not fully described in each JSONC schema. The SQL migration must preserve those values on import.

## Backend function migration map

| Function | Source | Data entities accessed | Authentication / authorization detected | Frontend callers | External dependency | Replacement |
|---|---|---|---|---|---|---|
| `approveRegistration` | `worker/src/legacy/functions/approveRegistration/entry.ts` | Clinic, User | platform owner only | src/components/superadmin/PendingRequests.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `assignUserToClinic` | `worker/src/legacy/functions/assignUserToClinic/entry.ts` | Clinic, ClinicRoleAssignment, User | platform owner only | src/components/superadmin/ManageUsersDialog.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `cancelClinicDeletion` | `worker/src/legacy/functions/cancelClinicDeletion/entry.ts` | PendingClinicDeletion | platform owner only | src/components/superadmin/DeleteClinicDialog.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `cancelPermanentDeletion` | `worker/src/legacy/functions/cancelPermanentDeletion/entry.ts` | PendingPermanentDeletion | platform owner only | src/components/superadmin/PermanentDeleteDialog.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `checkPendingClinicDeletion` | `worker/src/legacy/functions/checkPendingClinicDeletion/entry.ts` | Clinic, PendingClinicDeletion | platform owner only | src/components/superadmin/DeleteClinicDialog.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `checkPendingPermanentDeletion` | `worker/src/legacy/functions/checkPendingPermanentDeletion/entry.ts` | PendingPermanentDeletion | platform owner only | src/components/superadmin/PermanentDeleteDialog.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `clinicScopedCrud` | `worker/src/legacy/functions/clinicScopedCrud/entry.ts` | AuditLog, Patient, PatientTreatment, [ent], [entityName], [entity] | active ClinicRoleAssignment and clinic membership | src/lib/clinicApi.js | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `completeClinicSetup` | `worker/src/legacy/functions/completeClinicSetup/entry.ts` | Clinic | active ClinicRoleAssignment and clinic membership | src/components/clinic/ClinicSetupForm.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `createClinicBackup` | `worker/src/legacy/functions/createClinicBackup/entry.ts` | indirect/shared access | active ClinicRoleAssignment and clinic membership | src/components/settings/BackupManagement.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `createNewClinic` | `worker/src/legacy/functions/createNewClinic/entry.ts` | Clinic, User | platform owner only | src/components/superadmin/CreateClinicDialog.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `executeClinicDeletion` | `worker/src/legacy/functions/executeClinicDeletion/entry.ts` | Clinic, PendingClinicDeletion | active ClinicRoleAssignment and clinic membership; authenticated user session | scheduled/system or internal call | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `executePermanentDeletion` | `worker/src/legacy/functions/executePermanentDeletion/entry.ts` | Clinic, PendingPermanentDeletion | authenticated user session | scheduled/system or internal call | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `finalizeLabCase` | `worker/src/legacy/functions/finalizeLabCase/entry.ts` | Doctor, LabCase, Patient | active ClinicRoleAssignment and clinic membership | src/pages/LabCases.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `generateNotifications` | `worker/src/legacy/functions/generateNotifications/entry.ts` | Appointment, Clinic, Doctor, LabCase, Notification, PatientTreatment, User | scheduled/system credential and, where present, owner role | scheduled/system or internal call | scheduled trigger authentication | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getBackupHistory` | `worker/src/legacy/functions/getBackupHistory/entry.ts` | Backup | active ClinicRoleAssignment and clinic membership | src/components/settings/BackupManagement.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getClinicExportData` | `worker/src/legacy/functions/getClinicExportData/entry.ts` | Clinic, [entityName] | active ClinicRoleAssignment and clinic membership | src/components/settings/ClinicExportButtons.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getCurrentUserRole` | `worker/src/legacy/functions/getCurrentUserRole/entry.ts` | indirect/shared access | authenticated user session | src/lib/AuthContext.jsx, src/pages/RoleDebug.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getDashboardStats` | `worker/src/legacy/functions/getDashboardStats/entry.ts` | indirect/shared access | active ClinicRoleAssignment and clinic membership | src/pages/Dashboard.jsx, src/pages/ReceptionistDashboard.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getDoctorCommissionSummary` | `worker/src/legacy/functions/getDoctorCommissionSummary/entry.ts` | Doctor, DoctorPayout, Patient, Payment | active ClinicRoleAssignment and clinic membership | src/pages/DoctorCommission.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getDoctorDashboard` | `worker/src/legacy/functions/getDoctorDashboard/entry.ts` | Doctor, Patient | active ClinicRoleAssignment and clinic membership | src/pages/DoctorDashboard.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getMonthlyExpenses` | `worker/src/legacy/functions/getMonthlyExpenses/entry.ts` | Doctor, Expense, Payment, Purchase, Staff | active ClinicRoleAssignment and clinic membership | src/components/dashboard/MonthlyExpensesCard.jsx, src/pages/MonthlyExpenses.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getPaginatedRecords` | `worker/src/legacy/functions/getPaginatedRecords/entry.ts` | [entityName] | active ClinicRoleAssignment and clinic membership | src/hooks/usePaginatedQuery.js, src/pages/AuditLog.jsx, src/pages/Doctors.jsx, src/pages/LabCases.jsx, src/pages/Laboratories.jsx, src/pages/Payments.jsx, src/pages/SearchPage.jsx, src/pages/Staff.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getPatientFileSignedUrl` | `worker/src/legacy/functions/getPatientFileSignedUrl/entry.ts` | PatientFile | active ClinicRoleAssignment and clinic membership | scheduled/system or internal call | signed file URLs | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getPatientRecall` | `worker/src/legacy/functions/getPatientRecall/entry.ts` | Appointment, Patient, PatientTreatment | active ClinicRoleAssignment and clinic membership | src/pages/PatientRecall.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getPatientsForExport` | `worker/src/legacy/functions/getPatientsForExport/entry.ts` | Doctor, Patient, PatientTreatment, Payment | active ClinicRoleAssignment and clinic membership | src/pages/Patients.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getPatientTimeline` | `worker/src/legacy/functions/getPatientTimeline/entry.ts` | Appointment, ConsentForm, Invoice, LabCase, Patient, PatientFile, PatientTreatment, Payment | active ClinicRoleAssignment and clinic membership | src/components/patient/PatientTimeline.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getReportsStats` | `worker/src/legacy/functions/getReportsStats/entry.ts` | indirect/shared access | active ClinicRoleAssignment and clinic membership | src/components/settings/FinancialExportButtons.jsx, src/pages/Reports.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getSuperAdminStats` | `worker/src/legacy/functions/getSuperAdminStats/entry.ts` | Clinic | platform owner only | src/pages/SuperAdminDashboard.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `getSuperAdminUsers` | `worker/src/legacy/functions/getSuperAdminUsers/entry.ts` | ClinicRoleAssignment, DeletedUser, User | platform owner only | src/components/superadmin/ManageUsersDialog.jsx, src/pages/SuperAdminDashboard.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `linkExistingDoctor` | `worker/src/legacy/functions/linkExistingDoctor/entry.ts` | ClinicRoleAssignment, Doctor, User | active ClinicRoleAssignment and clinic membership | src/pages/Doctors.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `linkExistingReceptionist` | `worker/src/legacy/functions/linkExistingReceptionist/entry.ts` | ClinicRoleAssignment, Staff, User | active ClinicRoleAssignment and clinic membership | src/pages/Staff.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `loadUserClinic` | `worker/src/legacy/functions/loadUserClinic/entry.ts` | indirect/shared access | active ClinicRoleAssignment and clinic membership | src/lib/useClinic.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `migrateLegacyFiles` | `worker/src/legacy/functions/migrateLegacyFiles/entry.ts` | PatientFile | active ClinicRoleAssignment and clinic membership | scheduled/system or internal call | private file storage, signed file URLs | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `normalizeOwnerRoles` | `worker/src/legacy/functions/normalizeOwnerRoles/entry.ts` | ClinicRoleAssignment, User | scheduled/system credential and, where present, owner role | scheduled/system or internal call | scheduled trigger authentication | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `processPatientFileBatch` | `worker/src/legacy/functions/processPatientFileBatch/entry.ts` | Backup | active ClinicRoleAssignment and clinic membership | src/components/settings/BackupManagement.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `purgeRecycleBin` | `worker/src/legacy/functions/purgeRecycleBin/entry.ts` | AuditLog | scheduled/system credential and, where present, owner role | scheduled/system or internal call | scheduled trigger authentication | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `pwaManifest` | `worker/src/legacy/functions/pwaManifest/entry.ts` | indirect/shared access | inspect handler; no shared guard detected | scheduled/system or internal call | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `pwaServiceWorker` | `worker/src/legacy/functions/pwaServiceWorker/entry.ts` | indirect/shared access | inspect handler; no shared guard detected | scheduled/system or internal call | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `rejectRegistration` | `worker/src/legacy/functions/rejectRegistration/entry.ts` | User | platform owner only | src/components/superadmin/PendingRequests.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `restoreClinic` | `worker/src/legacy/functions/restoreClinic/entry.ts` | Clinic, PendingClinicDeletion | platform owner only | src/components/superadmin/RestoreClinicDialog.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `restoreClinicBackup` | `worker/src/legacy/functions/restoreClinicBackup/entry.ts` | Backup, PatientFile, RestoreLock | active ClinicRoleAssignment and clinic membership | src/components/settings/BackupManagement.jsx | signed file URLs | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `restoreUser` | `worker/src/legacy/functions/restoreUser/entry.ts` | ClinicRoleAssignment, DeletedUser | platform owner only | src/components/superadmin/UserRecycleBinDialog.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `runAutomaticBackups` | `worker/src/legacy/functions/runAutomaticBackups/entry.ts` | Backup, Clinic | scheduled/system credential and, where present, owner role | scheduled/system or internal call | scheduled trigger authentication | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `saveClinicSettings` | `worker/src/legacy/functions/saveClinicSettings/entry.ts` | Clinic, User | active ClinicRoleAssignment and clinic membership; authenticated user session | src/pages/Settings.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `saveDoctorCompensation` | `worker/src/legacy/functions/saveDoctorCompensation/entry.ts` | Doctor | active ClinicRoleAssignment and clinic membership | src/pages/Doctors.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `saveMessageTemplates` | `worker/src/legacy/functions/saveMessageTemplates/entry.ts` | Clinic | active ClinicRoleAssignment and clinic membership | src/pages/MessageTemplates.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `savePayment` | `worker/src/legacy/functions/savePayment/entry.ts` | Doctor, Invoice, LabCase, Patient, PatientTreatment, Payment | active ClinicRoleAssignment and clinic membership | src/components/patient/PatientPayments.jsx, src/components/payments/AddPaymentDialog.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `scheduleClinicDeletion` | `worker/src/legacy/functions/scheduleClinicDeletion/entry.ts` | Clinic, PendingClinicDeletion | platform owner only | src/components/superadmin/DeleteClinicDialog.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `schedulePermanentDeletion` | `worker/src/legacy/functions/schedulePermanentDeletion/entry.ts` | Clinic, PendingPermanentDeletion | platform owner only | src/components/superadmin/PermanentDeleteDialog.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `searchPatients` | `worker/src/legacy/functions/searchPatients/entry.ts` | Patient | active ClinicRoleAssignment and clinic membership | src/pages/Patients.jsx, src/pages/SearchPage.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `secureExtractData` | `worker/src/legacy/functions/secureExtractData/entry.ts` | indirect/shared access | active ClinicRoleAssignment and clinic membership | src/components/import/ImportDialog.jsx | document extraction provider | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `sendScheduledReports` | `worker/src/legacy/functions/sendScheduledReports/entry.ts` | Appointment, Clinic, Expense, LabCase, PatientTreatment, Payment, Purchase, ScheduledReport | scheduled/system credential and, where present, owner role | scheduled/system or internal call | email provider, scheduled trigger authentication | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |
| `softDeleteUser` | `worker/src/legacy/functions/softDeleteUser/entry.ts` | ClinicRoleAssignment, DeletedUser, User | platform owner only; active ClinicRoleAssignment and clinic membership | src/components/superadmin/ManageUsersDialog.jsx | none detected | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |

## Scheduled workflows

- `migration/source-workflows/Clinic Deletion Countdown.jsonc` — replace its schedule with a Cloudflare Cron Trigger and invoke the corresponding authenticated Worker operation after reviewing the source trigger and retry behavior.
- `migration/source-workflows/Daily Automatic Backup.jsonc` — replace its schedule with a Cloudflare Cron Trigger and invoke the corresponding authenticated Worker operation after reviewing the source trigger and retry behavior.
- `migration/source-workflows/Generate Notifications.jsonc` — replace its schedule with a Cloudflare Cron Trigger and invoke the corresponding authenticated Worker operation after reviewing the source trigger and retry behavior.
- `migration/source-workflows/Permanent Deletion Countdown.jsonc` — replace its schedule with a Cloudflare Cron Trigger and invoke the corresponding authenticated Worker operation after reviewing the source trigger and retry behavior.
- `migration/source-workflows/Recycle Bin Auto Purge.jsonc` — replace its schedule with a Cloudflare Cron Trigger and invoke the corresponding authenticated Worker operation after reviewing the source trigger and retry behavior.
- `migration/source-workflows/Send Scheduled Reports.jsonc` — replace its schedule with a Cloudflare Cron Trigger and invoke the corresponding authenticated Worker operation after reviewing the source trigger and retry behavior.

## Shared backend and integration dependencies

- `worker/src/legacy/shared/clinicAuth.ts`, `clinicRoleAssignment.ts`, `userSecurity.ts`: active clinic role, account status, and owner-protection resolution. These define the authorization boundary and must be ported without client role fallback.
- `worker/src/legacy/shared/commission.ts`, `currencyUtils.ts`, `planDiscount.ts`: financial formulas and discount distribution; preserve exact behavior and historical values.
- `worker/src/legacy/shared/auditLog.ts`, `clinicDeletion.ts`, `restoreLogic.ts`: audit snapshots, deletion/restore ordering, and restore locks.
- `worker/src/legacy/shared/backupLogic.ts`, `googleDriveBackup.ts`, `patientFileBatch.ts`: database backups, private files, signed links, Google Drive transfer, and patient-file reconciliation.
- `worker/src/legacy/shared/paginatedFetch.ts`, `rateLimiter.ts`, `messageI18n.ts`: pagination, abuse controls, and localized outbound content.
- Base44 Core integrations found: email (`SendEmail`), upload/public upload (`UploadFile`, `UploadPrivateFile`), signed URLs (`CreateFileSignedUrl`), and extraction (`ExtractDataFromUploadedFile`). Each provider requires explicit credentials or a configured replacement; missing credentials must not return success.
- Google Drive connector source is preserved under `migration/source-config/`; configure its OAuth client, refresh token, and folder settings in Worker secrets before use.
- Auth source configuration is preserved under `migration/source-config/`; email verification, redirects, OAuth providers, SMS/TOTP MFA, and templates must be configured in Supabase Auth before production use.

## Environment and configuration dependencies

- Frontend: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` configure the browser client.
- Worker-only: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and provider/schedule secrets from `.env.example`.
- Build: Vite uses the standard React plugin; `@base44/sdk` and `@base44/vite-plugin` are absent from the active package manifest.
- Static images were copied into the local asset tree; one-time legacy file transfer and archived source code remain documented migration inputs.

## Security requirements carried into the replacement

1. Derive clinic membership from the active `ClinicRoleAssignment` row, never a submitted `clinic_id` or mutable profile field.
2. Resolve platform owner eligibility from a server-owned record provisioned only by a trusted operator; a client role or generic admin value must never grant owner access.
3. Keep the service-role key and provider secrets in Worker secrets only. Browser code may contain only the Supabase URL and publishable key.
4. Enforce clinic access in both Worker guards and PostgreSQL RLS, including files and audit records.
5. Preserve entity permissions, doctor/receptionist field restrictions, audit snapshots, deletion recovery, and payment/commission calculations.

## Known migration inputs not present in this checkout

- Supabase project URL, publishable key, service-role key, and production database access.
- Base44 production record export and private-file contents/transfer credentials.
- Verified owner account ID, external provider credentials, and live Google Drive OAuth configuration.
- Production test accounts for at least two clinics and expected historical reconciliation counts.
- The source application defines `super_admin`, `clinic_admin`, `doctor`, and `receptionist` as authorization roles; `assistant` and `accountant` appear only as staff position labels. No role permissions were invented for those requested labels.

Without these inputs, code and SQL can be prepared, but live authentication, provider delivery, file transfer, production data reconciliation, and cross-clinic penetration checks cannot be truthfully marked verified.
