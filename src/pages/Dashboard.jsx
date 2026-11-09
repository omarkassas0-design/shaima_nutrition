import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { Users, CalendarDays, CreditCard, Clock, TrendingUp, UserRound, Activity, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import MonthlyExpensesCard from '@/components/dashboard/MonthlyExpensesCard';
import MetricCard from '@/components/dashboard/DashboardMetric';
import WelcomeBanner from '@/components/dashboard/WelcomeBanner';
import { formatDisplayDate } from '@/lib/dateFormat';
import { formatCurrencyTotals, formatMoney } from '@/lib/currencyUtils';
import { getStatusLabel } from '@/lib/statusLabels';
import { useRoleChangeEffect } from '@/hooks/useRoleChangeEffect';

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' } }) };

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  waiting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  no_show: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

function SectionCard({ icon: Icon, title, badge, children, className = '', index = 0 }) {
  return (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible" className={className}>
      <Card className="border border-border/60 shadow-sm h-full">
        <CardHeader className="pb-3 px-4 sm:px-5 pt-4 sm:pt-5">
          <CardTitle className="text-sm sm:text-base font-semibold flex flex-wrap gap-2 items-center justify-between">
            <span className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              {title}
            </span>
            {badge !== undefined && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-5 pb-4 sm:pb-5">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Dashboard() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['dashboardStats', clinic?.id],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getDashboardStats', { clinic_id: clinic?.id });
      return res.data;
    },
    enabled: !!clinic,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    onError: () => { /* error shown via empty state */ },
  });

  useRoleChangeEffect(() => { refetch(); });

  const m = stats?.metrics || {};
  const loading = isLoading && !stats;

  return (
    <div className="space-y-4 pb-8">
      <WelcomeBanner clinicName={clinic?.name} />

      {/* Responsive metric cards */}
      <div className="aura-metrics">
        <MetricCard index={0} icon={Users} label={t('total_patients')} value={m.totalPatients} sub={`+${m.newPatientsThisMonth || 0} ${t('new_this_month')}`} color="sky" loading={loading} onClick={() => navigate('/patients')} />
        <MetricCard index={1} icon={CalendarDays} label={t('todays_appointments')} value={m.todaysAppointments} sub={`${m.todaysCompleted || 0} ${t('completed')}`} color="teal" loading={loading} onClick={() => navigate('/appointments')} />
        <MetricCard index={2} icon={Clock} label={t('upcoming_appointments')} value={m.upcomingAppointments} color="violet" loading={loading} onClick={() => navigate('/appointments')} />
        {stats?.canViewFinancials && (
          <MetricCard index={3} icon={CreditCard} label={t('total_revenue')} value={formatCurrencyTotals(m.revenueByCurrency)} sub={`${m.paymentCount || 0} ${t('payments')}`} color="amber" loading={loading} onClick={() => navigate('/payments')} />
        )}
        {stats?.canViewFinancials && (
          <MetricCard index={4} icon={TrendingUp} label={t('monthly_income')} value={formatCurrencyTotals(m.monthlyIncomeByCurrency)} color="teal" loading={loading} onClick={() => navigate('/payments')} />
        )}
        {stats?.canViewFinancials && ['super_admin', 'admin', 'clinic_admin'].includes(effectiveRole) && (
          <MonthlyExpensesCard index={5} />
        )}
        <MetricCard index={6} icon={UserRound} label={t('doctors')} value={m.activeDoctors} color="indigo" loading={loading} onClick={() => navigate('/doctors')} />
        {stats?.canViewFinancials && (
          <MetricCard index={7} icon={UserPlus} label={t('staff')} value={m.totalStaff} color="rose" loading={loading} onClick={() => navigate('/staff')} />
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {stats?.canViewFinancials && (
          <SectionCard icon={TrendingUp} title={t('monthly_revenue')} index={2} className="lg:col-span-2">
            {loading ? <Skeleton className="h-48 w-full rounded-lg" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats?.revenueData || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revUSD" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revSYP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revTRY" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontSize: 12 }} />
                  <Area type="monotone" dataKey="USD" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#revUSD)" />
                  <Area type="monotone" dataKey="SYP" stroke="#10b981" strokeWidth={2.5} fill="url(#revSYP)" />
                  <Area type="monotone" dataKey="TRY" stroke="#f59e0b" strokeWidth={2.5} fill="url(#revTRY)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        )}

        <SectionCard icon={Activity} title={t('patient_growth')} index={3}>
          {loading ? <Skeleton className="h-48 w-full rounded-lg" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats?.patientGrowth || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontSize: 12 }} />
                <Bar dataKey="patients" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Bottom row — Today's appointments + Recent payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard icon={CalendarDays} title={t('todays_appointments')} badge={stats?.todayAppointments?.length || 0} index={4}>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 -mr-1">
            {loading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />) :
              !stats?.todayAppointments?.length ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <CalendarDays className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground text-center">{t('no_appointments_today')}</p>
                </div>
              ) : stats.todayAppointments.map(apt => (
                <div key={apt.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors">
                  <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: apt.doctor_color || '#0ea5e9' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{apt.patient_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{apt.start_time} · {apt.doctor_name}</p>
                  </div>
                  <Badge className={`text-xs border-0 ${statusColors[apt.status] || statusColors.scheduled}`}>{getStatusLabel(apt.status, lang)}</Badge>
                </div>
              ))
            }
          </div>
        </SectionCard>

        {stats?.canViewFinancials && (
          <SectionCard icon={CreditCard} title={t('recent_payments')} badge={stats?.recentPayments?.length || 0} index={5}>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 -mr-1">
              {loading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />) :
                !stats?.recentPayments?.length ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <CreditCard className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground text-center">{t('no_payments_yet')}</p>
                  </div>
                ) : stats.recentPayments.map(pay => (
                  <div key={pay.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{formatDisplayDate(pay.payment_date || pay.created_date, lang)}</p>
                      <p className="text-xs text-muted-foreground truncate">{getStatusLabel(pay.method || 'cash', lang)}</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">+{formatMoney(pay.amount, pay.currency)}</span>
                  </div>
                ))
              }
            </div>
          </SectionCard>
        )}
      </div>

      {/* Recent patients */}
      <SectionCard icon={Users} title={t('recent_patients')} index={6}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {loading ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />) :
            (stats?.recentPatients || []).length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-6 gap-2">
                <Users className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No patients yet</p>
              </div>
            ) : (stats?.recentPatients || []).map(p => (
              <a key={p.id} href={`/patients/${p.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors group">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <span className="text-sm font-bold text-primary">{p.full_name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.phone}</p>
                </div>
              </a>
            ))
          }
        </div>
      </SectionCard>
    </div>
  );
}