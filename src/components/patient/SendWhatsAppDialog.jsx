import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MessageCircle, Copy, ExternalLink } from 'lucide-react';
import {
  TEMPLATE_META, TEMPLATE_KEYS,
  getEffectiveTemplates, getDefaultTemplates, renderTemplate, buildWhatsAppLink,
} from '@/lib/messageTemplates';
import { computeOutstandingBalance, currencyTotalsToArray, formatMoney } from '@/lib/currencyUtils';
import {
  buildTemplateData, formatAppointmentLabel, pickDefaultAppointment,
  APPOINTMENT_TEMPLATE_KEYS,
} from '@/lib/messageData';

const tr = (lang, ar, tr, en) => (lang === 'ar' ? ar : lang === 'tr' ? tr : en);

export default function SendWhatsAppDialog({ patient, appointmentId, className }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState(TEMPLATE_KEYS.APPOINTMENT_REMINDER);
  const [customText, setCustomText] = useState('');
  const [outstandingCurrency, setOutstandingCurrency] = useState('USD');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(appointmentId || '');

  const saved = clinic?.settings?.message_templates || {};
  const templates = useMemo(() => getEffectiveTemplates(saved, lang), [clinic?.settings, lang]);

  // Fetch patient treatments to compute outstanding balances per currency
  const { data: treatments = [] } = useQuery({
    queryKey: ['patientTreatments', patient?.id, clinic?.id],
    queryFn: () => clinicApi.filter('PatientTreatment', { patient_id: patient.id }, '-created_date', 200),
    enabled: !!patient?.id && open,
  });

  // Fetch the patient's actual appointments from the database — real data, never hardcoded
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ['patientAppointments', patient?.id, clinic?.id],
    queryFn: () => clinicApi.filter('Appointment', { patient_id: patient.id }, '-date', 100),
    enabled: !!patient?.id && !!clinic?.id && open,
  });

  // Fetch the patient's lab cases for the lab-case reminder template
  const { data: labCases = [] } = useQuery({
    queryKey: ['patientLabCases', patient?.id, clinic?.id],
    queryFn: () => clinicApi.filter('LabCase', { patient_id: patient.id }, '-created_date', 50),
    enabled: !!patient?.id && !!clinic?.id && open,
  });
  const [selectedLabCaseId, setSelectedLabCaseId] = useState('');

  // Outstanding balance per currency (only completed treatments are payable)
  const outstandingByCurrency = useMemo(
    () => computeOutstandingBalance(treatments).remainingByCurrency,
    [treatments],
  );
  const outstandingArr = currencyTotalsToArray(outstandingByCurrency);

  // Auto-select first currency with a balance
  useEffect(() => {
    if (outstandingArr.length > 0 && !outstandingByCurrency[outstandingCurrency]) {
      setOutstandingCurrency(outstandingArr[0].currency);
    }
  }, [outstandingArr, outstandingCurrency]);

  // Auto-select the best appointment when the list loads (or the provided appointmentId)
  useEffect(() => {
    if (appointmentId) {
      setSelectedAppointmentId(appointmentId);
      return;
    }
    if (appointments.length > 0 && !selectedAppointmentId) {
      const best = pickDefaultAppointment(appointments);
      if (best) setSelectedAppointmentId(best.id);
    }
  }, [appointments, appointmentId, selectedAppointmentId]);

  const phone = patient?.whatsapp_number || patient?.phone || '';

  // The appointment currently selected in the message context — prevents mixing patients/appointments
  const selectedAppointment = useMemo(() => {
    if (!appointments.length) return null;
    if (selectedAppointmentId) {
      return appointments.find(a => a.id === selectedAppointmentId) || null;
    }
    return pickDefaultAppointment(appointments);
  }, [appointments, selectedAppointmentId]);

  // The lab case currently selected for lab-case templates
  const selectedLabCase = useMemo(() => {
    if (!labCases.length) return null;
    if (selectedLabCaseId) return labCases.find(lc => lc.id === selectedLabCaseId) || null;
    return labCases[0];
  }, [labCases, selectedLabCaseId]);

  // Build the real data object from actual patient + appointment + lab case + clinic records
  const buildData = () => buildTemplateData({
    patient,
    appointment: selectedAppointment,
    labCase: selectedLabCase,
    clinic,
    outstandingByCurrency,
    currency: outstandingCurrency,
    lang,
  });

  const defaults = getDefaultTemplates(lang);
  const baseText = customText || templates[selectedKey] || defaults[selectedKey] || '';
  const rendered = renderTemplate(baseText, buildData());

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rendered);
      toast.success(tr(lang, 'تم النسخ', 'Kopyalandı', 'Copied'));
    } catch {
      toast.error(tr(lang, 'فشل النسخ', 'Kopyalama başarısız', 'Copy failed'));
    }
  };

  const handleOpenWhatsApp = () => {
    if (!phone) {
      toast.error(tr(lang, 'لا يوجد رقم هاتف', 'Telefon numarası yok', 'No phone number'));
      return;
    }
    // Verify the message before opening WhatsApp — must not be empty
    if (!rendered || !rendered.trim()) {
      toast.error(tr(lang, 'الرسالة فارغة', 'Mesaj boş', 'Message is empty'));
      return;
    }
    window.open(buildWhatsAppLink(phone, rendered), '_blank');
  };

  const label = (meta) => tr(lang, meta.label_ar, meta.label_tr, meta.label_en);
  const isAppointmentTemplate = APPOINTMENT_TEMPLATE_KEYS.has(selectedKey);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={`text-green-600 hover:text-green-700 border-green-300 hover:bg-green-50 ${className || ''}`}>
          <MessageCircle className="w-4 h-4 mr-1.5" />
          {tr(lang, 'رسالة واتساب', 'WhatsApp Mesaj', 'WhatsApp Message')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tr(lang, 'إرسال رسالة واتساب', 'WhatsApp Mesaj Gönder', 'Send WhatsApp Message')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{tr(lang, 'القالب', 'Şablon', 'Template')}</Label>
            <Select value={selectedKey} onValueChange={(v) => { setSelectedKey(v); setCustomText(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_META.map(m => (
                  <SelectItem key={m.key} value={m.key}>{label(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Appointment selector — uses the real appointment selected in the message context */}
          {isAppointmentTemplate && (
            <div className="space-y-1.5">
              <Label>{tr(lang, 'الموعد', 'Randevu', 'Appointment')}</Label>
              {appointmentsLoading ? (
                <p className="text-xs text-muted-foreground">{tr(lang, 'جاري التحميل...', 'Yükleniyor...', 'Loading...')}</p>
              ) : appointments.length === 0 ? (
                <p className="text-xs text-muted-foreground">{tr(lang, 'لا توجد مواعيد', 'Randevu yok', 'No appointments')}</p>
              ) : (
                <Select value={selectedAppointmentId || ''} onValueChange={setSelectedAppointmentId}>
                  <SelectTrigger><SelectValue placeholder={tr(lang, 'اختر موعد', 'Randevu seç', 'Select appointment')} /></SelectTrigger>
                  <SelectContent>
                    {appointments.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {formatAppointmentLabel(a, lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Lab case selector — uses the real lab case selected in the message context */}
          {selectedKey === TEMPLATE_KEYS.LAB_CASE_REMINDER && (
            <div className="space-y-1.5">
              <Label>{tr(lang, 'حالة المختبر', 'Laboratuvar Vakası', 'Lab Case')}</Label>
              {labCases.length === 0 ? (
                <p className="text-xs text-muted-foreground">{tr(lang, 'لا توجد حالات مختبر', 'Laboratuvar vakası yok', 'No lab cases')}</p>
              ) : (
                <Select value={selectedLabCaseId || (selectedLabCase?.id || '')} onValueChange={setSelectedLabCaseId}>
                  <SelectTrigger><SelectValue placeholder={tr(lang, 'اختر حالة', 'Vaka seç', 'Select case')} /></SelectTrigger>
                  <SelectContent>
                    {labCases.map(lc => (
                      <SelectItem key={lc.id} value={lc.id}>
                        {lc.case_type || '—'}{lc.lab_name ? ` — ${lc.lab_name}` : ''}{lc.due_date ? ` (${formatDisplayDate(lc.due_date, lang)})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {(selectedKey === TEMPLATE_KEYS.PAYMENT_REMINDER || selectedKey === TEMPLATE_KEYS.OUTSTANDING_BALANCE) && (
            <div className="space-y-1.5">
              <Label>{tr(lang, 'العملة', 'Para Birimi', 'Currency')}</Label>
              {outstandingArr.length === 0 ? (
                <p className="text-xs text-muted-foreground">{tr(lang, 'لا يوجد رصيد مستحق', 'Ödenmemiş bakiye yok', 'No outstanding balance')}</p>
              ) : (
                <Select value={outstandingCurrency} onValueChange={setOutstandingCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {outstandingArr.map(({ currency, amount, symbol }) => (
                      <SelectItem key={currency} value={currency}>
                        {formatMoney(amount, currency)} {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{tr(lang, 'الرسالة', 'Mesaj', 'Message')}</Label>
            <Textarea
              value={rendered}
              onChange={e => setCustomText(e.target.value)}
              rows={8}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>

          <div className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-2">
            {tr(lang, 'المستلم:', 'Alıcı:', 'Recipient:')} <span className="font-medium" dir="ltr">{phone || '—'}</span>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCopy} disabled={!phone}>
              <Copy className="w-4 h-4 mr-1.5" />{tr(lang, 'نسخ', 'Kopyala', 'Copy')}
            </Button>
            <Button onClick={handleOpenWhatsApp} disabled={!phone} className="bg-green-600 hover:bg-green-700 text-white">
              <ExternalLink className="w-4 h-4 mr-1.5" />{tr(lang, 'فتح واتساب', 'WhatsApp Aç', 'Open WhatsApp')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}