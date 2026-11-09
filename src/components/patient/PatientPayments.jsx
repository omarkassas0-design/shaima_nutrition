import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { canRole } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, CreditCard, Trash2, FileText } from 'lucide-react';
import AddPaymentDialog from '@/components/payments/AddPaymentDialog';
import InvoiceDialog from '@/components/invoices/InvoiceDialog';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { formatCurrencyTotals, formatNumber } from '@/lib/currencyUtils';
import { getStatusLabel } from '@/lib/statusLabels';

export default function PatientPayments({ patient }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const canManagePayments = canRole(effectiveRole, 'payments:write');

  const { data: payments = [] } = useQuery({
    queryKey: ['patientPayments', patient.id],
    queryFn: () => clinicApi.filter('Payment', { patient_id: patient.id, clinic_id: clinic?.id }, '-created_date'),
    enabled: !!clinic,
  });

  const deleteMutation = useMutation({
    mutationFn: async (paymentId) => appClient.functions.invoke('savePayment', { action: 'delete', payment_id: paymentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientPayments'] });
      queryClient.invalidateQueries({ queryKey: ['patientTreatments'] });
      queryClient.invalidateQueries({ queryKey: ['paginatedPayments'] });
      queryClient.invalidateQueries({ queryKey: ['doctorCommissionSummary'] });
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      toast.success(t('deleted_success'));
    },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + (e?.message || '')),
  });

  const totalByCurrency = {};
  payments.forEach(p => {
    const cur = p.currency || 'USD';
    totalByCurrency[cur] = Math.round(((totalByCurrency[cur] || 0) + (p.amount || 0)) * 100) / 100;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{t('payment_history')}</h3>
          <p className="text-sm text-muted-foreground">{t('total')}: {formatCurrencyTotals(totalByCurrency)}</p>
        </div>
        {canManagePayments && (
          <div className="flex gap-2">
            <Button onClick={() => setShowInvoice(true)} variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-1" />{t('create_invoice')}
            </Button>
            <Button onClick={() => setShowAdd(true)} className="gradient-primary text-white" size="sm">
              <Plus className="w-4 h-4 mr-1" />{t('add_payment')}
            </Button>
          </div>
        )}
      </div>

      {payments.length === 0 ? (
        <EmptyState icon={CreditCard} title={t('no_data')} actionLabel={canManagePayments ? t('add_payment') : undefined} onAction={canManagePayments ? () => setShowAdd(true) : undefined} />
      ) : (
        <div className="space-y-2">
          {payments.map(p => (
            <Card key={p.id} className="glass border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{formatNumber(p.amount)} {p.currency}</p>
                    <p className="text-xs text-muted-foreground">{getStatusLabel(p.method, lang)} • {formatDisplayDate(p.payment_date || p.created_date, lang)}</p>
                    {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                  </div>
                  {canManagePayments && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 h-8 w-8"
                      disabled={deleteMutation.isPending}
                      onClick={() => { if (confirm(t('confirm_delete'))) deleteMutation.mutate(p.id); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddPaymentDialog open={showAdd} onClose={() => setShowAdd(false)} fixedPatient={patient} />
      {showInvoice && <InvoiceDialog open={showInvoice} onClose={() => setShowInvoice(false)} patient={patient} />}
    </div>
  );
}