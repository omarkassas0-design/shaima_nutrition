import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { addDays, subMonths, addMonths, startOfWeek, endOfWeek } from './calendarUtils';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';

const VIEW_KEYS = ['day', 'week', 'month'];

export default function CalendarToolbar({ view, setView, cursorDate, setCursorDate, onAdd }) {
  const { t, lang } = useLanguage();
  const VIEW_OPTIONS = [
    { key: 'day', label: t('day_view') },
    { key: 'week', label: t('week_view') },
    { key: 'month', label: t('month_view') },
    { key: 'agenda', label: t('agenda_view') },
  ];
  const goPrev = () => {
    if (view === 'day') setCursorDate(addDays(cursorDate, -1));
    else if (view === 'week' || view === 'agenda') setCursorDate(addDays(cursorDate, -7));
    else setCursorDate(subMonths(cursorDate, 1));
  };

  const goNext = () => {
    if (view === 'day') setCursorDate(addDays(cursorDate, 1));
    else if (view === 'week' || view === 'agenda') setCursorDate(addDays(cursorDate, 7));
    else setCursorDate(addMonths(cursorDate, 1));
  };

  const goToday = () => setCursorDate(new Date());

  const label = () => {
    if (view === 'day') return formatDisplayDate(cursorDate, lang);
    if (view === 'week' || view === 'agenda') {
      const s = startOfWeek(cursorDate, { weekStartsOn: 6 });
      const e = endOfWeek(cursorDate, { weekStartsOn: 6 });
      return `${formatDisplayDate(s, lang)} – ${formatDisplayDate(e, lang)}`;
    }
    return formatDisplayDate(cursorDate, lang, { monthOnly: true });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Button variant="outline" size="icon" onClick={goPrev}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={goNext}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday} className="gap-1.5">
          <CalendarDays className="w-4 h-4" />
          {t('today')}
        </Button>
        <h2 className="text-lg font-semibold ml-2">{label()}</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <div className="inline-flex flex-wrap rounded-xl border border-border overflow-hidden">
          {VIEW_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setView(opt.key)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                view === opt.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {onAdd && (
          <Button size="sm" onClick={onAdd} className="gradient-primary text-white">
            {t('new_appointment')}
          </Button>
        )}
      </div>
    </div>
  );
}