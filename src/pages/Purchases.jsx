import React, { useState } from 'react';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import { getClinicId } from '@/lib/useClinicId';
import { formatMoney, currencyTotalsToArray } from '@/lib/currencyUtils';
import { roleIsClinicAdmin, roleIsReadOnly } from '@/lib/permissions';
import PageHeader from '@/components/shared/PageHeader';
import ServerPagination from '@/components/shared/ServerPagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ShoppingCart, Pencil, Trash2, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';

const emptyForm = (currency) => ({
  name: '', category: 'supplies', supplier: '', quantity: 1, unit: '',
  amount: '', currency: currency || 'USD', purchase_date: new Date().toISOString().split('T')[0], notes: '',
});

export default function Purchases() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const CATEGORIES = [
    { value: 'supplies', label: t('supplies') },
    { value: 'equipment', label: t('equipment') },
    { value: 'instruments', label: t('instruments') },
    { value: 'medication', label: t('medication') },
    { value: 'office', label: t('office') },
    { value: 'other', label: t('other') },
  ];
  const { effectiveRole } = useAuth();
  const canManage = roleIsClinicAdmin(effectiveRole) || effectiveRole === 'receptionist';
  const readOnly = roleIsReadOnly(effectiveRole) || !canManage;

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm(clinic?.currency));
  const [saving, setSaving] = useState(false);

  const {
    records, page, setPage, pageSize, setPageSize, hasMore, hasPrev,
    isLoading, isFetching, search, setSearch, refetch,
  } = usePaginatedQuery('purchases', { pageSize: 20, sort: '-purchase_date' });

  // Totals across the loaded page (currency-separated)
  const totals = {};
  records.forEach(r => {
    const c = r.currency || 'USD';
    totals[c] = (totals[c] || 0) + (Number(r.amount) || 0);
  });
  const totalsArr = currencyTotalsToArray(totals);

  const openAdd = () => { setEditing(null); setForm(emptyForm(clinic?.currency)); setShowDialog(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      name: r.name || '', category: r.category || 'supplies', supplier: r.supplier || '',
      quantity: r.quantity ?? 1, unit: r.unit || '', amount: String(r.amount ?? ''),
      currency: r.currency || 'USD', purchase_date: r.purchase_date || '', notes: r.notes || '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim() || !form.amount || !form.purchase_date) {
      toast.error(t('name_amount_date_required'));
      return;
    }
    setSaving(true);
    try {
      const clinicId = await getClinicId(clinic);
      const payload = {
        name: form.name.trim(),
        category: form.category,
        supplier: form.supplier || '',
        quantity: Number(form.quantity) || 1,
        unit: form.unit || '',
        amount: Number(form.amount) || 0,
        currency: form.currency,
        purchase_date: form.purchase_date,
        notes: form.notes || '',
        clinic_id: clinicId,
      };
      if (editing) {
        await clinicApi.update('Purchase', editing.id, payload);
        toast.success(t('updated_success'));
      } else {
        await clinicApi.create('Purchase', payload);
        toast.success(t('created_success'));
      }
      setShowDialog(false);
      refetch();
    } catch (e) {
      toast.error(t('failed_to_save') + ': ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r) => {
    if (!confirm(t('delete_confirm_name').replace('{name}', r.name))) return;
    try {
      await clinicApi.delete('Purchase', r.id);
      toast.success(t('deleted_success'));
      refetch();
    } catch (e) {
      toast.error(t('failed_to_save') + ': ' + (e.message || ''));
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title={t('purchases')}
        subtitle={t('clinic_supplies_inventory')}
        actionLabel={t('add_purchase')}
        onAction={openAdd}
      />

      {/* Totals */}
      {totalsArr.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {totalsArr.map(({ currency, amount, symbol }) => (
            <Card key={currency} className="glass border-0 shadow-lg">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('page_total')} ({currency})</p>
                  <p className="text-2xl font-bold mt-1">{formatMoney(amount, currency)}</p>
                </div>
                <Package className="w-8 h-8 text-primary/60" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('search_purchases')}
          className="pl-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : records.length === 0 ? (
        <Card className="glass border-0 shadow-lg">
          <CardContent className="p-10 text-center text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>{t('no_purchases_recorded')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {records.map(r => (
              <Card key={r.id} className="glass border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{r.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{t(r.category) !== r.category ? t(r.category) : r.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDisplayDate(r.purchase_date, lang)}
                      {r.supplier && ` · ${r.supplier}`}
                      {r.quantity > 1 && ` · ${r.quantity} ${r.unit || t('unit')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold whitespace-nowrap">{formatMoney(r.amount, r.currency)}</p>
                    {!readOnly && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(r)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <ServerPagination
            page={page}
            setPage={setPage}
            nextPage={() => setPage(page + 1)}
            prevPage={() => setPage(page - 1)}
            pageSize={pageSize}
            setPageSize={setPageSize}
            hasMore={hasMore}
            hasPrev={hasPrev}
            isLoading={isFetching}
          />
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t('edit_purchase') : t('add_purchase')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t('name')} *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('name')} />
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
                <Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('category')}</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>{t('quantity')}</Label>
                <Input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>{t('unit')}</Label>
                <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder={t('unit')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('supplier')}</Label>
              <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>{t('cancel')}</Button>
              <Button onClick={handleSave} disabled={saving} className="gradient-primary text-white">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}