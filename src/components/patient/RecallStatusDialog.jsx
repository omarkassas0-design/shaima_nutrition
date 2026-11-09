import React, { useState, useEffect } from 'react';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function RecallStatusDialog({ patient, open, onOpenChange, onSaved }) {
  const { t } = useLanguage();
  const [recallDate, setRecallDate] = useState('');
  const [recallInterval, setRecallInterval] = useState('');
  const [recallStatus, setRecallStatus] = useState('pending');
  const [recallNotes, setRecallNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (patient) {
      setRecallDate(patient.recall_date || '');
      setRecallInterval(patient.recall_interval_months ? String(patient.recall_interval_months) : '');
      setRecallStatus(patient.recall_status || 'pending');
      setRecallNotes(patient.recall_notes || '');
    }
  }, [patient]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch = {
        recall_date: recallDate || null,
        recall_interval_months: recallInterval ? Number(recallInterval) : null,
        recall_status: recallStatus,
        recall_notes: recallNotes,
      };
      // If status is contacted or scheduled, record the last recall date
      if (recallStatus === 'contacted' || recallStatus === 'scheduled') {
        patch.last_recall_date = new Date().toISOString().split('T')[0];
      }
      await clinicApi.update('Patient', patient.id, patch);
      toast.success(t('recall_saved'));
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.message || 'Failed to save recall');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('record_recall')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('recall_date')}</Label>
            <Input type="date" value={recallDate} onChange={(e) => setRecallDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('recall_interval')}</Label>
            <Input type="number" min="1" value={recallInterval} onChange={(e) => setRecallInterval(e.target.value)} placeholder="6" />
          </div>
          <div className="space-y-1.5">
            <Label>{t('recall_status')}</Label>
            <Select value={recallStatus} onValueChange={setRecallStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{t('recall_pending')}</SelectItem>
                <SelectItem value="contacted">{t('recall_contacted')}</SelectItem>
                <SelectItem value="scheduled">{t('recall_scheduled')}</SelectItem>
                <SelectItem value="not_interested">{t('recall_not_interested')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('recall_notes')}</Label>
            <Textarea value={recallNotes} onChange={(e) => setRecallNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {t('save_recall')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}