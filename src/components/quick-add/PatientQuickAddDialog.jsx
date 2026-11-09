import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/lib/useLanguage';
import PatientForm from '@/components/patients/PatientForm';

/**
 * Quick Add Patient dialog — wraps the shared PatientForm (the SAME form used
 * by the AddPatient page) in a Dialog. No simplified duplicate — all fields,
 * Patient Source, Doctor assignment, and logic are identical.
 */
export default function PatientQuickAddDialog({ open, onClose }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('add_patient')}</DialogTitle></DialogHeader>
        <PatientForm
          onSuccess={(patient) => { onClose(); navigate(`/patients/${patient.id}`); }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}