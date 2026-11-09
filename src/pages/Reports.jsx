import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { FileDown, FileSpreadsheet, Printer, TrendingUp, TrendingDown, Wallet, ShoppingCart, FlaskConical, DollarSign, AlertCircle } from 'lucide-react';
import { formatCurrencyTotals, currencyTotalsToArray, formatMoney } from '@/lib/currencyUtils';
import { downloadReportPDF, exportReportExcel, printReport } from '@/lib/reportExport';
import DoctorPerformanceDetails from '@/components/reports/DoctorPerformanceDetails';

const COLORS = ['#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

function TotalsCard({ label, totals, icon: Icon, tone }) {
  const arr = currencyTotalsToArray(totals);
  const toneClass = {
    green: 'text-emerald-600',
    red: 'text-rose-600',
    blue: 'text-sky-600',
    amber: 'text-amber-600',
    violet: 'text-violet-600',
  }[tone] || 'text-foreground';
  return (
    <Card className="glass border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <Icon className={`w-5 h-5 ${toneClass}`} />
        </div>
        {arr.length === 0 ? (
          <p className="text-xl font-bold">0</p>
        ) : (
          <div className="space-y-0.5">
            {arr.map(({ currency, amount, symbol }) => (
              <p key={currency} className="text-lg font-bold">{formatMoney(amount, currency)} <span className="text-xs font-normal text-muted-foreground">{currency}</span></p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryBreakdownTable({ data }) {
  const { t } = useLanguage();
  const entries = Object.entries(data || {});
  if (entries.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">{t('no_data')}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">{t('category')}</th>
            <th className="py-2 text-right">{t('amount')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([cat, totals]) => (
            <tr key={cat} className="border-b last:border-0">
              <td className="py-2 pr-4 font-medium capitalize">{cat}</td>
              <td className="py-2 text-right font-semibold">{formatCurrencyTotals(totals)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartCard({ title, children, height = 320 }) {
  return (
    <Card className="glass border-0 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="w-full" style={{ height }}>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(now.toISOString().split('T')[0]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['reportsStats', clinic?.id, dateFrom, dateTo],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getReportsStats', { clinic_id: clinic?.id, date_from: dateFrom, date_to: dateTo });
      return res.data;
    },
    enabled: !!clinic,
  });

  const canViewFinancials = stats?.canViewFinancials;

  const clinicInfo = clinic ? { address: clinic.address, phone: clinic.phone, email: clinic.email, logo_url: clinic.logo_url } : null;
  const handlePDF = () => downloadReportPDF(stats, clinic?.name, clinicInfo, lang);
  const handleExcel = async () => { await exportReportExcel(stats, clinic?.name, clinicInfo, lang); };
  const handlePrint = () => printReport(stats, clinic?.name, clinicInfo, lang);

  const defaultTab = canViewFinancials ? 'overview' : 'doctors';

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title={t('reports')} subtitle={`${dateFrom} → ${dateTo}`} />

      {/* Filters + export */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between flex-wrap">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('from')}</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('to')}</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-44" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handlePDF} disabled={isLoading || !stats}>
            <FileDown className="w-4 h-4 mr-2" />{t('download_pdf')}
          </Button>
          <Button variant="outline" onClick={handleExcel} disabled={isLoading || !stats}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />{t('export_excel')}
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={isLoading || !stats}>
            <Printer className="w-4 h-4 mr-2" />{t('print')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : !stats ? null : (
        <>
          {/* Financial overview cards */}
          {canViewFinancials && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <TotalsCard label={t('revenue')} totals={stats.totals.revenue} icon={TrendingUp} tone="green" />
              <TotalsCard label={t('expenses')} totals={stats.totals.expenses} icon={TrendingDown} tone="red" />
              <TotalsCard label={t('purchases')} totals={stats.totals.purchases} icon={ShoppingCart} tone="blue" />
              <TotalsCard label={t('lab_costs')} totals={stats.totals.labCosts} icon={FlaskConical} tone="amber" />
              <TotalsCard label={t('commissions')} totals={stats.totals.commissions} icon={DollarSign} tone="violet" />
              <TotalsCard label={t('doctor_payouts')} totals={stats.totals.payouts} icon={Wallet} tone="red" />
              <TotalsCard label={t('outstanding')} totals={stats.totals.outstanding} icon={AlertCircle} tone="amber" />
              <TotalsCard label={t('net_profit')} totals={stats.totals.netProfit} icon={TrendingUp} tone="green" />
            </div>
          )}

          <Tabs defaultValue={defaultTab} className="space-y-4">
            <TabsList className="flex-wrap h-auto">
              {canViewFinancials && <TabsTrigger value="overview">{t('overview')}</TabsTrigger>}
              {canViewFinancials && <TabsTrigger value="revenue">{t('revenue_report')}</TabsTrigger>}
              <TabsTrigger value="doctors">{t('doctor_performance')}</TabsTrigger>
              <TabsTrigger value="treatments">{t('treatment_report')}</TabsTrigger>
              <TabsTrigger value="appointments">{t('appointment_report')}</TabsTrigger>
              <TabsTrigger value="patients">{t('patient_growth_report')}</TabsTrigger>
              {canViewFinancials && <TabsTrigger value="expenses">{t('expenses')}</TabsTrigger>}
              {canViewFinancials && <TabsTrigger value="outstanding">{t('outstanding_balances')}</TabsTrigger>}
            </TabsList>

            {canViewFinancials && (
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title={t('revenue_trend')}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.revenueData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="USD" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="SYP" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="TRY" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="EUR" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard title={t('payment_methods')}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.paymentMethodStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                          {stats.paymentMethodStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </TabsContent>
            )}

            {canViewFinancials && (
              <TabsContent value="revenue">
                <ChartCard title={t('revenue_report')} height={380}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="USD" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="SYP" fill="#10b981" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="TRY" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="EUR" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </TabsContent>
            )}

            <TabsContent value="doctors" className="space-y-4">
              <ChartCard title={t('doctor_performance')} height={380}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.doctorPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="appointments" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="treatments" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <DoctorPerformanceDetails doctorDetails={stats.doctorDetails} />
            </TabsContent>

            <TabsContent value="treatments">
              <ChartCard title={t('treatment_report')} height={380}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.treatmentStats} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={130} label>
                      {stats.treatmentStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </TabsContent>

            <TabsContent value="appointments">
              <ChartCard title={t('appointment_report')} height={380}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.appointmentStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={130} label>
                      {stats.appointmentStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </TabsContent>

            <TabsContent value="patients" className="space-y-4">
              <ChartCard title={t('patient_growth_report')} height={380}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.patientGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="new" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title={t('patient_source_analytics')} height={320}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(stats.patientSourceStats || []).map(s => ({ name: s.name === 'doctor' ? t('source_doctor') : t('source_clinic'), value: s.value }))}
                      dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={130} label
                    >
                      {COLORS.slice(0, 2).map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </TabsContent>

            {canViewFinancials && (
              <TabsContent value="expenses" className="space-y-4">
                <Card className="glass border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-base">{t('expenses_by_category')}</CardTitle></CardHeader>
                  <CardContent>
                    <CategoryBreakdownTable data={stats.expenseByCategory} />
                  </CardContent>
                </Card>
                <Card className="glass border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-base">{t('purchases_by_category')}</CardTitle></CardHeader>
                  <CardContent>
                    <CategoryBreakdownTable data={stats.purchaseByCategory} />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {canViewFinancials && (
              <TabsContent value="outstanding">
                <Card className="glass border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-base">{t('outstanding_balances')}</CardTitle></CardHeader>
                  <CardContent>
                    {stats.outstandingBalances.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">{t('no_outstanding_balances')}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="py-2 pr-4">{t('patient')}</th>
                              <th className="py-2 text-right">{t('amount_owed')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.outstandingBalances.map(o => (
                              <tr key={o.patient_id} className="border-b last:border-0">
                                <td className="py-2 pr-4 font-medium">{o.patient_name}</td>
                                <td className="py-2 text-right font-semibold">{formatCurrencyTotals(o.totals)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}