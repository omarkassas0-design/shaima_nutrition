/**
 * Financial-only export helpers: Excel (real .xlsx) and PDF (real text,
 * printed by the browser — see lib/pdfHtml.js).
 * Includes ONLY financial records: payments, expenses, purchases, lab costs,
 * doctor commissions/payouts, outstanding balances, and financial summaries.
 * Currencies are NEVER mixed — each amount keeps its currency column.
 *
 * Data source: getReportsStats backend function response (already date-filtered,
 * permission-checked, and currency-separated server-side).
 */
import { createWorkbook, addSheet, saveWorkbook } from '@/lib/excelWorkbook';
import { t } from '@/lib/i18n';
import { formatCurrencyTotalsPlain, currencyTotalsToArray, getCurrencySymbol } from '@/lib/currencyUtils';
import { formatDisplayDate } from '@/lib/dateFormat';
import { downloadHtmlPdf, escapeHtml } from '@/lib/pdfHtml';

// Plain text (no bidi control characters) so exported cells stay clean data.
const fmt = (totals) => formatCurrencyTotalsPlain(totals) || '0';

// Locale-aware month names for the selected language.
const fmtDate = (d) => formatDisplayDate(d);

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Excel (real .xlsx via SheetJS) ───

function buildSummaryAOA(data, lang) {
  const tt = data.totals || {};
  return [
    [t('metric', lang), t('amount', lang)],
    [t('revenue', lang), fmt(tt.revenue)],
    [t('expenses', lang), fmt(tt.expenses)],
    [t('purchases', lang), fmt(tt.purchases)],
    [t('laboratory_costs', lang), fmt(tt.labCosts)],
    [t('doctor_commissions_label', lang), fmt(tt.commissions)],
    [t('doctor_payouts', lang), fmt(tt.payouts)],
    [t('outstanding_balances', lang), fmt(tt.outstanding)],
    [t('net_profit', lang), fmt(tt.netProfit)],
  ];
}

const FINANCIAL_SHEETS = [
  {
    key: 'payments',
    name: 'Payments',
    headers: ['Date', 'Patient ID', 'Doctor', 'Amount', 'Currency', 'Method', 'Commission', 'Notes'],
    row: (p) => [p.payment_date, p.patient_id, p.doctor_name, p.amount, p.currency, p.method, p.doctor_commission_amount, p.notes],
  },
  {
    key: 'expenses',
    name: 'Expenses',
    headers: ['Date', 'Name', 'Category', 'Amount', 'Currency', 'Notes'],
    row: (e) => [e.expense_date, e.name, e.category, e.amount, e.currency, e.notes],
  },
  {
    key: 'purchases',
    name: 'Purchases',
    headers: ['Date', 'Name', 'Category', 'Supplier', 'Amount', 'Currency'],
    row: (p) => [p.purchase_date, p.name, p.category, p.supplier, p.amount, p.currency],
  },
  {
    key: 'labCases',
    name: 'Lab Cases',
    headers: ['Sent Date', 'Patient', 'Lab', 'Type', 'Cost', 'Currency', 'Status'],
    row: (lc) => [lc.sent_date, lc.patient_name, lc.lab_name, lc.case_type, lc.cost, lc.currency, lc.status],
  },
  {
    key: 'doctorPayouts',
    name: 'Doctor Payouts',
    headers: ['Date', 'Doctor', 'Amount', 'Currency', 'Period Start', 'Period End', 'Notes'],
    row: (p) => [p.payment_date, p.doctor_name, p.amount, p.currency, p.period_start, p.period_end, p.notes],
  },
];

export async function exportFinancialExcel(data, clinic, dateFrom, dateTo, lang = 'en') {
  const wb = createWorkbook();

  // Summary sheet
  addSheet(wb, 'Financial Summary', buildSummaryAOA(data, lang));

  // Doctor commissions sheet (from doctorPerformance)
  const dp = data.doctorPerformance || [];
  const commAOA = [
    ['Doctor', 'Appointments', 'Treatments', 'Commission', 'Paid Out'],
    ...dp.map(d => [d.name, d.appointments, d.treatments, fmt(d.commission), fmt(d.paid_out)]),
  ];
  addSheet(wb, 'Doctor Commissions', commAOA);

  // Outstanding balances sheet
  const ob = data.outstandingBalances || [];
  const obAOA = [
    ['Patient', 'Amount Owed'],
    ...ob.map(o => [o.patient_name, fmt(o.totals)]),
  ];
  addSheet(wb, 'Outstanding Balances', obAOA);

  // Expense by category
  const ebc = data.expenseByCategory || {};
  const ebcAOA = [
    ['Category', 'Amount'],
    ...Object.entries(ebc).map(([cat, totals]) => [cat, fmt(totals)]),
  ];
  addSheet(wb, 'Expenses by Category', ebcAOA);

  // Purchase by category
  const pbc = data.purchaseByCategory || {};
  const pbcAOA = [
    ['Category', 'Amount'],
    ...Object.entries(pbc).map(([cat, totals]) => [cat, fmt(totals)]),
  ];
  addSheet(wb, 'Purchases by Category', pbcAOA);

  // Raw record sheets
  for (const { key, name, headers, row: rowFn } of FINANCIAL_SHEETS) {
    const records = data[key] || [];
    addSheet(wb, name, [headers, ...records.map(rowFn)]);
  }

  await saveWorkbook(wb, `financial-export-${dateFrom}-to-${dateTo}.xlsx`);
}

// ─── PDF (Unicode-safe, printed by the browser — see lib/pdfHtml.js) ───

export async function exportFinancialPDF(data, clinic, dateFrom, dateTo, lang = 'en') {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const grid = (headers, rows) => `<table><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>`
    + rows.map(cells => `<tr>${cells.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')
    + '</tbody></table>';
  const keyValues = (rows) => `<table><tbody>${rows.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td class="num">${escapeHtml(v)}</td></tr>`).join('')}</tbody></table>`;
  const section = (title, body) => `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;

  let html = `<h1>${escapeHtml(t('financial_export_title', lang))}</h1>`;
  if (clinic?.name) html += `<p><strong>${escapeHtml(clinic.name)}</strong></p>`;
  if (clinic?.address) html += `<p>${escapeHtml(clinic.address)}</p>`;
  if (clinic?.phone) html += `<p class="num">Tel: ${escapeHtml(clinic.phone)}</p>`;
  if (clinic?.email) html += `<p>${escapeHtml(clinic.email)}</p>`;
  html += `<p><strong>${escapeHtml(t('period_label', lang))}: ${escapeHtml(dateFrom)} ${escapeHtml(t('to', lang))} ${escapeHtml(dateTo)}</strong></p>`;
  html += `<p class="num">${escapeHtml(t('export_date', lang))}: ${escapeHtml(formatDisplayDate(new Date(), lang, { time: true }))}</p>`;

  // Financial summary — every currency stays on its own line
  const tt = data.totals || {};
  html += section(t('financial_summary', lang), keyValues([
    [t('revenue', lang), fmt(tt.revenue)],
    [t('expenses', lang), fmt(tt.expenses)],
    [t('purchases', lang), fmt(tt.purchases)],
    [t('laboratory_costs', lang), fmt(tt.labCosts)],
    [t('doctor_commissions_label', lang), fmt(tt.commissions)],
    [t('doctor_payouts', lang), fmt(tt.payouts)],
    [t('outstanding_balances', lang), fmt(tt.outstanding)],
    [t('net_profit', lang), fmt(tt.netProfit)],
  ]));

  const payments = data.payments || [];
  if (payments.length) {
    html += section(`${t('payments', lang)} (${payments.length})`, grid(
      ['Date', 'Doctor', 'Amount', 'Cur', 'Method', 'Commission'],
      payments.map(p => [fmtDate(p.payment_date), p.doctor_name, p.amount, p.currency, p.method, p.doctor_commission_amount]),
    ));
  }

  const expenses = data.expenses || [];
  if (expenses.length) {
    html += section(`${t('expenses', lang)} (${expenses.length})`, grid(
      ['Date', 'Name', 'Category', 'Amount', 'Cur'],
      expenses.map(e => [fmtDate(e.expense_date), e.name, e.category, e.amount, e.currency]),
    ));
  }

  const purchases = data.purchases || [];
  if (purchases.length) {
    html += section(`${t('purchases', lang)} (${purchases.length})`, grid(
      ['Date', 'Name', 'Category', 'Supplier', 'Amount', 'Cur'],
      purchases.map(p => [fmtDate(p.purchase_date), p.name, p.category, p.supplier, p.amount, p.currency]),
    ));
  }

  const labCases = data.labCases || [];
  if (labCases.length) {
    html += section(`${t('lab_cases', lang)} (${labCases.length})`, grid(
      ['Sent Date', 'Patient', 'Lab', 'Type', 'Cost', 'Cur'],
      labCases.map(lc => [fmtDate(lc.sent_date), lc.patient_name, lc.lab_name, lc.case_type, lc.cost, lc.currency]),
    ));
  }

  const payouts = data.doctorPayouts || [];
  if (payouts.length) {
    html += section(`${t('doctor_payouts', lang)} (${payouts.length})`, grid(
      ['Date', 'Doctor', 'Amount', 'Cur'],
      payouts.map(p => [fmtDate(p.payment_date), p.doctor_name, p.amount, p.currency]),
    ));
  }

  const dp = data.doctorPerformance || [];
  if (dp.length) {
    html += section(t('doctor_commissions_label', lang), grid(
      ['Doctor', 'Appts', 'Treatments', 'Commission', 'Paid Out'],
      dp.map(d => [d.name, d.appointments, d.treatments, fmt(d.commission), fmt(d.paid_out)]),
    ));
  }

  const ob = data.outstandingBalances || [];
  if (ob.length) {
    html += section(`${t('outstanding_balances', lang)} (${ob.length})`, grid(
      ['Patient', 'Amount Owed'],
      ob.map(o => [o.patient_name, fmt(o.totals)]),
    ));
  }

  const ebc = data.expenseByCategory || {};
  if (Object.keys(ebc).length) {
    html += section(t('expenses_by_category', lang), grid(
      ['Category', 'Amount'],
      Object.entries(ebc).map(([cat, totals]) => [cat, fmt(totals)]),
    ));
  }

  const pbc = data.purchaseByCategory || {};
  if (Object.keys(pbc).length) {
    html += section(t('purchases_by_category', lang), grid(
      ['Category', 'Amount'],
      Object.entries(pbc).map(([cat, totals]) => [cat, fmt(totals)]),
    ));
  }

  await downloadHtmlPdf({
    html,
    filename: `financial-export-${dateFrom}-to-${dateTo}.pdf`,
    dir,
  });
}