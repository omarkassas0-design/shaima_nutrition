import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileText, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/currencyUtils';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function genInvoiceNumber(type) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const d = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const t = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${type === 'receipt' ? 'RCP' : 'INV'}-${d}-${t}`;
}

export default function InvoiceDialog({ open, onClose, patient, presetType = 'invoice' }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    type: presetType,
    notes: '',
    selectedPaymentIds: [],
    invoice_date: format(new Date(), 'yyyy-MM-dd'),
  });

  const { data: patientTreatments = [] } = useQuery({
    queryKey: ['patientTreatments', patient?.id],
    queryFn: () => clinicApi.filter('PatientTreatment', { patient_id: patient.id, clinic_id: clinic?.id }),
    enabled: !!patient && !!clinic,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['patientPayments', patient?.id],
    queryFn: () => clinicApi.filter('Payment', { patient_id: patient.id, clinic_id: clinic?.id }, '-created_date'),
    enabled: !!patient && !!clinic,
  });

  // Map treatment IDs to treatment records for receipt enrichment
  const treatmentMap = useMemo(() => {
    const map = {};
    (patientTreatments || []).forEach(pt => { map[pt.id] = pt; });
    return map;
  }, [patientTreatments]);

  // Only completed treatments are eligible for invoicing.
  const completedTreatments = useMemo(() =>
    (patientTreatments || []).filter(pt => pt.status === 'completed'),
    [patientTreatments]
  );

  // Group completed treatments by name + tooth + currency + unit_price.
  // Treatments on different teeth are NEVER grouped together.
  const items = useMemo(() => {
    const groups = {};
    completedTreatments.forEach(pt => {
      const price = Number(pt.price) || 0;
      const disc = pt.discount_type === 'percentage'
        ? price * (Number(pt.discount_value) || 0) / 100
        : pt.discount_type === 'fixed'
          ? (Number(pt.discount_value) || 0)
          : 0;
      const unitPrice = round2(price - disc);
      const toothKey = (pt.tooth_numbers?.length > 0) ? pt.tooth_numbers[0] : 'none';
      const key = `${pt.treatment_name}||${toothKey}||${pt.currency || 'USD'}||${unitPrice}`;
      if (!groups[key]) {
        groups[key] = {
          treatment_name: pt.treatment_name || '—',
          tooth_numbers: pt.tooth_numbers || [],
          quantity: 0,
          unit_price: unitPrice,
          currency: pt.currency || 'USD',
          paid_amount: 0,
          treatment_ids: [],
          discount_type: pt.discount_type || 'none',
          discount_value: Number(pt.discount_value) || 0,
        };
      }
      groups[key].quantity += 1;
      groups[key].paid_amount = round2(groups[key].paid_amount + (Number(pt.paid_amount) || 0));
      groups[key].treatment_ids.push(pt.id);
    });
    return Object.values(groups).map(g => ({
      ...g,
      total_price: round2(g.unit_price * g.quantity),
      remaining: round2(g.total_price - g.paid_amount),
    }));
  }, [completedTreatments]);

  // Totals per currency (aggregate: due - paid = remaining).
  const totals = useMemo(() => {
    const result = {};
    items.forEach(item => {
      const cur = item.currency;
      if (!result[cur]) result[cur] = { due: 0, paid: 0, remaining: 0 };
      result[cur].due = round2(result[cur].due + item.total_price);
      result[cur].paid = round2(result[cur].paid + item.paid_amount);
    });
    // For receipts: only count selected payments
    if (form.type === 'receipt') {
      const selectedPayments = payments.filter(p => form.selectedPaymentIds.includes(p.id));
      Object.keys(result).forEach(cur => { result[cur] = { due: 0, paid: 0, remaining: 0 }; });
      selectedPayments.forEach(p => {
        const cur = p.currency || 'USD';
        if (!result[cur]) result[cur] = { due: 0, paid: 0, remaining: 0 };
        result[cur].paid = round2(result[cur].paid + (Number(p.amount) || 0));
      });
    }
    Object.keys(result).forEach(cur => {
      result[cur].remaining = round2(result[cur].due - result[cur].paid);
    });
    return result;
  }, [items, payments, form.type, form.selectedPaymentIds]);

  const paymentsSnapshot = useMemo(() => {
    if (form.type !== 'receipt') return [];
    return payments
      .filter(p => form.selectedPaymentIds.includes(p.id))
      .map(p => {
        const pt = treatmentMap[p.patient_treatment_id];
        return {
          payment_id: p.id,
          amount: Number(p.amount) || 0,
          currency: p.currency || 'USD',
          method: p.method || 'cash',
          payment_date: p.payment_date || '',
          treatment_name: pt?.treatment_name || '',
          tooth_number: pt?.tooth_numbers?.[0] || null,
          notes: p.notes || '',
        };
      });
  }, [payments, form.type, form.selectedPaymentIds, treatmentMap]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clinic?.id) throw new Error('Clinic not set up');
      const invoiceNumber = genInvoiceNumber(form.type);
      const record = {
        patient_id: patient.id,
        patient_name: patient.full_name,
        invoice_number: invoiceNumber,
        invoice_date: form.invoice_date,
        type: form.type,
        items: form.type === 'invoice' ? items : [],
        payment_ids: form.type === 'receipt' ? form.selectedPaymentIds : [],
        payments_snapshot: paymentsSnapshot,
        totals,
        notes: form.notes || '',
        status: 'active',
      };
      return clinicApi.create('Invoice', record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['clinicInvoices'] });
      toast.success(t('invoice_created'));
      onClose();
      setForm({ type: presetType, notes: '', selectedPaymentIds: [], invoice_date: format(new Date(), 'yyyy-MM-dd') });
    },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + (e?.message || '')),
  });

  const togglePayment = (id) => {
    setForm(f => ({
      ...f,
      selectedPaymentIds: f.selectedPaymentIds.includes(id)
        ? f.selectedPaymentIds.filter(x => x !== id)
        : [...f.selectedPaymentIds, id],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('create_invoice')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Type selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, type: 'invoice' }))}
              className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${form.type === 'invoice' ? 'border-primary bg-primary/5' : 'border-input'}`}
            >
              <FileText className="w-5 h-5" />
              <span className="text-sm font-medium">{t('invoice')}</span>
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, type: 'receipt' }))}
              className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${form.type === 'receipt' ? 'border-primary bg-primary/5' : 'border-input'}`}
            >
              <Receipt className="w-5 h-5" />
              <span className="text-sm font-medium">{t('receipt')}</span>
            </button>
          </div>

          <div className="space-y-2">
            <Label>{t('invoice_date')}</Label>
            <Input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
          </div>

          {form.type === 'invoice' ? (
            <div className="space-y-2">
              <Label>{t('all_completed_treatments')}</Label>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted">{t('no_completed_treatments')}</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {items.map((item, i) => (
                    <div key={i} className="p-2 rounded-lg bg-muted/50 text-sm space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {item.tooth_numbers?.length > 0 && (
                            <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded flex-shrink-0">
                              #{item.tooth_numbers[0]}
                            </span>
                          )}
                          <span className="truncate">{item.treatment_name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">×{item.quantity}</span>
                        </div>
                        <span className="text-muted-foreground flex-shrink-0">
                          {formatMoney(item.total_price, item.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground pl-1">
                        <span>{t('unit_price')}: {formatMoney(item.unit_price, item.currency)}</span>
                        <span>{t('paid_amount')}: {formatMoney(item.paid_amount, item.currency)}</span>
                        <span>{t('remaining')}: {formatMoney(item.remaining, item.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t('select_payments')}</Label>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted">{t('no_data')}</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {payments.map(p => {
                    const pt = treatmentMap[p.patient_treatment_id];
                    return (
                      <label key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={form.selectedPaymentIds.includes(p.id)}
                          onCheckedChange={() => togglePayment(p.id)}
                        />
                        <span className="text-sm flex-1 min-w-0">
                          <span className="block">{formatDisplayDate(p.payment_date, lang)} — {t(p.method) || p.method}</span>
                          {pt && (
                            <span className="text-xs text-muted-foreground block">
                              {pt.treatment_name}
                              {pt.tooth_numbers?.[0] ? ` · #${pt.tooth_numbers[0]}` : ''}
                            </span>
                          )}
                        </span>
                        <span className="text-sm font-medium flex-shrink-0">
                          {formatMoney(p.amount || 0, p.currency)} {p.currency}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Totals preview */}
          {Object.keys(totals).length > 0 && (
            <div className="p-3 rounded-lg bg-muted space-y-1">
              {Object.entries(totals).map(([cur, val]) => (
                <div key={cur} className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">{cur}</p>
                  {form.type === 'invoice' && (
                    <>
                      <div className="flex justify-between text-sm"><span>{t('total_due')}</span><span>{formatMoney(val.due || 0, cur)}</span></div>
                      <div className="flex justify-between text-sm"><span>{t('total_paid')}</span><span>{formatMoney(val.paid || 0, cur)}</span></div>
                      <div className="flex justify-between text-sm font-semibold"><span>{t('remaining_balance')}</span><span>{formatMoney(val.remaining || 0, cur)}</span></div>
                    </>
                  )}
                  {form.type === 'receipt' && (
                    <div className="flex justify-between text-sm font-semibold"><span>{t('total_paid')}</span><span>{formatMoney(val.paid || 0, cur)}</span></div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || (form.type === 'invoice' && items.length === 0) || (form.type === 'receipt' && form.selectedPaymentIds.length === 0)}
              className="gradient-primary text-white"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}