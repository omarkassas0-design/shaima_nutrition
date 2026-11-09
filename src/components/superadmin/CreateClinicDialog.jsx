import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Building2, Mail, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/useLanguage';

export default function CreateClinicDialog({ open, onOpenChange, onSuccess, clinics = [] }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState('new'); // 'new' | 'existing'
  const [form, setForm] = useState({
    clinic_name: '',
    clinic_name_ar: '',
    owner_email: '',
    phone: '',
    address: '',
    currency: 'USD',
    language: 'en',
    existing_clinic_id: '',
  });
  const [result, setResult] = useState(null);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await appClient.functions.invoke('createNewClinic', data);
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(
        mode === 'existing'
          ? `Owner assigned to "${data.clinic.name}" successfully!`
          : `Clinic "${data.clinic.name}" created successfully!`
      );
      onSuccess?.();
    },
    onError: (e) => {
      toast.error(e?.message || 'Failed to create clinic');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'existing') {
      if (!form.existing_clinic_id) return toast.error('Please select a clinic');
      if (!form.owner_email.trim()) return toast.error('Owner email is required');
    } else {
      if (!form.clinic_name.trim()) return toast.error('Clinic name is required');
      if (!form.owner_email.trim()) return toast.error('Owner email is required');
    }
    setResult(null);
    createMutation.mutate(form);
  };

  const handleClose = () => {
    onOpenChange(false);
    if (result) {
      setForm({ clinic_name: '', clinic_name_ar: '', owner_email: '', phone: '', address: '', currency: 'USD', language: 'en', existing_clinic_id: '' });
      setMode('new');
      setResult(null);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canSubmit = mode === 'existing'
    ? !!form.existing_clinic_id && !!form.owner_email.trim()
    : !!form.clinic_name.trim() && !!form.owner_email.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Create New Clinic
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">
                  {mode === 'existing' ? 'Owner assigned successfully!' : 'Clinic created successfully!'}
                </p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
                  "{result.clinic.name}" is ready.
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50">
                <Mail className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Owner invitation sent to:</p>
                  <p className="text-muted-foreground">{result.owner.email}</p>
                  {!result.owner.assigned && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      The owner must accept the email invitation first. Once they register and log in,
                      assign them to this clinic from the clinic's "Manage" panel.
                    </p>
                  )}
                  {result.owner.assigned && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Owner assigned to this clinic automatically.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full gradient-primary text-white">Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mode toggle: New Clinic vs Use Existing Clinic ID */}
            <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg">
              <button
                type="button"
                onClick={() => setMode('new')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                  mode === 'new'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                New Clinic / New ID
              </button>
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                  mode === 'existing'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Use Existing Clinic ID
              </button>
            </div>

            {mode === 'existing' ? (
              <>
                <div className="space-y-2">
                  <Label>Select Existing Clinic *</Label>
                  <Select
                    value={form.existing_clinic_id}
                    onValueChange={v => set('existing_clinic_id', v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Choose a clinic" /></SelectTrigger>
                    <SelectContent>
                      {clinics.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} — {c.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Owner Email *</Label>
                  <Input
                    type="email"
                    value={form.owner_email}
                    onChange={e => set('owner_email', e.target.value)}
                    placeholder="owner@example.com"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    An invitation email will be sent. The owner will be assigned to the selected clinic as Clinic Admin.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Clinic Name (English) *</Label>
                  <Input
                    value={form.clinic_name}
                    onChange={e => set('clinic_name', e.target.value)}
                    placeholder="e.g. Bright Smile Dental"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Clinic Name (Arabic)</Label>
                  <Input
                    value={form.clinic_name_ar}
                    onChange={e => set('clinic_name_ar', e.target.value)}
                    placeholder={t('clinic_name_ar_placeholder')}
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Owner Email *</Label>
                  <Input
                    type="email"
                    value={form.owner_email}
                    onChange={e => set('owner_email', e.target.value)}
                    placeholder="owner@example.com"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    An invitation email will be sent to this address. The owner must accept it to access the clinic.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1..." dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Clinic address" />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
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
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={form.language} onValueChange={v => set('language', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="tr">Türkçe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !canSubmit}
                className="gradient-primary text-white"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === 'existing' ? 'Assign Owner to Clinic' : 'Create Clinic & Invite Owner'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}