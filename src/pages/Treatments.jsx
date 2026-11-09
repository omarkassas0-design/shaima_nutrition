import React, { useState, useEffect, useMemo } from 'react';

// Sentinel value for the "create a new category" option in the category select.
const NEW_CATEGORY = '__new_category__';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { roleIsDoctor } from '@/lib/permissions';
import { getClinicId } from '@/lib/useClinicId';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Stethoscope, Pencil, Trash2, Loader2, Clock } from 'lucide-react';
import NumberInput from '@/components/shared/NumberInput';
import { treatmentCountLabel } from '@/lib/pluralize';
import SurfaceSelector from '@/components/patient/SurfaceSelector';
import { Checkbox } from '@/components/ui/checkbox';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { deleteWithUndo } from '@/lib/undoDelete';

export default function Treatments() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const doctorView = roleIsDoctor(effectiveRole);

  const { data: treatments = [] } = useQuery({
    queryKey: ['treatments', clinic?.id],
    queryFn: () => clinicApi.filter('Treatment', { clinic_id: clinic.id }),
    enabled: !!clinic?.id,
    staleTime: 10 * 60 * 1000,
  });

  const handleDelete = (tr) => deleteWithUndo('Treatment', tr, 'Treatment', () =>
    queryClient.invalidateQueries({ queryKey: ['treatments'] })
  );

  return (
    <div>
      <PageHeader
        title={t('treatments')}
        subtitle={treatmentCountLabel(treatments.length, lang)}
        actionLabel={doctorView ? undefined : t('add_treatment')}
        onAction={doctorView ? undefined : () => { setEditing(null); setShowForm(true); }}
      />

      {treatments.length === 0 ? (
        <EmptyState icon={Stethoscope} title={t('no_treatments')} actionLabel={doctorView ? undefined : t('add_treatment')} onAction={doctorView ? undefined : () => setShowForm(true)} />
      ) : (
        <div className="space-y-4">
          {Object.entries(
            treatments.reduce((acc, tr) => {
              const cat = (tr.category || '').trim() || t('uncategorized');
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(tr);
              return acc;
            }, {})
          ).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-primary" />
                <span className="truncate">{category}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{items.length}</Badge>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {items.map((tr, i) => (
                  <motion.div key={tr.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <Card className="glass border-0 shadow-sm hover:shadow-md transition-shadow h-full">
                      <CardContent className="p-2.5">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-semibold leading-snug truncate min-w-0 flex-1">{tr.name}</p>
                          <Badge variant={tr.status === 'active' ? 'default' : 'secondary'} className="text-[9px] px-1.5 py-0 shrink-0">{t(tr.status)}</Badge>
                        </div>
                        {tr.description && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{tr.description}</p>}
                        {tr.applicable_surfaces?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tr.applicable_surfaces.map(s => (
                              <span key={s} className="text-[9px] bg-accent/10 text-accent px-1 py-0.5 rounded">{t(s) || s}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-1.5">
                          <span className="text-xs font-bold text-primary tabular-nums truncate">{tr.default_price || 0} {tr.currency}</span>
                          {tr.duration_minutes && (
                            <span className="text-muted-foreground flex items-center gap-0.5 text-[10px] shrink-0">
                              <Clock className="w-3 h-3" />{tr.duration_minutes} {t('minutes')}
                            </span>
                          )}
                        </div>
                        {!doctorView && (
                          <div className="flex gap-0.5 justify-end mt-1">
                            <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => { setEditing(tr); setShowForm(true); }}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive"
                              onClick={() => handleDelete(tr)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TreatmentFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        editing={editing}
        clinic={clinic}
        treatments={treatments}
      />
    </div>
  );
}

function TreatmentFormDialog({ open, onClose, editing, clinic, treatments = [] }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const defaultForm = {
    name: '', category: '', description: '', notes: '',
    default_price: 0, currency: 'USD', duration_minutes: 30, status: 'active',
    applicable_surfaces: [],
  };

  const [form, setForm] = useState(defaultForm);
  const [showSurfaces, setShowSurfaces] = useState(false);
  // Choosing from the existing categories stops duplicate categories being
  // created by retyping the same name with different spelling/spacing.
  const [creatingCategory, setCreatingCategory] = useState(false);

  const existingCategories = useMemo(() => {
    const set = new Set();
    treatments.forEach(tr => {
      const c = (tr.category || '').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [treatments]);

  useEffect(() => {
    setCreatingCategory(false);
    if (editing) {
      setForm({ ...defaultForm, ...editing });
      setShowSurfaces((editing.applicable_surfaces || []).length > 0);
    } else {
      setForm(defaultForm);
      setShowSurfaces(false);
    }
  }, [editing, open]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (!data.name?.trim()) throw new Error('Treatment name is required');
      // Trim both fields so "Restorative " and "Restorative" remain ONE category.
      const payload = {
        ...data,
        name: data.name.trim(),
        category: (data.category || '').trim(),
        // Numeric columns never receive an empty string from the inputs.
        default_price: Number(data.default_price) || 0,
        duration_minutes: Number(data.duration_minutes) || 0,
      };
      const clinicId = await getClinicId(clinic);
      if (editing) return clinicApi.update('Treatment', editing.id, payload);
      return clinicApi.create('Treatment', { ...payload, clinic_id: clinicId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatments'] });
      toast.success(editing ? t('updated_success') : t('created_success'));
      onClose();
    },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? t('edit') : t('add_treatment')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('name')} *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dental Crown" />
          </div>
          <div className="space-y-2">
            <Label>{t('category')}</Label>
            <Select
              value={creatingCategory ? NEW_CATEGORY : (form.category || '')}
              onValueChange={(v) => {
                if (v === NEW_CATEGORY) {
                  setCreatingCategory(true);
                  setForm({ ...form, category: '' });
                  return;
                }
                setCreatingCategory(false);
                setForm({ ...form, category: v });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {existingCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                <SelectItem value={NEW_CATEGORY}>+ New category</SelectItem>
              </SelectContent>
            </Select>
            {creatingCategory && (
              <Input
                autoFocus
                value={form.category || ''}
                onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder="New category name"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('description')}</Label>
            <Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('default_price')}</Label>
              <NumberInput min={0} value={form.default_price} onChange={v => setForm({ ...form, default_price: v })} />
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
            <div className="space-y-2">
              <Label>{t('duration')} (min)</Label>
              <NumberInput min={5} value={form.duration_minutes} onChange={v => setForm({ ...form, duration_minutes: v })} />
            </div>
            <div className="space-y-2">
              <Label>{t('status')}</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('active')}</SelectItem>
                  <SelectItem value="inactive">{t('inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="add-surfaces"
                checked={showSurfaces}
                onCheckedChange={(checked) => {
                  setShowSurfaces(!!checked);
                  if (!checked) setForm({ ...form, applicable_surfaces: [] });
                }}
              />
              <Label htmlFor="add-surfaces" className="cursor-pointer">
                {t('add_surfaces')} <span className="text-xs text-muted-foreground font-normal">({t('optional')})</span>
              </Label>
            </div>
            {showSurfaces && (
              <div className="p-3 bg-secondary/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">{t('applicable_surfaces_hint')}</p>
                <SurfaceSelector
                  surfaces={form.applicable_surfaces || []}
                  onChange={(s) => setForm({ ...form, applicable_surfaces: s })}
                  allowCustom
                />
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name?.trim()} className="gradient-primary text-white">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}