import React, { useState } from 'react';
import { Building2, ChevronRight, Pencil } from 'lucide-react';
import { useLanguage } from '@/lib/useLanguage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function ClinicSummary({ clinic, onEdit }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const fields = [['name', `${t('clinic_name')} (EN)`], ['name_ar', `${t('clinic_name')} (AR)`], ['phone', t('phone')], ['email', t('email_address')], ['address', t('address')], ['whatsapp_number', t('whatsapp_number')], ['country', t('country')], ['city', t('city')], ['currency', t('currency')]];
  return <>
    <button type="button" onClick={() => setOpen(true)} className="w-full rounded-2xl border border-border/60 bg-card p-5 text-start shadow-soft hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary">
      <div className="flex items-center gap-4">
        {clinic.logo_url ? <img src={clinic.logo_url} alt={clinic.name} className="h-14 w-14 shrink-0 rounded-2xl object-contain" /> : <Building2 className="h-12 w-12 shrink-0 rounded-2xl bg-primary/10 p-3 text-primary" />}
        <div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">{t('clinic_settings')}</p><h2 className="mt-1 break-words text-lg font-semibold">{clinic.name}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{[clinic.city, clinic.country].filter(Boolean).join(' · ')}</p><p className="mt-1 text-sm" dir="ltr">{clinic.phone}</p></div>
        <ChevronRight className="h-5 w-5 shrink-0 text-primary rtl:rotate-180" />
      </div>
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('clinic_settings')}</DialogTitle><DialogDescription>{clinic.name}</DialogDescription></DialogHeader>
        {clinic.logo_url && <img src={clinic.logo_url} alt={clinic.name} className="h-20 w-20 rounded-2xl object-contain" />}
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{fields.map(([key, label]) => <div key={key} className="min-w-0 rounded-xl bg-secondary/60 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium" dir={['phone', 'whatsapp_number', 'email'].includes(key) ? 'ltr' : 'auto'}>{clinic[key] || '—'}</dd></div>)}</dl>
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>{t('close')}</Button><Button onClick={() => { setOpen(false); onEdit(); }}><Pencil />{t('edit')}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}