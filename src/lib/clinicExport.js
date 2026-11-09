/**
 * Clinic-wide data export utilities.
 * Excel: real .xlsx workbook with one worksheet per entity.
 * PDF: one section per entity, laid out as HTML and printed by the browser so
 * Arabic (shaped, right-to-left) and Turkish text is exported correctly.
 * Currencies are never mixed — each amount keeps its currency column.
 */
import { createWorkbook, addSheet, saveWorkbook } from '@/lib/excelWorkbook';
import { t } from '@/lib/i18n';
import { formatDisplayDate, formatDisplayDateTime } from '@/lib/dateFormat';
import { downloadHtmlPdf, escapeHtml } from '@/lib/pdfHtml';
import { indexDoctors, resolveAssignedDoctorName } from '@/lib/exportDoctor';

// Locale-aware: day and month names follow the language the export was
// generated in (English / Arabic / Turkish). Previously hardcoded to 'en-US',
// so Arabic and Turkish exports always came out in English.
const fmtDate = (d) => formatDisplayDate(d);
const fmtDateTime = (d) => formatDisplayDateTime(d);

function teeth(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr.join(', ');
}

// ─── Excel (real .xlsx via SheetJS) ───

const SHEETS = [
  {
    key: 'clinic',
    name: 'Clinic Info',
    headers: ['Name', 'Name (AR)', 'Address', 'Phone', 'Email', 'Country', 'City', 'Currency', 'Language', 'WhatsApp'],
    row: (c) => [c?.name, c?.name_ar, c?.address, c?.phone, c?.email, c?.country, c?.city, c?.currency, c?.language, c?.whatsapp_number],
    single: true,
  },
  {
    key: 'doctors',
    name: 'Doctors',
    headers: ['Name', 'Specialty', 'Phone', 'Commission %', 'Monthly Salary', 'Salary Currency'],
    row: (d) => [d.name, d.specialty, d.phone, d.commission_percentage, d.monthly_salary, d.salary_currency],
  },
  {
    key: 'staff',
    name: 'Staff',
    headers: ['Full Name', 'Position', 'Phone', 'Email', 'Status', 'Hire Date'],
    row: (s) => [s.full_name, s.position, s.phone, s.email, s.status, s.hire_date],
  },
  {
    key: 'patients',
    name: 'Patients',
    // Assigned Doctor is resolved from the patient's assignment ID against the
    // clinic's Doctor records — see lib/exportDoctor.js.
    headers: ['ID', 'Full Name', 'Assigned Doctor', 'Phone', 'WhatsApp', 'Gender', 'Birth Date', 'Address', 'Registered', 'Notes'],
    row: (p, { doctorsById, lang }) => [p.id, p.full_name, resolveAssignedDoctorName(p, doctorsById, lang), p.phone, p.whatsapp_number, p.gender, p.birth_date, p.address, p.created_date, p.notes],
  },
  {
    key: 'treatments',
    name: 'Treatments',
    headers: ['Name', 'Category', 'Default Price', 'Currency', 'Duration (min)'],
    row: (tr) => [tr.name, tr.category, tr.default_price, tr.currency, tr.duration_minutes],
  },
  {
    key: 'patientTreatments',
    name: 'Patient Treatments',
    headers: ['Patient', 'Treatment', 'Tooth Numbers', 'Price', 'Currency', 'Paid', 'Discount Type', 'Discount Value', 'Status', 'Doctor', 'Date'],
    row: (pt) => [pt.patient_id, pt.treatment_name, teeth(pt.tooth_numbers), pt.price, pt.currency, pt.paid_amount, pt.discount_type, pt.discount_value, pt.status, pt.doctor_name, pt.treatment_date],
  },
  {
    key: 'appointments',
    name: 'Appointments',
    headers: ['Patient', 'Doctor', 'Date', 'Start', 'End', 'Room', 'Status', 'Treatment', 'Notes'],
    row: (a) => [a.patient_name, a.doctor_name, a.date, a.start_time, a.end_time, a.treatment_room, a.status, a.treatment_name, a.notes],
  },
  {
    key: 'payments',
    name: 'Payments',
    headers: ['Patient ID', 'Doctor', 'Amount', 'Currency', 'Method', 'Date', 'Commission', 'Notes'],
    row: (p) => [p.patient_id, p.doctor_name, p.amount, p.currency, p.method, p.payment_date, p.doctor_commission_amount, p.notes],
  },
  {
    key: 'labCases',
    name: 'Lab Cases',
    headers: ['Patient', 'Lab', 'Case Type', 'Sent Date', 'Due Date', 'Received Date', 'Cost', 'Currency', 'Status'],
    row: (lc) => [lc.patient_name, lc.lab_name, lc.case_type, lc.sent_date, lc.due_date, lc.received_date, lc.cost, lc.currency, lc.status],
  },
  {
    key: 'laboratories',
    name: 'Laboratories',
    headers: ['Name', 'Contact Person', 'Phone', 'WhatsApp', 'Email', 'Address', 'Status'],
    row: (l) => [l.name, l.contact_person, l.phone, l.whatsapp, l.email, l.address, l.status],
  },
  {
    key: 'expenses',
    name: 'Expenses',
    headers: ['Name', 'Category', 'Amount', 'Currency', 'Date'],
    row: (e) => [e.name, e.category, e.amount, e.currency, e.expense_date],
  },
  {
    key: 'purchases',
    name: 'Purchases',
    headers: ['Name', 'Category', 'Supplier', 'Amount', 'Currency', 'Date'],
    row: (p) => [p.name, p.category, p.supplier, p.amount, p.currency, p.purchase_date],
  },
  {
    key: 'invoices',
    name: 'Invoices',
    headers: ['Invoice #', 'Patient', 'Date', 'Type', 'Doctor', 'Status'],
    row: (i) => [i.invoice_number, i.patient_name, i.invoice_date, i.type, i.doctor_name, i.status],
  },
  {
    key: 'consentForms',
    name: 'Consent Forms',
    headers: ['Patient', 'Template', 'Procedure', 'Procedure Date', 'Doctor', 'Signed At', 'Status'],
    row: (c) => [c.patient_name, c.template_name, c.procedure_name, c.procedure_date, c.doctor_name, c.signed_at, c.status],
  },
  {
    key: 'doctorPayouts',
    name: 'Doctor Payouts',
    headers: ['Doctor', 'Amount', 'Currency', 'Date', 'Period Start', 'Period End', 'Notes'],
    row: (p) => [p.doctor_name, p.amount, p.currency, p.payment_date, p.period_start, p.period_end, p.notes],
  },
  {
    key: 'shifts',
    name: 'Shifts',
    headers: ['Employee', 'Position', 'Type', 'Days', 'Start', 'End', 'Break (min)'],
    row: (s) => [s.employee_name, s.employee_position, s.shift_type, (s.days_of_week || []).join(', '), s.start_time, s.end_time, s.break_duration_minutes],
  },
  {
    key: 'scheduledReports',
    name: 'Scheduled Reports',
    headers: ['Report Type', 'Frequency', 'Enabled', 'Last Sent', 'Next Send'],
    row: (r) => [r.report_type, r.frequency, r.enabled, r.last_sent_at, r.next_send_at],
  },
  {
    key: 'messageLogs',
    name: 'Message Logs',
    headers: ['Channel', 'Recipient', 'Name', 'Type', 'Status', 'Sent At'],
    row: (m) => [m.channel, m.recipient, m.recipient_name, m.message_type, m.status, m.sent_at],
  },
  {
    key: 'reminderLogs',
    name: 'Reminder Logs',
    headers: ['Patient', 'Phone', 'Type', 'Scheduled', 'Sent', 'Status'],
    row: (r) => [r.patient_name, r.patient_phone, r.reminder_type, r.scheduled_time, r.sent_time, r.status],
  },
  {
    key: 'notifications',
    name: 'Notifications',
    headers: ['Type', 'Title', 'Message', 'Read'],
    row: (n) => [n.type, n.title, n.message, n.read ? 'Yes' : 'No'],
  },
  {
    key: 'patientFiles',
    name: 'Patient Files',
    headers: ['Patient ID', 'File Name', 'File Type', 'Notes'],
    row: (f) => [f.patient_id, f.file_name, f.file_type, f.notes],
  },
];

export async function exportClinicExcel(data, clinic, lang = 'en', dateFrom, dateTo) {
  const wb = createWorkbook();
  const periodLabel = (dateFrom && dateTo) ? `${dateFrom}_to_${dateTo}` : new Date().toISOString().slice(0, 10);

  // Row builders receive the resolved doctor index so a patient row always
  // shows the doctor actually assigned to that patient.
  const ctx = { doctorsById: indexDoctors(data.doctors), lang };

  for (const { key, name, headers, row: rowFn, single } of SHEETS) {
    const records = single ? (data[key] ? [data[key]] : []) : (data[key] || []);
    const aoa = [headers, ...records.map((rec) => rowFn(rec, ctx))];
    // Sheet names are truncated to 31 chars (Excel limit)
    addSheet(wb, name || key, aoa);
  }

  await saveWorkbook(wb, `clinic-export-${(clinic?.name || 'clinic').replace(/\s+/g, '_')}-${periodLabel}.xlsx`);
}

// ─── PDF (Unicode-safe, printed by the browser — see lib/pdfHtml.js) ───

const PDF_SECTIONS = [
  {
    title: 'doctors',
    key: 'doctors',
    headers: ['Name', 'Specialty', 'Phone', 'Comm %'],
    row: (d) => [d.name, d.specialty, d.phone, d.commission_percentage + '%'],
  },
  {
    title: 'staff',
    key: 'staff',
    headers: ['Name', 'Position', 'Phone', 'Status'],
    row: (s) => [s.full_name, s.position, s.phone, s.status],
  },
  {
    title: 'patients',
    key: 'patients',
    headers: ['Name', 'Assigned Doctor', 'Phone', 'Gender', 'DOB', 'Registered'],
    row: (p, { doctorsById, lang }) => [p.full_name, resolveAssignedDoctorName(p, doctorsById, lang), p.phone, p.gender, fmtDate(p.birth_date), fmtDate(p.created_date)],
  },
  {
    title: 'patient_treatments',
    key: 'patientTreatments',
    headers: ['Patient ID', 'Treatment', 'Teeth', 'Price', 'Cur', 'Status'],
    row: (pt) => [(pt.patient_id || '').slice(0, 12), pt.treatment_name, teeth(pt.tooth_numbers), pt.price, pt.currency, pt.status],
  },
  {
    title: 'appointments',
    key: 'appointments',
    headers: ['Patient', 'Doctor', 'Date', 'Start', 'End', 'Status'],
    row: (a) => [a.patient_name, a.doctor_name, a.date, a.start_time, a.end_time, a.status],
  },
  {
    title: 'payments',
    key: 'payments',
    headers: ['Patient ID', 'Doctor', 'Amount', 'Cur', 'Method', 'Date'],
    row: (p) => [(p.patient_id || '').slice(0, 12), p.doctor_name, p.amount, p.currency, p.method, fmtDate(p.payment_date)],
  },
  {
    title: 'lab_cases',
    key: 'labCases',
    headers: ['Patient', 'Lab', 'Type', 'Cost', 'Cur', 'Status'],
    row: (lc) => [lc.patient_name, lc.lab_name, lc.case_type, lc.cost, lc.currency, lc.status],
  },
  {
    title: 'expenses',
    key: 'expenses',
    headers: ['Name', 'Category', 'Amount', 'Cur', 'Date'],
    row: (e) => [e.name, e.category, e.amount, e.currency, fmtDate(e.expense_date)],
  },
  {
    title: 'purchases',
    key: 'purchases',
    headers: ['Name', 'Category', 'Supplier', 'Amount', 'Cur'],
    row: (p) => [p.name, p.category, p.supplier, p.amount, p.currency],
  },
  {
    title: 'invoices_receipts',
    key: 'invoices',
    headers: ['Invoice #', 'Patient', 'Date', 'Type', 'Status'],
    row: (i) => [i.invoice_number, i.patient_name, fmtDate(i.invoice_date), i.type, i.status],
  },
  {
    title: 'consent_forms',
    key: 'consentForms',
    headers: ['Patient', 'Template', 'Procedure', 'Signed At'],
    row: (c) => [c.patient_name, c.template_name, c.procedure_name, fmtDateTime(c.signed_at)],
  },
  {
    title: 'doctor_payouts',
    key: 'doctorPayouts',
    headers: ['Doctor', 'Amount', 'Cur', 'Date'],
    row: (p) => [p.doctor_name, p.amount, p.currency, fmtDate(p.payment_date)],
  },
];

export async function exportClinicPDF(data, clinic, lang = 'en', dateFrom, dateTo) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  let html = '';

  // Header — clinic info, period and generation date
  html += `<h1>${escapeHtml(t('clinic_export_title', lang))}</h1>`;
  if (clinic?.name) html += `<p><strong>${escapeHtml(clinic.name)}</strong></p>`;
  if (clinic?.address) html += `<p>${escapeHtml(clinic.address)}</p>`;
  if (clinic?.phone) html += `<p class="num">Tel: ${escapeHtml(clinic.phone)}</p>`;
  if (clinic?.email) html += `<p>${escapeHtml(clinic.email)}</p>`;
  if (clinic?.currency) html += `<p>${escapeHtml(t('currency', lang))}: ${escapeHtml(clinic.currency)}</p>`;
  if (dateFrom && dateTo) {
    html += `<p><strong>${escapeHtml(t('period_label', lang))}: ${escapeHtml(dateFrom)} ${escapeHtml(t('to', lang))} ${escapeHtml(dateTo)}</strong></p>`;
  }
  html += `<p class="num">${escapeHtml(t('export_date', lang))}: ${escapeHtml(formatDisplayDateTime(new Date(), lang))}</p>`;

  // Summary counts
  const counts = [
    [t('patients', lang), (data.patients || []).length],
    [t('doctors', lang), (data.doctors || []).length],
    [t('staff', lang), (data.staff || []).length],
    [t('patient_treatments', lang), (data.patientTreatments || []).length],
    [t('appointments', lang), (data.appointments || []).length],
    [t('payments', lang), (data.payments || []).length],
    [t('lab_cases', lang), (data.labCases || []).length],
    [t('invoices_receipts', lang), (data.invoices || []).length],
  ];
  html += `<h2>${escapeHtml(t('summary', lang))}</h2><table><tbody>`;
  counts.forEach(([label, count]) => {
    html += `<tr><td>${escapeHtml(label)}</td><td class="num">${escapeHtml(count)}</td></tr>`;
  });
  html += '</tbody></table>';

  // One section per entity — row builders receive the resolved doctor index so
  // each patient row shows the doctor assigned to that patient.
  const ctx = { doctorsById: indexDoctors(data.doctors), lang };

  PDF_SECTIONS.forEach(({ title, key, headers, row: rowFn }) => {
    const records = data[key] || [];
    if (!records.length) return;
    html += `<section><h2>${escapeHtml(t(title, lang))} (${records.length})</h2>`;
    html += `<table><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>`;
    records.forEach(rec => {
      html += `<tr>${rowFn(rec, ctx).map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`;
    });
    html += '</tbody></table></section>';
  });

  const periodLabel = (dateFrom && dateTo) ? `${dateFrom}_to_${dateTo}` : new Date().toISOString().slice(0, 10);
  await downloadHtmlPdf({
    html,
    filename: `clinic-export-${(clinic?.name || 'clinic').replace(/\s+/g, '_')}-${periodLabel}.pdf`,
    dir,
  });
}