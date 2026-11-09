/**
 * Unicode-safe PDF output — the single path every printable document in the app
 * goes through.
 *
 * The PDF is produced by the browser's own print engine ("Print → Save as PDF" /
 * "Save to device"). That engine is the very text shaper the app renders with,
 * so:
 *   • Arabic is joined letter-to-letter and laid out right-to-left,
 *   • Turkish (ğ ı ş İ ö ü ç) and every other character comes from the real
 *     font instead of a substitution table,
 *   • mixed Arabic / Turkish / English / numeric text keeps its true order,
 *   • the saved file holds real, selectable, searchable text with the fonts
 *     embedded, at the document's own A4 layout, with table headers repeated on
 *     every page and no row split across a page break.
 *
 * The two earlier approaches are gone because neither could do any of that:
 * jsPDF's built-in fonts are Latin-1 (Arabic came out corrupted and Turkish
 * letters were lost), and rasterising the HTML turned every page into a picture
 * of text — not selectable, not searchable, and soft when scaled.
 */

export const PDF_FONT_STACK =
  "'Inter','Noto Sans Arabic',Arial,'Segoe UI',Tahoma,sans-serif";

/** The families the app itself loads, so a printed document matches the screen. */
const PDF_FONT_IMPORT =
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+Arabic:wght@300;400;500;600;700;800&display=swap";

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Shared document shell: A4 with printable margins, the app's fonts, table
 * rules that survive pagination, and the same right-to-left handling the screens
 * use — a figure, date or amount stays one left-to-right unit inside Arabic
 * text while the Arabic itself stays right-to-left.
 */
export function pdfBaseStyles() {
  return `<style>
    @page { size: A4; margin: 12mm; }
    html, body { margin: 0; padding: 0; background: #ffffff; }
    body {
      font-family: ${PDF_FONT_STACK};
      font-size: 12px;
      line-height: 1.5;
      color: #1e293b;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1 { font-size: 19px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 14px 0 6px; padding: 5px 8px; background: #ebf1fc; border-radius: 5px; }
    h3 { font-size: 11px; margin: 10px 0 4px; color: #475569; text-transform: uppercase; letter-spacing: .04em; }
    p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 0 0 10px; }
    th, td { padding: 5px 6px; text-align: start; vertical-align: top; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; border-bottom: 1px solid #cbd5e1; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    h2, h3 { break-after: avoid; page-break-after: avoid; }
    .num, .bidi-num { unicode-bidi: plaintext; }
    .bidi-iso { unicode-bidi: isolate; }
    /* Arabic letter joins must never be broken by tracking. */
    [dir="rtl"] * { letter-spacing: normal !important; }
    [dir="rtl"] :where(span, p, td, li, label, strong, b, small, div, h1, h2, h3, h4):not(:has(*)) {
      unicode-bidi: plaintext;
      text-align: match-parent;
      text-align: -webkit-match-parent;
    }
  </style>`;
}

/** Wrap a document body in the printable shell. */
export function buildPdfDocument({ html, title = 'Document', dir = 'ltr' }) {
  const direction = dir === 'rtl' ? 'rtl' : 'ltr';
  return `<!doctype html>`
    + `<html dir="${direction}" lang="${direction === 'rtl' ? 'ar' : 'en'}">`
    + `<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>`
    + `<style>@import url('${PDF_FONT_IMPORT}');</style>`
    + pdfBaseStyles()
    + `</head><body>${html}</body></html>`;
}

/**
 * Print a document from an off-screen frame and let the browser save it as a
 * PDF. Printing waits for the fonts to load, so the saved PDF can never fall
 * back to a font that lacks the Arabic or Turkish glyphs.
 */
export async function printPdfDocument({ html, filename = 'document.pdf', dir }) {
  if (typeof document === 'undefined') return;
  const target = dir || (document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr');
  const title = String(filename).replace(/\.pdf$/i, '');

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;';
  document.body.appendChild(frame);

  const frameWindow = frame.contentWindow;
  frameWindow.document.open();
  frameWindow.document.write(buildPdfDocument({ html, title, dir: target }));
  frameWindow.document.close();

  const remove = () => { if (frame.parentNode) frame.parentNode.removeChild(frame); };
  frameWindow.addEventListener('afterprint', remove);

  if (frameWindow.document.fonts) await frameWindow.document.fonts.ready;
  frameWindow.focus();
  frameWindow.print();
  setTimeout(remove, 120000);
}

/**
 * Export a document as a PDF. Every exporter in the app calls this, so Arabic,
 * Turkish and mixed text are correct in all of them by construction.
 */
export async function downloadHtmlPdf({ html, filename, dir }) {
  await printPdfDocument({ html, filename, dir });
}