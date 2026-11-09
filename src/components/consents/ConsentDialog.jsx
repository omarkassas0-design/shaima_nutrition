import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import SignaturePad from '@/components/consents/SignaturePad';
import { CONSENT_TEMPLATES, fillConsentTemplate } from '@/lib/consentTemplates';

export default function ConsentDialog({ open, onClose, patient }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    template_key: '',
    procedure_name: '',
    procedure_date: format(new Date(), 'yyyy-MM-dd'),
    doctor_id: '',
    signature: null,
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors', clinic?.id],
    queryFn: () => clinic ? clinicApi.filter('Doctor', { clinic_id: clinic.id }) : [],
    enabled: !!clinic,
  });

  const selectedTemplate = useMemo(
    () => CONSENT_TEMPLATES.find(tpl => tpl.key === form.template_key),
    [form.template_key]
  );

  const selectedDoctor = doctors.find(d => d.id === form.doctor_id);

  const filledBody = useMemo(() => {
    if (!selectedTemplate) return '';
    return fillConsentTemplate(selectedTemplate, {
      patient_name: patient?.full_name,
      clinic_name: clinic?.name,
      doctor_name: selectedDoctor?.name,
      procedure_name: form.procedure_name,
      date: form.procedure_date,
      lang,
    });
  }, [selectedTemplate, patient, clinic, selectedDoctor, form.procedure_name, form.procedure_date, lang]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clinic?.id) throw new Error('Clinic not set up');
      if (!form.template_key) throw new Error(t('select_template'));
      if (!form.signature) throw new Error(t('please_sign'));
      const template = selectedTemplate;
      const record = {
        patient_id: patient.id,
        patient_name: patient.full_name,
        template_key: form.template_key,
        template_name: template.name[lang] || template.name.en,
        procedure_name: form.procedure_name || '',
        procedure_date: form.procedure_date,
        doctor_id: form.doctor_id || '',
        doctor_name: selectedDoctor?.name || '',
        consent_body: filledBody,
        patient_signature: form.signature,
        signed_at: new Date().toISOString(),
        status: 'signed',
      };
      return clinicApi.create('ConsentForm', record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientConsents'] });
      toast.success(t('consent_created'));
      onClose();
      setForm({ template_key: '', procedure_name: '', procedure_date: format(new Date(), 'yyyy-MM-dd'), doctor_id: '', signature: null });
    },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + (e?.message || '')),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('create_consent')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('consent_template')} *</Label>
            <Select value={form.template_key} onValueChange={v => setForm(f => ({ ...f, template_key: v }))}>
              <SelectTrigger><SelectValue placeholder={t('select_template')} /></SelectTrigger>
              <SelectContent>
                {CONSENT_TEMPLATES.map(tpl => (
                  <SelectItem key={tpl.key} value={tpl.key}>
                    {tpl.name[lang] || tpl.name.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('procedure_name')}</Label>
            <Input
              value={form.procedure_name}
              onChange={e => setForm(f => ({ ...f, procedure_name: e.target.value }))}
              placeholder={t('procedure_name')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('procedure_date')}</Label>
              <Input type="date" value={form.procedure_date} onChange={e => setForm(f => ({ ...f, procedure_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('doctor')}</Label>
              <Select value={form.doctor_id} onValueChange={v => setForm(f => ({ ...f, doctor_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t('doctor')} /></SelectTrigger>
                <SelectContent>
                  {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filledBody && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border max-h-48 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap font-sans">{filledBody}</pre>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('patient_signature')} *</Label>
            <SignaturePad onChange={(dataUrl) => setForm(f => ({ ...f, signature: dataUrl }))} />
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.template_key || !form.signature}
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