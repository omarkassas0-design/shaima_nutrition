import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { getClinicId } from '@/lib/useClinicId';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ServerPagination from '@/components/shared/ServerPagination';
import { TestTube, Trash2, Pencil, Search, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import NumberInput from '@/components/shared/NumberInput';
import { treatmentCountLabel } from '@/lib/pluralize';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { deleteWithUndo } from '@/lib/undoDelete';
import { motion } from 'framer-motion';
import { getStatusLabel } from '@/lib/statusLabels';
import { useAuth } from '@/lib/AuthContext';
import { roleIsDoctor, canRole } from '@/lib/permissions';
import PatientSearchSelect from '@/components/appointments/PatientSearchSelect';
import EntitySearchSelect from '@/components/shared/EntitySearchSelect';
import { formatMoney } from '@/lib/currencyUtils';
import { CheckCircle2 } from 'lucide-react';

const STATUS_COLORS = {
  sent: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-green-100 text-green-700',
  delivered: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};

// Single "Price" field (stored as patient_price). The legacy patient_paid_amount
// input has been removed — existing records keep their stored value untouched.
const EMPTY_FORM = {
  patient_id: '', patient_name: '', doctor_id: '', doctor_name: '',
  lab_id: '', lab_name: '', case_type: '', description: '',
  due_date: '', sent_date: '', cost: '', patient_price: '',
  patient_treatment_ids: [], currency: 'USD', status: 'sent', notes: '',
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// What the patient actually pays for one treatment unit: catalog price minus
// its own discount. Used only for the lab-case PRICE preview — the treatment
// catalog itself is never modified.
const treatmentNetPrice = (pt) => {
  const price = Number(pt.price) || 0;
  const value = Number(pt.discount_value) || 0;
  if (pt.discount_type === 'percentage') return round2(price - (price * value) / 100);
  if (pt.discount_type === 'fixed') return round2(price - value);
  return round2(price);
};

export default function LabCases() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const doctorView = roleIsDoctor(effectiveRole);
  const canManage = canRole(effectiveRole, 'labcases:write');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // True once the price was changed by hand — auto-calculation then stops
  // overwriting it until the user asks to recalculate.
  const [priceManual, setPriceManual] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); setDebouncedSearch(search); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Server-side paginated lab cases
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['paginatedLabCases', clinic?.id, page, pageSize, debouncedSearch],
    queryFn: async () => {
      if (!clinic) return { records: [], has_more: false };
      const res = await appClient.functions.invoke('getPaginatedRecords', {
        entity: 'lab_cases',
        page, page_size: pageSize,
        search: debouncedSearch || undefined,
        clinic_id: clinic?.id,
      });
      return res.data;
    },
    enabled: !!clinic,
    keepPreviousData: true,
  });

  const cases = data?.records || [];

  // Patient treatments for the treatment link selector (optional).
  const { data: patientTreatments = [] } = useQuery({
    queryKey: ['patientTreatmentsForLab', clinic?.id, form.patient_id],
    queryFn: async () => {
      if (!clinic?.id || !form.patient_id) return [];
      const res = await appClient.functions.invoke('getPaginatedRecords', {
        entity: 'patient_treatments',
        page: 0, page_size: 100,
        clinic_id: clinic?.id,
        filters: { patient_id: form.patient_id },
      });
      return res.data?.records || [];
    },
    enabled: !!clinic?.id && !!form.patient_id && open,
  });

  // Treatments currently linked to this lab case (one or many units).
  const linkedTreatmentIds = form.patient_treatment_ids || [];
  const linkedTreatments = patientTreatments.filter(pt => linkedTreatmentIds.includes(pt.id));

  // Auto price = sum of the linked units' prices, each unit counted once.
  const autoPrice = (() => {
    const seen = new Set();
    let total = 0;
    let currency = null;
    let mixed = false;
    linkedTreatments.forEach(pt => {
      if (seen.has(pt.id)) return;
      seen.add(pt.id);
      total += treatmentNetPrice(pt);
      const cur = pt.currency || 'USD';
      if (!currency) currency = cur;
      else if (currency !== cur) mixed = true;
    });
    return { total: round2(total), currency: mixed ? null : currency, count: seen.size };
  })();

  const toggleTreatmentLink = (pt) => {
    setForm(f => {
      const current = f.patient_treatment_ids || [];
      const nextIds = current.includes(pt.id) ? current.filter(x => x !== pt.id) : [...current, pt.id];
      const nextList = patientTreatments.filter(x => nextIds.includes(x.id));
      const patch = { ...f, patient_treatment_ids: nextList.map(x => x.id) };
      if (!priceManual) {
        const seen = new Set();
        let total = 0;
        nextList.forEach(x => { if (!seen.has(x.id)) { seen.add(x.id); total += treatmentNetPrice(x); } });
        patch.patient_price = nextList.length > 0 ? round2(total) : '';
        const firstCur = nextList[0]?.currency;
        if (firstCur && nextList.every(x => (x.currency || 'USD') === firstCur)) patch.currency = firstCur;
      }
      return patch;
    });
  };

  const recalcPrice = () => {
    setPriceManual(false);
    setForm(f => ({ ...f, patient_price: autoPrice.count > 0 ? autoPrice.total : '' }));
  };

  const finalizeMutation = useMutation({
    mutationFn: async (lab_case_id) => {
      const res = await appClient.functions.invoke('finalizeLabCase', { lab_case_id });
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const clinic_id = await getClinicId(clinic);
      // The form now captures the patient price once, in a single "Price"
      // field. patient_paid_amount is legacy and is intentionally NOT written
      // here so existing values on older lab cases are preserved.
      const treatmentIds = Array.from(new Set(data.patient_treatment_ids || []));
      const payload = {
        ...data,
        patient_treatment_ids: treatmentIds,
        // Legacy single link mirrors the first unit so existing payment and
        // commission logic keeps resolving the prosthesis treatment.
        patient_treatment_id: treatmentIds[0] || '',
        cost: data.cost ? Number(data.cost) : 0,
        patient_price: data.patient_price ? Number(data.patient_price) : 0,
      };
      if (editing) return clinicApi.update('LabCase', editing.id, payload);
      return clinicApi.create('LabCase', { ...payload, clinic_id });
    },
    onSuccess: async (savedCase) => {
      // Trigger finalize/unfinalize based on the saved status.
      const caseId = savedCase?.id || editing?.id;
      if (caseId) {
        try {
          const res = await finalizeMutation.mutateAsync(caseId);
          if (res?.action === 'finalized') toast.success(t('lab_case_finalized'));
          else if (res?.action === 'unfinalized') toast.success(t('lab_case_unfinalized'));
        } catch (e) {
          console.error('Finalize failed:', e?.message || e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['paginatedLabCases'] });
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      queryClient.invalidateQueries({ queryKey: ['monthlyExpenses'] });
      if (!finalizeMutation.isPending) {
        toast.success(editing ? t('updated_success') : t('created_success'));
      }
      setOpen(false);
    },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + (e?.message || '')),
  });

  const handleDelete = (c) => deleteWithUndo('LabCase', c, 'Lab case', () =>
    queryClient.invalidateQueries({ queryKey: ['paginatedLabCases'] })
  );

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setPriceManual(false); setOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      patient_id: c.patient_id || '', patient_name: c.patient_name || '',
      doctor_id: c.doctor_id || '', doctor_name: c.doctor_name || '',
      lab_id: c.lab_id || '', lab_name: c.lab_name || '',
      case_type: c.case_type || '', description: c.description || '',
      due_date: c.due_date || '', sent_date: c.sent_date || '',
      cost: c.cost || '', patient_price: c.patient_price || '',
      // Existing cases keep their stored price and their old single link.
      patient_treatment_ids: c.patient_treatment_ids?.length
        ? c.patient_treatment_ids
        : (c.patient_treatment_id ? [c.patient_treatment_id] : []),
      currency: c.currency || 'USD',
      status: c.status || 'sent', notes: c.notes || '',
    });
    setPriceManual(false);
    setOpen(true);
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.patient_id) return toast.error(t('patient') + ' *');
    if (!form.lab_id) return toast.error(t('laboratory') + ' *');
    if (!form.case_type.trim()) return toast.error(t('case_type') + ' *');
    saveMutation.mutate(form);
  };

  return (
    <div>
      <PageHeader title={t('lab_cases')} actionLabel={canManage ? t('add_lab_case') : undefined} onAction={canManage ? openCreate : undefined} />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className="pl-10 rtl:pl-4 rtl:pr-10" />
        </div>
      </div>

      {!isLoading && cases.length === 0 ? (
        <EmptyState icon={TestTube} title={t('no_lab_cases_found')} actionLabel={canManage ? t('add_lab_case') : undefined} onAction={canManage ? openCreate : undefined} />
      ) : (
        <>
          <div className="space-y-2">
            {cases.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.2) }} className="glass rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{c.case_type} — {c.patient_name}</p>
                      {(c.patient_treatment_ids?.length || (c.patient_treatment_id ? 1 : 0)) > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {treatmentCountLabel(c.patient_treatment_ids?.length || 1, lang)}
                        </Badge>
                      )}
                      {c.is_finalized && (
                        <Badge className="bg-emerald-100 text-emerald-700 gap-1"><CheckCircle2 className="w-3 h-3" />{t('finalized')}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.lab_name} {c.due_date && `· ${t('due_date')}: ${formatDisplayDate(c.due_date, lang)}`}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={STATUS_COLORS[c.status] || ''}>{getStatusLabel(c.status, lang)}</Badge>
                    {canManage && <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>}
                    {!doctorView && <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(c)}><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                </div>
                {(c.cost || c.patient_price) ? (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                    <div className="rounded-lg bg-secondary/40 px-2.5 py-1.5">
                      <p className="text-muted-foreground">{t('cost')}</p>
                      <p className="font-semibold">{formatMoney(c.cost || 0, c.currency)}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/40 px-2.5 py-1.5">
                      <p className="text-muted-foreground">{t('price')}</p>
                      <p className="font-semibold">{formatMoney(c.patient_price || 0, c.currency)}</p>
                    </div>
                    {c.is_finalized && (
                      <>
                        <div className="rounded-lg bg-secondary/40 px-2.5 py-1.5">
                          <p className="text-muted-foreground">{t('net_amount')}</p>
                          <p className="font-semibold">{formatMoney(c.net_amount || 0, c.currency)}</p>
                        </div>
                        <div className="rounded-lg bg-secondary/40 px-2.5 py-1.5">
                          <p className="text-muted-foreground">{t('commission')}</p>
                          <p className="font-semibold">{formatMoney(c.doctor_commission_amount || 0, c.currency)}</p>
                        </div>
                        <div className="rounded-lg bg-secondary/40 px-2.5 py-1.5">
                          <p className="text-muted-foreground">{t('clinic_share')}</p>
                          <p className="font-semibold">{formatMoney(c.clinic_share || 0, c.currency)}</p>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </motion.div>
            ))}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t('edit') + ' ' + t('lab_case') : t('add_lab_case')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('patient')} *</Label>
              <PatientSearchSelect
                clinicId={clinic?.id}
                value={form.patient_id}
                patientName={form.patient_name}
                onChange={(id, rec) => setForm(f => ({ ...f, patient_id: id, patient_name: rec?.full_name || '' }))}
                disabled={!clinic?.id}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('doctor')}</Label>
              <EntitySearchSelect
                entity="Doctor"
                clinicId={clinic?.id}
                value={form.doctor_id}
                selectedLabel={form.doctor_name}
                onChange={(id, rec) => setForm(f => ({ ...f, doctor_id: id, doctor_name: rec?.name || '' }))}
                labelKey="name"
                secondaryKey="specialty"
                placeholder={t('doctor')}
                disabled={!clinic?.id}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('laboratory')} *</Label>
              <EntitySearchSelect
                entity="Laboratory"
                clinicId={clinic?.id}
                value={form.lab_id}
                selectedLabel={form.lab_name}
                onChange={(id, rec) => setForm(f => ({ ...f, lab_id: id, lab_name: rec?.name || '' }))}
                labelKey="name"
                secondaryKey="contact_person"
                extraFilter={{ status: 'active' }}
                placeholder={t('laboratory')}
                disabled={!clinic?.id}
              />
            </div>

            <div className="space-y-1.5"><Label>{t('case_type')} *</Label><Input value={form.case_type} onChange={set('case_type')} placeholder={t('case_type')} /></div>
            <div className="space-y-1.5"><Label>{t('description')}</Label><Textarea value={form.description} onChange={set('description')} rows={2} /></div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>{t('sent_date')}</Label><Input type="date" value={form.sent_date} onChange={set('sent_date')} /></div>
              <div className="space-y-1.5"><Label>{t('due_date')}</Label><Input type="date" value={form.due_date} onChange={set('due_date')} /></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>{t('cost')}</Label><Input type="number" value={form.cost} onChange={set('cost')} placeholder="0" /></div>
              <div className="space-y-1.5"><Label>{t('currency')}</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="SYP">SYP</SelectItem><SelectItem value="TRY">TRY (₺)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('price')}</Label>
                {priceManual && linkedTreatments.length > 0 && (
                  <button
                    type="button"
                    onClick={recalcPrice}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />{t('recalculate_price')}
                  </button>
                )}
              </div>
              <NumberInput
                value={form.patient_price}
                onChange={(v) => { setPriceManual(true); setForm(f => ({ ...f, patient_price: v })); }}
                placeholder="0"
                dir="ltr"
              />
              {linkedTreatments.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {t('auto_price_from_treatments')}: {formatMoney(autoPrice.total, autoPrice.currency || form.currency)}
                </p>
              )}
            </div>

            {form.patient_id && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>{t('link_treatment')}</Label>
                  {linkedTreatments.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">{treatmentCountLabel(linkedTreatments.length, lang)}</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground -mt-1">{t('link_treatments_multi_hint')}</p>
                {patientTreatments.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2.5 rounded-lg bg-muted">{t('no_treatments_for_patient')}</p>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded-lg border divide-y">
                    {patientTreatments.map(pt => {
                      const checked = linkedTreatmentIds.includes(pt.id);
                      return (
                        <button
                          type="button"
                          key={pt.id}
                          onClick={() => toggleTreatmentLink(pt)}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 text-start text-xs transition-colors ${checked ? 'bg-primary/5' : 'hover:bg-secondary/40'}`}
                        >
                          <span className={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center ${checked ? 'bg-primary border-primary' : 'border-gray-300 bg-white'}`}>
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <span className="flex-1 min-w-0 truncate">
                            {pt.treatment_name || '—'}
                            {pt.tooth_numbers?.length ? ` · ${t('tooth')}: ${pt.tooth_numbers.join(', ')}` : ''}
                          </span>
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            {formatMoney(treatmentNetPrice(pt), pt.currency || form.currency)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5"><Label>{t('status')}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['sent','in_progress','ready','delivered','cancelled'].map(s => <SelectItem key={s} value={s}>{getStatusLabel(s, lang)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.status === 'delivered' && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{t('lab_case_finalized')}</span>
              </div>
            )}

            <div className="space-y-1.5"><Label>{t('notes')}</Label><Textarea value={form.notes} onChange={set('notes')} rows={2} /></div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSubmit} disabled={saveMutation.isPending} className="gradient-primary text-white">{saveMutation.isPending ? '...' : t('save')}</Button>
              <Button variant="outline" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}