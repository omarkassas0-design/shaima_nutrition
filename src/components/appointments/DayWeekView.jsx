import React, { useMemo } from 'react';
import {
  HOUR_HEIGHT, START_HOUR, END_HOUR, getQuarterHourLabels,
  topForTime, heightForRange, getWeekDays, format, isSameDay,
  timeToMinutes, layoutAppointments
} from './calendarUtils';
import AppointmentBlock from './AppointmentBlock';
import { useLanguage } from '@/lib/useLanguage';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function DayWeekView({ view, cursorDate, appointments, doctors, onAppointmentClick, onSlotClick }) {
  const { t } = useLanguage();

  const days = useMemo(() => {
    if (view === 'day') return [cursorDate];
    return getWeekDays(cursorDate);
  }, [view, cursorDate]);

  const quarterLabels = getQuarterHourLabels();
  const totalHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT;
  const slotHeight = HOUR_HEIGHT / 4; // 15-min slot height
  const today = new Date();

  const apptsByDay = useMemo(() => {
    const map = {};
    days.forEach(d => { map[format(d, 'yyyy-MM-dd')] = []; });
    appointments.forEach(a => {
      if (map[a.date]) map[a.date].push(a);
    });
    return map;
  }, [appointments, days]);

  const doctorColor = (id) => doctors.find(d => d.id === id)?.calendar_color;

  // Current time indicator
  const nowMinutes = timeToMinutes(format(today, 'HH:mm'));
  const nowTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const showNowLine = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Day header row */}
      <div className="flex border-b border-border bg-muted/30">
        <div className="w-12 sm:w-14 shrink-0" />
        {days.map(d => {
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} className="flex-1 min-w-0 text-center py-2 border-l border-border">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t(WEEKDAY_KEYS[d.getDay()])}</div>
              <div className={`text-base sm:text-lg font-semibold ${isToday ? 'text-primary' : ''}`}>
                {format(d, 'd')}
                {isToday && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="flex overflow-y-auto" style={{ maxHeight: '65vh' }}>
        {/* Time gutter */}
        <div className="w-12 sm:w-14 shrink-0 relative bg-card border-r border-border" style={{ height: totalHeight }}>
          {quarterLabels.map((label, i) => (
            <div
              key={label.time}
              className={`absolute right-1 -translate-y-1/2 whitespace-nowrap ${
                label.major
                  ? 'text-[10px] font-semibold text-muted-foreground'
                  : 'text-[9px] text-muted-foreground/40'
              }`}
              style={{ top: i * slotHeight }}
            >
              {label.time}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map(d => {
          const dateKey = format(d, 'yyyy-MM-dd');
          const dayAppts = apptsByDay[dateKey] || [];
          const laidOut = layoutAppointments(dayAppts);
          const isToday = isSameDay(d, today);

          return (
            <div
              key={d.toISOString()}
              className="flex-1 relative border-l border-border cursor-pointer min-w-0"
              style={{ height: totalHeight }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const totalMins = Math.floor(y / slotHeight) * 15;
                const hour = START_HOUR + Math.floor(totalMins / 60);
                const mins = totalMins % 60;
                onSlotClick?.(dateKey, `${String(hour).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
              }}
            >
              {/* Quarter-hour grid lines */}
              {quarterLabels.map((label, i) => (
                <div
                  key={label.time}
                  className={`absolute left-0 right-0 ${label.major ? 'border-t border-border/60' : 'border-t border-border/15'}`}
                  style={{ top: i * slotHeight }}
                />
              ))}

              {/* Current time indicator */}
              {isToday && showNowLine && (
                <div
                  className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                  style={{ top: nowTop }}
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow-sm" />
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              )}

              {/* Appointment blocks with overlap layout */}
              {laidOut.map(({ appt, col, totalCols }) => {
                const top = topForTime(appt.start_time);
                const height = heightForRange(appt.start_time, appt.end_time);
                const widthPct = 100 / totalCols;
                const leftPct = col * widthPct;
                const compact = height < 52;
                return (
                  <div
                    key={appt.id}
                    className="absolute"
                    style={{
                      top: top + 1,
                      height: Math.max(height - 3, 20),
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
                  >
                    <AppointmentBlock
                      appt={appt}
                      doctorColor={doctorColor(appt.doctor_id)}
                      onClick={onAppointmentClick}
                      compact={compact}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}