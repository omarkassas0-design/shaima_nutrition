import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { useLanguage } from '@/lib/useLanguage';
import { formatNumber } from '@/lib/currencyUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getStatusLabel } from '@/lib/statusLabels';
import { getDoctorCommissionPct, calcCommissionAmount, calcProsthesisNet } from '@/lib/commissionUtils';
import PatientSearchSelect from '@/components/appointments/PatientSearchSelect';
import EntitySearchSelect from '@/components/shared/EntitySearchSelect';

const CURRENCIES = ['USD', 'SYP', 'TRY', 'EUR'];

const blankForm = (clinic) => ({
  patient_id: '', patient_name: '', doctor_id: '', amount: '',
  currency: clinic?.currency || 'USD', method: 'cash',
  notes: '', treatment_group_key: '', quantity: 1,
  payment_date: format(new Date(), 'yyyy-MM-dd'),
});

/**
 * Unified Add Payment dialog — the SINGLE payment flow used by every entry
 * point (Quick Add, Sidebar/Payments page, Patient Profile, Treatment Plan).
 *
 * Props:
 *   open, onClose        — dialog visibility
 *   fixedPatient         — optional Patient object; when provided the patient
 *                           is fixed (Patient Profile context)
 *   editing              — optional Payment object; when provided the dialog
 *                           is in edit mode (Payments page edit)
 *   presetDoctorId       — optional doctor to pre-select
 *   presetTreatmentId    — optional PatientTreatment id; auto-selects the
 *                           matching treatment group
 *
 * The flow is always: Patient → Treatment → Doctor → commission is
 * auto-calculated from the patient source via getDoctorCommissionPct →
 * amount/currency/method/date/notes → savePayment backend function.
 */
export default function AddPaymentDialog({ open, onClose, fixedPatient, editing, presetDoctorId, presetTreatmentId }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const queryClient = useQueryClient();
  const isEditing = !!editing;
  const [form, setForm] = useState(blankForm(clinic));

  const clinicId = clinic?.id;

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors', clinicId],
    queryFn: () => clinicId ? clinicApi.filter('Doctor', { clinic_id: clinicId }, 'name', 200) : [],
    enabled: !!clinicId && open,
  });

  // Resolve the full patient record (for patient_source) when the patient is
  // selected via search (not fixedPatient). Needed for commission calculation.
  const activePatientId = form.patient_id;
  const { data: resolvedPatient } = useQuery({
    queryKey: ['patient', activePatientId, clinicId],
    queryFn: () => clinicApi.get('Patient', activePatientId),
    enabled: !!activePatientId && open && !fixedPatient,
  });

  const patient = fixedPatient || resolvedPatient || null;

  // Load the patient's treatments for treatment-group selection (create mode only)
  const { data: patientTreatments = [] } = useQuery({
    queryKey: ['patientTreatments', activePatientId, clinicId],
    queryFn: () => clinicId && activePatientId
      ? clinicApi.filter('PatientTreatment', { patient_id: activePatientId, clinic_id: clinicId }, undefined, 200)
      : [],
    enabled: !!clinicId && !!activePatientId && open && !isEditing,
  });

  // Load LabCases for the patient — used to detect prosthesis treatments and
  // show the correct commission (on net amount, not full payment).
  const { data: patientLabCases = [] } = useQuery({
    queryKey: ['patientLabCases', activePatientId, clinicId],
    queryFn: () => clinicId && activePatientId
      ? clinicApi.filter('LabCase', { patient_id: activePatientId, clinic_id: clinicId }, undefined, 200)
      : [],
    enabled: !!clinicId && !!activePatientId && open && !isEditing,
  });

  // Map patient_treatment_id → LabCase (same currency, with a cost)
  const labCaseByTreatment = useMemo(() => {
    const map = {};
    (patientLabCases || []).forEach(lc => {
      if (lc.patient_treatment_id && (Number(lc.cost) || 0) > 0) {
        map[lc.patient_treatment_id] = lc;
      }
    });
    return map;
  }, [patientLabCases]);

  // Initialize / reset the form when the dialog opens or context changes
  useEffect(() => {
    if (!open) return;
    if (isEditing && editing) {
      setForm({
        patient_id: editing.patient_id || '',
        patient_name: editing.patient_name || '',
        doctor_id: editing.doctor_id || '',
        amount: editing.amount != null ? String(editing.amount) : '',
        currency: editing.currency || 'USD',
        method: editing.method || 'cash',
        notes: editing.notes || '',
        treatment_group_key: '', quantity: 1,
        payment_date: editing.payment_date || format(new Date(), 'yyyy-MM-dd'),
      });
    } else {
      const init = blankForm(clinic);
      if (fixedPatient) {
        init.patient_id = fixedPatient.id;
        init.patient_name = fixedPatient.full_name || '';
      }
      if (presetDoctorId) init.doctor_id = presetDoctorId;
      setForm(init);
    }
  }, [open, isEditing, editing, fixedPatient, presetDoctorId, clinic]);

  const selectedDoctor = doctors.find(d => d.id === form.doctor_id);
  const commissionPct = getDoctorCommissionPct(selectedDoctor, patient);
  const amountNum = Number(form.amount) || 0;

  // Group COMPLETED unpaid treatments by name + currency
  const treatmentGroups = useMemo(() => {
    const completed = (patientTreatments || []).filter(pt => pt.status === 'completed');
    const groups = {};
    completed.forEach(pt => {
      const key = `${pt.treatment_name}||${pt.currency || 'USD'}`;
      if (!groups[key]) groups[key] = { key, treatment_name: pt.treatment_name, currency: pt.currency || 'USD', unpaidTreatments: [] };
      const disc = pt.discount_type === 'percentage' ? (pt.price * (pt.discount_value || 0) / 100) : (pt.discount_type === 'fixed' ? (pt.discount_value || 0) : 0);
      const finalPrice = Math.round(((pt.price || 0) - disc) * 100) / 100;
      const remaining = Math.round((finalPrice - (pt.paid_amount || 0)) * 100) / 100;
      if (remaining > 0.001) groups[key].unpaidTreatments.push({ ...pt, _finalPrice: finalPrice, _remaining: remaining });
    });
    return Object.values(groups)
      .filter(g => g.unpaidTreatments.length > 0)
      .map(g => ({ ...g, maxQuantity: g.unpaidTreatments.length, unitPrice: g.unpaidTreatments[0]._finalPrice }));
  }, [patientTreatments]);

  // Determine if the selected treatment is a prosthesis/lab case with a cost.
  // The first unpaid treatment in the selected group is the one being paid.
  const selectedGroup = treatmentGroups.find(g => g.key === form.treatment_group_key);
  const activeTreatment = selectedGroup?.unpaidTreatments?.[0] || null;
  const activeLabCase = activeTreatment ? labCaseByTreatment[activeTreatment.id] : null;
  const isProsthesis = !!activeLabCase && (activeLabCase.currency || 'USD') === form.currency;
  const prosthesisCost = isProsthesis ? (Number(activeLabCase.cost) || 0) : 0;
  const cumulativePaidBefore = activeTreatment ? (Number(activeTreatment.paid_amount) || 0) : 0;
  const netAmount = isProsthesis
    ? calcProsthesisNet(amountNum, cumulativePaidBefore, prosthesisCost)
    : amountNum;
  const commissionAmount = calcCommissionAmount(netAmount, commissionPct);

  // Auto-select the treatment group matching presetTreatmentId
  useEffect(() => {
    if (!open || isEditing || !presetTreatmentId) return;
    const grp = treatmentGroups.find(g => g.unpaidTreatments.some(pt => pt.id === presetTreatmentId));
    if (grp) {
      setForm(f => ({ ...f, treatment_group_key: grp.key, quantity: 1, currency: grp.currency, amount: String(grp.unitPrice) }));
    }
  }, [open, isEditing, presetTreatmentId, treatmentGroups]);

  const { mutate, isPending } = useMutation({
    mutationFn: async (data) => {
      if (!clinicId) throw new Error('Clinic not set up. Please go to Settings first.');
      if (!data.patient_id) throw new Error('Patient is required');
      if (!data.doctor_id) throw new Error('Doctor is required');
      const basePayload = {
        patient_id: data.patient_id,
        doctor_id: data.doctor_id,
        currency: data.currency,
        method: data.method,
        payment_date: data.payment_date,
        notes: data.notes || '',
      };
      if (isEditing && editing?.id) {
        if (!data.amount || Number(data.amount) <= 0) throw new Error('Valid amount is required');
        const res = await appClient.functions.invoke('savePayment', {
          ...basePayload, amount: Number(data.amount), payment_id: editing.id,
        });
        return res.data;
      }
      // Create mode: distribute amount across selected treatments if a group is chosen
      if (data.treatment_group_key) {
        const grp = treatmentGroups.find(g => g.key === data.treatment_group_key);
        if (grp) {
          const qty = Math.min(Number(data.quantity) || 1, grp.unpaidTreatments.length);
          if (qty <= 0) throw new Error('No unpaid treatments available');
          let remaining = Number(data.amount) || 0;
          if (remaining <= 0) throw new Error('Valid amount is required');
          for (let i = 0; i < qty && remaining > 0.001; i++) {
            const pt = grp.unpaidTreatments[i];
            const payAmt = Math.min(remaining, pt._remaining);
            await appClient.functions.invoke('savePayment', {
              ...basePayload, amount: Math.round(payAmt * 100) / 100, patient_treatment_id: pt.id,
            });
            remaining = Math.round((remaining - payAmt) * 100) / 100;
          }
          return;
        }
      }
      if (!data.amount || Number(data.amount) <= 0) throw new Error('Valid amount is required');
      const res = await appClient.functions.invoke('savePayment', { ...basePayload, amount: Number(data.amount) });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paginatedPayments'] });
      queryClient.invalidateQueries({ queryKey: ['patientPayments'] });
      queryClient.invalidateQueries({ queryKey: ['patientTreatments'] });
      queryClient.invalidateQueries({ queryKey: ['patientsForPayments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['doctorCommissionSummary'] });
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      toast.success(isEditing ? t('updated_success') : t('created_success'));
      setForm(blankForm(clinic));
      onClose();
    },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + (e?.message || '')),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.patient_id) return toast.error(t('patient_required'));
    if (!form.doctor_id) return toast.error(t('doctor_required'));
    if (!form.amount || Number(form.amount) <= 0) return toast.error(t('valid_amount_required'));
    mutate(form);
  };

  const showPatientField = !fixedPatient;
  const showTreatmentField = !isEditing && treatmentGroups.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEditing ? t('edit_payment') : t('add_payment')}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {showPatientField && (
            <div className="space-y-1.5">
              <Label>{t('patient')} *</Label>
              <PatientSearchSelect
                clinicId={clinicId}
                value={form.patient_id}
                patientName={form.patient_name}
                onChange={(id, rec) => setForm(f => ({ ...f, patient_id: id, patient_name: rec?.full_name || '', treatment_group_key: '', quantity: 1, amount: '' }))}
              />
            </div>
          )}

          {showTreatmentField && (
            <div className="space-y-1.5">
              <Label>{t('treatment')}</Label>
              <Select
                value={form.treatment_group_key}
                onValueChange={v => {
                  const grp = treatmentGroups.find(g => g.key === v);
                  setForm(f => ({ ...f, treatment_group_key: v, quantity: 1, currency: grp?.currency || f.currency, amount: grp ? String(grp.unitPrice) : '' }));
                }}
              >
                <SelectTrigger><SelectValue placeholder={t('treatment')} /></SelectTrigger>
                <SelectContent>
                  {treatmentGroups.map(g => (
                    <SelectItem key={g.key} value={g.key}>
                      {g.treatment_name} — {t('available')}: {g.maxQuantity} × {formatNumber(g.unitPrice)} {g.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.treatment_group_key && !isEditing && (() => {
            const grp = treatmentGroups.find(g => g.key === form.treatment_group_key);
            if (!grp) return null;
            return (
              <div className="space-y-1.5">
                <Label>{t('quantity')}</Label>
                <Select
                  value={String(form.quantity)}
                  onValueChange={v => {
                    const q = Number(v);
                    const total = grp.unpaidTreatments.slice(0, q).reduce((s, pt) => s + pt._finalPrice, 0);
                    setForm(f => ({ ...f, quantity: q, amount: String(Math.round(total * 100) / 100) }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: grp.maxQuantity }, (_, i) => i + 1).map(q => {
                      const total = grp.unpaidTreatments.slice(0, q).reduce((s, pt) => s + pt._finalPrice, 0);
                      return (
                        <SelectItem key={q} value={String(q)}>
                          {q} × {formatNumber(grp.unitPrice)} = {formatNumber(Math.round(total * 100) / 100)} {grp.currency}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            );
          })()}

          <div className="space-y-1.5">
            <Label>{t('doctor')} *</Label>
            <EntitySearchSelect
              entity="Doctor"
              clinicId={clinicId}
              value={form.doctor_id}
              selectedLabel={selectedDoctor?.name}
              onChange={(id, rec) => setForm(f => ({ ...f, doctor_id: id }))}
              labelKey="name"
              secondaryKey="specialty"
              placeholder={t('doctor')}
              disabled={!clinicId}
            />
            {selectedDoctor && (
              <p className="text-xs text-muted-foreground">
                {t('commission')}: <span className="font-semibold text-foreground">{commissionPct}%</span>
                {patient?.patient_source && (
                  <span className="ml-1">· {t('patient_source')}: {t(patient.patient_source === 'doctor' ? 'source_doctor' : 'source_clinic')}</span>
                )}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('amount')} *</Label>
              <Input type="number" min={0} step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('currency')}</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}{c === 'TRY' ? ' (₺)' : ''}{c === 'EUR' ? ' (€)' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.doctor_id && amountNum > 0 && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('amount')}</span>
                <span className="font-semibold">{formatNumber(amountNum)} {form.currency}</span>
              </div>
              {isProsthesis && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('lab_cost')}</span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">−{formatNumber(prosthesisCost)} {form.currency}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('net_amount')}</span>
                    <span className="font-semibold">{formatNumber(netAmount)} {form.currency}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('commission')} ({commissionPct}%){isProsthesis ? ` · ${t('net_amount')}` : ''}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(commissionAmount)} {form.currency}</span>
              </div>
              {isProsthesis && (
                <p className="text-xs text-muted-foreground pt-1 border-t border-emerald-200 dark:border-emerald-900">{t('prosthesis_net_note')}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('method')}</Label>
              <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['cash', 'card', 'transfer', 'other'].map(m => <SelectItem key={m} value={m}>{getStatusLabel(m, lang)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('payment_date')}</Label>
              <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('notes')}</Label>
            <Textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button type="submit" disabled={isPending || !clinicId || !form.patient_id || !form.doctor_id || !form.amount} className="gradient-primary text-white">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}