import React from 'react';
import { useLanguage } from '@/lib/useLanguage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  waiting: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function TodayAppointments({ appointments }) {
  const { t } = useLanguage();

  return (
    <Card className="glass border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          {t('todays_appointments')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t('no_appointments')}</p>
        ) : (
          appointments.slice(0, 6).map((apt) => (
            <Link
              key={apt.id}
              to={`/appointments`}
              className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-1 h-10 rounded-full" style={{ backgroundColor: apt.doctor_color || '#0ea5e9' }} />
                <div>
                  <p className="text-sm font-medium">{apt.patient_name || t('patient')}</p>
                  <p className="text-xs text-muted-foreground">{apt.start_time} - {apt.doctor_name || t('doctor')}</p>
                </div>
              </div>
              <Badge className={`text-xs ${statusColors[apt.status] || statusColors.scheduled}`}>
                {t(apt.status)}
              </Badge>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}