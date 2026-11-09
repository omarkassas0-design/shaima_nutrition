import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, ExternalLink } from 'lucide-react';
import StaticOdontogram from '@/components/patient/StaticOdontogram';
import { getStatusLabel } from '@/lib/statusLabels';

const STATUS_BADGE = {
  planned:     'bg-blue-100 text-blue-700',
  in_progress:  'bg-amber-100 text-amber-700',
  completed:    'bg-green-100 text-green-700',
  cancelled:    'bg-red-100 text-red-700',
};

export default function DentalChart({ patient }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const navigate = useNavigate();

  const { data: patientTreatments = [] } = useQuery({
    queryKey: ['patientTreatments', patient.id],
    queryFn: () => clinicApi.filter('PatientTreatment', { patient_id: patient.id, clinic_id: clinic?.id }),
    enabled: !!clinic,
  });

  return (
    <div className="space-y-4">
      <Card className="glass border-0 shadow-lg">
        <CardHeader className="pb-2 px-4 sm:px-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">{t('dental_chart')}</CardTitle>
            <Button
              variant="outline" size="sm"
              onClick={() => navigate(`/patients/${patient.id}/treatment-plan`)}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              {t('open_full_plan')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <StaticOdontogram
            patient={patient}
            clinic={clinic}
            patientTreatments={patientTreatments}
          />
        </CardContent>
      </Card>

      {/* Treatment history */}
      <Card className="glass border-0 shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4" />
            {t('treatment_history')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patientTreatments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">
              {t('no_treatments_recorded')}
            </p>
          ) : (
            <div className="space-y-2">
              {patientTreatments.map(pt => (
                <div key={pt.id} className="flex items-start justify-between p-2.5 bg-secondary/40 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {pt.treatment_name}
                      {(pt.tooth_numbers || []).length > 0 && (
                        <span className="ml-2 text-xs text-primary font-bold">
                          #{(pt.tooth_numbers || []).join(', #')}
                        </span>
                      )}
                    </p>
                    {pt.tooth_numbers?.length > 0 && pt.tooth_surfaces?.[String(pt.tooth_numbers[0])]?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {pt.tooth_surfaces[String(pt.tooth_numbers[0])].map(s => (
                          <span key={s} className="text-[10px] bg-accent/10 text-accent px-1 rounded">{t(s)}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{pt.doctor_name || '—'} · {formatDisplayDate(pt.treatment_date, lang)}</p>
                    <p className="text-xs text-muted-foreground">{pt.price} {pt.currency} · {t('paid')}: {pt.paid_amount || 0}</p>
                    {pt.notes && <p className="text-xs italic text-muted-foreground mt-0.5">{pt.notes}</p>}
                  </div>
                  <Badge className={`text-xs ${STATUS_BADGE[pt.status] || ''} ml-2 flex-shrink-0`}>
                    {getStatusLabel(pt.status, lang)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}