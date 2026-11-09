/**
 * Patient export utilities.
 *
 * PDF: the document is real HTML printed by the browser into a paginated A4 PDF
 *   (see lib/pdfHtml.js), which shapes Arabic, orders it right-to-left and
 *   renders Turkish diacritics correctly while keeping the text selectable.
 * Excel: real .xlsx workbook with separate worksheets (Basic Info,
 *   Medical, Treatments, Payments, Balance Summary). Currencies are never
 *   mixed — each amount has its currency column beside it.
 */
import { createWorkbook, addSheet, saveWorkbook } from '@/lib/excelWorkbook';
import { t } from '@/lib/i18n';
import { downloadHtmlPdf, escapeHtml } from '@/lib/pdfHtml';
import { indexDoctors, resolveAssignedDoctorName } from '@/lib/exportDoctor';

import { formatDisplayDate, formatDisplayDateTime } from '@/lib/dateFormat';

/**
 * Dates come from the single shared formatter so the export can never drift
 * from the rest of the app (locale, month/day names and the date-only noon
 * anchor all live in src/lib/dateFormat.js).
 */
const fmtDate = (value, lang) => formatDisplayDate(value, lang);
const fmtDateTime = (value, lang) => formatDisplayDateTime(value, lang);

/**
 * Every patient row (Excel and PDF) shows the doctor resolved from the
 * patient's assignment ID against the clinic's Doctor records — see
 * lib/exportDoctor.js — so an out-of-date cached doctor name is never
 * exported and a patient with no doctor is labelled in the export language.
 */

// ─── Excel (real .xlsx via SheetJS with separate worksheets) ───

export async function exportPatientsExcel(data, clinic, lang = 'en') {
  const { patients, treatments, payments } = data;
  const doctorsById = indexDoctors(data.doctors);

  const txByPatient = {};
  treatments.forEach(pt => { (txByPatient[pt.patient_id] ||= []).push(pt); });
  const payByPatient = {};
  payments.forEach(p => { (payByPatient[p.patient_id] ||= []).push(p); });

  const wb = createWorkbook();

  // Sheet 1: Basic Info (includes the Assigned Doctor column)
  const basicAOA = [
    [t('patient_id', lang), t('full_name', lang), t('phone', lang), t('whatsapp', lang), t('gender', lang), t('date_of_birth', lang), t('address', lang), t('assigned_doctor', lang), t('registered_date', lang), t('notes', lang)],
    ...patients.map(p => [p.id, p.full_name, p.phone, p.whatsapp_number, p.gender, p.birth_date, p.address, resolveAssignedDoctorName(p, doctorsById, lang), p.created_date, p.notes]),
  ];
  addSheet(wb, t('basic_info_sheet', lang) || 'Basic Info', basicAOA);

  // Sheet 2: Medical Info
  const medicalAOA = [
    [t('patient_id', lang), t('patient', lang), t('blood_type', lang), t('allergies', lang), t('chronic_diseases', lang), t('medications', lang)],
    ...patients.map(p => [p.id, p.full_name, p.medical_info?.blood_type, p.medical_info?.allergies, p.medical_info?.chronic_diseases, p.medical_info?.medications]),
  ];
  addSheet(wb, t('medical_info_sheet', lang) || 'Medical Info', medicalAOA);

  // Sheet 3: Treatments (currency column beside each amount)
  const txAOA = [
    [t('patient_id', lang), t('patient', lang), t('treatment', lang), t('description', lang), t('price', lang), t('currency', lang), t('discount_type', lang), t('discount_value', lang), t('paid', lang), t('currency', lang), t('remaining', lang), t('currency', lang), t('status', lang), t('doctor', lang), t('date', lang)],
  ];
  patients.forEach(p => {
    (txByPatient[p.id] || []).forEach(pt => {
      const disc = pt.discount_type === 'percentage' ? (pt.price * (pt.discount_value || 0) / 100)
        : (pt.discount_type === 'fixed' ? (pt.discount_value || 0) : 0);
      const remaining = pt.status === 'completed' ? Math.round(((pt.price || 0) - disc - (pt.paid_amount || 0)) * 100) / 100 : 0;
      txAOA.push([
        p.id, p.full_name, pt.treatment_name, pt.description,
        pt.price, pt.currency, pt.discount_type, pt.discount_value,
        pt.paid_amount, pt.currency, remaining, pt.currency,
        pt.status, pt.doctor_name, pt.treatment_date,
      ]);
    });
  });
  addSheet(wb, t('treatments', lang) || 'Treatments', txAOA);

  // Sheet 4: Payments
  const payAOA = [
    [t('patient_id', lang), t('patient', lang), t('payment_date', lang), t('amount', lang), t('currency', lang), t('method', lang), t('doctor', lang), t('notes', lang)],
  ];
  patients.forEach(p => {
    (payByPatient[p.id] || []).forEach(pay => {
      payAOA.push([
        p.id, p.full_name, pay.payment_date,
        pay.amount, pay.currency, pay.method, pay.doctor_name, pay.notes,
      ]);
    });
  });
  addSheet(wb, t('payments', lang) || 'Payments', payAOA);

  // Sheet 5: Balance Summary (per currency — never mixed)
  const balAOA = [
    [t('patient_id', lang), t('patient', lang), t('currency', lang), t('total_due', lang), t('currency', lang), t('total_paid', lang), t('currency', lang), t('remaining', lang), t('currency', lang)],
  ];
  patients.forEach(p => {
    const ptList = txByPatient[p.id] || [];
    const totals = {};
    ptList.forEach(pt => {
      if (pt.status !== 'completed') return; // Only completed treatments are payable
      const cur = pt.currency || 'USD';
      if (!totals[cur]) totals[cur] = { due: 0, paid: 0 };
      const disc = pt.discount_type === 'percentage' ? (pt.price * (pt.discount_value || 0) / 100)
        : (pt.discount_type === 'fixed' ? (pt.discount_value || 0) : 0);
      totals[cur].due += (pt.price || 0) - disc;
      totals[cur].paid += (pt.paid_amount || 0);
    });
    Object.entries(totals).forEach(([cur, v]) => {
      balAOA.push([
        p.id, p.full_name, cur,
        Math.round(v.due * 100) / 100, cur,
        Math.round(v.paid * 100) / 100, cur,
        Math.round((v.due - v.paid) * 100) / 100, cur,
      ]);
    });
    if (ptList.length === 0) {
      balAOA.push([p.id, p.full_name, '', 0, '', 0, '', 0, '']);
    }
  });
  addSheet(wb, t('balance_summary', lang) || 'Balance Summary', balAOA);

  await saveWorkbook(wb, `patients-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── PDF (HTML → rasterised, Unicode-safe) ───

export async function downloadPatientsPDF(data, clinic, lang = 'en') {
  const { patients, treatments, payments } = data;
  const doctorsById = indexDoctors(data.doctors);

  const txByPatient = {};
  treatments.forEach(pt => { (txByPatient[pt.patient_id] ||= []).push(pt); });
  const payByPatient = {};
  payments.forEach(p => { (payByPatient[p.patient_id] ||= []).push(p); });

  const rows = patients.map((patient, idx) => {
    const ptList = txByPatient[patient.id] || [];
    const payList = payByPatient[patient.id] || [];

    const info = [
      [t('patient_id', lang), (patient.id || '').slice(0, 16)],
      [t('phone', lang), patient.phone || '—'],
      [t('gender', lang), patient.gender || '—'],
      [t('date_of_birth', lang), fmtDate(patient.birth_date, lang)],
      [t('address', lang), patient.address || '—'],
      [t('assigned_doctor', lang), resolveAssignedDoctorName(patient, doctorsById, lang)],
      [t('registered', lang), fmtDate(patient.created_date, lang)],
    ];

    const mi = patient.medical_info || {};
    const medical = [
      [t('blood_type', lang), mi.blood_type],
      [t('allergies', lang), mi.allergies],
      [t('chronic_diseases', lang), mi.chronic_diseases],
      [t('medications', lang), mi.medications],
    ].filter(([, v]) => v);

    const treatmentRows = ptList.map(pt => {
      const disc = pt.discount_type === 'percentage' ? (pt.price * (pt.discount_value || 0) / 100)
        : (pt.discount_type === 'fixed' ? (pt.discount_value || 0) : 0);
      const final = Math.round(((pt.price || 0) - disc) * 100) / 100;
      const remaining = pt.status === 'completed' ? Math.round((final - (pt.paid_amount || 0)) * 100) / 100 : 0;
      return `<tr>
        <td>${escapeHtml(pt.treatment_name || '—')}</td>
        <td class="num">${escapeHtml(pt.price ?? 0)} ${escapeHtml(pt.currency || 'USD')}</td>
        <td class="num">${escapeHtml(pt.paid_amount ?? 0)} ${escapeHtml(pt.currency || 'USD')}</td>
        <td class="num">${escapeHtml(remaining)} ${escapeHtml(pt.currency || 'USD')}</td>
        <td>${escapeHtml(pt.status || '')}</td>
      </tr>`;
    }).join('');

    const paymentRows = payList.map(p => `<tr>
        <td class="num">${escapeHtml(fmtDate(p.payment_date, lang))}</td>
        <td class="num">${escapeHtml(p.amount ?? 0)} ${escapeHtml(p.currency || 'USD')}</td>
        <td>${escapeHtml(p.method || '')}</td>
        <td>${escapeHtml(p.doctor_name || '—')}</td>
      </tr>`).join('');

    const totals = {};
    ptList.forEach(pt => {
      if (pt.status !== 'completed') return; // Only completed treatments are payable
      const cur = pt.currency || 'USD';
      if (!totals[cur]) totals[cur] = { due: 0, paid: 0 };
      const disc = pt.discount_type === 'percentage' ? (pt.price * (pt.discount_value || 0) / 100)
        : (pt.discount_type === 'fixed' ? (pt.discount_value || 0) : 0);
      totals[cur].due += (pt.price || 0) - disc;
      totals[cur].paid += (pt.paid_amount || 0);
    });
    const balanceRows = Object.entries(totals).map(([cur, v]) => `<tr>
        <td>${escapeHtml(cur)}</td>
        <td class="num">${escapeHtml(Math.round(v.due * 100) / 100)}</td>
        <td class="num">${escapeHtml(Math.round(v.paid * 100) / 100)}</td>
        <td class="num">${escapeHtml(Math.round((v.due - v.paid) * 100) / 100)}</td>
      </tr>`).join('');

    return `
      <section class="patient">
        <h2>${escapeHtml(idx + 1)}. ${escapeHtml(patient.full_name || '—')}</h2>
        <table class="kv">
          ${info.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td class="${/^[0-9+\-() ]+$/.test(String(v)) ? 'num' : ''}">${escapeHtml(v)}</td></tr>`).join('')}
        </table>
        ${medical.length ? `<h3>${escapeHtml(t('medical_info', lang))}</h3><table class="kv">${medical.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join('')}</table>` : ''}
        ${patient.notes ? `<h3>${escapeHtml(t('notes', lang))}</h3><p>${escapeHtml(patient.notes).replace(/\n/g, '<br/>')}</p>` : ''}
        ${treatmentRows ? `<h3>${escapeHtml(t('treatments', lang))}</h3><table class="grid"><thead><tr><th>${escapeHtml(t('treatment', lang))}</th><th>${escapeHtml(t('price', lang))}</th><th>${escapeHtml(t('paid', lang))}</th><th>${escapeHtml(t('remaining', lang))}</th><th>${escapeHtml(t('status', lang))}</th></tr></thead><tbody>${treatmentRows}</tbody></table>` : ''}
        ${paymentRows ? `<h3>${escapeHtml(t('payments', lang))}</h3><table class="grid"><thead><tr><th>${escapeHtml(t('payment_date', lang))}</th><th>${escapeHtml(t('amount', lang))}</th><th>${escapeHtml(t('method', lang))}</th><th>${escapeHtml(t('doctor', lang))}</th></tr></thead><tbody>${paymentRows}</tbody></table>` : ''}
        ${balanceRows ? `<h3>${escapeHtml(t('balance_summary', lang))}</h3><table class="grid"><thead><tr><th>${escapeHtml(t('currency', lang))}</th><th>${escapeHtml(t('due', lang))}</th><th>${escapeHtml(t('paid', lang))}</th><th>${escapeHtml(t('remaining', lang))}</th></tr></thead><tbody>${balanceRows}</tbody></table>` : ''}
      </section>`;
  }).join('');

  const header = `
    <header>
      <h1>${escapeHtml(t('patient_export', lang))}</h1>
      ${clinic?.name ? `<p class="strong">${escapeHtml(clinic.name)}</p>` : ''}
      ${clinic?.address ? `<p>${escapeHtml(clinic.address)}</p>` : ''}
      ${clinic?.phone ? `<p class="num">Tel: ${escapeHtml(clinic.phone)}</p>` : ''}
      ${clinic?.email ? `<p>${escapeHtml(clinic.email)}</p>` : ''}
      <p class="num">${escapeHtml(t('export_date', lang))}: ${escapeHtml(fmtDateTime(new Date(), lang))}</p>
      <p class="num">${escapeHtml(t('total_patients', lang))}: ${escapeHtml(patients.length)}</p>
      ${clinic?.currency ? `<p>${escapeHtml(t('clinic_currency', lang))}: ${escapeHtml(clinic.currency)}</p>` : ''}
    </header>`;

  const styles = `
    <style>
      h1 { font-size:20px; margin:0 0 4px; }
      h2 { font-size:15px; margin:0 0 8px; padding:6px 8px; background:#ebf1fc; border-radius:6px; }
      h3 { font-size:12px; margin:12px 0 4px; color:#475569; text-transform:uppercase; letter-spacing:.04em; }
      header { border-bottom:1px solid #cbd5e1; padding-bottom:10px; margin-bottom:16px; }
      header p { margin:1px 0; font-size:11px; color:#64748b; }
      header p.strong { font-size:13px; color:#0f172a; font-weight:600; }
      section.patient { padding-bottom:14px; margin-bottom:14px; border-bottom:1px dashed #e2e8f0; page-break-inside:avoid; }
      table { width:100%; border-collapse:collapse; font-size:11px; }
      table.kv th { text-align:start; width:34%; color:#64748b; font-weight:500; padding:2px 6px 2px 0; vertical-align:top; }
      table.kv td { padding:2px 0; }
      table.grid th { background:#f1f5f9; text-align:start; padding:5px 6px; border-bottom:1px solid #cbd5e1; }
      table.grid td { padding:5px 6px; border-bottom:1px solid #eef2f7; }
      .num { unicode-bidi:plaintext; }
    </style>`;

  await downloadHtmlPdf({
    html: styles + header + rows,
    filename: `patients-export-${new Date().toISOString().slice(0, 10)}.pdf`,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
  });
}