import React, { useState, useEffect, useRef } from 'react';
import { appClient } from '@/api/appClient';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useLanguage } from '@/lib/useLanguage';

export default function AppointmentSearch({ clinicMap, onResultClick }) {
  const { lang } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const list = await appClient.entities.Appointment.filter(
          { patient_name: { $regex: escaped, $options: 'i' }, status: { $ne: 'cancelled' } },
          '-date', 50
        );
        setResults(list);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handlePick = (a) => {
    onResultClick(a);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative mb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search appointments by patient name..."
          className="pl-9 pr-9 h-10"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-80 overflow-y-auto">
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No appointments found</div>
          ) : (
            results.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => handlePick(a)}
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent border-b last:border-0"
              >
                <span className="font-medium truncate">{a.patient_name || 'Unknown patient'}</span>
                <span className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>{formatDisplayDate(a.date, lang)}</span>
                  <span>{a.start_time}–{a.end_time}</span>
                  {a.doctor_name && <span>Dr. {a.doctor_name}</span>}
                  {clinicMap && clinicMap[a.clinic_id] && (
                    <span className="text-primary font-medium">{clinicMap[a.clinic_id]}</span>
                  )}
                </span>
                {a.treatment_name && (
                  <span className="text-xs text-muted-foreground truncate">{a.treatment_name}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}