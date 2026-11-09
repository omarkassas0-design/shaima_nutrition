import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserRound, ClipboardPlus, ClipboardList, CalendarDays, CreditCard, FileText, Image as ImageIcon, FileCheck, Clock } from 'lucide-react';
import { ToothIcon } from '@/components/patient/ToothIcon';
import PatientHeader from '@/components/patient/PatientHeader';
import PatientBasicInfo from '@/components/patient/PatientBasicInfo';
import PatientMedicalInfo from '@/components/patient/PatientMedicalInfo';
import PatientTreatmentPlan from '@/components/patient/PatientTreatmentPlan';
import PatientAppointments from '@/components/patient/PatientAppointments';
import PatientPayments from '@/components/patient/PatientPayments';
import PatientFiles from '@/components/patient/PatientFiles';
import PatientInvoices from '@/components/patient/PatientInvoices';
import PatientConsents from '@/components/patient/PatientConsents';
import PatientTimeline from '@/components/patient/PatientTimeline';
import DentalChart from '@/components/patient/DentalChart';
import PatientAlerts from '@/components/patient/PatientAlerts';
import { useAuth } from '@/lib/AuthContext';
import { roleIsDoctor } from '@/lib/permissions';

export default function PatientProfile() {
  const { t } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const showInvoices = !roleIsDoctor(effectiveRole);
  const patientId = window.location.pathname.split('/patients/')[1]?.split('/')[0];

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId, clinic?.id],
    queryFn: () => clinicApi.filter('Patient', { id: patientId, clinic_id: clinic?.id }),
    select: (data) => data[0],
    enabled: !!patientId && !!clinic,
    // Shared clinic data: auto-refresh so edits by other clinic users appear.
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  if (!patientId) return <div className="text-center py-20 text-muted-foreground">{t('invalid_patient_id')}</div>;

  if (!patient) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-secondary rounded-xl w-48" />
      <div className="h-12 bg-secondary rounded-xl" />
      <div className="h-64 bg-secondary rounded-xl" />
    </div>
  );

  return (
    <div>
      <PatientHeader patient={patient} />

      <PatientAlerts patient={patient} />

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 h-auto p-0 bg-transparent border-0 shadow-none">
          <TabsTrigger value="basic" className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border border-border/60 bg-card hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md transition-all">
            <UserRound className="w-4 h-4" />
            <span className="text-xs font-medium text-center leading-tight">{t('basic_info')}</span>
          </TabsTrigger>
          <TabsTrigger value="medical" className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border border-border/60 bg-card hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md transition-all">
            <ClipboardPlus className="w-4 h-4" />
            <span className="text-xs font-medium text-center leading-tight">{t('medical_info')}</span>
          </TabsTrigger>
          <TabsTrigger value="dental" className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border border-border/60 bg-card hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md transition-all">
            <ToothIcon className="w-4 h-4" />
            <span className="text-xs font-medium text-center leading-tight">{t('dental_chart')}</span>
          </TabsTrigger>
          <TabsTrigger value="treatments" className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border border-border/60 bg-card hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md transition-all">
            <ClipboardList className="w-4 h-4" />
            <span className="text-xs font-medium text-center leading-tight">{t('treatment_plan')}</span>
          </TabsTrigger>
          <TabsTrigger value="appointments" className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border border-border/60 bg-card hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md transition-all">
            <CalendarDays className="w-4 h-4" />
            <span className="text-xs font-medium text-center leading-tight">{t('appointments')}</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border border-border/60 bg-card hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md transition-all">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs font-medium text-center leading-tight">{t('payments')}</span>
          </TabsTrigger>
          {showInvoices && <TabsTrigger value="invoices" className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border border-border/60 bg-card hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md transition-all">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium text-center leading-tight">{t('invoices_receipts')}</span>
          </TabsTrigger>}
          <TabsTrigger value="files" className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border border-border/60 bg-card hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md transition-all">
            <ImageIcon className="w-4 h-4" />
            <span className="text-xs font-medium text-center leading-tight">{t('files')}</span>
          </TabsTrigger>
          <TabsTrigger value="consents" className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border border-border/60 bg-card hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md transition-all">
            <FileCheck className="w-4 h-4" />
            <span className="text-xs font-medium text-center leading-tight">{t('consent_forms')}</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border border-border/60 bg-card hover:bg-accent/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md transition-all">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium text-center leading-tight">{t('timeline')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic"><PatientBasicInfo patient={patient} /></TabsContent>
        <TabsContent value="medical"><PatientMedicalInfo patient={patient} /></TabsContent>
        <TabsContent value="dental"><DentalChart patient={patient} /></TabsContent>
        <TabsContent value="treatments"><PatientTreatmentPlan patient={patient} /></TabsContent>
        <TabsContent value="appointments"><PatientAppointments patient={patient} /></TabsContent>
        <TabsContent value="payments"><PatientPayments patient={patient} /></TabsContent>
        {showInvoices && <TabsContent value="invoices"><PatientInvoices patient={patient} /></TabsContent>}
        <TabsContent value="files"><PatientFiles patient={patient} /></TabsContent>
        <TabsContent value="consents"><PatientConsents patient={patient} /></TabsContent>
        <TabsContent value="timeline"><PatientTimeline patient={patient} /></TabsContent>
      </Tabs>
    </div>
  );
}