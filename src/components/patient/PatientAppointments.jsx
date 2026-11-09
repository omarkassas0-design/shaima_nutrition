import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { roleIsDoctor } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import { getStatusLabel } from '@/lib/statusLabels';

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  waiting: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function PatientAppointments({ patient }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const doctorView = roleIsDoctor(effectiveRole);

  const { data: appointments = [] } = useQuery({
    queryKey: ['patientAppointments', patient.id],
    queryFn: () => clinicApi.filter('Appointment', { patient_id: patient.id, clinic_id: clinic?.id }, '-date'),
    enabled: !!clinic,
  });

  if (appointments.length === 0) {
    return <EmptyState icon={CalendarDays} title={t('no_appointments')} />;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  return (
    <div className="space-y-2">
      {appointments.map(apt => {
        const isMissed = apt.status !== 'completed' && apt.status !== 'cancelled' && apt.date < todayStr;
        return (
        <Card key={apt.id} className={`glass border-0 ${isMissed ? 'opacity-75' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{formatDisplayDate(apt.date, lang)}</p>
                  <span className="text-sm text-muted-foreground">{apt.start_time} - {apt.end_time}</span>
                  {isMissed ? (
                    <Badge className="text-xs bg-orange-100 text-orange-700">{t('missed')}</Badge>
                  ) : (
                    <Badge className={`text-xs ${statusColors[apt.status]}`}>{getStatusLabel(apt.status, lang)}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t('doctor')}: {apt.doctor_name}</p>
                {apt.notes && <p className="text-xs text-muted-foreground">{apt.notes}</p>}
              </div>
              {!doctorView && patient.phone && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="w-8 h-8"
                    onClick={() => window.open(`https://wa.me/${patient.phone?.replace(/[^0-9]/g, '')}`, '_blank')}>
                    <MessageCircle className="w-4 h-4 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8"
                    onClick={() => window.open(`tel:${patient.phone}`)}>
                    <Phone className="w-4 h-4 text-primary" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}