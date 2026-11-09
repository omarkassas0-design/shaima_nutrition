import React, { useMemo } from 'react';
import { getMonthMatrix, format, isSameDay, isSameMonth, STATUS_STYLES } from './calendarUtils';
import { useLanguage } from '@/lib/useLanguage';

const WEEKDAY_KEYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

export default function MonthView({ cursorDate, appointments, doctors, onAppointmentClick, onDayClick }) {
  const { t } = useLanguage();
  const WEEKDAY_LABELS = WEEKDAY_KEYS.map(k => t(k));
  const days = useMemo(() => getMonthMatrix(cursorDate), [cursorDate]);
  const today = new Date();
  const doctorColor = (id) => doctors.find(d => d.id === id)?.calendar_color;

  const apptsByDay = useMemo(() => {
    const map = {};
    appointments.forEach(a => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [appointments]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAY_LABELS.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map(d => {
          const dateKey = format(d, 'yyyy-MM-dd');
          const dayAppts = apptsByDay[dateKey] || [];
          const inMonth = isSameMonth(d, cursorDate);
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              onClick={() => onDayClick?.(dateKey)}
              className={`min-h-[96px] border-b border-r border-border p-1.5 cursor-pointer hover:bg-muted/40 transition-colors ${!inMonth ? 'bg-muted/20 opacity-50' : ''}`}
            >
              <div className={`text-xs font-semibold mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full ${
                isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
              }`}>
                {format(d, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayAppts.slice(0, 3).map(appt => {
                  const style = STATUS_STYLES[appt.status] || STATUS_STYLES.scheduled;
                  const statusColor = style.solid;
                  return (
                    <button
                      key={appt.id}
                      onClick={(e) => { e.stopPropagation(); onAppointmentClick(appt); }}
                      className="w-full text-left flex items-center gap-1 rounded px-1 py-0.5 text-[10px] hover:brightness-95"
                      style={{ background: statusColor + '22', borderLeft: `3px solid ${statusColor}` }}
                    >
                      <span className="font-semibold text-foreground shrink-0">{appt.start_time}</span>
                      <span className="truncate text-muted-foreground">{appt.patient_name}</span>
                    </button>
                  );
                })}
                {dayAppts.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">+{dayAppts.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}