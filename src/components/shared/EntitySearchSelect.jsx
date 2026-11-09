import React, { useState, useEffect, useRef } from 'react';
import { clinicApi } from '@/lib/clinicApi';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Search, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Generic searchable entity select — a Popover-based combobox that debounces
 * a server-side regex search on any clinic-scoped entity. Mirrors
 * PatientSearchSelect but works for Doctor, Laboratory, Staff, etc.
 *
 * Props:
 *   entity        — entity name ('Doctor', 'Laboratory', 'Staff', …)
 *   clinicId      — clinic scope (required)
 *   value         — selected record id
 *   selectedLabel — display label for the selected value (string)
 *   onChange      — (id, record) => void
 *   labelKey      — field used for the primary display label (default 'name')
 *   secondaryKey  — optional field shown as a secondary line (e.g. 'phone','email')
 *   searchKey     — field used for the regex search (defaults to labelKey)
 *   extraFilter   — additional filter criteria merged into the query
 *   sortField     — sort field (defaults to labelKey)
 *   placeholder   — trigger placeholder text
 *   disabled      — boolean
 *   overrideClinicId — super-admin override (passed through to clinicApi.filter)
 */
export default function EntitySearchSelect({
  entity,
  clinicId,
  value,
  selectedLabel,
  onChange,
  labelKey = 'name',
  secondaryKey,
  searchKey,
  extraFilter = {},
  sortField,
  placeholder = 'Select...',
  disabled,
  overrideClinicId,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const sKey = searchKey || labelKey;
  const sField = sortField || labelKey;

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 50);
    if (!open) setQuery('');
  }, [open]);

  // Debounced DB search — never loads the full list
  useEffect(() => {
    if (!open || !clinicId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const term = query.trim();
      setLoading(true);
      try {
        const filter = { clinic_id: clinicId, ...extraFilter };
        if (term) {
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          filter[sKey] = { $regex: escaped, $options: 'i' };
        }
        const list = await clinicApi.filter(entity, filter, sField, 20, overrideClinicId || clinicId);
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open, clinicId, entity, sKey, sField]);

  const handleSelect = (rec) => {
    onChange(rec.id, rec);
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
          {selectedLabel ? (
            <span className="truncate text-left">{selectedLabel}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
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
            placeholder="Search..."
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
            <div className="py-6 text-center text-sm text-muted-foreground">No results</div>
          ) : (
            results.map(rec => (
              <button
                key={rec.id}
                type="button"
                onClick={() => handleSelect(rec)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors',
                  value === rec.id && 'bg-accent/50'
                )}
              >
                <span className="flex flex-col min-w-0">
                  <span className="truncate font-medium">{rec[labelKey]}</span>
                  {secondaryKey && rec[secondaryKey] && (
                    <span className="text-xs text-muted-foreground truncate">{rec[secondaryKey]}</span>
                  )}
                </span>
                {value === rec.id && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}