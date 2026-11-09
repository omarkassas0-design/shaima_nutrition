import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { useLanguage } from '@/lib/useLanguage';
import { formatMoney } from '@/lib/currencyUtils';

// Shared locale-aware money formatting. This was hardcoded to 'en-US', so a
// doctor's earnings were always shown in English conventions whatever language
// the app was in.
const fmt = (amount, currency) => formatMoney(amount, currency);

/**
 * A doctor's OWN commission earnings, shown strictly per currency.
 * Currencies are never summed or converted together.
 */
export default function DoctorEarningsCard({ financials }) {
  const { t } = useLanguage();
  const currencies = [...new Set([
    ...Object.keys(financials?.commission || {}),
    ...Object.keys(financials?.paid || {}),
  ])];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="w-4 h-4 text-primary" />
          {t('my_earnings')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {currencies.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('no_data')}</p>
        )}
        {currencies.map(cur => (
          <div key={cur} className="rounded-xl border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{cur}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[11px] text-muted-foreground">{t('commission_earned')}</p>
                <p className="text-sm font-semibold">{fmt(financials.commission?.[cur], cur)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{t('paid')}</p>
                <p className="text-sm font-semibold text-emerald-600">{fmt(financials.paid?.[cur], cur)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{t('remaining')}</p>
                <p className="text-sm font-semibold text-amber-600">{fmt(financials.remaining?.[cur], cur)}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}