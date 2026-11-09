import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import { useSuperAdmin } from '@/lib/SuperAdminContext';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import SeedDataButton from '@/components/SeedDataButton';
import ClinicSummary from '@/components/settings/ClinicSummary';
import ClinicExportButtons from '@/components/settings/ClinicExportButtons';
import FinancialExportButtons from '@/components/settings/FinancialExportButtons';
import ScheduledReports from '@/components/settings/ScheduledReports';
import ImportDialog from '@/components/import/ImportDialog';
import { useAuth } from '@/lib/AuthContext';
import { roleIsClinicAdmin, roleIsSuperAdmin } from '@/lib/permissions';
import PersonalSettings from '@/components/settings/PersonalSettings';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

export default function Settings() {
  const { t } = useLanguage();
  const { clinic, loading, updateClinic, refreshClinic, setClinicDirectly } = useClinic();
  const { user, refreshUser, effectiveRole } = useAuth();
  const { managedClinicId } = useSuperAdmin();
  const canManage = roleIsClinicAdmin(effectiveRole);
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingClinic, setEditingClinic] = useState(false);
  const [form, setForm] = useState({
    name: '', name_ar: '', address: '', phone: '', email: '',
    country: '', city: '', whatsapp_number: '',
    currency: 'USD', logo_url: '',
  });

  // Populate form when clinic loads
  useEffect(() => {
    if (clinic) {
      setForm({
        name: clinic.name || '',
        name_ar: clinic.name_ar || '',
        address: clinic.address || '',
        phone: clinic.phone || '',
        email: clinic.email || '',
        country: clinic.country || '',
        city: clinic.city || '',
        whatsapp_number: clinic.whatsapp_number || '',
        currency: clinic.currency || 'USD',
        logo_url: clinic.logo_url || '',
      });
    }
  }, [clinic]);

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error(t('clinic_name_required'));
      return;
    }
    setSaving(true);
    try {
      // Use the backend function to save (handles both create + update, bypasses RLS)
      const response = await appClient.functions.invoke('saveClinicSettings', {
        clinic_id: clinic?.id || managedClinicId || null,
        ...form,
      });
      const result = response.data || response;
      if (result?.error) {
        throw new Error(result.error);
      }

      // Use the clinic returned from the backend to immediately update the UI
      if (result?.clinic) {
        setClinicDirectly(result.clinic);
      }

      // Silently refresh the user (picks up newly linked clinic_id without unmounting the app)
      await refreshUser();
      // Refresh clinic state so the form stays in sync with the database
      await refreshClinic();

      // Invalidate Super Admin stats so the clinic list refreshes
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });

      setSaved(true);
      setEditingClinic(false);
      setTimeout(() => setSaved(false), 3000);
      toast.success(result?.created ? t('clinic_created_saved') : t('clinic_settings_saved'));
    } catch (e) {
      console.error('Save clinic settings error:', e);
      toast.error(t('failed_to_save') + ': ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file, clinic_id: clinic?.id || managedClinicId });
      setForm(prev => ({ ...prev, logo_url: file_url }));
      toast.success(t('logo_uploaded'));
    } catch (e) {
      toast.error(t('upload_failed') + ': ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-2xl">
        <div className="h-10 bg-secondary rounded-xl w-48" />
        <div className="h-64 bg-secondary rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('clinic_settings')} />

      <div className="max-w-2xl space-y-6">
        {/* No clinic linked — contact admin notice */}
        {!clinic && (
          <Card className="border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">{t('no_clinic_assigned')}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  {t('contact_admin_clinic')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Non-admin roles (doctor, receptionist) see personal settings only */}
        {!canManage && clinic && <PersonalSettings />}

        {/* Admin-only sections below */}
        {canManage && (
          <>
        {/* Seed data card — super_admin only */}
        {clinic && roleIsSuperAdmin(effectiveRole) && (
          <Card className="glass border-0 shadow border-dashed border-2 border-border">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-sm">{t('dev_sample_data')}</p>
                <p className="text-xs text-muted-foreground">{t('dev_sample_desc')}</p>
              </div>
              <SeedDataButton />
            </CardContent>
          </Card>
        )}

        {clinic?.name && !editingClinic ? <ClinicSummary clinic={clinic} onEdit={() => { setForm(Object.fromEntries(Object.keys(form).map(key => [key, clinic[key] || (key === 'currency' ? 'USD' : '')]))); setEditingClinic(true); }} /> : (
        <Card className="glass border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {t('clinic_settings')}
              {clinic && <span className="text-xs font-normal text-muted-foreground ml-1">ID: {clinic.id.slice(0, 8)}…</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset disabled={!canManage} className="border-0 p-0 m-0 space-y-4">
            {/* Logo */}
            <div className="space-y-2">
              <Label>{t('logo')}</Label>
              <div className="flex items-center gap-4">
                {form.logo_url && (
                  <img src={form.logo_url} alt="Logo" className="w-16 h-16 rounded-xl object-cover border" />
                )}
                <div>
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} className="max-w-[220px]" />
                  {uploading && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> {t('uploading')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('clinic_name')} (EN) *</Label>
                <Input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder={t('clinic_name_en_placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('clinic_name')} (AR)</Label>
                <Input
                  value={form.name_ar}
                  onChange={e => set('name_ar', e.target.value)}
                  placeholder={t('clinic_name_ar_placeholder')}
                  dir="rtl"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('phone')}</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} dir="ltr" placeholder="+963..." />
              </div>
              <div className="space-y-2">
                <Label>{t('email_address')}</Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} dir="ltr" placeholder="clinic@example.com" />
              </div>
              <div className="space-y-2">
                <Label>{t('address')}</Label>
                <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Clinic address" />
              </div>
              <div className="space-y-2">
                <Label>{t('whatsapp_number')}</Label>
                <Input value={form.whatsapp_number} onChange={e => set('whatsapp_number', e.target.value)} dir="ltr" placeholder="+963..." />
              </div>
              <div className="space-y-2">
                <Label>{t('country')}</Label>
                <Input value={form.country} onChange={e => set('country', e.target.value)} placeholder={t('country')} />
              </div>
              <div className="space-y-2">
                <Label>{t('city')}</Label>
                <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder={t('city')} />
              </div>
              <div className="space-y-2">
                <Label>{t('currency')}</Label>
                <Select value={form.currency} onValueChange={v => set('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="SYP">SYP</SelectItem>
                    <SelectItem value="TRY">TRY (₺)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/50">
              {clinic?.name && <Button variant="outline" disabled={saving} onClick={() => setEditingClinic(false)}>{t('cancel')}</Button>}
              <p className="text-xs text-muted-foreground">
                {clinic ? t('changes_saved_permanently') : t('no_clinic_setup')}
              </p>
              <Button
                onClick={handleSave}
                disabled={saving || !form.name?.trim()}
                className={saved ? 'bg-green-600 hover:bg-green-700 text-white' : 'gradient-primary text-white'}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('saving')}</>
                ) : saved ? (
                  <><CheckCircle2 className="w-4 h-4 mr-2" />{t('saved_success')}</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />{t('save')}</>
                )}
              </Button>
            </div>
          </fieldset>
          </CardContent>
        </Card>
        )}

        {/* Excel/CSV Import — admin only */}
        {clinic && canManage && (
          <Card className="glass border-0 shadow-lg">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-sm flex items-center gap-2"><Upload className="w-4 h-4 text-primary" /> {t('data_import')}</p>
                <p className="text-xs text-muted-foreground">{t('data_import_desc')}</p>
              </div>
              <Button onClick={() => setShowImport(true)} variant="outline">
                <Upload className="w-4 h-4 mr-2" /> {t('import_data')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Automated Scheduled Reports — admin only */}
        {clinic && canManage && <ScheduledReports />}

        {/* Clinic Data Export — admin only */}
        {clinic && canManage && <ClinicExportButtons />}

        {/* Financial Export (date-range filtered) — admin only */}
        {clinic && canManage && <FinancialExportButtons />}


          </>
        )}
      </div>

      <ImportDialog open={showImport} onOpenChange={setShowImport} />
    </div>
  );
}
