import React, { useState } from 'react';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { formatNumber } from '@/lib/currencyUtils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, User, Stethoscope } from 'lucide-react';

const STATUS_STYLE = {
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

function DoctorRow({ doctor }) {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const hasPatients = doctor.patients.length > 0;

  return (
    <Card className="glass border-0 shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 p-4 text-left disabled:cursor-default"
        onClick={() => setOpen(o => !o)}
        disabled={!hasPatients}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{doctor.doctor_name}</p>
            <p className="text-xs text-muted-foreground">
              {doctor.patient_count} {t('patients_treated')} · {doctor.treatment_count} {t('treatments')}
            </p>
          </div>
        </div>
        {hasPatients && (
          <ChevronDown className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && hasPatients && (
        <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
          {doctor.patients.map(p => (
            <div key={p.patient_id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <p className="text-sm font-medium truncate">{p.patient_name}</p>
                <Badge variant="secondary" className="text-[10px] ml-auto flex-shrink-0">{p.treatments.length}</Badge>
              </div>
              <div className="ml-5 space-y-1">
                {p.treatments.map((tr, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm py-1 border-b last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{tr.treatment_name}</p>
                      <p className="text-xs text-muted-foreground">{formatDisplayDate(tr.treatment_date, lang)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {tr.price > 0 && (
                        <span className="text-xs font-medium">{formatNumber(tr.price)} {tr.currency}</span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[tr.status] || 'bg-gray-100 text-gray-600'}`}>
                        {t(tr.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function DoctorPerformanceDetails({ doctorDetails }) {
  const { t } = useLanguage();
  if (!doctorDetails || doctorDetails.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">{t('no_data')}</p>;
  }
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">{t('doctor_details')}</h3>
      {doctorDetails.map(d => (
        <DoctorRow key={d.doctor_id} doctor={d} />
      ))}
    </div>
  );
}