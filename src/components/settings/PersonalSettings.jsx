import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useClinic } from '@/lib/useClinic';
import { useLanguage } from '@/lib/useLanguage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Building2, Shield } from 'lucide-react';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  clinic_admin: 'Clinic Admin',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
};

export default function PersonalSettings() {
  const { t } = useLanguage();
  const { user, effectiveRole } = useAuth();
  const { clinic } = useClinic();
  const role = effectiveRole;

  return (
    <Card className="glass border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          {t('account_profile')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-white text-xl font-bold">
            {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-lg">{user?.full_name || '—'}</p>
            <Badge className="mt-1">
              <Shield className="w-3 h-3 mr-1" />
              {ROLE_LABELS[role] || role || '—'}
            </Badge>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{t('email_address')}</p>
              <p className="text-sm font-medium">{user?.email || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{t('clinic')}</p>
              <p className="text-sm font-medium">{clinic?.name || '—'}</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
          {t('personal_settings_note')}
        </p>
      </CardContent>
    </Card>
  );
}