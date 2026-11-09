import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import EmptyState from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays, Stethoscope, CreditCard, FileText, ShieldCheck, Receipt, Clock, FlaskConical, RotateCcw, ClipboardList
} from 'lucide-react';

const TYPE_META = {
  appointment: { icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-100' },
  treatment_plan: { icon: ClipboardList, color: 'text-purple-600', bg: 'bg-purple-100' },
  treatment: { icon: Stethoscope, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  payment: { icon: CreditCard, color: 'text-teal-600', bg: 'bg-teal-100' },
  file: { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-100' },
  consent: { icon: ShieldCheck, color: 'text-purple-600', bg: 'bg-purple-100' },
  invoice: { icon: Receipt, color: 'text-rose-600', bg: 'bg-rose-100' },
  lab_case: { icon: FlaskConical, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  recall: { icon: RotateCcw, color: 'text-orange-600', bg: 'bg-orange-100' },
};



export default function PatientTimeline({ patient }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['patientTimeline', patient.id, clinic?.id],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getPatientTimeline', {
        patient_id: patient.id,
        clinic_id: clinic?.id,
      });
      const data = res.data || res;
      return data?.events || [];
    },
    enabled: !!patient?.id && !!clinic,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return <EmptyState icon={Clock} title={t('no_timeline_events')} />;
  }

  const formatDate = (d) => {
    if (!d) return '—';
    return formatDisplayDate(d, lang);
  };

  return (
    <div className="relative pl-6">
      {/* vertical line */}
      <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
      <div className="space-y-4">
        {events.map((ev, i) => {
          const meta = TYPE_META[ev.type] || TYPE_META.file;
          const Icon = meta.icon;
          return (
            <div key={`${ev.type}-${ev.id || i}`} className="relative">
              <div className={`absolute -left-4 w-7 h-7 rounded-full flex items-center justify-center ${meta.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
              </div>
              <div className="ml-4 glass rounded-lg p-3 border-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{ev.title}</p>
                    {ev.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{ev.subtitle}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {typeof ev.amount === 'number' && (
                      <Badge variant="secondary" className="text-xs">
                        {ev.amount} {ev.currency || ''}
                      </Badge>
                    )}
                    {ev.status && (
                      <Badge variant="outline" className="text-xs">{ev.status}</Badge>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(ev.date)}{ev.time ? ` · ${ev.time}` : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}