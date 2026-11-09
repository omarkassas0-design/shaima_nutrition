import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/useLanguage';
import { canRole } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Plus, X, UserPlus, CalendarPlus, CreditCard } from 'lucide-react';
import PatientQuickAddDialog from './PatientQuickAddDialog';
import AppointmentFormDialog from '@/components/appointments/AppointmentFormDialog';
import AddPaymentDialog from '@/components/payments/AddPaymentDialog';

export default function QuickAddButton() {
  const { t } = useLanguage();
  const { effectiveRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null); // 'patient' | 'appointment' | 'payment' | null
  const menuRef = useRef(null);

  const canPatient = canRole(effectiveRole, 'patients:write');
  const canAppointment = canRole(effectiveRole, 'appointments:write');
  const canPayment = canRole(effectiveRole, 'payments:write');
  const hasAny = canPatient || canAppointment || canPayment;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!hasAny) return null;

  const actions = [
    { key: 'patient', label: t('add_patient'), icon: UserPlus, show: canPatient },
    { key: 'appointment', label: t('add_appointment'), icon: CalendarPlus, show: canAppointment },
    { key: 'payment', label: t('add_payment'), icon: CreditCard, show: canPayment },
  ].filter(a => a.show);

  const handleAction = (key) => {
    setOpen(false);
    setDialog(key);
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setOpen(o => !o)}
          className="rounded-full transition-transform duration-200 hover:scale-105"
          aria-label={t('quick_add')}
        >
          <span className={`transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>
            {open ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </span>
        </Button>

        {open && (
          <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 z-50 min-w-[200px] rounded-xl border bg-popover shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
            {actions.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleAction(key)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-left rtl:text-right"
              >
                <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <PatientQuickAddDialog open={dialog === 'patient'} onClose={() => setDialog(null)} />
      <AppointmentFormDialog open={dialog === 'appointment'} onClose={() => setDialog(null)} />
      <AddPaymentDialog open={dialog === 'payment'} onClose={() => setDialog(null)} />
    </>
  );
}