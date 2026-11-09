import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/useLanguage';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import PatientForm from '@/components/patients/PatientForm';

export default function AddPatient() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div>
      <PageHeader title={t('add_patient')} showBack />
      <Card className="max-w-xl">
        <CardContent className="pt-6">
          <PatientForm
            onSuccess={(patient) => navigate(`/patients/${patient.id}`)}
            onCancel={() => navigate(-1)}
          />
        </CardContent>
      </Card>
    </div>
  );
}