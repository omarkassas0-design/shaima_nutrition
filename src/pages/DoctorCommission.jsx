import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { roleIsClinicAdmin } from '@/lib/permissions';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, TrendingUp, Users, Calculator, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/currencyUtils';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DoctorCommission() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = roleIsClinicAdmin(effectiveRole);

  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedCurrency, setSelectedCurrency] = useState(clinic?.currency || 'USD');
  const [showPayout, setShowPayout] = useState(false);
  const [selectedDoctorForPayout, setSelectedDoctorForPayout] = useState(null);

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors', clinic?.id],
    queryFn: () => clinic ? clinicApi.filter('Doctor', { clinic_id: clinic.id }) : [],
    enabled: !!clinic,
  });

  const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
  const monthEnd = endOfMonth(monthStart);
  const { data: summaryRes, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['doctorCommissionSummary', clinic?.id, selectedMonth],
    queryFn: async () => {
      if (!clinic) return { summary: [] };
      const res = await appClient.functions.invoke('getDoctorCommissionSummary', {
        date_from: format(monthStart, 'yyyy-MM-dd'),
        date_to: format(monthEnd, 'yyyy-MM-dd'),
      });
      return res.data;
    },
    enabled: !!clinic,
  });

  const commissionData = useMemo(() => (summaryRes?.summary || []).map(d => ({
    doctor_id: d.doctor_id,
    doctor_name: d.doctor_name,
    commission_percentage: d.commission_percentage,
    payments_count: d.payments_count,
    total_revenue: d.total_revenue,       // { USD, SYP, TRY }
    total_commission: d.total_commission,  // { USD, SYP, TRY }
    paid_amount: d.paid_amount,            // { USD, SYP, TRY }
    remaining: d.remaining,               // { USD, SYP, TRY }
    payments: d.payments || [],           // per-payment rows for the details table
  })), [summaryRes]);

  const filteredData = selectedDoctor === 'all' ? commissionData : commissionData.filter(d => d.doctor_id === selectedDoctor);

  // Per-currency totals across all filtered doctors — currencies never mixed
  const totalCommission = {};
  const totalPaid = {};
  const totalRemaining = {};
  filteredData.forEach(d => {
    for (const [cur, amt] of Object.entries(d.total_commission || {})) {
      totalCommission[cur] = Math.round(((totalCommission[cur] || 0) + amt) * 100) / 100;
    }
    for (const [cur, amt] of Object.entries(d.paid_amount || {})) {
      totalPaid[cur] = Math.round(((totalPaid[cur] || 0) + amt) * 100) / 100;
    }
    for (const [cur, amt] of Object.entries(d.remaining || {})) {
      totalRemaining[cur] = Math.round(((totalRemaining[cur] || 0) + amt) * 100) / 100;
    }
  });

  const chartData = commissionData
    .filter(d => (d.total_commission?.[selectedCurrency] || 0) > 0)
    .map(d => ({
      name: d.doctor_name.split(' ')[0],
      commission: d.total_commission[selectedCurrency] || 0,
    }));

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title={t('doctor_commission')} />
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {t('no_permission_financial')}
        </CardContent></Card>
      </div>
    );
  }

  const fmtCur = (totals) => formatMoney(totals?.[selectedCurrency] || 0, selectedCurrency);

  if (summaryError) {
    return (
      <div>
        <PageHeader title={t('doctor_commission')} subtitle={t('track_doctor_earnings')} />
        <Card><CardContent className="p-8 text-center space-y-2">
          <p className="font-semibold">{t('could_not_load_commission')}</p>
          <p className="text-sm text-muted-foreground">{summaryError.message || t('try_again')}</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('doctor_commission')} subtitle={t('track_doctor_earnings')} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={DollarSign} label={`${t('total_commission')} (${selectedCurrency})`} value={fmtCur(totalCommission)} color="bg-green-500" />
        <MetricCard icon={TrendingUp} label={`${t('total_paid')} (${selectedCurrency})`} value={fmtCur(totalPaid)} color="bg-blue-500" />
        <MetricCard icon={Calculator} label={`${t('remaining')} (${selectedCurrency})`} value={fmtCur(totalRemaining)} color="bg-orange-500" />
        <MetricCard icon={Users} label={t('active_doctors')} value={commissionData.filter(d => d.payments_count > 0).length.toString()} color="bg-purple-500" />
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="space-y-1">
          <Label>{t('month')}</Label>
          <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label>{t('currency')}</Label>
          <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="SYP">SYP (£S)</SelectItem>
              <SelectItem value="TRY">TRY (₺)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t('doctor')}</Label>
          <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t('all_doctors')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_doctors')}</SelectItem>
              {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle>{t('commission_by_doctor')} ({selectedCurrency})</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => formatMoney(v, selectedCurrency)} />
                <Bar dataKey="commission" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('commission_distribution')} ({selectedCurrency})</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={chartData} dataKey="commission" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {chartData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(v, selectedCurrency)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('doctor_details')}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[820px] text-sm table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[9%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead className="border-b bg-secondary/40">
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 px-3 text-start font-semibold">{t('doctor')}</th>
                  <th className="py-2.5 px-2 text-end font-semibold whitespace-nowrap">{t('payments')}</th>
                  <th className="py-2.5 px-2 text-end font-semibold leading-tight">{t('revenue')}</th>
                  <th className="py-2.5 px-2 text-end font-semibold leading-tight">{t('commission')}</th>
                  <th className="py-2.5 px-2 text-end font-semibold leading-tight">{t('paid')}</th>
                  <th className="py-2.5 px-2 text-end font-semibold leading-tight">{t('remaining')}</th>
                  <th className="py-2.5 px-2 text-start font-semibold">{t('actions')}</th>
                </tr>
                <tr className="text-[10px] text-muted-foreground">
                  <th className="pb-1 px-3" />
                  <th className="pb-1 px-2" />
                  <th className="pb-1 px-2 text-end font-normal">{selectedCurrency}</th>
                  <th className="pb-1 px-2 text-end font-normal">{selectedCurrency}</th>
                  <th className="pb-1 px-2 text-end font-normal">{selectedCurrency}</th>
                  <th className="pb-1 px-2 text-end font-normal">{selectedCurrency}</th>
                  <th className="pb-1 px-2" />
                </tr>
              </thead>
              <tbody>
                {commissionData.map((d) => {
                  const docRemaining = Math.max(0, d.remaining?.[selectedCurrency] || 0);
                  return (
                    <tr key={d.doctor_id} className="border-b last:border-0 align-middle">
                      <td className="py-2.5 px-3 font-medium truncate" title={d.doctor_name}>{d.doctor_name}</td>
                      <td className="py-2.5 px-2 text-end tabular-nums">{d.payments_count}</td>
                      <td className="py-2.5 px-2 text-end tabular-nums whitespace-nowrap">{formatMoney(d.total_revenue?.[selectedCurrency] || 0, selectedCurrency)}</td>
                      <td className="py-2.5 px-2 text-end tabular-nums whitespace-nowrap font-semibold text-green-600">{formatMoney(d.total_commission?.[selectedCurrency] || 0, selectedCurrency)}</td>
                      <td className="py-2.5 px-2 text-end tabular-nums whitespace-nowrap text-blue-600">{formatMoney(d.paid_amount?.[selectedCurrency] || 0, selectedCurrency)}</td>
                      <td className="py-2.5 px-2 text-end tabular-nums whitespace-nowrap text-orange-600">{formatMoney(docRemaining, selectedCurrency)}</td>
                      <td className="py-2.5 px-2">
                        <Button size="sm" className="whitespace-nowrap w-full" disabled={docRemaining <= 0} onClick={() => { setSelectedDoctorForPayout({ ...d, remaining: docRemaining, currency: selectedCurrency }); setShowPayout(true); }}>{t('record_payout')}</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Per-payment commission details — patient, treatment, amount, commission, currency, date */}
      <Card className="mb-6">
        <CardHeader><CardTitle>{t('commission_details')}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[760px] text-sm table-fixed">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[22%]" />
                <col className="w-[24%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead className="border-b bg-secondary/40">
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 px-3 text-start font-semibold">{t('doctor')}</th>
                  <th className="py-2.5 px-3 text-start font-semibold">{t('patient')}</th>
                  <th className="py-2.5 px-3 text-start font-semibold">{t('treatment')}</th>
                  <th className="py-2.5 px-2 text-end font-semibold">{t('amount')}</th>
                  <th className="py-2.5 px-2 text-end font-semibold">{t('commission')}</th>
                  <th className="py-2.5 px-2 text-start font-semibold">{t('date')}</th>
                </tr>
              </thead>
              <tbody>
                {commissionData.flatMap(d => (d.payments || []).map(p => ({ ...p, doctor_name: d.doctor_name, doctor_id: d.doctor_id })))
                  .filter(p => selectedDoctor === 'all' || p.doctor_id === selectedDoctor)
                  .map(p => (
                    <tr key={p.payment_id} className="border-b last:border-0">
                      <td className="py-2.5 px-3 font-medium truncate" title={p.doctor_name}>{p.doctor_name}</td>
                      <td className="py-2.5 px-3 truncate" title={p.patient_name || ''}>{p.patient_name || '—'}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground truncate" title={p.treatment_name || ''}>{p.treatment_name || '—'}</td>
                      <td className="py-2.5 px-2 text-end tabular-nums whitespace-nowrap">{formatMoney(p.amount, p.currency)}</td>
                      <td className="py-2.5 px-2 text-end font-semibold text-green-600 tabular-nums whitespace-nowrap">{formatMoney(p.commission_amount, p.currency)}</td>
                      <td className="py-2.5 px-2 text-xs text-muted-foreground whitespace-nowrap">{formatDisplayDate(p.payment_date, lang)}</td>
                    </tr>
                  ))}
                {commissionData.flatMap(d => d.payments || []).length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">{t('no_data')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PayoutDialog open={showPayout} onClose={() => setShowPayout(false)} doctor={selectedDoctorForPayout} clinic={clinic} />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${color} text-white flex items-center justify-center`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PayoutDialog({ open, onClose, doctor, clinic }) {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ amount: '', currency: 'USD', payment_date: format(new Date(), 'yyyy-MM-dd'), notes: '', period_start: '', period_end: '' });

  useEffect(() => {
    if (doctor) {
      setForm({
        amount: Math.max(0, Number(doctor.remaining) || 0).toFixed(2),
        currency: doctor.currency || 'USD',
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
        period_start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        period_end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
      });
    }
  }, [doctor]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (!data.amount || Number(data.amount) <= 0) throw new Error('Amount is required');
      const amount = Number(data.amount);
      const outstanding = Math.max(0, Number(doctor?.remaining) || 0);
      // A payout larger than the outstanding commission is what produced the
      // negative "remaining" figures. Reject it before saving.
      if (amount > outstanding + 0.001) {
        const MSG = {
          en: 'The amount exceeds the remaining commission',
          ar: 'المبلغ يتجاوز العمولة المتبقية',
          tr: 'Tutar kalan komisyonu aşıyor',
        };
        throw new Error(`${MSG[lang] || MSG.en}: ${formatMoney(outstanding, data.currency)}`);
      }
      return clinicApi.create('DoctorPayout', {
        ...data,
        amount: Number(data.amount),
        currency: data.currency,
        clinic_id: clinic.id,
        doctor_id: doctor.doctor_id,
        doctor_name: doctor.doctor_name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorCommissionSummary'] });
      toast.success(t('payout_recorded'));
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!doctor) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('record_payout')} - {doctor.doctor_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">{t('remaining_commission')}: <span className="font-bold text-orange-600">{formatMoney(doctor.remaining || 0, doctor.currency || 'USD')}</span></p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('amount')} *</Label>
              <Input type="number" min={0} step={0.01} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t('currency')}</Label>
              <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="SYP">SYP (£S)</SelectItem>
                  <SelectItem value="TRY">TRY (₺)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('payment_date')} *</Label>
            <Input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('period_start')}</Label>
              <Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('period_end')}</Label>
              <Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gradient-primary text-white">
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save_payout')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}