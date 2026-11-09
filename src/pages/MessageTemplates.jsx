import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CalendarClock, CalendarCheck, CalendarX, CalendarMinus, CreditCard, Wallet,
  Stethoscope, FlaskConical, MessageSquare, Heart, RotateCcw, Save, Copy,
  Eye, EyeOff, Loader2, ExternalLink
} from 'lucide-react';
import {
  TEMPLATE_META, TEMPLATE_VARIABLES,
  getEffectiveTemplates, getDefaultTemplates, getSampleData,
  renderTemplate, buildWhatsAppLink,
} from '@/lib/messageTemplates';

const ICONS = { CalendarClock, CalendarCheck, CalendarX, CalendarMinus, CreditCard, Wallet, Stethoscope, FlaskConical, MessageSquare, Heart };

const tr = (lang, ar, tr, en) => (lang === 'ar' ? ar : lang === 'tr' ? tr : en);

export default function MessageTemplates() {
  const { t, lang } = useLanguage();
  const { clinic, updateClinic } = useClinic();
  const queryClient = useQueryClient();

  const saved = clinic?.settings?.message_templates || {};
  const [templates, setTemplates] = useState(() => getEffectiveTemplates(saved, lang));
  const [editing, setEditing] = useState(null);
  const [showPreview, setShowPreview] = useState({});
  const [saving, setSaving] = useState(false);

  const defaults = getDefaultTemplates(lang);
  const isDirty = (key) => (templates[key] || '') !== (saved[lang]?.[key] || defaults[key]);

  // Re-load templates when language changes (shows the selected language's customs/defaults)
  useEffect(() => {
    setTemplates(getEffectiveTemplates(saved, lang));
    setEditing(null);
  }, [lang]);

  const handleEdit = (key) => setEditing(editing === key ? null : key);

  const handleChange = (key, value) => setTemplates(prev => ({ ...prev, [key]: value }));

  const handleRestore = (key) => {
    setTemplates(prev => ({ ...prev, [key]: defaults[key] }));
    toast.success(tr(lang, 'تم استعادة القالب الافتراضي', 'Varsayılan şablon geri yüklendi', 'Default template restored'));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await appClient.functions.invoke('saveMessageTemplates', {
        clinic_id: clinic?.id,
        templates,
        lang,
      });
      const existingTemplates = clinic?.settings?.message_templates || {};
      const normalizedExisting = (existingTemplates.en || existingTemplates.ar || existingTemplates.tr)
        ? existingTemplates
        : { en: existingTemplates };
      const newMessageTemplates = { ...normalizedExisting, [lang]: templates };
      const newSettings = { ...(clinic?.settings || {}), message_templates: newMessageTemplates };
      if (updateClinic) await updateClinic({ settings: newSettings });
      queryClient.invalidateQueries({ queryKey: ['clinic'] });
      toast.success(tr(lang, 'تم حفظ القوالب', 'Şablonlar kaydedildi', 'Templates saved'));
      setEditing(null);
    } catch (e) {
      toast.error(tr(lang, 'فشل الحفظ', 'Kaydedilemedi', 'Failed to save') + ': ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(tr(lang, 'تم النسخ', 'Kopyalandı', 'Copied to clipboard'));
    } catch {
      toast.error(tr(lang, 'فشل النسخ', 'Kopyalama başarısız', 'Copy failed'));
    }
  };

  const handleOpenWhatsApp = (text) => {
    const sample = getSampleData(lang);
    const link = buildWhatsAppLink(sample.clinic_phone, renderTemplate(text, sample));
    window.open(link, '_blank');
  };

  const label = (meta) => tr(lang, meta.label_ar, meta.label_tr, meta.label_en);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title={tr(lang, 'قوالب الرسائل', 'Mesaj Şablonları', 'Message Templates')}
        subtitle={tr(lang, 'قوالب جاهزة للواتساب — إرسال يدوي فقط', 'WhatsApp için hazır şablonlar — manuel gönderim', 'Ready-made WhatsApp templates — manual sending only')}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-muted-foreground max-w-xl">
          {tr(lang,
            'استخدم هذه القوالب لإنشاء رسائل احترافية. استبدل المتغيرات بين الأقواس بالبيانات الفعلية. يمكنك النسخ أو فتح واتساب يدوياً — لا يوجد إرسال تلقائي.',
            'Profesyonel mesajlar oluşturmak için bu şablonları kullanın. Köşeli parantez içindeki değişkenleri gerçek verilerle değiştirin. Kopyalayabilir veya WhatsApp uygulamasini manuel açabilirsiniz — otomatik gönderim yok.',
            'Use these templates to craft professional messages. Variables in curly braces are replaced with real data. You can copy or open WhatsApp manually — no automatic sending.'
          )}
        </p>
        <Button onClick={handleSaveAll} disabled={saving} className="gradient-primary text-white">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('saving')}</> : <><Save className="w-4 h-4 mr-2" />{t('save')}</>}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMPLATE_META.map((meta) => {
          const Icon = ICONS[meta.icon] || MessageSquare;
          const text = templates[meta.key] || defaults[meta.key];
          const dirty = isDirty(meta.key);
          const isEditing = editing === meta.key;
          const showPrev = showPreview[meta.key];
          const rendered = renderTemplate(text, getSampleData(lang));

          return (
            <Card key={meta.key} className={`glass border-0 shadow-sm ${dirty ? 'ring-1 ring-amber-400/50' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    {label(meta)}
                  </span>
                  {dirty && <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px]">•</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isEditing ? (
                  <>
                    <Textarea
                      value={text}
                      onChange={e => handleChange(meta.key, e.target.value)}
                      rows={8}
                      className="text-sm font-mono"
                      dir={lang === 'ar' ? 'rtl' : 'ltr'}
                    />
                    <div className="flex flex-wrap gap-1">
                      {TEMPLATE_VARIABLES.map(v => (
                        <button
                          key={v}
                          onClick={() => handleChange(meta.key, text + (text.endsWith('\n') ? '' : ' ') + v)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary transition"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        {t('cancel')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRestore(meta.key)}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />{tr(lang, 'استعادة', 'Geri Yükle', 'Restore')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <pre className="text-xs whitespace-pre-wrap text-muted-foreground bg-secondary/40 rounded-lg p-3 max-h-32 overflow-y-auto" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{text}</pre>
                    {showPrev && (
                      <div className="text-xs whitespace-pre-wrap bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                        <p className="text-[10px] text-emerald-600 font-semibold mb-1">{tr(lang, 'معاينة:', 'Önizleme:', 'Preview:')}</p>
                        {rendered}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(meta.key)}>
                        {t('edit')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowPreview(p => ({ ...p, [meta.key]: !p[meta.key] }))}>
                        {showPrev ? <><EyeOff className="w-3.5 h-3.5 mr-1" />{tr(lang, 'إخفاء', 'Gizle', 'Hide')}</> : <><Eye className="w-3.5 h-3.5 mr-1" />{tr(lang, 'معاينة', 'Önizle', 'Preview')}</>}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCopy(rendered)}>
                        <Copy className="w-3.5 h-3.5 mr-1" />{tr(lang, 'نسخ', 'Kopyala', 'Copy')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleOpenWhatsApp(text)} className="text-green-600 hover:text-green-700">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />{t('whatsapp')}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}