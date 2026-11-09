/**
 * Data-driven helpers for WhatsApp message templates.
 *
 * Builds the real {variable} → value mapping from actual patient, appointment,
 * and clinic data fetched from the database. Never hardcodes names, dates, or
 * times — every value comes from a real record.
 *
 * Language-aware: dates, days, and times are formatted per clinic language
 * (en / ar / tr). Missing fields are replaced with empty strings (clean
 * handling — the placeholder simply disappears, never invented).
 */

import { formatNumber } from '@/lib/currencyUtils';

// ── Localized day & month names ─────────────────────────────────────
const DAYS = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  tr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
};

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
};

function normalizeLang(lang) {
  return lang === 'ar' || lang === 'tr' ? lang : 'en';
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Accept "YYYY-MM-DD" or full ISO strings
  const d = dateStr.length <= 10 ? new Date(dateStr + 'T00:00:00') : new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/** Formats an appointment date as a localized long date, e.g. "Monday, September 15, 2026". */
export function formatAppointmentDate(dateStr, lang = 'en') {
  const d = parseDate(dateStr);
  if (!d) return dateStr || '';
  const L = normalizeLang(lang);
  const dayName = DAYS[L][d.getDay()];
  const monthName = MONTHS[L][d.getMonth()];
  const dayNum = d.getDate();
  const year = d.getFullYear();
  if (L === 'ar') return `${dayName}، ${dayNum} ${monthName} ${year}`;
  if (L === 'tr') return `${dayName}, ${dayNum} ${monthName} ${year}`;
  return `${dayName}, ${monthName} ${dayNum}, ${year}`;
}

/** Returns the localized weekday name for a date, e.g. "Monday" / "الإثنين" / "Pazartesi". */
export function formatAppointmentDay(dateStr, lang = 'en') {
  const d = parseDate(dateStr);
  if (!d) return '';
  return DAYS[normalizeLang(lang)][d.getDay()];
}

/** Formats a "HH:MM" time string per language (12h for en/ar, 24h for tr). */
export function formatAppointmentTime(timeStr, lang = 'en') {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':').map(Number);
  const h = parts[0];
  const m = parts[1];
  if (isNaN(h) || isNaN(m)) return timeStr;
  const L = normalizeLang(lang);
  if (L === 'tr') return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const period = h >= 12 ? (L === 'ar' ? 'مساءً' : 'PM') : (L === 'ar' ? 'صباحاً' : 'AM');
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Human-readable label for an appointment, used in the selector dropdown. */
export function formatAppointmentLabel(appointment, lang = 'en') {
  if (!appointment) return '';
  const L = normalizeLang(lang);
  const date = formatAppointmentDate(appointment.date, L);
  const time = formatAppointmentTime(appointment.start_time, L);
  const doctor = appointment.doctor_name || '';
  const sep = L === 'ar' ? '، ' : ', ';
  const parts = [date, time].filter(Boolean);
  let label = parts.join(sep);
  if (doctor) {
    // Avoid double-prefixing when the doctor name already starts with a title
    const hasTitle = /^(dr\.?|d\.|dr |د\.|د )/i.test(doctor);
    const prefix = hasTitle ? doctor : (L === 'ar' ? `د. ${doctor}` : `Dr. ${doctor}`);
    label = `${prefix}${sep}${label}`;
  }
  return label;
}

/**
 * Builds the full {variable} → value data object from real records.
 *
 * @param {object} opts
 * @param {object} opts.patient       - Patient record from the DB
 * @param {object} [opts.appointment]  - Appointment record (may be null)
 * @param {object} [opts.labCase]      - LabCase record (for lab templates)
 * @param {object} opts.clinic         - Clinic record
 * @param {object} [opts.outstandingByCurrency] - { USD: 100, TRY: 500, ... }
 * @param {string} [opts.currency]     - Selected currency for balance templates
 * @param {string} [opts.lang]         - 'en' | 'ar' | 'tr'
 * @returns {object} flat { variable: value } map for renderTemplate()
 */
export function buildTemplateData({
  patient,
  appointment,
  labCase,
  clinic,
  outstandingByCurrency = {},
  currency = 'USD',
  lang = 'en',
}) {
  const L = normalizeLang(lang);
  const owed = outstandingByCurrency[currency] || 0;
  const room = appointment?.treatment_room ? String(appointment.treatment_room) : '';

  return {
    patient_name: patient?.full_name || '',
    doctor_name: appointment?.doctor_name || '',
    clinic_name: clinic?.name || '',
    appointment_date: formatAppointmentDate(appointment?.date, L),
    appointment_day: formatAppointmentDay(appointment?.date, L),
    appointment_time: formatAppointmentTime(appointment?.start_time, L),
    treatment_name: appointment?.treatment_name || labCase?.case_type || '',
    room,
    location: room,
    outstanding_balance: owed > 0 ? formatNumber(owed, L) : '0',
    currency,
    clinic_phone: clinic?.phone || '',
    lab_name: labCase?.lab_name || '',
    due_date: labCase?.due_date || '',
  };
}

/** Template keys that benefit from real appointment data. */
export const APPOINTMENT_TEMPLATE_KEYS = new Set([
  'appointment_reminder',
  'appointment_confirmation',
  'appointment_rescheduling',
  'appointment_cancellation',
  'treatment_followup',
  'thank_you',
]);

/** Picks the best default appointment from a list: the next upcoming, or the most recent past. */
export function pickDefaultAppointment(appointments) {
  if (!appointments || appointments.length === 0) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = appointments
    .filter(a => a.date && new Date(a.date + 'T00:00:00') >= today)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (upcoming.length > 0) return upcoming[0];
  // No upcoming — use the most recent past appointment
  const past = appointments
    .filter(a => a.date)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return past[0] || appointments[0];
}