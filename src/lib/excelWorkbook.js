/**
 * Shared .xlsx workbook helpers (ExcelJS).
 *
 * Every export in the app builds the workbook as an array-of-arrays per sheet
 * (header row first) and downloads it as a real .xlsx file. These helpers keep
 * that behavior identical across all exports.
 */
import ExcelJS from 'exceljs';

export function createWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AuraDental Cloud';
  wb.created = new Date();
  return wb;
}

/** Adds one worksheet from an array-of-arrays. Names are cut to Excel's 31-char limit. */
export function addSheet(wb, name, aoa) {
  const ws = wb.addWorksheet(String(name || 'Sheet').slice(0, 31));
  aoa.forEach((row) => ws.addRow(row));
  return ws;
}

/** Writes the workbook to a .xlsx file and triggers the browser download. */
export async function saveWorkbook(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}