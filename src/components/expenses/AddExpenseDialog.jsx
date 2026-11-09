import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { getClinicId } from '@/lib/useClinicId';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/useLanguage';

export default function AddExpenseDialog({ open, onClose, month }) {
  const { t } = useLanguage();
  const { clinic } = useClinic();
  const queryClient = useQueryClient();
  const defaultDate = month ? `${month}-01` : new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    name: '', amount: '', currency: clinic?.currency || 'USD',
    expense_date: defaultDate, category: 'other', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name?.trim() || !form.amount || !form.expense_date) {
      toast.error(t('name_amount_date_required'));
      return;
    }
    setSaving(true);
    try {
      const clinicId = await getClinicId(clinic);
      await clinicApi.create('Expense', {
        name: form.name.trim(),
        amount: Number(form.amount) || 0,
        currency: form.currency,
        expense_date: form.expense_date,
        category: form.category,
        notes: form.notes || '',
        clinic_id: clinicId,
      });
      queryClient.invalidateQueries({ queryKey: ['monthlyExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['monthlyExpensesSummary'] });
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      toast.success(t('expense_added'));
      onClose();
      setForm({ name: '', amount: '', currency: clinic?.currency || 'USD', expense_date: defaultDate, category: 'other', notes: '' });
    } catch (e) {
      toast.error(t('failed_to_save') + ': ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('add_expense')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{t('name')} *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('expense_name_placeholder')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('amount')} *</Label>
              <Input type="number" min={0} step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t('currency')}</Label>
              <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="SYP">SYP</SelectItem>
                  <SelectItem value="TRY">TRY (₺)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('date')} *</Label>
              <Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('category')}</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">{t('rent')}</SelectItem>
                  <SelectItem value="utilities">{t('utilities')}</SelectItem>
                  <SelectItem value="supplies">{t('supplies')}</SelectItem>
                  <SelectItem value="equipment">{t('equipment')}</SelectItem>
                  <SelectItem value="marketing">{t('marketing')}</SelectItem>
                  <SelectItem value="insurance">{t('insurance')}</SelectItem>
                  <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
                  <SelectItem value="taxes">{t('taxes')}</SelectItem>
                  <SelectItem value="other">{t('other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-white">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}