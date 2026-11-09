import React from 'react';
import { STATUS_STYLES, durationMinutes } from './calendarUtils';
import { Clock, Stethoscope } from 'lucide-react';

export default function AppointmentBlock({ appt, doctorColor, onClick, compact }) {
  const statusStyle = STATUS_STYLES[appt.status] || STATUS_STYLES.scheduled;
  // Use STATUS color for the background — this is the primary visual indicator.
  // Scheduled=Blue, No Show=Red, Completed=Green (per requirement).
  const bgColor = statusStyle.solid;
  const duration = durationMinutes(appt.start_time, appt.end_time);
  const durationLabel = duration >= 60
    ? `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}m` : ''}`
    : `${duration}m`;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(appt); }}
      title={[appt.patient_name, appt.doctor_name, appt.start_time, appt.end_time, appt.treatment_name].filter(Boolean).join(' · ')}
      aria-label={[appt.patient_name, appt.doctor_name, appt.start_time, appt.end_time, appt.treatment_name].filter(Boolean).join(' · ')}
      data-calendar-event="true"
      className="absolute inset-0 rounded-lg shadow-sm overflow-hidden text-left transition-all hover:shadow-md hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-ring"
      style={{ backgroundColor: bgColor }}
    >
      {/* Doctor color accent stripe (left edge) — preserves doctor identification */}
      {doctorColor && (
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: doctorColor }} />
      )}
      <div className="px-1.5 py-1 leading-tight text-white h-full flex flex-col">
        {/* Time + duration */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-bold tracking-wide opacity-95">{appt.start_time}</span>
          <span className="text-[9px] opacity-75 truncate">· {durationLabel}</span>
        </div>
        {/* Patient name */}
        <p className="text-[11px] font-bold truncate mt-0.5">{appt.patient_name || '—'}</p>
        {!compact && (
          <>
            {appt.doctor_name && (
              <p className="text-[10px] opacity-85 truncate flex items-center gap-0.5">
                <Stethoscope className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{appt.doctor_name}</span>
              </p>
            )}
            {appt.treatment_name && (
              <p className="text-[10px] opacity-75 truncate flex items-center gap-0.5 mt-auto">
                <Clock className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{appt.treatment_name}</span>
              </p>
            )}
          </>
        )}
      </div>
    </button>
  );
}