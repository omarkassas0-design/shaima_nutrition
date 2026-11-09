import React, { useState } from 'react';
import { useClinic } from '@/lib/useClinic';
import { useLanguage } from '@/lib/useLanguage';
import { appClient } from '@/api/appClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Building2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const tr = (lang, ar, tr, en) => (lang === 'ar' ? ar : lang === 'tr' ? tr : en);

export default function ClinicSetupForm() {
  const { clinic, setClinicDirectly } = useClinic();
  const { lang, isRTL } = useLanguage();

  const [form, setForm] = useState({
    name: clinic?.name || '',
    name_ar: clinic?.name_ar || '',
    phone: clinic?.phone || '',
    address: clinic?.address || '',
    country: clinic?.country || '',
    city: clinic?.city || '',
    currency: clinic?.currency || 'USD',
    language: clinic?.language || lang || 'en',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = tr(lang, 'مطلوب', 'Zorunlu', 'Required');
    if (!form.phone.trim()) e.phone = tr(lang, 'مطلوب', 'Zorunlu', 'Required');
    if (!form.address.trim()) e.address = tr(lang, 'مطلوب', 'Zorunlu', 'Required');
    if (!form.country.trim()) e.country = tr(lang, 'مطلوب', 'Zorunlu', 'Required');
    if (!form.city.trim()) e.city = tr(lang, 'مطلوب', 'Zorunlu', 'Required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const response = await appClient.functions.invoke('completeClinicSetup', form);
      const result = response.data || response;
      if (result?.error) throw new Error(result.error);

      if (result?.clinic) {
        setClinicDirectly(result.clinic);
      }
      toast.success(
        tr(lang, 'تم إكمال الإعداد بنجاح!', 'Kurulum tamamlandı!', 'Setup completed successfully!')
      );
    } catch (err) {
      toast.error(
        tr(lang, 'فشل في الإعداد', 'Kurulum başarısız', 'Setup failed') +
          ': ' +
          (err?.message || '')
      );
    } finally {
      setSaving(false);
    }
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto" dir={dir}>
      <div className="min-h-full flex items-center justify-center p-4 md:p-6">
        <Card className="w-full max-w-2xl glass border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-3">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {tr(lang, 'أكمل إعداد عيادتك', 'Klinik Kurulumunu Tamamlayın', 'Complete Your Clinic Setup')}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
              {tr(
                lang,
                'يرجى إكمال معلومات عيادتك لبدء استخدام النظام. هذه الخطوة إلزامية لمرة واحدة.',
                'Sistemi kullanmaya başlamak için klinik bilgilerinizi tamamlayın. Bu adım yalnızca bir kez gereklidir.',
                'Please complete your clinic information to start using the system. This is a one-time required step.'
              )}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Clinic Name */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {tr(lang, 'اسم العيادة', 'Klinik Adı', 'Clinic Name')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder={tr(lang, 'اسم العيادة', 'Klinik Adı', 'Clinic Name')}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name}</p>
                  )}
                </div>

                {/* Clinic Name (Arabic) */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {tr(lang, 'الاسم بالعربية (اختياري)', 'Arapça Ad (opsiyonel)', 'Arabic Name (optional)')}
                  </Label>
                  <Input
                    value={form.name_ar}
                    onChange={(e) => handleChange('name_ar', e.target.value)}
                    placeholder={tr(lang, 'الاسم بالعربية', 'Arapça Ad', 'Arabic Name')}
                    dir="rtl"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {tr(lang, 'هاتف العيادة', 'Klinik Telefonu', 'Clinic Phone')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+90 555 123 4567"
                    className={errors.phone ? 'border-destructive' : ''}
                    dir="ltr"
                  />
                  {errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone}</p>
                  )}
                </div>

                {/* Country */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {tr(lang, 'الدولة', 'Ülke', 'Country')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    placeholder={tr(lang, 'الدولة', 'Ülke', 'Country')}
                    className={errors.country ? 'border-destructive' : ''}
                  />
                  {errors.country && (
                    <p className="text-xs text-destructive">{errors.country}</p>
                  )}
                </div>

                {/* City */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {tr(lang, 'المدينة', 'Şehir', 'City')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder={tr(lang, 'المدينة', 'Şehir', 'City')}
                    className={errors.city ? 'border-destructive' : ''}
                  />
                  {errors.city && (
                    <p className="text-xs text-destructive">{errors.city}</p>
                  )}
                </div>

                {/* Address */}
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-sm font-medium">
                    {tr(lang, 'عنوان العيادة', 'Klinik Adresi', 'Clinic Address')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder={tr(lang, 'العنوان التفصيلي', 'Detaylı adres', 'Detailed address')}
                    className={errors.address ? 'border-destructive' : ''}
                  />
                  {errors.address && (
                    <p className="text-xs text-destructive">{errors.address}</p>
                  )}
                </div>

                {/* Currency */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {tr(lang, 'العملة', 'Para Birimi', 'Currency')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => handleChange('currency', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="TRY">TRY</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="SYP">SYP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Language */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {tr(lang, 'اللغة', 'Dil', 'Language')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.language}
                    onValueChange={(v) => handleChange('language', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">
                        {tr(lang, 'الإنجليزية', 'İngilizce', 'English')}
                      </SelectItem>
                      <SelectItem value="ar">
                        {tr(lang, 'العربية', 'Arapça', 'Arabic')}
                      </SelectItem>
                      <SelectItem value="tr">
                        {tr(lang, 'التركية', 'Türkçe', 'Turkish')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {tr(
                    lang,
                    'سيتم حفظ هذه المعلومات نهائياً ولن تظهر هذه الشاشة مرة أخرى',
                    'Bu bilgiler kalıcı olarak kaydedilecek ve bu ekran bir daha görünmeyecek',
                    'This information will be saved permanently — this screen will not appear again'
                  )}
                </span>
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="w-full gradient-primary text-white h-11 text-base font-semibold"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {tr(lang, 'جاري الحفظ...', 'Kaydediliyor...', 'Saving...')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    {tr(lang, 'حفظ ومتابعة', 'Kaydet ve Devam Et', 'Save & Continue')}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}