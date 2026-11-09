import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { deleteWithUndo } from '@/lib/undoDelete';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ServerPagination from '@/components/shared/ServerPagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreditCard, Search, Pencil, Trash2 } from 'lucide-react';
import AddPaymentDialog from '@/components/payments/AddPaymentDialog';
import { motion } from 'framer-motion';
import { formatCurrencyTotals, formatNumber, formatPercent } from '@/lib/currencyUtils';
import { getStatusLabel } from '@/lib/statusLabels';
import { clinicApi } from '@/lib/clinicApi';

export default function Payments() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();

  const canManagePayments = ['super_admin', 'clinic_admin', 'receptionist'].includes(effectiveRole);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Server-side paginated payments
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['paginatedPayments', clinic?.id, page, pageSize, debouncedSearch, dateFrom, dateTo],
    queryFn: async () => {
      if (!clinic) return { records: [], has_more: false };
      const filters = {};
      if (dateFrom || dateTo) {
        filters.payment_date = {};
        if (dateFrom) filters.payment_date.$gte = dateFrom;
        if (dateTo) filters.payment_date.$lte = dateTo;
      }
      const res = await appClient.functions.invoke('getPaginatedRecords', {
        entity: 'payments',
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        filters,
        clinic_id: clinic?.id,
      });
      return res.data;
    },
    enabled: !!clinic?.id,
    keepPreviousData: true,
  });

  // Fetch patient names for display (limited set for current page)
  const payments = data?.records || [];
  const patientIds = [...new Set(payments.map(p => p.patient_id))];

  const { data: patients = [] } = useQuery({
    queryKey: ['patientsForPayments', clinic?.id, JSON.stringify(patientIds)],
    queryFn: () => {
      if (!clinic || patientIds.length === 0) return [];
      // Fetch only the patients needed for the current page
      return clinicApi.filter('Patient', { id: { $in: patientIds } }, 'full_name', 100);
    },
    enabled: !!clinic?.id && patientIds.length > 0,
  });

  const patientMap = Object.fromEntries(patients.map(p => [p.id, p]));

  const handleDelete = (p) => deleteWithUndo('Payment', p, 'Payment', () => {
    queryClient.invalidateQueries({ queryKey: ['paginatedPayments'] });
  });

  const filtered = payments;
  const totalByCurrency = {};
  filtered.forEach(p => {
    const cur = p.currency || 'USD';
    totalByCurrency[cur] = Math.round(((totalByCurrency[cur] || 0) + (p.amount || 0)) * 100) / 100;
  });

  if (!canManagePayments) {
    return (
      <div>
        <PageHeader title={t('payments')} />
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {t('no_permission_payments')}
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('payments')}
        subtitle={`${t('total')}: ${formatCurrencyTotals(totalByCurrency)}`}
        actionLabel={t('add_payment')}
        onAction={() => { setEditing(null); setShowForm(true); }}
      />

      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className="pl-10 rtl:pl-4 rtl:pr-10" />
        </div>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="max-w-xs" />
        <span className="text-muted-foreground text-sm">{t('to')}</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="max-w-xs" />
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={CreditCard} title={t('no_payments_found')} actionLabel={t('add_payment')} onAction={() => setShowForm(true)} />
      ) : (
        <>
          <div className="space-y-2">
            {filtered.map((p, i) => {
              const patient = patientMap[p.patient_id];
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}>
                  <Card className="glass border-0">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{patient?.full_name || t('patient')}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.doctor_name ? `${t('doctor')} ${p.doctor_name} · ` : ''}{getStatusLabel(p.method, lang)} · {formatDisplayDate(p.payment_date || p.created_date, lang)}
                          </p>
                          {p.doctor_commission_amount > 0 && (
                            <p className="text-xs text-emerald-600 mt-0.5">
              {t('commission')}: <span className="bidi-iso">{formatNumber(p.doctor_commission_amount, lang)} {p.currency}</span> (<span className="bidi-iso">{formatPercent(p.doctor_commission_percentage, lang)}</span>)
                            </p>
                          )}
                          {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-primary">{formatNumber(p.amount)} {p.currency}</p>
                          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => { setEditing(p); setShowForm(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive"
                            onClick={() => handleDelete(p)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <ServerPagination
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={(s) => { setPageSize(s); setPage(0); }}
            nextPage={() => data?.has_more && setPage(p => p + 1)}
            prevPage={() => setPage(p => Math.max(0, p - 1))}
            hasMore={data?.has_more || false}
            hasPrev={page > 0}
            isLoading={isFetching}
          />
        </>
      )}

      <AddPaymentDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        editing={editing}
      />
    </div>
  );
}