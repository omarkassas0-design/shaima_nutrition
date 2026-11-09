import React, { useState } from 'react';
import { DoorClosed, Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/useLanguage';

const ROOMS = [1, 2, 3, 4, 5];

export default function TreatmentRoomSelector({ selectedRoom, onChange }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const label = (n) => t('treatment_room_n').replace('{n}', n);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <DoorClosed className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">{t('room_calendar')}</span>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-11 w-full sm:w-64 items-center justify-between rounded-md gradient-primary text-white px-4 text-base font-semibold shadow-md border border-transparent hover:opacity-90 transition-opacity"
          >
            <span className="truncate">{label(selectedRoom)}</span>
            <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-90" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-1 w-[var(--radix-popover-trigger-width)] min-w-[240px]" align="start">
          <div className="max-h-72 overflow-y-auto">
            {ROOMS.map(n => {
              const active = n === selectedRoom;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => { onChange(n); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-base text-left transition-colors hover:bg-accent',
                    active && 'bg-accent/60 font-semibold'
                  )}
                >
                  <span className="truncate">{label(n)}</span>
                  {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}