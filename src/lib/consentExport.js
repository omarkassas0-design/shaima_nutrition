/**
 * Consent form PDF export and print helpers.
 * Includes the consent body text and the patient's digital signature image.
 */
import { t } from '@/lib/i18n';
import { formatDisplayDateTime } from '@/lib/dateFormat';
import { buildPdfDocument, downloadHtmlPdf, escapeHtml } from '@/lib/pdfHtml';

/**
 * Validates that a signature string is a safe base64 image data URL.
 * Prevents XSS via javascript: URLs or other non-image protocols being
 * injected into the <img src> attribute during consent export/print.
 * Signatures from the SignaturePad are always data:image/png;base64,...
 */
function isValidSignatureDataUrl(sig) {
  if (!sig || typeof sig !== 'string') return false;
  return /^data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+$/.test(sig);
}

const CONSENT_STYLES = `<style>
    .header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .clinic-info h1 { font-size: 19px; margin: 0; }
    .clinic-info p { font-size: 11px; color: #64748b; margin: 2px 0; }
    .doc-title { text-align: end; }
    .doc-title h2 { font-size: 15px; margin: 0; }
    .doc-title p { font-size: 11px; margin: 2px 0; }
    .meta { margin: 12px 0; font-size: 12px; }
    .meta div { margin: 3px 0; }
    .body { margin: 16px 0; font-size: 12px; white-space: pre-wrap; }
    .sig-section { margin-top: 32px; break-inside: avoid; page-break-inside: avoid; }
    .sig-img { max-width: 250px; max-height: 100px; }
    .sig-line { border-top: 1px solid #475569; width: 250px; margin-top: 5px; padding-top: 5px; font-size: 11px; }
    .footer { margin-top: 32px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 10px; color: #94a3b8; text-align: center; }
  </style>`;

/**
 * Build the consent document body. One source for both the PDF and the print
 * action, so the two can never drift apart.
 */
function buildConsentHtml(consent, clinic, lang = 'en') {
  const esc = escapeHtml;

  let html = `<div class="header">
    <div class="clinic-info">
      <h1>${esc(clinic?.name || '')}</h1>`;
  if (clinic?.address) html += `<p>${esc(clinic.address)}</p>`;
  if (clinic?.phone) html += `<p class="num">Tel: ${esc(clinic.phone)}</p>`;
  if (clinic?.email) html += `<p>${esc(clinic.email)}</p>`;
  html += `</div>
    <div class="doc-title">
      <h2>${esc(t('consent_forms', lang))}</h2>
      <p>${esc(consent.template_name || '—')}</p>
    </div>
  </div>`;

  html += `<div class="meta">
    <div><strong>${esc(t('patient', lang))}:</strong> ${esc(consent.patient_name || '—')}</div>`;
  if (consent.doctor_name) html += `<div><strong>${esc(t('doctor', lang))}:</strong> Dr. ${esc(consent.doctor_name)}</div>`;
  if (consent.procedure_name) html += `<div><strong>${esc(t('procedure_name', lang))}:</strong> ${esc(consent.procedure_name)}</div>`;
  html += `<div><strong>${esc(t('date', lang))}:</strong> ${esc(consent.procedure_date || consent.signed_at?.split('T')[0] || '—')}</div>`;
  html += `</div>`;

  html += `<div class="body">${esc(consent.consent_body || '')}</div>`;

  html += `<div class="sig-section">`;
  if (consent.patient_signature && isValidSignatureDataUrl(consent.patient_signature)) {
    html += `<img class="sig-img" src="${esc(consent.patient_signature)}" alt="signature" />`;
  }
  html += `<div class="sig-line">${esc(t('patient_signature', lang))}</div>`;
  if (consent.signed_at) {
    html += `<div style="font-size:11px;margin-top:5px;">${esc(t('signed_at', lang))}: ${esc(formatDisplayDateTime(consent.signed_at, lang))}</div>`;
  }
  html += `</div>`;

  html += `<div class="footer">${esc(clinic?.name || '')}</div>`;

  return CONSENT_STYLES + html;
}

/**
 * Download a signed consent form as PDF.
 * @param {object} consent - The ConsentForm record
 * @param {object} clinic - Clinic record
 * @param {string} lang - 'en' | 'ar' | 'tr'
 */
export async function downloadConsentPDF(consent, clinic, lang = 'en') {
  await downloadHtmlPdf({
    html: buildConsentHtml(consent, clinic, lang),
    filename: `consent-${consent.template_key}-${consent.patient_name || 'patient'}.pdf`,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
  });
}

/**
 * Print a consent form.
 */
export function printConsent(consent, clinic, lang = 'en') {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(buildPdfDocument({
    html: buildConsentHtml(consent, clinic, lang),
    title: consent.template_name || 'Consent',
    dir: lang === 'ar' ? 'rtl' : 'ltr',
  }));
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 300);
}