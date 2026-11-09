import handler0 from './legacy/functions/approveRegistration/entry.ts';
import handler1 from './legacy/functions/assignUserToClinic/entry.ts';
import handler2 from './legacy/functions/cancelClinicDeletion/entry.ts';
import handler3 from './legacy/functions/cancelPermanentDeletion/entry.ts';
import handler4 from './legacy/functions/checkPendingClinicDeletion/entry.ts';
import handler5 from './legacy/functions/checkPendingPermanentDeletion/entry.ts';
import handler6 from './legacy/functions/clinicScopedCrud/entry.ts';
import handler7 from './legacy/functions/completeClinicSetup/entry.ts';
import handler8 from './legacy/functions/createClinicBackup/entry.ts';
import handler9 from './legacy/functions/createNewClinic/entry.ts';
import handler10 from './legacy/functions/executeClinicDeletion/entry.ts';
import handler11 from './legacy/functions/executePermanentDeletion/entry.ts';
import handler12 from './legacy/functions/finalizeLabCase/entry.ts';
import handler13 from './legacy/functions/generateNotifications/entry.ts';
import handler14 from './legacy/functions/getBackupHistory/entry.ts';
import handler15 from './legacy/functions/getClinicExportData/entry.ts';
import handler16 from './legacy/functions/getCurrentUserRole/entry.ts';
import handler17 from './legacy/functions/getDashboardStats/entry.ts';
import handler18 from './legacy/functions/getDoctorCommissionSummary/entry.ts';
import handler19 from './legacy/functions/getDoctorDashboard/entry.ts';
import handler20 from './legacy/functions/getMonthlyExpenses/entry.ts';
import handler21 from './legacy/functions/getPaginatedRecords/entry.ts';
import handler22 from './legacy/functions/getPatientFileSignedUrl/entry.ts';
import handler23 from './legacy/functions/getPatientRecall/entry.ts';
import handler24 from './legacy/functions/getPatientTimeline/entry.ts';
import handler25 from './legacy/functions/getPatientsForExport/entry.ts';
import handler26 from './legacy/functions/getReportsStats/entry.ts';
import handler27 from './legacy/functions/getSuperAdminStats/entry.ts';
import handler28 from './legacy/functions/getSuperAdminUsers/entry.ts';
import handler29 from './legacy/functions/linkExistingDoctor/entry.ts';
import handler30 from './legacy/functions/linkExistingReceptionist/entry.ts';
import handler31 from './legacy/functions/loadUserClinic/entry.ts';
import handler32 from './legacy/functions/migrateLegacyFiles/entry.ts';
import handler33 from './legacy/functions/normalizeOwnerRoles/entry.ts';
import handler34 from './legacy/functions/processPatientFileBatch/entry.ts';
import handler35 from './legacy/functions/purgeRecycleBin/entry.ts';
import handler36 from './legacy/functions/pwaManifest/entry.ts';
import handler37 from './legacy/functions/pwaServiceWorker/entry.ts';
import handler38 from './legacy/functions/rejectRegistration/entry.ts';
import handler39 from './legacy/functions/restoreClinic/entry.ts';
import handler40 from './legacy/functions/restoreClinicBackup/entry.ts';
import handler41 from './legacy/functions/restoreUser/entry.ts';
import handler42 from './legacy/functions/runAutomaticBackups/entry.ts';
import handler43 from './legacy/functions/saveClinicSettings/entry.ts';
import handler44 from './legacy/functions/saveDoctorCompensation/entry.ts';
import handler45 from './legacy/functions/saveMessageTemplates/entry.ts';
import handler46 from './legacy/functions/savePayment/entry.ts';
import handler47 from './legacy/functions/scheduleClinicDeletion/entry.ts';
import handler48 from './legacy/functions/schedulePermanentDeletion/entry.ts';
import handler49 from './legacy/functions/searchPatients/entry.ts';
import handler50 from './legacy/functions/secureExtractData/entry.ts';
import handler51 from './legacy/functions/sendScheduledReports/entry.ts';
import handler52 from './legacy/functions/softDeleteUser/entry.ts';

export const handlers = {
  "approveRegistration": handler0,
  "assignUserToClinic": handler1,
  "cancelClinicDeletion": handler2,
  "cancelPermanentDeletion": handler3,
  "checkPendingClinicDeletion": handler4,
  "checkPendingPermanentDeletion": handler5,
  "clinicScopedCrud": handler6,
  "completeClinicSetup": handler7,
  "createClinicBackup": handler8,
  "createNewClinic": handler9,
  "executeClinicDeletion": handler10,
  "executePermanentDeletion": handler11,
  "finalizeLabCase": handler12,
  "generateNotifications": handler13,
  "getBackupHistory": handler14,
  "getClinicExportData": handler15,
  "getCurrentUserRole": handler16,
  "getDashboardStats": handler17,
  "getDoctorCommissionSummary": handler18,
  "getDoctorDashboard": handler19,
  "getMonthlyExpenses": handler20,
  "getPaginatedRecords": handler21,
  "getPatientFileSignedUrl": handler22,
  "getPatientRecall": handler23,
  "getPatientTimeline": handler24,
  "getPatientsForExport": handler25,
  "getReportsStats": handler26,
  "getSuperAdminStats": handler27,
  "getSuperAdminUsers": handler28,
  "linkExistingDoctor": handler29,
  "linkExistingReceptionist": handler30,
  "loadUserClinic": handler31,
  "migrateLegacyFiles": handler32,
  "normalizeOwnerRoles": handler33,
  "processPatientFileBatch": handler34,
  "purgeRecycleBin": handler35,
  "pwaManifest": handler36,
  "pwaServiceWorker": handler37,
  "rejectRegistration": handler38,
  "restoreClinic": handler39,
  "restoreClinicBackup": handler40,
  "restoreUser": handler41,
  "runAutomaticBackups": handler42,
  "saveClinicSettings": handler43,
  "saveDoctorCompensation": handler44,
  "saveMessageTemplates": handler45,
  "savePayment": handler46,
  "scheduleClinicDeletion": handler47,
  "schedulePermanentDeletion": handler48,
  "searchPatients": handler49,
  "secureExtractData": handler50,
  "sendScheduledReports": handler51,
  "softDeleteUser": handler52,
};
