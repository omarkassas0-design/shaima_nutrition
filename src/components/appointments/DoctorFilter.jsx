import React from 'react';
import { Stethoscope } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/useLanguage';

export default function DoctorFilter({ doctors, selectedDoctorId, onChange }) {
  const { t } = useLanguage();
  return (
    <Select value={selectedDoctorId || 'all'} onValueChange={onChange}>
      <SelectTrigger className="w-56">
        <Stethoscope className="w-4 h-4 mr-1.5 text-muted-foreground" />
        <SelectValue placeholder={t('all_doctors')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t('all_doctors')}</SelectItem>
        {doctors.map(d => (
          <SelectItem key={d.id} value={d.id}>
            <span className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: d.calendar_color || '#0ea5e9' }}
              />
              {d.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}