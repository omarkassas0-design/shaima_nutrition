import { format, parseISO, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, isSameMonth, eachDayOfInterval } from 'date-fns';

export const HOUR_HEIGHT = 80; // px per hour — taller for 15-min readability
export const START_HOUR = 8;
export const END_HOUR = 21; // grid shows 08:00 - 21:00

export const STATUS_STYLES = {
  scheduled: { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white', dot: 'bg-blue-300', soft: 'bg-blue-50 text-blue-700 border-blue-200', solid: '#3b82f6' },
  confirmed: { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white', dot: 'bg-emerald-300', soft: 'bg-emerald-50 text-emerald-700 border-emerald-200', solid: '#10b981' },
  waiting: { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-white', dot: 'bg-amber-300', soft: 'bg-amber-50 text-amber-700 border-amber-200', solid: '#f59e0b' },
  completed: { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white', dot: 'bg-emerald-300', soft: 'bg-emerald-50 text-emerald-700 border-emerald-200', solid: '#22c55e' },
  no_show: { bg: 'bg-red-500', border: 'border-red-600', text: 'text-white', dot: 'bg-red-300', soft: 'bg-red-50 text-red-700 border-red-200', solid: '#ef4444' },
  cancelled: { bg: 'bg-rose-500', border: 'border-rose-600', text: 'text-white', dot: 'bg-rose-300', soft: 'bg-rose-50 text-rose-700 border-rose-200', solid: '#e11d48' },
};

export function getStatusStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES.scheduled;
}

// Convert "HH:MM" to minutes from midnight
export function timeToMinutes(time) {
  if (!time || typeof time !== 'string') return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Convert "HH:MM" to decimal hours
export function timeToHours(time) {
  return timeToMinutes(time) / 60;
}

// Duration in minutes between start and end
export function durationMinutes(start, end) {
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}

// Position helpers for the time grid
export function topForTime(time) {
  const h = timeToHours(time);
  return Math.max(0, (h - START_HOUR) * HOUR_HEIGHT);
}

export function heightForRange(start, end) {
  return Math.max(20, (timeToHours(end) - timeToHours(start)) * HOUR_HEIGHT);
}

export function getHourLabels() {
  const labels = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    labels.push(format(new Date().setHours(h, 0, 0, 0), 'HH:mm'));
  }
  return labels;
}

// 15-minute increment labels for the time axis
export function getQuarterHourLabels() {
  const labels = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    labels.push({ time: `${String(h).padStart(2, '0')}:00`, major: true });
    if (h < END_HOUR) {
      labels.push({ time: `${String(h).padStart(2, '0')}:15`, major: false });
      labels.push({ time: `${String(h).padStart(2, '0')}:30`, major: false });
      labels.push({ time: `${String(h).padStart(2, '0')}:45`, major: false });
    }
  }
  return labels;
}

// Overlap layout: assigns each appointment a column index and total columns
// in its overlap group, so side-by-side rendering never covers a neighbor.
export function layoutAppointments(appointments) {
  if (!appointments || appointments.length === 0) return [];

  const valid = appointments.filter(a => a.start_time && a.end_time);
  if (valid.length === 0) return [];

  const sorted = [...valid].sort((a, b) => {
    const aStart = timeToMinutes(a.start_time);
    const bStart = timeToMinutes(b.start_time);
    if (aStart !== bStart) return aStart - bStart;
    return timeToMinutes(b.end_time) - timeToMinutes(a.end_time);
  });

  // Greedy column assignment: place each appt in the first column whose
  // last appointment ends before this one starts.
  const columnEnds = [];
  const assigned = sorted.map(appt => {
    const start = timeToMinutes(appt.start_time);
    const end = timeToMinutes(appt.end_time);
    let col = columnEnds.findIndex(e => e <= start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[col] = end;
    }
    return { appt, col, start, end };
  });

  // For each appointment, the total columns = max column index + 1 among
  // all appointments that overlap with it.
  return assigned.map(({ appt, col, start, end }) => {
    const overlapping = assigned.filter(o => o.start < end && o.end > start);
    const totalCols = Math.max(...overlapping.map(o => o.col + 1));
    return { appt, col, totalCols };
  });
}

export function getWeekDays(date) {
  const start = startOfWeek(date, { weekStartsOn: 6 }); // Saturday start
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function getMonthMatrix(date) {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 6 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 6 });
  return eachDayOfInterval({ start, end });
}

export {
  format, parseISO, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addMonths, subMonths, isSameDay, isSameMonth
};