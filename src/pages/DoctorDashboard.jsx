import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Users, CalendarDays, Stethoscope, TestTube, Clock } from 'lucide-react';
import DoctorMetricCard from '@/components/doctor/DoctorMetricCard';
import DoctorEarningsCard from '@/components/doctor/DoctorEarningsCard';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { getStatusLabel } from '@/lib/statusLabels';
import { useRoleChangeEffect } from '@/hooks/useRoleChangeEffect';

const STATUS_STYLES = {
  scheduled: 'bg-sky-100 text-sky-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  waiting: 'bg-amber-100 text-amber-700',
  completed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-red-100 text-red-700',
  sent: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-amber-100 text-amber-700',
  ready: 'bg-emerald-100 text-emerald-700',
};

export default function DoctorDashboard() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['doctorDashboard', user?.id],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getDoctorDashboard', {});
      return res.data;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  // Immediately refetch doctor dashboard metrics when the user's role changes.
  useRoleChangeEffect(() => { refetch(); });

  if (error) {
    return (
      <Card className="max-w-lg mx-auto mt-10">
        <CardContent className="p-6 text-center space-y-2">
          <p className="font-semibold">{t('could_not_load_dashboard')}</p>
          <p className="text-sm text-muted-foreground">{t('refresh_or_contact')}</p>
        </CardContent>
      </Card>
    );
  }

  if (data && data.linked === false) {
    return (
      <Card className="max-w-lg mx-auto mt-10">
        <CardContent className="p-6 text-center space-y-2">
          <Stethoscope className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="font-semibold">{t('no_doctor_profile')}</p>
          <p className="text-sm text-muted-foreground">{data.message}</p>
        </CardContent>
      </Card>
    );
  }

  const m = data?.metrics || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            {isLoading ? <Skeleton className="h-8 w-48" /> : `${t('dr_prefix')} ${data?.doctor?.name || ''}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data?.doctor?.specialty || t('your_clinical_overview')}
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Eye className="w-3.5 h-3.5" /> {t('view_only_access')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DoctorMetricCard
          icon={CalendarDays} label={t('todays_appointments')} isLoading={isLoading}
          value={m.todaysAppointmentCount ?? 0}
          hint={`${m.todaysCompleted ?? 0} ${t('completed')}`}
        />
        <DoctorMetricCard
          icon={Clock} label={t('upcoming_appointments')} isLoading={isLoading}
          value={m.upcomingCount ?? 0} accent="bg-amber-500/10 text-amber-600"
        />
        <DoctorMetricCard
          icon={Users} label={t('my_patients')} isLoading={isLoading}
          value={m.totalPatients ?? 0} accent="bg-emerald-500/10 text-emerald-600"
        />
        <DoctorMetricCard
          icon={TestTube} label={t('active_cases')} isLoading={isLoading}
          value={m.activeLabCaseCount ?? 0} accent="bg-violet-500/10 text-violet-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('today_schedule')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <Skeleton className="h-20 w-full" />}
            {!isLoading && (data?.todaysAppointments?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('no_appointments_today_schedule')}</p>
            )}
            {data?.todaysAppointments?.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.patient_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.start_time}{a.end_time ? ` – ${a.end_time}` : ''}
                    {a.treatment_name ? ` · ${a.treatment_name}` : ''}
                    {a.treatment_room ? ` · ${t('room_label')} ${a.treatment_room}` : ''}
                    </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[a.status] || 'bg-slate-100 text-slate-700'}`}>
                    {getStatusLabel(a.status, lang)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {isLoading ? <Skeleton className="h-64 w-full" /> : <DoctorEarningsCard financials={data?.financials || {}} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('upcoming_appointments')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!isLoading && (data?.upcomingAppointments?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('nothing_upcoming')}</p>
            )}
            {data?.upcomingAppointments?.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{a.patient_name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{formatDisplayDate(a.date, lang)} · {a.start_time}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('my_lab_cases')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!isLoading && (data?.activeLabCases?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('no_active_lab_cases')}</p>
            )}
            {data?.activeLabCases?.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{c.patient_name} · {c.case_type}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.lab_name}{c.due_date ? ` · ${t('due_label')} ${formatDisplayDate(c.due_date, lang)}` : ''}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[c.status] || 'bg-slate-100 text-slate-700'}`}>
                  {getStatusLabel(c.status, lang)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('my_treatment_plans')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!isLoading && (data?.treatmentPlans?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('no_treatment_plans_assigned')}</p>
          )}
          {data?.treatmentPlans?.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-3 text-sm border-b border-border last:border-0 pb-2 last:pb-0">
              <div className="min-w-0">
                <p className="truncate">{t.patient_name}</p>
                <p className="text-xs text-muted-foreground truncate">{t.treatment_name}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[t.status] || 'bg-slate-100 text-slate-700'}`}>
                {getStatusLabel(t.status, lang)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}