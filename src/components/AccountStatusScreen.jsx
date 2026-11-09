import React from 'react';
import { ShieldAlert, CreditCard, Phone, Mail, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/useLanguage';

const CONTACT_PHONE = '+963 930 478 389';
const CONTACT_EMAIL = 'auradentalcloud@gmail.com';

export default function AccountStatusScreen({ type }) {
  const { logout } = useAuth();
  const { t, lang } = useLanguage();

  const isSuspended = type === 'account_suspended';
  const title = isSuspended ? t('account_suspended_title') : t('trial_ended');
  const description = isSuspended ? t('account_suspended_desc') : t('trial_ended_desc');
  const Icon = isSuspended ? ShieldAlert : CreditCard;
  const iconBg = isSuspended ? 'bg-orange-100' : 'bg-amber-100';
  const iconColor = isSuspended ? 'text-orange-600' : 'text-amber-600';
  const isRtl = lang === 'ar';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl border border-slate-200">
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full ${iconBg}`}>
            <Icon className={`w-8 h-8 ${iconColor}`} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3" dir={isRtl ? 'rtl' : 'ltr'}>{title}</h1>
          <p className="text-slate-600 mb-8 text-sm leading-relaxed" dir={isRtl ? 'rtl' : 'ltr'}>{description}</p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3" dir={isRtl ? 'rtl' : 'ltr'}>{t('contact_support')}</p>
            <div className="space-y-3">
              <a
                href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`}
                className="flex items-center gap-3 text-slate-700 hover:text-primary transition-colors"
              >
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200">
                  <Phone className="w-4 h-4 text-primary" />
                </span>
                <span className="font-medium" dir="ltr">{CONTACT_PHONE}</span>
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-3 text-slate-700 hover:text-primary transition-colors"
              >
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-slate-200">
                  <Mail className="w-4 h-4 text-primary" />
                </span>
                <span className="font-medium" dir="ltr">{CONTACT_EMAIL}</span>
              </a>
            </div>
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}