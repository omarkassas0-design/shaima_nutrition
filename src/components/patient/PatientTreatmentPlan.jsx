import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import NumberInput from '@/components/shared/NumberInput';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Pencil, Stethoscope, Check } from 'lucide-react';
import SurfaceSelector from '@/components/patient/SurfaceSelector';
import EntitySearchSelect from '@/components/shared/EntitySearchSelect';
import { toast } from 'sonner';
import EmptyState from '@/components/shared/EmptyState';
import { format } from 'date-fns';
import { formatCurrencyTotals, computeLedgerBalance } from '@/lib/currencyUtils';

const statusColors = {
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const ALL_TEETH = [
  18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28,
  31,32,33,34,35,36,37,38, 41,42,43,44,45,46,47,48,
];

function ToothPicker({ value, onChange, multi = true }) {
  const { t } = useLanguage();
  const toggle = (n) => {
    if (multi) {
      onChange(value.includes(n) ? value.filter(x => x !== n) : [...value, n]);
    } else {
      onChange(value.includes(n) ? [] : [n]);
    }
  };
  return (
    <div className="p-3 bg-secondary/30 rounded-xl">
      <div className="flex flex-wrap gap-1.5">
        {ALL_TEETH.map(n => (
          <button key={n} type="button" onClick={() => toggle(n)}
            className={`w-9 h-9 text-xs font-semibold rounded-lg border-2 transition-all hover:scale-105
              ${value.includes(n)
                ? 'bg-primary text-white border-primary shadow'
                : 'bg-background border-border text-muted-foreground hover:border-primary/50'}`}
          >{n}</button>
        ))}
      </div>
      {value.length > 0 && (
        <p className="text-xs text-primary font-medium mt-2">
          {t('selected_label')} {[...value].sort((a,b)=>a-b).join(', ')}
        </p>
      )}
    </div>
  );
}

export default function PatientTreatmentPlan({ patient }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);

  const { data: patientTreatments = [] } = useQuery({
    queryKey: ['patientTreatments', patient.id],
    queryFn: () => clinicApi.filter('PatientTreatment', { patient_id: patient.id, clinic_id: clinic?.id }),
    enabled: !!clinic,
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ['treatments', clinic?.id],
    queryFn: () => clinic ? clinicApi.filter('Treatment', { clinic_id: clinic.id, status: 'active' }) : [],
    enabled: !!clinic,
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors', clinic?.id],
    queryFn: () => clinic ? clinicApi.filter('Doctor', { clinic_id: clinic.id }) : [],
    enabled: !!clinic,
  });

  // The payment ledger is the source of truth for what the patient has paid.
  const { data: payments = [] } = useQuery({
    queryKey: ['patientPayments', patient.id, clinic?.id],
    queryFn: () => clinicApi.filter('Payment', { patient_id: patient.id, clinic_id: clinic?.id }),
    enabled: !!clinic,
  });

  // Per-currency totals — currencies never mixed
  const totalsByCurrency = {};
  patientTreatments.forEach(pt => {
    const cur = pt.currency || 'USD';
    if (!totalsByCurrency[cur]) totalsByCurrency[cur] = { original: 0, discount: 0, final: 0, paid: 0 };
    const discount = pt.discount_type === 'percentage' ? (pt.price * (pt.discount_value || 0) / 100) : (pt.discount_type === 'fixed' ? (pt.discount_value || 0) : 0);
    const final = pt.price - discount;
    totalsByCurrency[cur].original = Math.round((totalsByCurrency[cur].original + (pt.price || 0)) * 100) / 100;
    totalsByCurrency[cur].discount = Math.round((totalsByCurrency[cur].discount + discount) * 100) / 100;
    totalsByCurrency[cur].final = Math.round((totalsByCurrency[cur].final + final) * 100) / 100;
    totalsByCurrency[cur].paid = Math.round((totalsByCurrency[cur].paid + (pt.paid_amount || 0)) * 100) / 100;
  });
  const sumField = (field) => Object.fromEntries(
    Object.entries(totalsByCurrency).map(([c, v]) => [c, v[field]])
  );
  // Remaining: ONLY completed treatments contribute to the amount due, and the
  // amount paid is read from the Payment ledger — so recording a payment (or
  // marking a treatment paid) always reduces the remaining balance, exactly
  // once, and it can never go negative.
  const { paidByCurrency, remainingByCurrency } = computeLedgerBalance(patientTreatments, payments);

  const deleteMutation = useMutation({
    mutationFn: (id) => clinicApi.delete('PatientTreatment', id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['patientTreatments'] }); queryClient.invalidateQueries({ queryKey: ['auditLog'] }); },
  });
  const handleDelete = (id) => deleteMutation.mutate(id);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => clinicApi.update('PatientTreatment', id, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['patientTreatments'] }); queryClient.invalidateQueries({ queryKey: ['auditLog'] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{t('treatment_plan')}</h3>
        <Button onClick={() => setShowAdd(true)} className="gradient-primary text-white" size="sm">
          <Plus className="w-4 h-4 mr-1" />{t('add_treatment')}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label={t('original_total')} value={formatCurrencyTotals(sumField('original'))} />
        <SummaryCard label={t('discount')} value={formatCurrencyTotals(sumField('discount'))} />
        <SummaryCard label={t('paid')} value={formatCurrencyTotals(paidByCurrency)} />
        <SummaryCard label={t('remaining')} value={formatCurrencyTotals(remainingByCurrency)} highlight />
      </div>

      {patientTreatments.length === 0 ? (
        <EmptyState icon={Stethoscope} title={t('no_treatments')} actionLabel={t('add_treatment')} onAction={() => setShowAdd(true)} />
      ) : (
        <div className="space-y-2">
          {patientTreatments.map(pt => {
            const discount = pt.discount_type === 'percentage' ? (pt.price * (pt.discount_value || 0) / 100) : (pt.discount_type === 'fixed' ? (pt.discount_value || 0) : 0);
            return (
              <Card key={pt.id} className="glass border-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {pt.tooth_numbers?.length > 0 && (
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">#{pt.tooth_numbers[0]}</span>
                        )}
                        <p className="font-semibold text-sm">{pt.treatment_name}</p>
                      </div>
                      {pt.tooth_numbers?.length > 0 && pt.tooth_surfaces?.[String(pt.tooth_numbers[0])]?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {pt.tooth_surfaces[String(pt.tooth_numbers[0])].map(s => (
                            <span key={s} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">{t(s)}</span>
                          ))}
                        </div>
                      )}
                      {pt.description && <p className="text-xs text-muted-foreground">{pt.description}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{t('price')}: {pt.price} {pt.currency}</span>
                        {discount > 0 && <span>{t('discount')}: -{discount} {pt.currency}</span>}
                        <span>{t('paid')}: {pt.paid_amount || 0} {pt.currency}</span>
                        {pt.doctor_name && <span>{t('doctor')}: {pt.doctor_name}</span>}
                        {pt.treatment_date && <span>{formatDisplayDate(pt.treatment_date, lang)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Select value={pt.status} onValueChange={(v) => updateStatusMutation.mutate({ id: pt.id, status: v })}>
                        <SelectTrigger className="h-7 w-auto text-xs border-0 bg-secondary/50 px-2">
                          <Badge className={`text-xs ${statusColors[pt.status]}`}>{t(pt.status)}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">{t('planned')}</SelectItem>
                          <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
                          <SelectItem value="completed">{t('completed')}</SelectItem>
                          <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => setEditingTreatment(pt)} className="text-muted-foreground hover:text-primary">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(pt.id)} className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddTreatmentDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        patient={patient}
        treatments={treatments}
        doctors={doctors}
        clinic={clinic}
      />
      {editingTreatment && (
        <EditTreatmentDialog
          open={!!editingTreatment}
          onClose={() => setEditingTreatment(null)}
          treatment={editingTreatment}
          doctors={doctors}
          clinic={clinic}
        />
      )}
    </div>
  );
}

function EditTreatmentDialog({ open, onClose, treatment, doctors, clinic }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    treatment_name: treatment.treatment_name || '',
    description: treatment.description || '',
    price: treatment.price || 0,
    currency: treatment.currency || clinic?.currency || 'USD',
    paid_amount: treatment.paid_amount || 0,
    discount_type: treatment.discount_type || 'none',
    discount_value: treatment.discount_value || 0,
    status: treatment.status || 'planned',
    doctor_id: treatment.doctor_id || '',
    doctor_name: treatment.doctor_name || '',
    treatment_date: treatment.treatment_date || '',
    tooth_numbers: treatment.tooth_numbers || [],
    tooth_surfaces: treatment.tooth_surfaces || {},
    selectedSurfaces: (treatment.tooth_numbers?.length > 0 && treatment.tooth_surfaces) ? (treatment.tooth_surfaces[String(treatment.tooth_numbers[0])] || []) : [],
  });

  const handleDoctorSelect = (id) => {
    const doc = doctors.find(d => d.id === id);
    if (doc) setForm(prev => ({ ...prev, doctor_id: id, doctor_name: doc.name }));
  };

  const updateMutation = useMutation({
    mutationFn: (data) => clinicApi.update('PatientTreatment', treatment.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientTreatments'] });
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('edit')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('tooth_numbers')}</Label>
            <ToothPicker value={form.tooth_numbers} onChange={(v) => setForm({...form, tooth_numbers: v})} />
          </div>
          {form.tooth_numbers.length > 0 && (
            <div className="space-y-2">
              <Label>{t('surfaces')} <span className="text-xs text-muted-foreground font-normal">({t('optional')})</span></Label>
              <div className="p-2.5 bg-secondary/30 rounded-lg">
                <SurfaceSelector
                  surfaces={form.selectedSurfaces}
                  onChange={(s) => setForm({ ...form, selectedSurfaces: s })}
                />
              </div>
            </div>
          )}
          <div className="space-y-2"><Label>{t('name')}</Label><Input value={form.treatment_name} onChange={e => setForm({...form, treatment_name: e.target.value})} /></div>
          <div className="space-y-2"><Label>{t('description')}</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t('price')}</Label><NumberInput value={form.price} onChange={v => setForm({...form, price: v})} /></div>
            <div className="space-y-2"><Label>{t('currency')}</Label>
              <Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="SYP">SYP</SelectItem><SelectItem value="TRY">TRY</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t('discount')}</Label>
              <Select value={form.discount_type} onValueChange={v => setForm({...form, discount_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">{t('none')}</SelectItem><SelectItem value="percentage">{t('percentage')}</SelectItem><SelectItem value="fixed">{t('fixed')}</SelectItem></SelectContent>
              </Select>
            </div>
            {form.discount_type !== 'none' && (
              <div className="space-y-2"><Label>{t('discount_value')}</Label><NumberInput value={form.discount_value} onChange={v => setForm({...form, discount_value: v})} /></div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t('paid_amount')}</Label><NumberInput value={form.paid_amount} onChange={v => setForm({...form, paid_amount: v})} /></div>
            <div className="space-y-2"><Label>{t('status')}</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">{t('planned')}</SelectItem>
                  <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
                  <SelectItem value="completed">{t('completed')}</SelectItem>
                  <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t('assigned_doctor')}</Label>
              <EntitySearchSelect
                entity="Doctor"
                clinicId={clinic?.id}
                value={form.doctor_id}
                selectedLabel={form.doctor_name || doctors.find(d => d.id === form.doctor_id)?.name}
                onChange={(id, rec) => setForm(prev => ({ ...prev, doctor_id: id, doctor_name: rec?.name || '' }))}
                labelKey="name"
                secondaryKey="specialty"
                placeholder={t('doctor')}
                disabled={!clinic?.id}
              />
            </div>
            <div className="space-y-2"><Label>{t('date')}</Label><Input type="date" value={form.treatment_date} onChange={e => setForm({...form, treatment_date: e.target.value})} /></div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button onClick={() => {
              const toothSurfacesMap = {};
              (form.tooth_numbers || []).forEach(tooth => { toothSurfacesMap[String(tooth)] = form.selectedSurfaces; });
              updateMutation.mutate({
                ...form,
                // Never send empty strings / NaN into numeric columns.
                price: Number(form.price) || 0,
                paid_amount: Number(form.paid_amount) || 0,
                discount_value: Number(form.discount_value) || 0,
                tooth_surfaces: toothSurfacesMap,
              });
            }} disabled={updateMutation.isPending} className="gradient-primary text-white">
              {updateMutation.isPending && <span className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />}
              {t('save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/50'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${highlight ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}

function AddTreatmentDialog({ open, onClose, patient, treatments, doctors, clinic }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    treatment_id: '', treatment_name: '', description: '', price: 0,
    currency: clinic?.currency || 'USD', paid_amount: 0, discount_type: 'none',
    discount_value: 0, status: 'planned', doctor_id: '', doctor_name: '',
    treatment_date: format(new Date(), 'yyyy-MM-dd'), tooth_numbers: [], tooth_surfaces: {}, applicable_surfaces: [], selectedSurfaces: [],
  });

  const handleTreatmentSelect = (id) => {
    const tr = treatments.find(t => t.id === id);
    if (tr) {
      setForm(prev => ({ ...prev, treatment_id: id, treatment_name: tr.name, price: tr.default_price || 0, currency: tr.currency || prev.currency, description: tr.description || '', applicable_surfaces: tr.applicable_surfaces || [], selectedSurfaces: [] }));
      setSurfacesConfirmed(false);
    }
  };

  const handleDoctorSelect = (id) => {
    const doc = doctors.find(d => d.id === id);
    if (doc) setForm(prev => ({ ...prev, doctor_id: id, doctor_name: doc.name }));
  };

  const [isSaving, setIsSaving] = useState(false);
  const [surfacesConfirmed, setSurfacesConfirmed] = useState(false);

  const handleSave = async () => {
    if (!clinic?.id) { toast.error('Clinic not set up'); return; }
    setIsSaving(true);
    try {
      // One record per tooth
      const teeth = form.tooth_numbers?.length > 0 ? form.tooth_numbers : [null];
      await Promise.all(teeth.map(tooth =>
        clinicApi.create('PatientTreatment', {
          ...form,
          clinic_id: clinic.id,
          patient_id: patient.id,
          tooth_numbers: tooth ? [tooth] : [],
          tooth_surfaces: tooth ? { [String(tooth)]: form.selectedSurfaces } : {},
          // Numeric columns must never receive an empty string.
          price: Number(form.price) || 0,
          discount_value: Number(form.discount_value) || 0,
          paid_amount: 0,
        })
      ));
      queryClient.invalidateQueries({ queryKey: ['patientTreatments'] });
      onClose();
      setForm({ treatment_id: '', treatment_name: '', description: '', price: 0, currency: clinic?.currency || 'USD', paid_amount: 0, discount_type: 'none', discount_value: 0, status: 'planned', doctor_id: '', doctor_name: '', treatment_date: format(new Date(), 'yyyy-MM-dd'), tooth_numbers: [], tooth_surfaces: {}, applicable_surfaces: [], selectedSurfaces: [] });
      setSurfacesConfirmed(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('add_treatment')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('tooth_numbers')} {t('one_record_per_tooth')}</Label>
            <ToothPicker value={form.tooth_numbers} onChange={(v) => setForm({...form, tooth_numbers: v})} />
          </div>
          <div className="space-y-2">
            <Label>{t('treatment')}</Label>
            <EntitySearchSelect
              entity="Treatment"
              clinicId={clinic?.id}
              value={form.treatment_id}
              selectedLabel={form.treatment_name}
              onChange={(id, tr) => {
                if (tr) {
                  setForm(prev => ({ ...prev, treatment_id: id, treatment_name: tr.name, price: tr.default_price || 0, currency: tr.currency || prev.currency, description: tr.description || '', applicable_surfaces: tr.applicable_surfaces || [], selectedSurfaces: [] }));
                  setSurfacesConfirmed(false);
                }
              }}
              labelKey="name"
              placeholder={t('treatment')}
              extraFilter={{ status: 'active' }}
              disabled={!clinic?.id}
            />
          </div>
          {form.treatment_id && form.applicable_surfaces?.length > 0 && (
            <div className="space-y-2">
              <Label>{t('surfaces')} <span className="text-xs text-destructive font-normal">({t('required')})</span></Label>
              {!surfacesConfirmed ? (
                <div className="p-3 bg-secondary/30 rounded-lg space-y-3">
                  <SurfaceSelector
                    surfaces={form.selectedSurfaces}
                    onChange={(s) => setForm({...form, selectedSurfaces: s})}
                    options={form.applicable_surfaces}
                  />
                  <Button size="sm" onClick={() => setSurfacesConfirmed(true)} disabled={form.selectedSurfaces.length === 0}>
                    <Check className="w-4 h-4 mr-1" />{t('done')}
                  </Button>
                </div>
              ) : (
                <div className="p-3 bg-accent/5 rounded-lg flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {form.selectedSurfaces.map(s => <Badge key={s} className="bg-accent/10 text-accent border-0">{t(s) || s}</Badge>)}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSurfacesConfirmed(false)}>{t('edit')}</Button>
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('name')}</Label>
            <Input value={form.treatment_name} onChange={e => setForm({...form, treatment_name: e.target.value})} />
          </div>
          <div className="space-y-2"><Label>{t('description')}</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t('price')}</Label><NumberInput value={form.price} onChange={v => setForm({...form, price: v})} /></div>
            <div className="space-y-2"><Label>{t('currency')}</Label>
              <Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="SYP">SYP</SelectItem><SelectItem value="TRY">TRY</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t('discount')}</Label>
              <Select value={form.discount_type} onValueChange={v => setForm({...form, discount_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">{t('none')}</SelectItem><SelectItem value="percentage">{t('percentage')}</SelectItem><SelectItem value="fixed">{t('fixed')}</SelectItem></SelectContent>
              </Select>
            </div>
            {form.discount_type !== 'none' && (
              <div className="space-y-2"><Label>{t('discount_value')}</Label><NumberInput value={form.discount_value} onChange={v => setForm({...form, discount_value: v})} /></div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t('paid_amount')}</Label><NumberInput value={form.paid_amount} onChange={v => setForm({...form, paid_amount: v})} /></div>
            <div className="space-y-2"><Label>{t('status')}</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">{t('planned')}</SelectItem>
                  <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
                  <SelectItem value="completed">{t('completed')}</SelectItem>
                  <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{t('assigned_doctor')}</Label>
              <EntitySearchSelect
                entity="Doctor"
                clinicId={clinic?.id}
                value={form.doctor_id}
                selectedLabel={form.doctor_name || doctors.find(d => d.id === form.doctor_id)?.name}
                onChange={(id, rec) => setForm(prev => ({ ...prev, doctor_id: id, doctor_name: rec?.name || '' }))}
                labelKey="name"
                secondaryKey="specialty"
                placeholder={t('doctor')}
                disabled={!clinic?.id}
              />
            </div>
            <div className="space-y-2"><Label>{t('date')}</Label><Input type="date" value={form.treatment_date} onChange={e => setForm({...form, treatment_date: e.target.value})} /></div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={isSaving || (form.treatment_id && form.applicable_surfaces?.length > 0 && !surfacesConfirmed)} className="gradient-primary text-white">
              {isSaving && <span className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />}
              {t('save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}