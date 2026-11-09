import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { canRole, roleIsDoctor } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Download, Printer, Loader2 } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import ConsentDialog from '@/components/consents/ConsentDialog';
import { downloadConsentPDF, printConsent } from '@/lib/consentExport';

export default function PatientConsents({ patient }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const canManage = canRole(effectiveRole, 'consents:write');
  const readOnly = roleIsDoctor(effectiveRole);

  const { data: consents = [], isLoading } = useQuery({
    queryKey: ['patientConsents', patient.id],
    queryFn: () => clinicApi.filter('ConsentForm', { patient_id: patient.id, clinic_id: clinic?.id }, '-signed_at'),
    enabled: !!clinic,
  });

  const voidMutation = useMutation({
    mutationFn: async (id) => clinicApi.update('ConsentForm', id, { status: 'void' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientConsents'] });
      toast.success(t('voided'));
    },
  });

  const handleDownload = (c) => downloadConsentPDF(c, clinic, lang);
  const handlePrint = (c) => printConsent(c, clinic, lang);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{t('consent_forms')}</h3>
        {canManage && (
          <Button onClick={() => setShowCreate(true)} className="gradient-primary text-white" size="sm">
            <Plus className="w-4 h-4 mr-1" />{t('create_consent')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : consents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('no_data')}
          actionLabel={canManage ? t('create_consent') : undefined}
          onAction={canManage ? () => setShowCreate(true) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {consents.map(c => {
            const isVoid = c.status === 'void';
            return (
              <Card key={c.id} className={`glass border-0 ${isVoid ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{c.template_name || '—'}</span>
                        {isVoid && <Badge variant="destructive" className="text-xs">{t('voided')}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDisplayDate(c.procedure_date || c.signed_at, lang)}
                      </p>
                      {c.procedure_name && <p className="text-xs text-muted-foreground mt-0.5">{c.procedure_name}</p>}
                      {c.doctor_name && <p className="text-xs text-muted-foreground mt-0.5">Dr. {c.doctor_name}</p>}
                    </div>
                    {!isVoid && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(c)} title={t('download_pdf')}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrint(c)} title={t('print')}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 h-8"
                            disabled={voidMutation.isPending}
                            onClick={() => { if (confirm(t('confirm_delete'))) voidMutation.mutate(c.id); }}
                          >
                            {t('void')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showCreate && <ConsentDialog open={showCreate} onClose={() => setShowCreate(false)} patient={patient} />}
    </div>
  );
}