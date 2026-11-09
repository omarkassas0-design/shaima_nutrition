import React, { useState, useEffect, useRef } from 'react';
import { clinicApi } from '@/lib/clinicApi';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Search, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PatientSearchSelect({ clinicId, value, patientName, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    if (!open) setQuery('');
  }, [open]);

  // Debounced DB search — never loads the full patient list
  useEffect(() => {
    if (!open || !clinicId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const term = query.trim();
      setLoading(true);
      try {
        const filter = { clinic_id: clinicId };
        if (term) {
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          filter.full_name = { $regex: escaped, $options: 'i' };
        }
        const list = await clinicApi.filter('Patient', filter, 'full_name', 20, clinicId);
        setResults(list);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open, clinicId]);

  const handleSelect = (p) => {
    // The selected RECORD is passed on (same contract as EntitySearchSelect),
    // so callers can read the patient's name, currency or any other field
    // instead of receiving a bare string.
    onChange(p.id, p);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {patientName ? (
            <span className="truncate text-left">{patientName}</span>
          ) : (
            <span className="text-muted-foreground">Select patient</span>
          )}
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-80 max-w-[calc(100vw-2rem)]" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search patient name..."
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-9"
          />
        </div>
        <div
          className="max-h-60 overflow-y-auto overscroll-contain"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
        >
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No patients found</div>
          ) : (
            results.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors',
                  value === p.id && 'bg-accent/50'
                )}
              >
                <span className="flex flex-col min-w-0">
                  <span className="truncate font-medium">{p.full_name}</span>
                  {p.phone && <span className="text-xs text-muted-foreground truncate">{p.phone}</span>}
                </span>
                {value === p.id && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}