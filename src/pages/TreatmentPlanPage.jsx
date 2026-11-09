import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { roleIsDoctor } from '@/lib/permissions';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import NumberInput from '@/components/shared/NumberInput';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, Printer, Check, AlertTriangle } from 'lucide-react';
import BackButton from '@/components/shared/BackButton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import StaticOdontogram from '@/components/patient/StaticOdontogram';
import SurfaceSelector from '@/components/patient/SurfaceSelector';
import { formatCurrencyTotals, computeLedgerBalance, formatNumber, formatPercent } from '@/lib/currencyUtils';
import { printTreatmentPlan } from '@/lib/treatmentPlanExport';

const STATUS_BADGE = {
  planned:     'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed:   'bg-green-100 text-green-700 border-green-200',
  cancelled:   'bg-red-100 text-red-700 border-red-200',
};

const ALL_TEETH = [
  18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28,
  31,32,33,34,35,36,37,38, 41,42,43,44,45,46,47,48,
];

export default function TreatmentPlanPage() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const navigate = useNavigate();
  const { id: patientId } = useParams();
  const queryClient = useQueryClient();

  const [showDialog, setShowDialog] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  // Plan-level discount
  const [planDiscountType, setPlanDiscountType] = useState('none');
  const [planDiscountValue, setPlanDiscountValue] = useState(0);

  const {
    data: patient,
    isLoading: patientLoading,
    isError: patientError,
    refetch: refetchPatient,
  } = useQuery({
    queryKey: ['patient', patientId, clinic?.id],
    // ROOT CAUSE FIX: previously a single clinic-scoped filter with no error
    // handling — when it came back empty or threw, `patient` stayed undefined
    // forever and the page rendered its loading skeleton indefinitely (the
    // "blank white screen"). Now the lookup has a fallback and the page has
    // explicit loading / error / not-found states.
    queryFn: async () => {
      // Server-verified lookup: the 'get' path rejects any record whose clinic_id
      // differs from the caller's clinic, so a stale or foreign patient id can
      // never resolve to a different patient's plan.
      return await clinicApi.get('Patient', patientId);
    },
    enabled: !!patientId && !!clinic,
    retry: 2,
  });

  // Load saved plan-level discount from patient record
  useEffect(() => {
    if (patient) {
      setPlanDiscountType(patient.plan_discount_type || 'none');
      setPlanDiscountValue(patient.plan_discount_value || 0);
    }
  }, [patient]);

  const { data: patientTreatments = [], isLoading: treatmentsLoading } = useQuery({
    queryKey: ['patientTreatments', patientId],
    queryFn: () => clinicApi.filter('PatientTreatment', { patient_id: patientId, clinic_id: clinic?.id }),
    enabled: !!clinic && !!patientId,
  });

  // Payment ledger — the authoritative record of what the patient has paid.
  const { data: payments = [] } = useQuery({
    queryKey: ['patientPayments', patientId, clinic?.id],
    queryFn: () => clinicApi.filter('Payment', { patient_id: patientId, clinic_id: clinic?.id }),
    enabled: !!clinic && !!patientId,
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

  const deleteMutation = useMutation({
    mutationFn: (id) => clinicApi.delete('PatientTreatment', id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['patientTreatments'] }); toast.success(t('deleted_success')); },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => clinicApi.update('PatientTreatment', id, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['patientTreatments'] }); },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + e.message),
  });

  // ── Plan-level discount helpers ──
  const getDiscountAmount = (pt) => {
    const price = Number(pt.price) || 0;
    if (pt.discount_type === 'percentage') return Math.round(price * (Number(pt.discount_value) || 0) / 100 * 100) / 100;
    if (pt.discount_type === 'fixed') return Number(pt.discount_value) || 0;
    return 0;
  };
  const getDiscountedPrice = (pt) => (Number(pt.price) || 0) - getDiscountAmount(pt);

  // Apply plan-level discount: distribute across all PatientTreatment records and persist
  const applyDiscountMutation = useMutation({
    mutationFn: async () => {
      if (!patient || !clinic) throw new Error(t('try_again'));
      const rawValue = Number(planDiscountValue);
      // Empty / non-numeric input never reaches the API: sending NaN or null
      // into a numeric column is what produced the raw HTTP 400.
      if (planDiscountType !== 'none' && !Number.isFinite(rawValue)) {
        throw new Error(t('invalid_discount_value'));
      }

      try {
        // ONE server operation: validated, distributed over every treatment
        // and the plan metadata saved together. A rejected discount writes
        // nothing, so a plan can never end up half discounted.
        await clinicApi.applyPlanDiscount({
          patientId: patient.id,
          type: planDiscountType,
          value: planDiscountType === 'none' ? 0 : rawValue,
        });
      } catch (e) {
        // Prefer the localized wording for the server's own reason code.
        const code = e?.code;
        if (code && t(code) !== code) throw new Error(t(code));
        const msg = String(e?.message || '');
        throw new Error(/status code \d{3}/i.test(msg) ? `${t('failed_to_save')} — ${t('try_again')}` : (msg || t('failed_to_save')));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientTreatments'] });
      queryClient.invalidateQueries({ queryKey: ['patient'] });
      toast.success(t('discount_applied'));
    },
    onError: (e) => toast.error(e.message || t('failed_to_save')),
  });

  // Per-currency totals — currencies are NEVER mixed
  const totalsByCurrency = useMemo(() => {
    const map = {};
    patientTreatments.forEach(pt => {
      const cur = pt.currency || 'USD';
      if (!map[cur]) map[cur] = { original: 0, discount: 0, final: 0, paid: 0 };
      const disc = pt.discount_type === 'percentage' ? (pt.price * (pt.discount_value || 0) / 100) : (pt.discount_type === 'fixed' ? (pt.discount_value || 0) : 0);
      const final = pt.price - disc;
      map[cur].original = Math.round((map[cur].original + (pt.price || 0)) * 100) / 100;
      map[cur].discount = Math.round((map[cur].discount + disc) * 100) / 100;
      map[cur].final = Math.round((map[cur].final + final) * 100) / 100;
      map[cur].paid = Math.round((map[cur].paid + (pt.paid_amount || 0)) * 100) / 100;
    });
    return map;
  }, [patientTreatments]);
  const sumField = (field) => Object.fromEntries(Object.entries(totalsByCurrency).map(([c, v]) => [c, v[field]]));
  // Paid is taken from the payment ledger and remaining is clamped at zero, so
  // a recorded payment always reduces the balance and it can never go negative.
  const { paidByCurrency: ledgerPaidByCurrency, remainingByCurrency } = useMemo(
    () => computeLedgerBalance(patientTreatments, payments),
    [patientTreatments, payments]
  );
  // Plan-level discount preview (screen only) — applied to the clinic's default currency subtotal
  const clinicCur = clinic?.currency || 'USD';
  const planDiscountPreview = planDiscountType === 'percentage'
    ? (totalsByCurrency[clinicCur]?.original || 0) * (planDiscountValue || 0) / 100
    : planDiscountType === 'fixed' ? (planDiscountValue || 0) : 0;
  // Empty or out-of-range values are rejected before any request is sent.
  const discountInvalid = planDiscountType === 'percentage'
    ? !(Number(planDiscountValue) > 0 && Number(planDiscountValue) <= 100)
    : planDiscountType === 'fixed'
      ? !(Number(planDiscountValue) >= 0)
      : false;

  // Prints a dedicated, self-contained A4 document instead of the live app page —
  // see src/lib/treatmentPlanExport.js for why window.print() produced a blank
  // preview on Android. Read-only: it never writes to the stored plan.
  const handlePrint = () => {
    printTreatmentPlan({
      clinic,
      patient,
      treatments: sortedTreatments,
      totalsByCurrency,
      paidByCurrency: ledgerPaidByCurrency,
      remainingByCurrency,
      lang,
      showPatientPhone: !roleIsDoctor(effectiveRole),
    });
  };

  if (patientError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackPath={`/patients/${patientId}`} />
          <h1 className="text-xl font-bold">{t('treatment_plan')}</h1>
        </div>
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 mx-auto text-destructive" />
            <p className="font-semibold">Could not load the treatment plan</p>
            <p className="text-sm text-muted-foreground">{t('try_again')}</p>
            <Button onClick={() => refetchPatient()}>{t('try_again')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // The patient query is paused until the clinic is resolved — that is loading,
  // not a missing record, so never surface "not found" during it.
  if (!clinic || patientLoading || treatmentsLoading) {
    return (
      <div className="space-y-4 animate-pulse p-4">
        <div className="h-10 bg-secondary rounded-xl w-60" />
        <div className="h-64 bg-secondary rounded-xl" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackPath="/patients" />
          <h1 className="text-xl font-bold">{t('treatment_plan')}</h1>
        </div>
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="font-semibold">Patient not found</p>
            <p className="text-sm text-muted-foreground">
              This patient does not exist, or you do not have access to this clinic&apos;s records.
            </p>
            <Button onClick={() => navigate('/patients')}>{t('patients')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sort treatments: by tooth number, then by date
  const sortedTreatments = [...patientTreatments].sort((a, b) => {
    const ta = (a.tooth_numbers || [])[0] || 999;
    const tb = (b.tooth_numbers || [])[0] || 999;
    return ta - tb;
  });

  return (
    <>
      <div className="space-y-5 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap no-print">
          <BackButton fallbackPath={`/patients/${patientId}`} />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold leading-tight">{patient.full_name}</h1>
            <p className="text-sm text-muted-foreground">{t('treatment_plan')}{!roleIsDoctor(effectiveRole) && patient.phone ? ` · ${patient.phone}` : ''}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" />{t('print')}
            </Button>
            <Button
              className="gradient-primary text-white"
              onClick={() => { setEditingTreatment(null); setShowDialog(true); }}
            >
              <Plus className="w-4 h-4 mr-1" />{t('add_treatment')}
            </Button>
          </div>
        </div>

        {/* Static Odontogram */}
        <Card className="glass border-0 shadow-lg no-print">
          <CardContent className="pt-4">
            <StaticOdontogram
              patient={patient}
              clinic={clinic}
              patientTreatments={patientTreatments}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ['patientTreatments'] })}
            />
          </CardContent>
        </Card>

        {/* Printable Treatment Plan */}
        <div id="treatment-plan-print">
          {/* Treatment Table */}
          <Card className="glass border-0 shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{t('treatment_plan')} — {t('n_records').replace('{n}', sortedTreatments.length)}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {sortedTreatments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10 italic">
                  {t('no_treatments_select_hint')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-secondary/40">
                        <th className="px-3 py-2.5 text-left font-semibold text-xs text-muted-foreground">{t('tooth_label')}</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs text-muted-foreground">{t('condition')}</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs text-muted-foreground">{t('treatment')}</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs text-muted-foreground">{t('doctor')}</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-xs text-muted-foreground">{t('unit_price')}</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-xs text-muted-foreground">{t('qty')}</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-xs text-muted-foreground">{t('total')}</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-xs text-muted-foreground">{t('status')}</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs text-muted-foreground">{t('notes')}</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs text-muted-foreground">{t('date')}</th>
                        <th className="px-3 py-2.5 no-print"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTreatments.map((pt, i) => {
                        const toothNum = (pt.tooth_numbers || [])[0];
                        return (
                          <tr key={pt.id} className={`border-b hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                            <td className="px-3 py-2.5">
                              {toothNum ? (
                                <div>
                                  <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-xs">#{toothNum}</span>
                                  {(pt.tooth_surfaces?.[String(toothNum)] || []).length > 0 && (
                                    <div className="flex flex-wrap gap-0.5 mt-1">
                                      {(pt.tooth_surfaces[String(toothNum)] || []).map(s => (
                                        <span key={s} className="text-[10px] bg-accent/10 text-accent px-1 rounded">{t(s)}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{pt.description || '—'}</td>
                            <td className="px-3 py-2.5 font-medium">{pt.treatment_name}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{pt.doctor_name || '—'}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(pt.price || 0)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">1</td>
                            <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                              {formatNumber(getDiscountedPrice(pt))} <span className="text-xs text-muted-foreground">{pt.currency}</span>
                              {getDiscountAmount(pt) > 0 && (
                                <div className="text-[10px] text-muted-foreground line-through">{formatNumber(pt.price || 0)}</div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <Select value={pt.status} onValueChange={v => updateStatusMutation.mutate({ id: pt.id, status: v })}>
                                <SelectTrigger className="h-6 w-28 text-xs border-0 bg-transparent p-0 no-print">
                                  <Badge className={`text-xs border ${STATUS_BADGE[pt.status]} cursor-pointer`}>{t(pt.status)}</Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="planned">{t('planned')}</SelectItem>
                                  <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
                                  <SelectItem value="completed">{t('completed')}</SelectItem>
                                  <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[120px] truncate">{pt.notes || '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDisplayDate(pt.treatment_date, lang)}</td>
                            <td className="px-3 py-2.5 no-print">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="w-7 h-7"
                                  onClick={() => { setEditingTreatment(pt); setShowDialog(true); }}>
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                {!roleIsDoctor(effectiveRole) && (
                                  <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive"
                                    onClick={() => deleteMutation.mutate(pt.id)} disabled={deleteMutation.isPending}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan-level Discount */}
          <Card className="glass border-0 shadow no-print">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('plan_discount')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('discount_type')}</Label>
                  <Select value={planDiscountType} onValueChange={v => { setPlanDiscountType(v); if (v === 'none') setPlanDiscountValue(0); }}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('no_discount')}</SelectItem>
                      <SelectItem value="percentage">{t('percentage')} (%)</SelectItem>
                      <SelectItem value="fixed">{t('fixed_amount')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {planDiscountType !== 'none' && (
                  <div className="space-y-1">
                    <Label className="text-xs">{planDiscountType === 'percentage' ? `${t('discount')} (%)` : `${t('discount')} (${clinic?.currency || 'USD'})`}</Label>
                    <NumberInput
                      min={0}
                      max={planDiscountType === 'percentage' ? 100 : undefined}
                      value={planDiscountValue}
                      onChange={setPlanDiscountValue}
                      className="w-32"
                    />
                  </div>
                )}
                {planDiscountType !== 'none' && (
                  <p className="text-sm text-muted-foreground pb-1">
                    = {formatNumber(planDiscountPreview)} {clinic?.currency || 'USD'} {t('off')}
                  </p>
                )}
                <Button
                  className="gradient-primary text-white"
                  disabled={applyDiscountMutation.isPending || patientTreatments.length === 0 || discountInvalid}
                  onClick={() => applyDiscountMutation.mutate()}
                >
                  {applyDiscountMutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  {t('apply')}
                </Button>
              </div>
              {patient?.plan_discount_type && patient.plan_discount_type !== 'none' && (
                <p className="text-xs text-green-600 mt-2">
                  ✓ {t('discount_applied')}: <span className="bidi-iso">{patient.plan_discount_type === 'percentage' ? formatPercent(patient.plan_discount_value, lang) : `${formatNumber(patient.plan_discount_value, lang)} ${clinic?.currency || 'USD'}`}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Summary — per currency, currencies are never mixed */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: t('original_total'), value: formatCurrencyTotals(sumField('original')) },
              { label: t('discount'), value: formatCurrencyTotals(sumField('discount')), negative: true },
              { label: t('final_total'), value: formatCurrencyTotals(sumField('final')), accent: true },
              { label: t('paid'), value: formatCurrencyTotals(ledgerPaidByCurrency), positive: true },
              { label: t('remaining'), value: formatCurrencyTotals(remainingByCurrency), highlight: true },
            ].map(({ label, value, highlight, accent, negative, positive }) => (
              <Card key={label} className={`border-0 shadow-sm ${highlight ? 'ring-1 ring-destructive/30 bg-destructive/5' : accent ? 'ring-1 ring-primary/30 bg-primary/5' : 'glass'}`}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-base font-bold tabular-nums break-words ${highlight ? 'text-destructive' : accent ? 'text-primary' : negative ? 'text-amber-600' : positive ? 'text-green-600' : ''}`}>
                    {value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

        </div>

        <TreatmentDialog
          open={showDialog}
          onClose={() => { setShowDialog(false); setEditingTreatment(null); }}
          editing={editingTreatment}
          patient={patient}
          clinic={clinic}
          treatments={treatments}
          doctors={doctors}
          preSelectedTeeth={[]}
          onSaved={() => {}}
        />
      </div>
    </>
  );
}

// ─── Treatment Dialog (Add / Edit) ────────────────────────────────────────────
function TreatmentDialog({ open, onClose, editing, patient, clinic, treatments, doctors, preSelectedTeeth, onSaved }) {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();

  const defaultForm = () => ({
    treatment_id: '', treatment_name: '', description: '', price: 0,
    currency: clinic?.currency || 'USD', paid_amount: 0,
    discount_type: 'none', discount_value: 0, status: 'planned',
    doctor_id: '', doctor_name: '',
    treatment_date: format(new Date(), 'yyyy-MM-dd'),
    tooth_numbers: preSelectedTeeth || [],
    tooth_surfaces: {},
    applicable_surfaces: [],
    selectedSurfaces: [],
    notes: '',
  });

  const [form, setForm] = useState(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [surfacesConfirmed, setSurfacesConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        const firstTooth = (editing.tooth_numbers || [])[0];
        const existingSurfaces = firstTooth ? (editing.tooth_surfaces?.[String(firstTooth)] || []) : [];
        setForm({ ...defaultForm(), ...editing, tooth_numbers: editing.tooth_numbers || [], tooth_surfaces: editing.tooth_surfaces || {}, applicable_surfaces: editing.applicable_surfaces || [], selectedSurfaces: existingSurfaces });
        setSurfacesConfirmed(existingSurfaces.length > 0);
      } else {
        setForm({ ...defaultForm(), tooth_numbers: preSelectedTeeth || [], tooth_surfaces: {}, applicable_surfaces: [], selectedSurfaces: [] });
        setSurfacesConfirmed(false);
      }
    }
  }, [open, editing, preSelectedTeeth]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTreatmentSelect = (id) => {
    const tr = treatments.find(t => t.id === id);
    if (tr) {
      setForm(f => ({ ...f, treatment_id: id, treatment_name: tr.name, price: tr.default_price || 0, currency: tr.currency || f.currency, description: tr.description || '', applicable_surfaces: tr.applicable_surfaces || [], selectedSurfaces: [] }));
      setSurfacesConfirmed(false);
    }
  };

  const handleDoctorSelect = (id) => {
    const doc = doctors.find(d => d.id === id);
    if (doc) setForm(f => ({ ...f, doctor_id: id, doctor_name: doc.name }));
  };

  const toggleTooth = (n) => {
    setForm(f => {
      const isSelected = f.tooth_numbers.includes(n);
      const newTeeth = isSelected
        ? f.tooth_numbers.filter(x => x !== n)
        : [...f.tooth_numbers, n];
      const newSurfaces = { ...f.tooth_surfaces };
      if (isSelected) delete newSurfaces[String(n)];
      return { ...f, tooth_numbers: newTeeth, tooth_surfaces: newSurfaces };
    });
  };

  // Price preview: unit price × number of teeth
  const teethCount = form.tooth_numbers.length || 1;
  const totalPreview = (form.price || 0) * (editing ? 1 : teethCount);

  const handleSave = async () => {
    if (!form.treatment_name?.trim()) { toast.error(t('treatment_name_required')); return; }
    setIsSaving(true);
    try {
      if (editing) {
        // Update single record
        await clinicApi.update('PatientTreatment', editing.id, {
          treatment_id: form.treatment_id,
          treatment_name: form.treatment_name,
          description: form.description,
          price: Number(form.price) || 0,
          currency: form.currency,
          paid_amount: Number(form.paid_amount) || 0,
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value) || 0,
          status: form.status,
          doctor_id: form.doctor_id,
          doctor_name: form.doctor_name,
          treatment_date: form.treatment_date,
          tooth_numbers: form.tooth_numbers,
          tooth_surfaces: Object.fromEntries((form.tooth_numbers || []).map(tooth => [String(tooth), form.selectedSurfaces])),
          notes: form.notes,
        });
        toast.success(t('treatment_updated'));
      } else {
        // Create one record PER tooth (if multiple teeth selected)
        const teeth = form.tooth_numbers.length > 0 ? form.tooth_numbers : [null];
        const creates = teeth.map(tooth =>
          clinicApi.create('PatientTreatment', {
            clinic_id: clinic.id,
            patient_id: patient.id,
            treatment_id: form.treatment_id,
            treatment_name: form.treatment_name,
            description: form.description,
            price: Number(form.price) || 0,   // per-tooth unit price
            currency: form.currency,
            paid_amount: 0,             // paid handled separately
            discount_type: 'none',
            discount_value: 0,
            status: form.status,
            doctor_id: form.doctor_id,
            doctor_name: form.doctor_name,
            treatment_date: form.treatment_date,
            tooth_numbers: tooth ? [tooth] : [],
            tooth_surfaces: tooth ? { [String(tooth)]: form.selectedSurfaces } : {},
            notes: form.notes,
          })
        );
        await Promise.all(creates);
        toast.success(teeth.length > 1 ? t('n_treatment_records_created').replace('{n}', teeth.length) : t('treatment_saved'));
        onSaved && onSaved();
      }
      queryClient.invalidateQueries({ queryKey: ['patientTreatments'] });
      onClose();
    } catch (e) {
      toast.error(t('failed_to_save') + ': ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('edit_treatment') : t('add_treatment')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Tooth selector */}
          <div className="space-y-2">
            <Label>{t('tooth_numbers')} {!editing && t('one_record_per_tooth')}</Label>
            <div className="p-3 bg-secondary/30 rounded-xl">
              <div className="flex flex-wrap gap-1.5">
                {ALL_TEETH.map(n => (
                  <button key={n} type="button" onClick={() => toggleTooth(n)}
                    className={`w-9 h-9 text-xs font-semibold rounded-lg border-2 transition-all hover:scale-105
                      ${form.tooth_numbers.includes(n)
                        ? 'bg-primary text-white border-primary shadow'
                        : 'bg-background border-border text-muted-foreground hover:border-primary/50'}`}
                  >{n}</button>
                ))}
              </div>
              {form.tooth_numbers.length > 0 && (
                <p className="text-xs text-primary font-medium mt-2">
                  {t('selected_label')} {[...form.tooth_numbers].sort((a,b)=>a-b).join(', ')}
                  {!editing && ` · ${t('n_records_will_be_created').replace('{n}', form.tooth_numbers.length)}`}
                </p>
              )}
            </div>
          </div>

          {/* Treatment catalog — select treatment AFTER tooth */}
          <div className="space-y-2">
            <Label>{t('from_catalog')}</Label>
            <Select value={form.treatment_id} onValueChange={handleTreatmentSelect}>
              <SelectTrigger><SelectValue placeholder={t('select_treatment_template')} /></SelectTrigger>
              <SelectContent>
                {treatments.map(tr => (
                  <SelectItem key={tr.id} value={tr.id}>{tr.name} — {tr.default_price} {tr.currency}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Surface selection — only after treatment is selected and has applicable surfaces */}
          {form.treatment_id && form.applicable_surfaces?.length > 0 && (
            <div className="space-y-2">
              <Label>{t('surfaces')} <span className="text-xs text-destructive font-normal">({t('required')})</span></Label>
              {!surfacesConfirmed ? (
                <div className="p-3 bg-secondary/30 rounded-lg space-y-3">
                  <SurfaceSelector
                    surfaces={form.selectedSurfaces}
                    onChange={(s) => setForm(f => ({ ...f, selectedSurfaces: s }))}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>{t('treatment')} *</Label>
              <Input value={form.treatment_name} onChange={e => set('treatment_name', e.target.value)} placeholder={t('treatment')} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>{t('description_condition')}</Label>
              <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder={t('description_condition')} />
            </div>
            <div className="space-y-2">
              <Label>{t('unit_price_per_tooth')}</Label>
              <NumberInput min={0} value={form.price} onChange={v => set('price', v)} />
            </div>
            <div className="space-y-2">
              <Label>{t('currency')}</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="SYP">SYP</SelectItem><SelectItem value="TRY">TRY</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('status')}</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">{t('planned')}</SelectItem>
                  <SelectItem value="in_progress">{t('in_progress')}</SelectItem>
                  <SelectItem value="completed">{t('completed')}</SelectItem>
                  <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('doctor')}</Label>
              <Select value={form.doctor_id} onValueChange={handleDoctorSelect}>
                <SelectTrigger><SelectValue placeholder={t('doctor')} /></SelectTrigger>
                <SelectContent>
                  {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('date')}</Label>
              <Input type="date" value={form.treatment_date} onChange={e => set('treatment_date', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder={t('clinical_notes_placeholder')} />
          </div>

          {/* Cost preview */}
          {!editing && form.price > 0 && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-sm font-semibold text-primary">
                {t('cost_preview')}: {form.price} × {teethCount} {t('tooth_singular')} = <span className="text-lg">{formatNumber(totalPreview)} {form.currency}</span>
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !form.treatment_name?.trim() || (form.treatment_id && form.applicable_surfaces?.length > 0 && !surfacesConfirmed)}
              className="gradient-primary text-white"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? t('update_btn') : (form.tooth_numbers.length > 1 ? t('save_n_records').replace('{n}', form.tooth_numbers.length) : t('save'))}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}