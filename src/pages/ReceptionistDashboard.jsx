import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useLanguage } from '@/lib/useLanguage';
import StatCard from '@/components/dashboard/DashboardMetric';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { Users, CalendarDays, Clock, UserPlus, Phone, CalendarCheck, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { getStatusLabel } from '@/lib/statusLabels';
import { useRoleChangeEffect } from '@/hooks/useRoleChangeEffect';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' } }),
};

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  waiting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  no_show: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export default function ReceptionistDashboard() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const navigate = useNavigate();

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['receptionistDashboard', clinic?.id],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getDashboardStats', { clinic_id: clinic?.id });
      return res.data;
    },
    enabled: !!clinic,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  useRoleChangeEffect(() => { refetch(); });

  const m = stats?.metrics || {};
  const loading = isLoading;
  const todayAppts = stats?.todayAppointments || [];
  const upcomingAppts = todayAppts.filter(a => a.status === 'scheduled' || a.status === 'confirmed');
  const toConfirm = todayAppts.filter(a => a.status === 'scheduled');
  const recentPatients = stats?.recentPatients || [];

  return (
    <div className="space-y-6 pb-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-foreground">{t('reception_desk')} 📋</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{clinic?.name || t('app_name')}</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard index={0} icon={CalendarDays} label={t('todays_appointments')} value={m.todaysAppointments} sub={`${m.todaysCompleted || 0} ${t('completed')}`} color="sky" loading={loading} onClick={() => navigate('/appointments')} />
        <StatCard index={1} icon={Clock} label={t('upcoming_appointments')} value={m.upcomingAppointments} color="violet" loading={loading} onClick={() => navigate('/appointments')} />
        <StatCard index={2} icon={Users} label={t('total_patients')} value={m.totalPatients} sub={`+${m.newPatientsThisMonth || 0} ${t('new_this_month')}`} color="teal" loading={loading} onClick={() => navigate('/patients')} />
        <StatCard index={3} icon={CalendarCheck} label={t('appointments_to_confirm')} value={toConfirm.length} color="amber" loading={loading} onClick={() => navigate('/appointments')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <Card className="glass border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" />{t('todays_appointments')}</span>
                <Badge variant="secondary">{todayAppts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {loading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />) :
                todayAppts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t('no_appointments_today')}</p>
                ) : todayAppts.map(apt => (
                  <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors">
                    <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: apt.doctor_color || '#0ea5e9' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{apt.patient_name}</p>
                      <p className="text-xs text-muted-foreground">{apt.start_time} · {apt.doctor_name}</p>
                    </div>
                    <Badge className={`text-xs ${statusColors[apt.status] || 'bg-slate-100 text-slate-700'} border-0`}>
                      {getStatusLabel(apt.status, lang)}
                    </Badge>
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
          <Card className="glass border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />{t('patient_growth')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-48 w-full" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats?.patientGrowth || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }} />
                    <Bar dataKey="patients" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
        <Card className="glass border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />{t('recent_patients')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {loading ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />) :
                recentPatients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 col-span-full">{t('no_patients')}</p>
                ) : recentPatients.map(p => (
                  <a key={p.id} href={`/patients/${p.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors group">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <span className="text-sm font-bold text-primary">{p.full_name?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.full_name}</p>
                      {p.phone ? (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Phone className="w-3 h-3" />{p.phone}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground truncate">{p.created_date ? formatDisplayDate(p.created_date, lang) : ''}</p>
                      )}
                    </div>
                  </a>
                ))
              }
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}