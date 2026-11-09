import React from 'react';
import { isSameDay, STATUS_STYLES, durationMinutes } from './calendarUtils';
import { getStatusLabel } from '@/lib/statusLabels';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { Clock, Stethoscope, Calendar } from 'lucide-react';

export default function AgendaView({ appointments, cursorDate, onAppointmentClick }) {
  const { t, lang } = useLanguage();

  const sorted = [...appointments]
    .filter(a => a.start_time && a.end_time)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

  const grouped = {};
  sorted.forEach(a => {
    if (!grouped[a.date]) grouped[a.date] = [];
    grouped[a.date].push(a);
  });

  const dates = Object.keys(grouped).sort();
  const today = new Date();

  if (dates.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
        {t('no_appointments')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dates.map(date => {
        const d = new Date(date);
        const isToday = isSameDay(d, today);
        return (
          <div key={date}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                {formatDisplayDate(date, lang)}
              </div>
              {isToday && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {t('today')}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {grouped[date].map(appt => {
                const style = STATUS_STYLES[appt.status] || STATUS_STYLES.scheduled;
                const duration = durationMinutes(appt.start_time, appt.end_time);
                return (
                  <button
                    key={appt.id}
                    onClick={() => onAppointmentClick(appt)}
                    className="w-full flex items-stretch gap-3 rounded-lg border border-border bg-card p-3 text-left hover:shadow-md transition-shadow"
                  >
                    <div className="w-1 rounded-full shrink-0" style={{ backgroundColor: style.solid }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
                        <span className="text-sm font-semibold truncate">{appt.patient_name || '—'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{appt.start_time} – {appt.end_time} ({duration}m)</span>
                        </div>
                        {appt.doctor_name && (
                          <div className="flex items-center gap-1.5">
                            <Stethoscope className="w-3 h-3 shrink-0" />
                            <span className="truncate">{appt.doctor_name}</span>
                          </div>
                        )}
                        {appt.treatment_name && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span className="truncate">{appt.treatment_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-start">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${style.soft} border`}>
                        {getStatusLabel(appt.status, lang)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}