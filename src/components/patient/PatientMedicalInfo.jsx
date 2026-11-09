import React, { useState, useCallback } from 'react';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Save, X, Heart, Activity } from 'lucide-react';
import MedicalInfoField from '@/components/patient/MedicalInfoField';

export default function PatientMedicalInfo({ patient }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const med = patient.medical_info || {};
  const dental = patient.dental_history || {};
  const [form, setForm] = useState({ ...med });
  const [dentalForm, setDentalForm] = useState({ ...dental });

  const saveMutation = useMutation({
    mutationFn: () => clinicApi.update('Patient', patient.id, {
      medical_info: form,
      dental_history: dentalForm,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      setEditing(false);
      toast.success('Saved');
    },
    onError: () => toast.error('Failed to save'),
  });
  const handleSave = () => saveMutation.mutate();

  // Stable wrapper: only recreated when `editing` toggles, NOT on every keystroke.
  // Without useCallback, F is a new function each render → React remounts the
  // input on every character → mobile keyboard closes and focus is lost.
  const F = useCallback(
    (props) => <MedicalInfoField {...props} editing={editing} />,
    [editing]
  );

  return (
    <div className="space-y-4">
      <Card className="glass border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" />{t('medical_info')}
          </CardTitle>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5 mr-1.5" />{t('edit')}</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5 mr-1" />{t('cancel')}</Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gradient-primary text-white">
                {saveMutation.isPending ? <span className="w-3.5 h-3.5 mr-1 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                {t('save')}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label={t('chief_complaint')} field="chief_complaint" area formObj={form} setFormObj={setForm} />
            <F label={t('diagnosis')} field="diagnosis" area formObj={form} setFormObj={setForm} />
            <F label={t('medical_history')} field="medical_history" area formObj={form} setFormObj={setForm} />
            <F label={t('previous_treatments')} field="previous_treatments" area formObj={form} setFormObj={setForm} />
            <F label={t('allergies')} field="allergies" formObj={form} setFormObj={setForm} />
            <F label={t('medications')} field="medications" formObj={form} setFormObj={setForm} />
            <F label={t('chronic_diseases')} field="chronic_diseases" formObj={form} setFormObj={setForm} />
            <div className="space-y-1.5">
              <Label className="text-xs">{t('smoking_status')}</Label>
              {editing ? (
                <Select value={form.smoking_status || ''} onValueChange={v => setForm({...form, smoking_status: v})}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="non_smoker">{t('non_smoker')}</SelectItem>
                    <SelectItem value="smoker">{t('smoker')}</SelectItem>
                    <SelectItem value="former_smoker">{t('former_smoker')}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm bg-secondary/50 rounded-lg px-3 py-2">{form.smoking_status ? t(form.smoking_status) : '-'}</p>
              )}
            </div>
            <F label={t('blood_pressure')} field="blood_pressure" formObj={form} setFormObj={setForm} />
            <F label={t('treatment_recommendations')} field="treatment_recommendations" area formObj={form} setFormObj={setForm} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-0 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />{t('dental_history')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label={t('previous_dental')} field="previous_dental" area formObj={dentalForm} setFormObj={setDentalForm} />
            <F label={t('tooth_notes')} field="tooth_notes" area formObj={dentalForm} setFormObj={setDentalForm} />
            <F label={t('orthodontic_history')} field="orthodontic_history" area formObj={dentalForm} setFormObj={setDentalForm} />
            <F label={t('implant_history')} field="implant_history" area formObj={dentalForm} setFormObj={setDentalForm} />
            <F label={t('surgical_history')} field="surgical_history" area formObj={dentalForm} setFormObj={setDentalForm} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}