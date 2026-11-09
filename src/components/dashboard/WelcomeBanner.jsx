import React from 'react';
import { CalendarDays } from 'lucide-react';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';

export default function WelcomeBanner({ clinicName }) {
  const { t, lang } = useLanguage();
  return <section className="relative isolate overflow-hidden rounded-3xl border border-primary/10 bg-primary/5 shadow-soft">
    <img src="/assets/welcome-banner.png" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover rtl:-scale-x-100 dark:opacity-20" />
    <div className="relative flex min-h-36 sm:min-h-44 flex-col justify-center items-start gap-3 p-5 sm:p-7">
      <p className="inline-flex items-center gap-2 rounded-lg bg-card/90 px-2.5 py-1 text-xs text-foreground"><CalendarDays className="h-3.5 w-3.5 text-primary" />{formatDisplayDate(new Date(), lang)}</p>
      <div className="max-w-[70%] rounded-xl bg-card/60 p-2 backdrop-blur-sm"><h1 className="text-xl sm:text-3xl font-bold leading-snug">{t('welcome_back')}</h1><p className="mt-1 text-sm text-muted-foreground break-words">{clinicName || t('app_name')}</p></div>
    </div>
  </section>;
}
