/**
 * Treatment Plan print helper.
 *
 * ROOT CAUSE OF THE BLANK ANDROID PRINT PREVIEW
 * ---------------------------------------------
 * The plan used to be printed with `window.print()` on the live app document,
 * combined with `@media print { body * { visibility: hidden } }`. That prints the
 * React application itself: the printable block stays nested inside the app shell
 * (fixed sidebar + a scroll container with overflow), and `visibility:hidden`
 * keeps the layout space of every hidden element, so the Android print service
 * received pages of empty area with the content pushed far down the flow. Chrome
 * on Android hands that empty document to the print spooler, which is what shows
 * "This printer isn't available right now" against an otherwise valid PDF writer.
 *
 * The fix prints a SELF-CONTAINED A4 document written into its own window (or a
 * hidden iframe when the popup is blocked), so the print service always gets a
 * complete, laid-out page: no app shell, no clipped scroll container, no
 * visibility tricks, no external resources that can delay or blank the render.
 */
import { t } from '@/lib/i18n';
import { formatDisplayDate } from '@/lib/dateFormat';
import { formatNumber, formatPercent } from '@/lib/currencyUtils';
import { escapeHtml as esc } from '@/lib/pdfHtml';

const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Per-line discount amount — identical maths to the treatment plan table. */
const discountOf = (pt) => {
  const price = Number(pt.price) || 0;
  if (pt.discount_type === 'percentage') return round2((price * (Number(pt.discount_value) || 0)) / 100);
  if (pt.discount_type === 'fixed') return round2(Number(pt.discount_value) || 0);
  return 0;
};

const lineTotalOf = (pt) => round2((Number(pt.price) || 0) - discountOf(pt));

const num = (value, lang) => `<span class="num">${esc(formatNumber(value, lang))}</span>`;

const money = (value, currency, lang) =>
  `<span class="money"><span class="num">${esc(formatNumber(value, lang))}</span> <span class="cur">${esc(currency)}</span></span>`;

const STYLES = `
  @page { size: A4 portrait; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: "Segoe UI", Tahoma, "Noto Sans Arabic", "Noto Naskh Arabic", Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #0f1729;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { width: 100%; max-width: 190mm; margin: 0 auto; padding: 18mm 8mm 14mm; }
  @media print { .sheet { padding: 0; max-width: none; } }

  .num { direction: ltr; unicode-bidi: isolate; display: inline-block; }
  .money { white-space: nowrap; }
  .cur { font-size: 8.5pt; color: #4f5e72; }

  .head { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between;
          border-bottom: 2px solid #0da2e7; padding-bottom: 8px; }
  .clinic { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
  .clinic img { width: 46px; height: 46px; object-fit: contain; flex: none; }
  .clinic h1 { font-size: 15pt; margin: 0 0 2px; line-height: 1.2; }
  .clinic p { margin: 0; font-size: 9pt; color: #4f5e72; }
  .doc-title { text-align: end; flex: none; }
  .doc-title .label { font-size: 10.5pt; font-weight: 700; color: #0da2e7; }
  .doc-title .date { font-size: 9pt; color: #4f5e72; }

  .meta { display: flex; gap: 12px; justify-content: space-between; margin: 10px 0 12px;
          padding: 8px 10px; border: 1px solid #e1e7ef; border-radius: 8px; background: #f8fafc; }
  .meta .who { min-width: 0; }
  .meta .name { font-size: 12pt; font-weight: 700; line-height: 1.25; }
  .meta .line { font-size: 9pt; color: #4f5e72; }
  .meta .side { text-align: end; font-size: 9pt; color: #4f5e72; flex: none; }

  table.items { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.items thead { display: table-header-group; }
  table.items th, table.items td {
    border: 1px solid #e1e7ef; padding: 4px 5px; vertical-align: top;
    word-wrap: break-word; overflow-wrap: anywhere;
  }
  table.items th { background: #eef6fd; font-size: 8.5pt; font-weight: 700; text-align: start; }
  table.items td { font-size: 9pt; }
  table.items tr { page-break-inside: avoid; }
  table.items tbody tr:nth-child(even) td { background: #fbfcfe; }
  .th-num, .td-num { text-align: end; }
  .treat-name { font-weight: 600; }
  .sub { font-size: 8pt; color: #4f5e72; }
  .strike { text-decoration: line-through; color: #4f5e72; font-size: 8pt; }
  .tooth { font-weight: 700; }

  .empty { padding: 18px 0; text-align: center; font-style: italic; color: #4f5e72; }

  .totals { margin-top: 12px; page-break-inside: avoid; }
  table.sum { width: 70mm; margin-inline-start: auto; border-collapse: collapse; }
  table.sum caption { caption-side: top; text-align: start; font-size: 9pt; font-weight: 700;
                      color: #4f5e72; padding-bottom: 3px; }
  table.sum th, table.sum td { padding: 3px 5px; font-size: 9pt; border-bottom: 1px solid #e1e7ef; }
  table.sum th { text-align: start; font-weight: 500; color: #4f5e72; }
  table.sum td { text-align: end; }
  table.sum tr.grand th, table.sum tr.grand td { font-weight: 700; font-size: 10pt; color: #0f1729;
                                                 border-top: 1.5px solid #0f1729; border-bottom: none; }
  table.sum tr.due th, table.sum tr.due td { font-weight: 700; color: #b42318; }
  .plan-discount { margin-top: 6px; font-size: 9pt; color: #16794a; text-align: end; }

  .sign { display: flex; gap: 16px; justify-content: space-between; margin-top: 22px;
          page-break-inside: avoid; }
  .sign > div { flex: 1 1 0; }
  .sign .cap { font-size: 9pt; font-weight: 600; margin-bottom: 26px; }
  .sign .line { border-bottom: 1px solid #9aa7b8; }
  .foot { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e1e7ef;
          text-align: center; font-size: 8pt; color: #7b8798; }

  .bar { position: fixed; inset-block-start: 0; inset-inline: 0; display: flex; gap: 8px;
         justify-content: center; align-items: center; padding: 10px; background: #0f1729; }
  .bar button { font: inherit; font-size: 11pt; font-weight: 700; padding: 8px 20px; border: 0;
                border-radius: 8px; background: #0da2e7; color: #000; cursor: pointer; }
  .bar span { color: #fff; font-size: 9pt; }
  @media print { .bar { display: none !important; } }
`;

const COLUMNS =
  '<colgroup>' +
  '<col style="width:6%"><col style="width:8%"><col style="width:29%"><col style="width:13%">' +
  '<col style="width:9%"><col style="width:11%"><col style="width:5%"><col style="width:8%">' +
  '<col style="width:11%">' +
  '</colgroup>';

function buildRows(treatments, lang) {
  return treatments.map((pt, index) => {
    const teeth = (pt.tooth_numbers || []).filter((n) => n !== null && n !== undefined);
    const surfaces = teeth
      .flatMap((n) => (pt.tooth_surfaces?.[String(n)] || []).map((s) => t(s, lang)))
      .filter(Boolean);
    const discount = discountOf(pt);
    const total = lineTotalOf(pt);

    const toothCell = teeth.length
      ? `<span class="tooth num">#${esc(teeth.join(', '))}</span>` +
        (surfaces.length ? `<div class="sub" dir="auto">${esc(surfaces.join(', '))}</div>` : '')
      : '—';

    const treatCell =
      `<div class="treat-name" dir="auto">${esc(pt.treatment_name || '—')}</div>` +
      (pt.description ? `<div class="sub" dir="auto">${esc(pt.description)}</div>` : '') +
      (pt.notes ? `<div class="sub" dir="auto"><em>${esc(pt.notes)}</em></div>` : '');

    return (
      '<tr>' +
      `<td class="td-num">${num(index + 1, lang)}</td>` +
      `<td>${toothCell}</td>` +
      `<td>${treatCell}</td>` +
      `<td dir="auto">${esc(pt.doctor_name || '—')}</td>` +
      `<td>${esc(pt.treatment_date ? formatDisplayDate(pt.treatment_date, lang) : '—')}</td>` +
      `<td class="td-num">${money(Number(pt.price) || 0, pt.currency || '', lang)}</td>` +
      '<td class="td-num">1</td>' +
      `<td class="td-num">${discount > 0 ? `-${money(discount, pt.currency || '', lang)}` : '—'}</td>` +
      '<td class="td-num">' +
      (discount > 0 ? `<div class="strike">${money(Number(pt.price) || 0, '', lang)}</div>` : '') +
      `<strong>${money(total, pt.currency || '', lang)}</strong>` +
      '</td>' +
      '</tr>'
    );
  }).join('');
}

function buildTotals(totalsByCurrency, paidByCurrency, remainingByCurrency, lang) {
  const currencies = Object.keys(totalsByCurrency || {});
  if (!currencies.length) return '';
  return currencies
    .map((cur) => {
      const v = totalsByCurrency[cur] || {};
      const paid = Number(paidByCurrency?.[cur] || 0);
      const remaining = Number(remainingByCurrency?.[cur] || 0);
      return (
        '<table class="sum">' +
        `<caption>${esc(cur)}</caption>` +
        `<tr><th>${esc(t('original_total', lang))}</th><td>${money(v.original || 0, cur, lang)}</td></tr>` +
        (v.discount > 0
          ? `<tr><th>${esc(t('discount', lang))}</th><td>-${money(v.discount, cur, lang)}</td></tr>`
          : '') +
        `<tr class="grand"><th>${esc(t('final_total', lang))}</th><td>${money(v.final || 0, cur, lang)}</td></tr>` +
        `<tr><th>${esc(t('paid', lang))}</th><td>${money(paid, cur, lang)}</td></tr>` +
        `<tr class="due"><th>${esc(t('remaining', lang))}</th><td>${money(remaining, cur, lang)}</td></tr>` +
        '</table>'
      );
    })
    .join('');
}

/** Builds the complete, self-contained A4 print document. */
export function buildTreatmentPlanHtml({
  clinic = {},
  patient = {},
  treatments = [],
  totalsByCurrency = {},
  paidByCurrency = {},
  remainingByCurrency = {},
  lang = 'en',
  showPatientPhone = true,
}) {
  const dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
  const clinicName = (lang === 'ar' && clinic.name_ar) ? clinic.name_ar : (clinic.name || '');
  const clinicLines = [clinic.address, clinic.phone, clinic.email].filter(Boolean);
  const doctorName = patient.assigned_doctor_name || patient.referring_doctor_name || '';
  const planDiscount = patient.plan_discount_type && patient.plan_discount_type !== 'none'
    ? patient.plan_discount_type === 'percentage'
      ? formatPercent(patient.plan_discount_value, lang)
      : `${formatNumber(patient.plan_discount_value, lang)} ${clinic.currency || ''}`.trim()
    : '';

  const head =
    '<div class="head">' +
    '<div class="clinic">' +
    (clinic.logo_url ? `<img src="${esc(clinic.logo_url)}" alt="">` : '') +
    '<div>' +
    `<h1>${esc(clinicName)}</h1>` +
    clinicLines.map((l) => `<p dir="auto">${esc(l)}</p>`).join('') +
    '</div>' +
    '</div>' +
    '<div class="doc-title">' +
    `<div class="label">${esc(t('treatment_plan', lang))}</div>` +
    `<div class="date">${esc(t('date', lang))}: ${esc(formatDisplayDate(new Date(), lang))}</div>` +
    '</div>' +
    '</div>';

  const meta =
    '<div class="meta">' +
    '<div class="who">' +
    `<div class="name" dir="auto">${esc(patient.full_name || '')}</div>` +
    (showPatientPhone && patient.phone ? `<div class="line num">${esc(patient.phone)}</div>` : '') +
    (doctorName ? `<div class="line"><span>${esc(t('doctor', lang))}:</span> <span dir="auto">${esc(doctorName)}</span></div>` : '') +
    '</div>' +
    '<div class="side">' +
    `<div>${esc(t('clinic', lang))}: ${esc(clinicName)}</div>` +
    `<div>${esc(t('treatment_plan', lang))} · ${esc(formatNumber(treatments.length, lang))}</div>` +
    '</div>' +
    '</div>';

  const table = treatments.length
    ? '<table class="items">' +
      COLUMNS +
      '<thead><tr>' +
      `<th style="text-align:end">#</th>` +
      `<th>${esc(t('tooth_label', lang))}</th>` +
      `<th>${esc(t('treatment', lang))}</th>` +
      `<th>${esc(t('doctor', lang))}</th>` +
      `<th>${esc(t('date', lang))}</th>` +
      `<th style="text-align:end">${esc(t('unit_price', lang))}</th>` +
      `<th style="text-align:end">${esc(t('qty', lang))}</th>` +
      `<th style="text-align:end">${esc(t('discount', lang))}</th>` +
      `<th style="text-align:end">${esc(t('total', lang))}</th>` +
      '</tr></thead>' +
      `<tbody>${buildRows(treatments, lang)}</tbody>` +
      '</table>'
    : `<div class="empty">${esc(t('no_treatments_select_hint', lang))}</div>`;

  const totals = buildTotals(totalsByCurrency, paidByCurrency, remainingByCurrency, lang);

  const sign =
    '<div class="sign">' +
    `<div><div class="cap">${esc(t('doctors_signature', lang))}</div><div class="line"></div></div>` +
    `<div><div class="cap">${esc(t('patients_signature', lang))}</div><div class="line"></div></div>` +
    '</div>';

  return '<!doctype html>' +
    `<html dir="${dir}" lang="${esc(lang)}"><head><meta charset="utf-8">` +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${esc(`${t('treatment_plan', lang)} — ${patient.full_name || ''}`)}</title>` +
    `<style>${STYLES}</style></head><body>` +
    // Fallback for mobile browsers whose print dialog does not open automatically.
    `<div class="bar no-print"><span>${esc(t('treatment_plan', lang))}</span>` +
    `<button type="button" data-print>${esc(t('print', lang))}</button></div>` +
    '<div class="sheet">' +
    head +
    meta +
    table +
    totals +
    (planDiscount
      ? `<div class="plan-discount">${esc(t('plan_discount', lang))}: ${esc(planDiscount)}</div>`
      : '') +
    sign +
    `<div class="foot">${esc(t('generated_by', lang))} · ${esc(formatDisplayDate(new Date(), lang))}</div>` +
    '</div></body></html>';
}

/**
 * Prints the document. Opens it in its own window (the reliable path on Android,
 * where the native print service needs a real, fully laid-out document) and falls
 * back to a hidden iframe when the popup is blocked.
 */
export function printHtmlDocument(html) {
  const popup = window.open('', '_blank');
  if (popup && popup.document) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      try {
        popup.focus();
        popup.print();
      } catch {
        // The document is on screen with its own Print button as a fallback.
      }
    };

    // The in-document Print button is wired from here (same origin) so the
    // document needs no inline script, which a strict CSP could block.
    try {
      const btn = popup.document.querySelector('[data-print]');
      if (btn) {
        btn.addEventListener('click', () => {
          try {
            popup.focus();
            popup.print();
          } catch {
            // Nothing else available on this browser.
          }
        });
      }
    } catch {
      // Leave the auto-print path only.
    }

    const waitAndPrint = () => {
      if (popup.document.readyState === 'complete') setTimeout(fire, 250);
      else popup.addEventListener('load', () => setTimeout(fire, 250), { once: true });
    };
    try {
      waitAndPrint();
    } catch {
      setTimeout(fire, 600);
    }
    // Never leave the user without a print dialog if the load event is missed.
    setTimeout(fire, 3500);
    return;
  }

  // Popup blocked → print from a hidden iframe rendered off-screen.
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1120px;border:0;';
  frame.onload = () => {
    setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        // Nothing else we can do; the caller still has its own UI.
      }
      setTimeout(() => frame.remove(), 60000);
    }, 350);
  };
  document.body.appendChild(frame);
  frame.srcdoc = html;
}

/** Entry point used by the Treatment Plan page. */
export function printTreatmentPlan(data) {
  printHtmlDocument(buildTreatmentPlanHtml(data));
}