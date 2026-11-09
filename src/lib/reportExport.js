/**
 * Report export helpers: PDF (real text, printed by the browser), Excel (real
 * .xlsx), and Print.
 * All three include the COMPLETE report — every section and every currency.
 * Every monetary amount is explicitly labeled with its currency code.
 */
import { createWorkbook, addSheet as addWorksheet, saveWorkbook } from '@/lib/excelWorkbook';
import { formatCurrencyTotalsPlain, currencyTotalsToArray, getCurrencySymbol, formatMoney } from '@/lib/currencyUtils';
import { t } from '@/lib/i18n';
import { downloadHtmlPdf, escapeHtml } from '@/lib/pdfHtml';

// ─── PDF (Unicode-safe, printed by the browser — see lib/pdfHtml.js) ───
// The report is laid out as HTML and printed by the browser, which shapes
// Arabic (joined, right-to-left) and renders Turkish and every other Unicode
// character from the real font, keeping the text selectable and searchable.

/** A cell may hold a per-currency totals object — expand it one currency per line. */
function pdfCell(cell) {
  if (cell !== null && typeof cell === 'object') return totalsLines(cell).map(escapeHtml).join('<br/>');
  return escapeHtml(cell);
}

function pdfTable(headers, rows) {
  return `<table><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>`
    + rows.map(cells => `<tr>${cells.map(c => `<td>${pdfCell(c)}</td>`).join('')}</tr>`).join('')
    + '</tbody></table>';
}

/** Financial summary row: label on the left, every currency on its own line. */
function pdfFinancialRow(label, totals) {
  return `<tr><td>${escapeHtml(label)}</td><td class="num">${totalsLines(totals).map(escapeHtml).join('<br/>')}</td></tr>`;
}

/**
 * Convert a per-currency totals object to an array of formatted strings,
 * one per currency. Each string always includes symbol + code: "$5,000 USD".
 */
function totalsLines(totals) {
  const arr = currencyTotalsToArray(totals);
  if (arr.length === 0) return ['0'];
  return arr.map(({ amount, currency }) => `${formatMoney(amount, currency)} ${currency}`);
}

// Compact single-line format for Excel/Print (includes currency codes)
const fmt = (totals) => formatCurrencyTotalsPlain(totals) || '0';

export async function downloadReportPDF(data, clinicName, clinicInfo, lang = 'en') {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  let html = '';

  // Header
  html += `<h1>${escapeHtml(t('clinic_report', lang))}</h1>`;
  if (clinicName) html += `<p><strong>${escapeHtml(clinicName)}</strong></p>`;
  if (clinicInfo?.address) html += `<p>${escapeHtml(clinicInfo.address)}</p>`;
  if (clinicInfo?.phone) html += `<p class="num">Tel: ${escapeHtml(clinicInfo.phone)}</p>`;
  if (clinicInfo?.email) html += `<p>${escapeHtml(clinicInfo.email)}</p>`;
  if (clinicInfo?.logo_url) html += `<p><img src="${escapeHtml(clinicInfo.logo_url)}" alt="logo" style="max-height:70px" /></p>`;
  html += `<p><strong>${escapeHtml(t('period_label', lang))}: ${escapeHtml(data.dateFrom)} ${escapeHtml(t('to', lang))} ${escapeHtml(data.dateTo)}</strong></p>`;

  // Financial summary
  if (data.canViewFinancials) {
    html += `<h2>${escapeHtml(t('financial_summary', lang))}</h2><table><tbody>`;
    html += pdfFinancialRow(t('revenue', lang), data.totals.revenue);
    html += pdfFinancialRow(t('expenses', lang), data.totals.expenses);
    html += pdfFinancialRow(t('purchases', lang), data.totals.purchases);
    html += pdfFinancialRow(t('laboratory_costs', lang), data.totals.labCosts);
    html += pdfFinancialRow(t('doctor_commissions_label', lang), data.totals.commissions);
    html += pdfFinancialRow(t('doctor_payouts', lang), data.totals.payouts);
    html += pdfFinancialRow(t('outstanding_balances', lang), data.totals.outstanding);
    html += pdfFinancialRow(t('net_profit', lang), data.totals.netProfit);
    html += '</tbody></table>';
  }

  // Doctor performance
  html += `<h2>${escapeHtml(t('doctor_performance', lang))}</h2>` + pdfTable(
    [t('doctor', lang), t('appointments', lang), t('treatments', lang), t('commission', lang), t('paid_out', lang)],
    (data.doctorPerformance || []).map(d => [d.name, d.appointments, d.treatments, d.commission, d.paid_out]),
  );

  // Treatment statistics
  html += `<h2>${escapeHtml(t('treatment_stats', lang))}</h2>` + pdfTable(
    [t('treatment', lang), t('count', lang)],
    (data.treatmentStats || []).map(tr => [tr.name, tr.count]),
  );

  // Appointment status
  html += `<h2>${escapeHtml(t('appointment_status', lang))}</h2>` + pdfTable(
    [t('status', lang), t('count', lang)],
    (data.appointmentStats || []).map(a => [a.name, a.value]),
  );

  // Outstanding balances
  if (data.canViewFinancials && data.outstandingBalances?.length) {
    html += `<h2>${escapeHtml(t('outstanding_balances', lang))}</h2>` + pdfTable(
      [t('patient', lang), t('amount_owed', lang)],
      data.outstandingBalances.map(o => [o.patient_name, o.totals]),
    );
  }

  // Expenses by category
  if (data.canViewFinancials && data.expenseByCategory) {
    html += `<h2>${escapeHtml(t('expenses_by_category', lang))}</h2>` + pdfTable(
      [t('category', lang), t('amount', lang)],
      Object.entries(data.expenseByCategory).map(([cat, totals]) => [cat, totals]),
    );
  }

  // Purchases by category
  if (data.canViewFinancials && data.purchaseByCategory) {
    html += `<h2>${escapeHtml(t('purchases_by_category', lang))}</h2>` + pdfTable(
      [t('category', lang), t('amount', lang)],
      Object.entries(data.purchaseByCategory).map(([cat, totals]) => [cat, totals]),
    );
  }

  // Patient growth
  html += `<h2>${escapeHtml(t('patient_growth', lang))}</h2>` + pdfTable(
    [t('month', lang), t('new_col', lang), t('total', lang)],
    (data.patientGrowth || []).map(p => [p.month, p.new, p.total]),
  );

  // Payment methods
  if (data.canViewFinancials && data.paymentMethodStats) {
    html += `<h2>${escapeHtml(t('payment_methods', lang))}</h2>` + pdfTable(
      [t('method', lang), t('count', lang)],
      data.paymentMethodStats.map(p => [p.name, p.value]),
    );
  }

  // Patient source analytics
  if (data.patientSourceStats) {
    html += `<h2>${escapeHtml(t('patient_source_analytics', lang))}</h2>` + pdfTable(
      [t('source', lang), t('count', lang)],
      data.patientSourceStats.map(p => [p.name, p.value]),
    );
  }

  await downloadHtmlPdf({
    html,
    filename: `clinic-report-${data.dateFrom}-to-${data.dateTo}.pdf`,
    dir,
  });
}

// ─── Excel / Print helpers ───

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildExcelHTML(data, clinicName, clinicInfo, lang = 'en') {
  const rows = (arr, headers, fields) => {
    if (!arr || arr.length === 0) return '<tr><td colspan="' + headers.length + '">No records</td></tr>';
    return arr.map(r => '<tr>' + fields.map(f => `<td>${esc(typeof f === 'function' ? f(r) : r[f])}</td>`).join('') + '</tr>').join('');
  };
  const th = headers => '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';

  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>';
  html += `<h2>${esc(t('clinic_report', lang))} — ${esc(clinicName)}</h2>`;
  if (clinicInfo) {
    html += '<p style="color:#64748b;font-size:12px;">';
    if (clinicInfo.address) html += `${esc(clinicInfo.address)}<br/>`;
    if (clinicInfo.phone) html += `Tel: ${esc(clinicInfo.phone)}<br/>`;
    if (clinicInfo.email) html += `Email: ${esc(clinicInfo.email)}<br/>`;
    html += '</p>';
  }
  html += `<p>${esc(t('period_label', lang))}: ${esc(data.dateFrom)} ${esc(t('to', lang))} ${esc(data.dateTo)}</p>`;

  if (data.canViewFinancials) {
    html += `<h3>${esc(t('financial_summary', lang))}</h3><table border="1"><tr><th>${esc(t('metric', lang))}</th><th>${esc(t('amount', lang))}</th></tr>`;
    const tt = data.totals;
    html += `<tr><td>${esc(t('revenue', lang))}</td><td>${esc(fmt(tt.revenue))}</td></tr>`;
    html += `<tr><td>${esc(t('expenses', lang))}</td><td>${esc(fmt(tt.expenses))}</td></tr>`;
    html += `<tr><td>${esc(t('purchases', lang))}</td><td>${esc(fmt(tt.purchases))}</td></tr>`;
    html += `<tr><td>${esc(t('laboratory_costs', lang))}</td><td>${esc(fmt(tt.labCosts))}</td></tr>`;
    html += `<tr><td>${esc(t('doctor_commissions_label', lang))}</td><td>${esc(fmt(tt.commissions))}</td></tr>`;
    html += `<tr><td>${esc(t('doctor_payouts', lang))}</td><td>${esc(fmt(tt.payouts))}</td></tr>`;
    html += `<tr><td>${esc(t('outstanding_balances', lang))}</td><td>${esc(fmt(tt.outstanding))}</td></tr>`;
    html += `<tr><td>${esc(t('net_profit', lang))}</td><td>${esc(fmt(tt.netProfit))}</td></tr>`;
    html += '</table>';

    html += '<h3>Payments</h3><table border="1">' + th(['Date', 'Patient', 'Doctor', 'Amount', 'Currency', 'Method', 'Commission']);
    html += rows(data.payments, [], [p => p.payment_date, p => p.patient_id, p => p.doctor_name, p => p.amount, p => p.currency, p => p.method, p => p.doctor_commission_amount]) + '</table>';

    html += '<h3>Expenses</h3><table border="1">' + th(['Date', 'Name', 'Category', 'Amount', 'Currency']);
    html += rows(data.expenses, [], ['expense_date', 'name', 'category', 'amount', 'currency']) + '</table>';

    html += '<h3>Purchases</h3><table border="1">' + th(['Date', 'Name', 'Category', 'Supplier', 'Amount', 'Currency']);
    html += rows(data.purchases, [], ['purchase_date', 'name', 'category', 'supplier', 'amount', 'currency']) + '</table>';

    html += '<h3>Laboratory Cases</h3><table border="1">' + th(['Sent Date', 'Patient', 'Lab', 'Type', 'Cost', 'Currency', 'Status']);
    html += rows(data.labCases, [], ['sent_date', 'patient_name', 'lab_name', 'case_type', 'cost', 'currency', 'status']) + '</table>';

    html += '<h3>Doctor Payouts</h3><table border="1">' + th(['Date', 'Doctor', 'Amount', 'Currency']);
    html += rows(data.doctorPayouts, [], ['payment_date', 'doctor_name', 'amount', 'currency']) + '</table>';

    html += '<h3>Outstanding Balances</h3><table border="1">' + th(['Patient', 'Amount Owed']);
    html += rows(data.outstandingBalances, [], [o => o.patient_name, o => fmt(o.totals)]) + '</table>';

    if (data.expenseByCategory) {
      html += '<h3>Expenses by Category</h3><table border="1">' + th(['Category', 'Amount']);
      html += Object.entries(data.expenseByCategory).map(([cat, totals]) => `<tr><td>${esc(cat)}</td><td>${esc(fmt(totals))}</td></tr>`).join('') + '</table>';
    }
    if (data.purchaseByCategory) {
      html += '<h3>Purchases by Category</h3><table border="1">' + th(['Category', 'Amount']);
      html += Object.entries(data.purchaseByCategory).map(([cat, totals]) => `<tr><td>${esc(cat)}</td><td>${esc(fmt(totals))}</td></tr>`).join('') + '</table>';
    }
  }

  html += '<h3>Doctor Performance</h3><table border="1">' + th(['Doctor', 'Appointments', 'Treatments', 'Commission', 'Paid Out']);
  html += rows(data.doctorPerformance, [], [d => d.name, d => d.appointments, d => d.treatments, d => fmt(d.commission), d => fmt(d.paid_out)]) + '</table>';

  html += '<h3>Treatment Statistics</h3><table border="1">' + th(['Treatment', 'Count']);
  html += rows(data.treatmentStats, [], ['name', 'count']) + '</table>';

  html += '<h3>Appointment Status</h3><table border="1">' + th(['Status', 'Count']);
  html += rows(data.appointmentStats, [], ['name', 'value']) + '</table>';

  html += '<h3>Patient Growth</h3><table border="1">' + th(['Month', 'New', 'Total']);
  html += rows(data.patientGrowth, [], ['month', 'new', 'total']) + '</table>';

  html += '</body></html>';
  return html;
}

export async function exportReportExcel(data, clinicName, clinicInfo, lang = 'en') {
  const wb = createWorkbook();

  // Financial Summary sheet
  if (data.canViewFinancials) {
    const tt = data.totals;
    const summaryAOA = [
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
    addWorksheet(wb, 'Financial Summary', summaryAOA);
  }

  // Helper to add a sheet from records
  const addSheet = (name, headers, records, fields) => {
    if (!records || records.length === 0) return;
    const aoa = [headers, ...records.map(r => fields.map(f => typeof f === 'function' ? f(r) : r[f]))];
    addWorksheet(wb, name, aoa);
  };

  if (data.canViewFinancials) {
    addSheet('Payments', ['Date', 'Patient ID', 'Doctor', 'Amount', 'Currency', 'Method', 'Commission'], data.payments, [p => p.payment_date, p => p.patient_id, p => p.doctor_name, p => p.amount, p => p.currency, p => p.method, p => p.doctor_commission_amount]);
    addSheet('Expenses', ['Date', 'Name', 'Category', 'Amount', 'Currency'], data.expenses, ['expense_date', 'name', 'category', 'amount', 'currency']);
    addSheet('Purchases', ['Date', 'Name', 'Category', 'Supplier', 'Amount', 'Currency'], data.purchases, ['purchase_date', 'name', 'category', 'supplier', 'amount', 'currency']);
    addSheet('Lab Cases', ['Sent Date', 'Patient', 'Lab', 'Type', 'Cost', 'Currency', 'Status'], data.labCases, ['sent_date', 'patient_name', 'lab_name', 'case_type', 'cost', 'currency', 'status']);
    addSheet('Doctor Payouts', ['Date', 'Doctor', 'Amount', 'Currency'], data.doctorPayouts, ['payment_date', 'doctor_name', 'amount', 'currency']);
    addSheet('Outstanding Balances', ['Patient', 'Amount Owed'], data.outstandingBalances, [o => o.patient_name, o => fmt(o.totals)]);
    if (data.expenseByCategory) {
      addSheet('Expenses by Category', ['Category', 'Amount'], Object.entries(data.expenseByCategory).map(([cat, totals]) => ({ cat, totals })), [r => r.cat, r => fmt(r.totals)]);
    }
    if (data.purchaseByCategory) {
      addSheet('Purchases by Category', ['Category', 'Amount'], Object.entries(data.purchaseByCategory).map(([cat, totals]) => ({ cat, totals })), [r => r.cat, r => fmt(r.totals)]);
    }
  }

  addSheet('Doctor Performance', ['Doctor', 'Appointments', 'Treatments', 'Commission', 'Paid Out'], data.doctorPerformance, [d => d.name, d => d.appointments, d => d.treatments, d => fmt(d.commission), d => fmt(d.paid_out)]);
  addSheet('Treatment Statistics', ['Treatment', 'Count'], data.treatmentStats, ['name', 'count']);
  addSheet('Appointment Status', ['Status', 'Count'], data.appointmentStats, ['name', 'value']);
  addSheet('Patient Growth', ['Month', 'New', 'Total'], data.patientGrowth, ['month', 'new', 'total']);

  await saveWorkbook(wb, `clinic-report-${data.dateFrom}-to-${data.dateTo}.xlsx`);
}

export function printReport(data, clinicName, clinicInfo, lang = 'en') {
  const html = buildExcelHTML(data, clinicName, clinicInfo, lang);
  const w = window.open('', '_blank');
  if (!w) { return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 300);
}