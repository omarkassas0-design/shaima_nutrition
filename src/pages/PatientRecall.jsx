import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useClinic } from '@/lib/useClinic';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useAuth } from '@/lib/AuthContext';
import { roleIsDoctor } from '@/lib/permissions';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import RecallStatusDialog from '@/components/patient/RecallStatusDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, MessageCircle, CalendarPlus, AlertTriangle, Wallet, ClipboardList, RotateCcw, CalendarClock } from 'lucide-react';



export default function PatientRecall() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [months, setMonths] = useState(6);
  const [recallPatient, setRecallPatient] = useState(null);
  const [recallOpen, setRecallOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['patientRecall', clinic?.id, months],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getPatientRecall', {
        clinic_id: clinic?.id,
        months,
      });
      return res.data || res;
    },
    enabled: !!clinic,
  });

  const recall = data?.recall || [];
  const doctor = roleIsDoctor(effectiveRole);

  const formatDate = (d) => {
    if (!d) return t('recall_no_visit');
    return formatDisplayDate(d, lang);
  };

  const reasonBadge = (reason) => {
    if (reason === 'overdue') return { label: t('recall_overdue'), cls: 'bg-amber-100 text-amber-700', icon: AlertTriangle };
    if (reason === 'no_visit') return { label: t('recall_no_visit'), cls: 'bg-blue-100 text-blue-700', icon: CalendarPlus };
    if (reason === 'outstanding') return { label: t('recall_outstanding'), cls: 'bg-rose-100 text-rose-700', icon: Wallet };
    if (reason === 'planned') return { label: t('recall_planned'), cls: 'bg-purple-100 text-purple-700', icon: ClipboardList };
    if (reason === 'recall_due') return { label: t('recall_due'), cls: 'bg-red-100 text-red-700', icon: AlertTriangle };
    if (reason === 'recall_upcoming') return { label: t('recall_upcoming'), cls: 'bg-cyan-100 text-cyan-700', icon: CalendarClock };
    return null;
  };

  const statusBadge = (status) => {
    if (status === 'contacted') return { label: t('recall_contacted'), cls: 'bg-green-100 text-green-700' };
    if (status === 'scheduled') return { label: t('recall_scheduled'), cls: 'bg-blue-100 text-blue-700' };
    if (status === 'not_interested') return { label: t('recall_not_interested'), cls: 'bg-gray-100 text-gray-700' };
    if (status === 'pending') return { label: t('recall_pending'), cls: 'bg-amber-100 text-amber-700' };
    return null;
  };

  const handleRecallSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['patientRecall'] });
  };

  const openRecallDialog = (patient) => {
    setRecallPatient(patient);
    setRecallOpen(true);
  };

  return (
    <div>
      <PageHeader title={t('patient_recall')} />

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">{t('month')}</span>
        <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[3, 6, 9, 12].map(m => (
              <SelectItem key={m} value={String(m)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {recall.length} {t('patients').toLowerCase()}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : recall.length === 0 ? (
        <EmptyState icon={CalendarPlus} title={t('no_recall')} />
      ) : (
        <div className="space-y-2">
          {recall.map(p => {
            const hasPhone = !doctor && !!(p.whatsapp_number || p.phone);
            const sb = p.recall_status ? statusBadge(p.recall_status) : null;
            return (
              <Card key={p.id} className="glass border-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{p.full_name}</p>
                        {p.recall_date && (
                          <Badge className="text-xs bg-cyan-100 text-cyan-700">
                            <CalendarClock className="w-3 h-3 mr-1" />
                            {formatDate(p.recall_date)}
                          </Badge>
                        )}
                        {sb && (
                          <Badge className={`text-xs ${sb.cls}`}>{sb.label}</Badge>
                        )}
                        {p.reasons.map(r => {
                          const b = reasonBadge(r);
                          if (!b) return null;
                          const Icon = b.icon;
                          return (
                            <Badge key={r} className={`text-xs ${b.cls}`}>
                              <Icon className="w-3 h-3 mr-1" />
                              {b.label}
                            </Badge>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('last_visit')}: {formatDate(p.last_visit)}
                      </p>
                      {p.recall_notes && (
                        <p className="text-xs text-muted-foreground italic truncate">{p.recall_notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="w-8 h-8"
                        onClick={() => openRecallDialog(p)}
                        title={t('record_recall')}>
                        <RotateCcw className="w-4 h-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8"
                        onClick={() => navigate(`/patients/${p.id}`)}
                        title={t('view')}>
                        <CalendarPlus className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      {hasPhone && (
                        <>
                          <Button variant="ghost" size="icon" className="w-8 h-8"
                            onClick={() => window.open(`https://wa.me/${(p.whatsapp_number || p.phone || '').replace(/[^0-9]/g, '')}`, '_blank')}
                            title="WhatsApp">
                            <MessageCircle className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8"
                            onClick={() => window.open(`tel:${p.phone}`)}
                            title={t('phone')}>
                            <Phone className="w-4 h-4 text-primary" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <RecallStatusDialog
        patient={recallPatient}
        open={recallOpen}
        onOpenChange={setRecallOpen}
        onSaved={handleRecallSaved}
      />
    </div>
  );
}