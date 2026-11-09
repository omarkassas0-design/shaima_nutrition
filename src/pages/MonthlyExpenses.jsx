import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { clinicApi } from '@/lib/clinicApi';
import { toast } from 'sonner';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { roleIsClinicAdmin } from '@/lib/permissions';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, UserRound, Stethoscope, Receipt, Plus, AlertCircle, ShoppingCart, Trash2 } from 'lucide-react';
import AddExpenseDialog from '@/components/expenses/AddExpenseDialog';
import { formatMoney, formatCurrencyTotals, currencyTotalsToArray, formatPercent } from '@/lib/currencyUtils';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { getStatusLabel } from '@/lib/statusLabels';

export default function MonthlyExpenses() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const queryClient = useQueryClient();

  const { effectiveRole } = useAuth();
  const canView = roleIsClinicAdmin(effectiveRole);

  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [showAddExpense, setShowAddExpense] = useState(false);

  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ value: val, label: formatDisplayDate(d, lang, { monthOnly: true }) });
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['monthlyExpenses', clinic?.id, month],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getMonthlyExpenses', { month, clinic_id: clinic?.id });
      return res.data;
    },
    enabled: !!clinic?.id && canView,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => clinicApi.delete('Expense', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthlyExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      toast.success(t('expense_deleted'));
    },
    onError: (e) => toast.error(t('failed_to_delete') + ': ' + (e.message || '')),
  });

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
        <p className="text-lg font-semibold">{t('access_denied')}</p>
        <p className="text-sm text-muted-foreground">{t('admin_only_expenses')}</p>
      </div>
    );
  }

  const grandTotalArr = currencyTotalsToArray(data?.totals?.grand_total);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title={t('monthly_expenses')} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{t('month')}:</span>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowAddExpense(true)} className="gradient-primary text-white">
          <Plus className="w-4 h-4 mr-1" /> {t('add_expense')}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : error ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">{t('failed_to_load_expenses')}</CardContent></Card>
      ) : data ? (
        <>
          {/* Grand total — one card per currency */}
          {grandTotalArr.length === 0 ? (
            <Card className="glass border-0 shadow-lg">
              <CardContent className="p-6 text-center text-muted-foreground">{t('no_expenses_month')}</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {grandTotalArr.map(({ currency, amount, symbol }) => (
                <Card key={currency} className="glass border-0 shadow-lg overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-500 to-pink-400 opacity-[0.05] pointer-events-none" />
                  <CardContent className="p-5 relative">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground uppercase tracking-wider">{t('total_label')} — {data.monthLabel} ({currency})</p>
                        <p className="text-3xl font-bold mt-1 text-rose-600">{formatMoney(amount, currency)}</p>
                      </div>
                      <Wallet className="w-10 h-10 text-rose-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Summary breakdown — per currency */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryItem label={t('staff_salaries')} totals={data.totals.staff_salaries} />
            <SummaryItem label={t('doctor_salaries')} totals={data.totals.doctor_salaries} />
            <SummaryItem label={t('doctor_commissions_label')} totals={data.totals.doctor_commissions} />
            <SummaryItem label={t('prosthesis_lab_costs')} totals={data.totals.prosthesis_lab_costs} />
            <SummaryItem label={t('other_expenses')} totals={data.totals.other_expenses} />
            <SummaryItem label={t('purchases')} totals={data.totals.purchases} />
          </div>

          {/* Employees */}
          {data.staff.length > 0 && (
            <Card className="glass border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <UserRound className="w-4 h-4 text-primary" />{t('employees')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.staff.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/40">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{getStatusLabel(s.position, lang)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(s.salary, s.salary_currency)}</p>
                      <p className="text-xs text-muted-foreground">{t('salary_label')}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Doctors */}
          {data.doctors.length > 0 && (
            <Card className="glass border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-primary" />{t('doctors')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.doctors.map(d => (
                  <div key={d.id} className="p-3 rounded-xl bg-secondary/40">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.specialty || t('doctor_role')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatMoney(d.salary, d.salary_currency)}</p>
                        <p className="text-xs text-muted-foreground">{t('salary_label')}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span>{t('rate_label')}: <span className="bidi-iso">{formatPercent(d.commission_percentage, lang)}</span></span>
                      <span>{t('commission_label')}: {formatCurrencyTotals(d.commission_earned)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Prosthesis/Lab Costs */}
          {data.prosthesis_lab?.length > 0 && (
            <Card className="glass border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />{t('prosthesis_lab_costs')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.prosthesis_lab.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/40">
                    <div>
                      <p className="font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDisplayDate(e.expense_date, lang)}</p>
                    </div>
                    <p className="font-semibold">{formatMoney(e.amount, e.currency)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Other expenses */}
          <Card className="glass border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" />{t('other_expenses')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('no_expenses_month')}</p>
              ) : data.expenses.map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/40">
                  <div>
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDisplayDate(e.expense_date, lang)} · {e.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{formatMoney(e.amount, e.currency)}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(e.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Purchases */}
          {data.purchases?.length > 0 && (
            <Card className="glass border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-primary" />{t('purchases')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.purchases.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/40">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDisplayDate(p.purchase_date, lang)} · {p.category}{p.supplier ? ` · ${p.supplier}` : ''}</p>
                    </div>
                    <p className="font-semibold">{formatMoney(p.amount, p.currency)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Final total — per currency */}
          <Card className="glass border-0 shadow-lg bg-rose-500/5">
            <CardContent className="p-6 space-y-2">
              <p className="text-lg font-semibold">{t('total_monthly_expenses')} — {data.monthLabel}</p>
              {grandTotalArr.map(({ currency, amount, symbol }) => (
                <div key={currency} className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{currency}</p>
                  <p className="text-xl font-bold text-rose-600">{formatMoney(amount, currency)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      <AddExpenseDialog open={showAddExpense} onClose={() => setShowAddExpense(false)} month={month} />
    </div>
  );
}

function SummaryItem({ label, totals }) {
  const arr = currencyTotalsToArray(totals);
  return (
    <Card className="glass border-0 shadow">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        {arr.length === 0 ? (
          <p className="text-xl font-bold mt-1">$0</p>
        ) : (
          <div className="mt-1 space-y-0.5">
            {arr.map(({ currency, amount, symbol }) => (
              <p key={currency} className="text-lg font-bold">{formatMoney(amount, currency)} <span className="text-xs font-normal text-muted-foreground">{currency}</span></p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}