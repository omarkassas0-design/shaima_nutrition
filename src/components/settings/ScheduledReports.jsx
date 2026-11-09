import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Mail, Plus, Trash2, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';

const REPORT_TYPES = [
  { value: 'daily_summary', label: 'Daily Summary' },
  { value: 'weekly_summary', label: 'Weekly Summary' },
  { value: 'monthly_summary', label: 'Monthly Summary' },
  { value: 'revenue_summary', label: 'Revenue Summary' },
  { value: 'expense_summary', label: 'Expense Summary' },
  { value: 'payment_summary', label: 'Payment Summary' },
  { value: 'outstanding_balances', label: 'Outstanding Balances' },
  { value: 'appointment_statistics', label: 'Appointment Statistics' },
  { value: 'clinic_performance', label: 'Clinic Performance' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function ScheduledReports() {
  const { lang } = useLanguage();
  const { clinic } = useClinic();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    report_type: 'daily_summary',
    frequency: 'daily',
    email_recipients: '',
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['scheduledReports', clinic?.id],
    queryFn: async () => {
      if (!clinic) return [];
      return clinicApi.filter('ScheduledReport', { clinic_id: clinic.id }, '-created_date', 100);
    },
    enabled: !!clinic,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const recipients = data.email_recipients
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter(Boolean);
      if (recipients.length === 0) throw new Error('At least one email recipient is required');

      // Compute next_send_at (8 AM tomorrow for daily, etc.)
      const now = new Date();
      let next = new Date(now);
      if (data.frequency === 'daily') next.setDate(next.getDate() + 1);
      else if (data.frequency === 'weekly') next.setDate(next.getDate() + 7);
      else next.setMonth(next.getMonth() + 1);
      next.setHours(8, 0, 0, 0);

      return clinicApi.create('ScheduledReport', {
        clinic_id: clinic.id,
        report_type: data.report_type,
        frequency: data.frequency,
        email_recipients: recipients,
        enabled: true,
        next_send_at: next.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
      toast.success('Scheduled report created');
      setShowForm(false);
      setForm({ report_type: 'daily_summary', frequency: 'daily', email_recipients: '' });
    },
    onError: (e) => toast.error(e?.message || 'Failed to create'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }) => clinicApi.update('ScheduledReport', id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledReports'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => clinicApi.delete('ScheduledReport', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
      toast.success('Scheduled report deleted');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <Card className="glass border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Automated Reports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Schedule report summaries to be sent automatically by email. Reports respect clinic isolation, user permissions, and currency separation.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : reports.length === 0 && !showForm ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">No scheduled reports configured yet.</p>
            <Button onClick={() => setShowForm(true)} className="gradient-primary text-white">
              <Plus className="w-4 h-4 mr-2" /> Create Report
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-secondary/30">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{REPORT_TYPES.find((t) => t.value === r.report_type)?.label || r.report_type}</p>
                      <Badge variant="outline" className="text-xs">{r.frequency}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {r.email_recipients?.join(', ') || 'No recipients'}
                    </p>
                    {r.last_sent_at && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Last sent: {formatDisplayDate(r.last_sent_at, lang, { time: true })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={r.enabled}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: r.id, enabled: checked })}
                    />
                    <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deleteMutation.mutate(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {showForm ? (
              <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-lg border border-border bg-secondary/20">
                <div className="space-y-1.5">
                  <Label>Report Type</Label>
                  <Select value={form.report_type} onValueChange={(v) => setForm((f) => ({ ...f, report_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Email Recipients (comma or line separated)</Label>
                  <Input
                    value={form.email_recipients}
                    onChange={(e) => setForm((f) => ({ ...f, email_recipients: e.target.value }))}
                    placeholder="admin@clinic.com, manager@clinic.com"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" disabled={createMutation.isPending} className="gradient-primary text-white">
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Create
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <Button onClick={() => setShowForm(true)} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Add Scheduled Report
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}