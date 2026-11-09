import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { canRole } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Download, Printer, Loader2 } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/currencyUtils';
import InvoiceDialog from '@/components/invoices/InvoiceDialog';
import { downloadInvoicePDF, printInvoice } from '@/lib/invoiceExport';

export default function PatientInvoices({ patient }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const canManage = canRole(effectiveRole, 'invoices:write');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['patientInvoices', patient.id],
    queryFn: () => clinicApi.filter('Invoice', { patient_id: patient.id, clinic_id: clinic?.id }, '-invoice_date'),
    enabled: !!clinic,
  });

  const voidMutation = useMutation({
    mutationFn: async (id) => clinicApi.update('Invoice', id, { status: 'void' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientInvoices'] });
      toast.success(t('voided'));
    },
  });

  const handleDownload = (inv) => downloadInvoicePDF(inv, clinic, lang);
  const handlePrint = (inv) => printInvoice(inv, clinic, lang);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{t('invoices_receipts')}</h3>
        {canManage && (
          <Button onClick={() => setShowCreate(true)} className="gradient-primary text-white" size="sm">
            <Plus className="w-4 h-4 mr-1" />{t('create_invoice')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('no_data')}
          actionLabel={canManage ? t('create_invoice') : undefined}
          onAction={canManage ? () => setShowCreate(true) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => {
            const isVoid = inv.status === 'void';
            return (
              <Card key={inv.id} className={`glass border-0 ${isVoid ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{inv.invoice_number}</span>
                        <Badge variant={inv.type === 'receipt' ? 'secondary' : 'default'} className="text-xs">
                          {inv.type === 'receipt' ? t('receipt') : t('invoice')}
                        </Badge>
                        {isVoid && <Badge variant="destructive" className="text-xs">{t('voided')}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatDisplayDate(inv.invoice_date || inv.created_date, lang)}</p>
                      {inv.totals && Object.entries(inv.totals).map(([cur, val]) => (
                        <p key={cur} className="text-xs text-muted-foreground mt-0.5">
                          {inv.type === 'receipt'
                            ? `${t('total_paid')}: ${formatMoney(val.paid || 0, cur)} ${cur}`
                            : `${t('remaining_balance')}: ${formatMoney(val.remaining || 0, cur)} ${cur}`}
                        </p>
                      ))}
                    </div>
                    {!isVoid && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(inv)} title={t('download_pdf')}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrint(inv)} title={t('print')}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 h-8"
                            disabled={voidMutation.isPending}
                            onClick={() => { if (confirm(t('confirm_delete'))) voidMutation.mutate(inv.id); }}
                          >
                            {t('void')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showCreate && <InvoiceDialog open={showCreate} onClose={() => setShowCreate(false)} patient={patient} />}
    </div>
  );
}