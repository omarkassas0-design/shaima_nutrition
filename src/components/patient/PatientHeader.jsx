import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useAuth } from '@/lib/AuthContext';
import { roleIsDoctor } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Stethoscope, Phone, Calendar, User, CheckCircle } from 'lucide-react';
import SendWhatsAppDialog from '@/components/patient/SendWhatsAppDialog';



function calcAge(birthDate) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return age >= 0 && age < 120 ? age : null;
}

function formatDate(dateStr, lang) {
  if (!dateStr) return '—';
  return formatDisplayDate(dateStr, lang);
}

/** A single metadata chip — icon + label + value, never wraps mid-value. */
function MetaChip({ icon: Icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
      <span className="text-xs font-medium whitespace-nowrap" dir="ltr">{value}</span>
    </div>
  );
}

export default function PatientHeader({ patient }) {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { effectiveRole } = useAuth();
  const doctorView = roleIsDoctor(effectiveRole);
  const isRtl = lang === 'ar';

  const age = calcAge(patient.birth_date);
  const genderLabel = patient.gender ? t(patient.gender) : null;
  const regDate = formatDate(patient.created_date, lang);

  // Build the list of visible metadata chips
  const chips = [];
  if (!doctorView && patient.phone) chips.push({ icon: Phone, label: t('phone'), value: patient.phone });
  if (genderLabel) chips.push({ icon: User, label: t('gender'), value: genderLabel });
  if (age !== null) chips.push({ icon: Calendar, label: t('age'), value: `${age}` });
  chips.push({ icon: Calendar, label: t('registered'), value: regDate });

  return (
    <div className="mb-6 space-y-3">
      {/* Back button row — always on its own line */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/patients')} className="shrink-0">
          <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
        </Button>
        <span className="text-sm text-muted-foreground">{t('back_to_patients')}</span>
      </div>

      {/* Patient card */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5">
          {/* Top row: avatar + name (and inline badges on desktop) */}
          <div className="flex flex-wrap items-start gap-3 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl gradient-primary flex items-center justify-center text-white text-xl sm:text-2xl font-bold shrink-0 shadow-md">
              {patient.full_name?.[0]?.toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight break-words min-w-0">
                  {patient.full_name}
                </h1>
                {patient.phone_verified && (
                  <Badge className="bg-green-100 text-green-700 text-[10px] shrink-0 gap-1">
                    <CheckCircle className="w-3 h-3" />{t('phone_verified')}
                  </Badge>
                )}
              </div>

              {/* Inline metadata row — desktop only (chips flow horizontally) */}
              <div className="hidden sm:flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2" dir={isRtl ? 'rtl' : 'ltr'}>
                {chips.map((c, i) => <MetaChip key={i} {...c} />)}
              </div>
            </div>

            {/* Action buttons — desktop: right side of same row; mobile: moved below via order */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              {!doctorView && <SendWhatsAppDialog patient={patient} />}
              <Button
                onClick={() => navigate(`/patients/${patient.id}/treatment-plan`)}
                className="gradient-primary text-white"
                size="sm"
              >
                <Stethoscope className="w-4 h-4 sm:mr-1.5" />
                {t('treatment_plan')}
              </Button>
            </div>
          </div>

          {/* Mobile metadata — flex-wrap so each chip takes only the space it needs */}
          <div className="sm:hidden flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-border/50" dir={isRtl ? 'rtl' : 'ltr'}>
            {chips.map((c, i) => <MetaChip key={i} {...c} />)}
          </div>

          {/* Mobile action buttons — full-width row, never overlap */}
          <div className="sm:hidden flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
            {!doctorView && <SendWhatsAppDialog patient={patient} className="flex-1" />}
            <Button
              onClick={() => navigate(`/patients/${patient.id}/treatment-plan`)}
              className="gradient-primary text-white flex-1"
              size="sm"
            >
              <Stethoscope className="w-4 h-4 mr-1.5" />
              {t('treatment_plan')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}