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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Printer, Loader2, Search } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/currencyUtils';
import { downloadInvoicePDF, printInvoice } from '@/lib/invoiceExport';

export default function Invoices() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const canManage = canRole(effectiveRole, 'invoices:write');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['clinicInvoices', clinic?.id],
    queryFn: () => clinicApi.filter('Invoice', { clinic_id: clinic?.id }, '-invoice_date'),
    enabled: !!clinic,
  });

  const voidMutation = useMutation({
    mutationFn: async (id) => clinicApi.update('Invoice', id, { status: 'void' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinicInvoices'] });
      toast.success(t('voided'));
    },
  });

  const filtered = invoices.filter(inv => {
    if (typeFilter !== 'all' && inv.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (inv.patient_name || '').toLowerCase().includes(q) || (inv.invoice_number || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('invoices_receipts')}</h1>
        <p className="text-sm text-muted-foreground">{clinic?.name}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search')}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            <SelectItem value="invoice">{t('invoice')}</SelectItem>
            <SelectItem value="receipt">{t('receipt')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title={t('no_data')} />
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => {
            const isVoid = inv.status === 'void';
            return (
              <Card key={inv.id} className={`glass border-0 ${isVoid ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/patients/${inv.patient_id}`)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{inv.invoice_number}</span>
                        <Badge variant={inv.type === 'receipt' ? 'secondary' : 'default'} className="text-xs">
                          {inv.type === 'receipt' ? t('receipt') : t('invoice')}
                        </Badge>
                        {isVoid && <Badge variant="destructive" className="text-xs">{t('voided')}</Badge>}
                      </div>
                      <p className="text-sm text-foreground mt-1">{inv.patient_name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{formatDisplayDate(inv.invoice_date, lang)}</p>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadInvoicePDF(inv, clinic, lang)} title={t('download_pdf')}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => printInvoice(inv, clinic, lang)} title={t('print')}>
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
    </div>
  );
}