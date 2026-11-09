/**
 * Invoice / Receipt PDF export and print helpers.
 *
 * Both the printed copy and the downloaded PDF are built from ONE HTML
 * document. The PDF is printed from that HTML by the browser, which shapes
 * Arabic, lays it out right-to-left and renders Turkish characters correctly —
 * see lib/pdfHtml.js.
 *
 * Currencies are never mixed — each currency's totals are shown separately.
 */
import { getCurrencySymbol, formatMoney } from '@/lib/currencyUtils';
import { t } from '@/lib/i18n';
import { downloadHtmlPdf, escapeHtml, PDF_FONT_STACK } from '@/lib/pdfHtml';

// Locale-aware grouping/separators, matching the amounts shown on screen.
function fmtMoney(amount, currency) {
  return formatMoney(amount, currency);
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Build the invoice/receipt document body (HTML). Shared by print and PDF so
 * the two can never drift apart.
 */
function buildInvoiceHtml(invoice, clinic, lang = 'en') {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const titleText = invoice.type === 'receipt' ? t('receipt', lang) : t('invoice', lang);

  let body = '<div class="doc">';

  // Header — clinic info + document title
  body += '<div class="header">';
  body += '<div class="clinic-info">';
  body += `<h1>${escapeHtml(clinic?.name || '')}</h1>`;
  if (clinic?.address) body += `<p>${escapeHtml(clinic.address)}</p>`;
  if (clinic?.phone) body += `<p class="num">Tel: ${escapeHtml(clinic.phone)}</p>`;
  if (clinic?.email) body += `<p>${escapeHtml(clinic.email)}</p>`;
  body += '</div>';
  body += '<div class="doc-title">';
  body += `<h2>${escapeHtml(titleText)}</h2>`;
  body += `<p>${escapeHtml(t('invoice_number', lang))}: <span class="num">${escapeHtml(invoice.invoice_number)}</span></p>`;
  body += `<p>${escapeHtml(t('date', lang))}: <span class="num">${escapeHtml(invoice.invoice_date)}</span></p>`;
  body += '</div>';
  body += '</div>';

  // Meta
  body += '<div class="meta">';
  body += `<div><strong>${escapeHtml(t('patient', lang))}:</strong> ${escapeHtml(invoice.patient_name || '—')}</div>`;
  if (invoice.doctor_name) body += `<div><strong>${escapeHtml(t('doctor', lang))}:</strong> Dr. ${escapeHtml(invoice.doctor_name)}</div>`;
  body += '</div>';

  if (invoice.type === 'receipt' && invoice.payments_snapshot?.length > 0) {
    const byCurrency = {};
    invoice.payments_snapshot.forEach(p => {
      const cur = p.currency || 'USD';
      if (!byCurrency[cur]) byCurrency[cur] = [];
      byCurrency[cur].push(p);
    });
    Object.entries(byCurrency).forEach(([cur, payments]) => {
      body += `<table><thead><tr><th>${escapeHtml(t('date', lang))}</th><th>${escapeHtml(t('treatment', lang))}</th><th>${escapeHtml(t('tooth_label', lang))}</th><th>${escapeHtml(t('amount', lang))}</th><th>${escapeHtml(t('method', lang))}</th><th>${escapeHtml(t('currency', lang))}</th></tr></thead><tbody>`;
      payments.forEach(p => {
        body += `<tr><td class="num">${escapeHtml(p.payment_date || '—')}</td><td>${escapeHtml(p.treatment_name || '—')}</td><td class="num">${p.tooth_number ? '#' + escapeHtml(p.tooth_number) : '—'}</td><td class="num">${escapeHtml(fmtMoney(p.amount, cur))}</td><td>${escapeHtml(t(p.method, lang) || p.method || '—')}</td><td>${escapeHtml(cur)}</td></tr>`;
      });
      const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      body += `<tr class="totals-row"><td>${escapeHtml(t('total', lang))}</td><td class="num">${escapeHtml(fmtMoney(total, cur))}</td><td></td><td>${escapeHtml(cur)}</td></tr>`;
      body += '</tbody></table>';
    });
  } else if (invoice.items?.length > 0) {
    const byCurrency = {};
    invoice.items.forEach(item => {
      const cur = item.currency || 'USD';
      if (!byCurrency[cur]) byCurrency[cur] = [];
      byCurrency[cur].push(item);
    });
    Object.entries(byCurrency).forEach(([cur, items]) => {
      body += `<table><thead><tr><th>${escapeHtml(t('tooth_label', lang))}</th><th>${escapeHtml(t('treatment', lang))}</th><th>${escapeHtml(t('qty', lang))}</th><th>${escapeHtml(t('unit_price', lang))}</th><th>${escapeHtml(t('total', lang))}</th><th>${escapeHtml(t('paid_amount', lang))}</th><th>${escapeHtml(t('remaining', lang))}</th></tr></thead><tbody>`;
      items.forEach(item => {
        const total = item.total_price || round2((item.unit_price || 0) * (item.quantity || 1));
        const remaining = Math.round((total - (item.paid_amount || 0)) * 100) / 100;
        const tooth = item.tooth_numbers?.[0];
        body += `<tr><td class="num">${tooth ? '#' + escapeHtml(tooth) : '—'}</td><td>${escapeHtml(item.treatment_name || '—')}</td><td class="num">${escapeHtml(item.quantity || 1)}</td><td class="num">${escapeHtml(fmtMoney(item.unit_price, cur))}</td><td class="num">${escapeHtml(fmtMoney(total, cur))}</td><td class="num">${escapeHtml(fmtMoney(item.paid_amount, cur))}</td><td class="num">${escapeHtml(fmtMoney(remaining, cur))}</td></tr>`;
      });
      const totals = (invoice.totals && invoice.totals[cur]) || {};
      body += `<tr class="totals-row"><td colspan="2">${escapeHtml(t('total_due', lang))}</td><td class="num">${escapeHtml(fmtMoney(totals.due, cur))}</td><td class="num">${escapeHtml(fmtMoney(totals.paid, cur))}</td><td class="num">${escapeHtml(fmtMoney(totals.remaining, cur))}</td></tr>`;
      body += '</tbody></table>';
    });
  }

  if (invoice.notes) {
    body += `<div class="notes"><strong>${escapeHtml(t('notes', lang))}:</strong><br/>${escapeHtml(invoice.notes).replace(/\n/g, '<br/>')}</div>`;
  }

  body += `<div class="footer">${escapeHtml(clinic?.name || '')}</div>`;
  body += '</div>';
  return { body, dir };
}

function invoiceStyles() {
  return `
  <style>
    .doc { font-family:${PDF_FONT_STACK}; color:#1e293b; }
    .header { display:flex; justify-content:space-between; gap:16px; margin-bottom:18px; }
    .clinic-info h1 { font-size:19px; margin:0; }
    .clinic-info p { font-size:11px; color:#64748b; margin:2px 0; }
    .doc-title { text-align:end; }
    .doc-title h2 { font-size:17px; margin:0; text-transform:uppercase; }
    .doc-title p { font-size:11px; margin:2px 0; }
    .meta { margin:12px 0; font-size:12px; }
    .meta div { margin:3px 0; }
    table { width:100%; border-collapse:collapse; margin:12px 0; font-size:11px; }
    th { background:#f1f5f9; padding:7px; text-align:start; border-bottom:2px solid #cbd5e1; }
    td { padding:7px; border-bottom:1px solid #e2e8f0; }
    .totals-row { font-weight:700; background:#f8fafc; }
    .notes { margin-top:16px; font-size:11px; }
    .footer { margin-top:30px; border-top:1px solid #cbd5e1; padding-top:8px; font-size:10px; color:#94a3b8; text-align:center; }
    .num { unicode-bidi:plaintext; }
  </style>`;
}

/**
 * Generate and download a PDF for an invoice or receipt.
 * @param {object} invoice - The Invoice record
 * @param {object} clinic - Clinic record (name, address, phone, email)
 * @param {string} lang - 'en' | 'ar' | 'tr'
 */
export async function downloadInvoicePDF(invoice, clinic, lang = 'en') {
  const { body, dir } = buildInvoiceHtml(invoice, clinic, lang);
  await downloadHtmlPdf({
    html: invoiceStyles() + body,
    filename: `${invoice.invoice_number}.pdf`,
    dir,
  });
}

/**
 * Print an invoice/receipt by opening a new window with the same HTML.
 */
export function printInvoice(invoice, clinic, lang = 'en') {
  const { body, dir } = buildInvoiceHtml(invoice, clinic, lang);

  const html = `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoice_number)}</title>`
    + invoiceStyles().replace('<style>', '<style>body{margin:24px;} @media print { body { margin: 12px; } }')
    + `</head><body>${body}</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 300);
}