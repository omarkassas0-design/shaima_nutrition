import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { useLanguage } from '@/lib/useLanguage';
import { getClinicId } from '@/lib/useClinicId';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import EntitySearchSelect from '@/components/shared/EntitySearchSelect';

/**
 * Shared Patient form — the FULL form with Patient Source, Doctor assignment,
 * and all fields. Used by both the AddPatient page (inside a Card) and the
 * Quick Add Patient dialog (inside a Dialog). This is the single source of
 * truth for patient creation logic.
 *
 * Props:
 *   onSuccess(patient) — called after successful creation (e.g. navigate)
 *   onCancel()         — called when cancel button is clicked
 */
export default function PatientForm({ onSuccess, onCancel }) {
  const { t } = useLanguage();
  const { clinic } = useClinic();
  const queryClient = useQueryClient();
  const clinicId = clinic?.id;

  const [form, setForm] = useState({
    full_name: '', phone: '', whatsapp_number: '', whatsapp_opt_in: false,
    patient_source: '', referring_doctor_id: '', referring_doctor_name: '',
    assigned_doctor_id: '', assigned_doctor_name: '',
    gender: '', birth_date: '', address: '', notes: '',
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors', clinicId],
    queryFn: () => clinicId ? clinicApi.filter('Doctor', { clinic_id: clinicId }, 'name', 200) : [],
    enabled: !!clinicId,
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const clinic_id = await getClinicId(clinic);
      return clinicApi.create('Patient', { ...form, clinic_id });
    },
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      toast.success(t('patient_created'));
      onSuccess?.(patient);
    },
    onError: (err) => toast.error(t('failed_to_create_patient') + ': ' + (err?.message || '')),
  });

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!form.full_name.trim()) return toast.error(t('name_required'));
    if (!form.phone.trim()) return toast.error(t('phone_required'));
    mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t('full_name')} *</Label>
        <Input value={form.full_name} onChange={set('full_name')} placeholder={t('full_name')} />
      </div>

      <div className="space-y-1.5">
        <Label>{t('phone')} *</Label>
        <Input value={form.phone} onChange={set('phone')} placeholder={t('phone')} dir="ltr" />
      </div>

      <div className="space-y-1.5">
        <Label>{t('whatsapp_number')}</Label>
        <Input value={form.whatsapp_number} onChange={set('whatsapp_number')} placeholder="+1234567890" dir="ltr" />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="wa-opt-in"
          checked={form.whatsapp_opt_in}
          onChange={e => setForm(f => ({ ...f, whatsapp_opt_in: e.target.checked }))}
          className="h-4 w-4"
        />
        <Label htmlFor="wa-opt-in" className="text-sm">{t('enable_whatsapp_reminders')}</Label>
      </div>

      <div className="space-y-1.5">
        <Label>{t('patient_source')}</Label>
        <Select
          value={form.patient_source}
          onValueChange={v => setForm(f => ({ ...f, patient_source: v, referring_doctor_id: v === 'clinic' ? '' : f.referring_doctor_id, assigned_doctor_id: v === 'doctor' ? '' : f.assigned_doctor_id }))}
        >
          <SelectTrigger><SelectValue placeholder={t('select_patient_source')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="doctor">{t('source_doctor')}</SelectItem>
            <SelectItem value="clinic">{t('source_clinic')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.patient_source === 'doctor' && (
        <div className="space-y-1.5">
          <Label>{t('referring_doctor')}</Label>
          <EntitySearchSelect
            entity="Doctor"
            clinicId={clinicId}
            value={form.referring_doctor_id}
            selectedLabel={form.referring_doctor_name || doctors.find(d => d.id === form.referring_doctor_id)?.name}
            onChange={(id, rec) => setForm(f => ({ ...f, referring_doctor_id: id, referring_doctor_name: rec?.name || '' }))}
            labelKey="name"
            secondaryKey="phone"
            placeholder={t('select_doctor')}
            disabled={!clinicId}
          />
        </div>
      )}

      {form.patient_source === 'clinic' && (
        <div className="space-y-1.5">
          <Label>{t('assigned_doctor')}</Label>
          <EntitySearchSelect
            entity="Doctor"
            clinicId={clinicId}
            value={form.assigned_doctor_id}
            selectedLabel={form.assigned_doctor_name || doctors.find(d => d.id === form.assigned_doctor_id)?.name}
            onChange={(id, rec) => setForm(f => ({ ...f, assigned_doctor_id: id, assigned_doctor_name: rec?.name || '' }))}
            labelKey="name"
            secondaryKey="phone"
            placeholder={t('select_doctor')}
            disabled={!clinicId}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t('gender')}</Label>
          <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
            <SelectTrigger><SelectValue placeholder={t('select_gender')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">{t('male')}</SelectItem>
              <SelectItem value="female">{t('female')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('birth_date')}</Label>
          <Input type="date" value={form.birth_date} onChange={set('birth_date')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t('address')}</Label>
        <Input value={form.address} onChange={set('address')} placeholder={t('address')} />
      </div>

      <div className="space-y-1.5">
        <Label>{t('notes')}</Label>
        <Textarea value={form.notes} onChange={set('notes')} rows={3} />
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isPending} className="gradient-primary text-white">
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save')}
        </Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>{t('cancel')}</Button>}
      </div>
    </form>
  );
}