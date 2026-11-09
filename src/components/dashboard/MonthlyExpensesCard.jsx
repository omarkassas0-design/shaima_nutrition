import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { useClinic } from '@/lib/useClinic';
import { ChevronRight, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrencyTotals } from '@/lib/currencyUtils';
import { useRoleChangeEffect } from '@/hooks/useRoleChangeEffect';
import { useLanguage } from '@/lib/useLanguage';

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' } }) };

export default function MonthlyExpensesCard({ index = 0 }) {
  const { t } = useLanguage();
  const { clinic } = useClinic();
  const navigate = useNavigate();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['monthlyExpensesSummary', clinic?.id, month],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getMonthlyExpenses', { month, clinic_id: clinic?.id });
      return res.data;
    },
    enabled: !!clinic?.id,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  // Immediately refetch when the user's role changes.
  useRoleChangeEffect(() => { refetch(); });

  return (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible" className="h-full">
      <button
        type="button"
        onClick={() => navigate('/monthly-expenses')}
        className="aura-metric metric-rose relative flex h-full w-full min-w-0 flex-col justify-between rounded-xl border border-border/40 p-2.5 sm:p-3 text-start shadow-soft transition-shadow hover:shadow-md"
      >
        <div className="flex items-start gap-2">
          <div className="metric-icon grid h-8 w-8 shrink-0 place-items-center rounded-lg"><Wallet className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium leading-snug text-muted-foreground break-words">{t('monthly_expenses')}</p>
            {isLoading ? (
              <div className="mt-1 h-5 w-14 rounded bg-secondary/40 animate-pulse" />
            ) : (
              <p className="mt-0.5 text-base sm:text-lg font-bold leading-tight tabular-nums break-words">{formatCurrencyTotals(data?.totals?.grand_total)}</p>
            )}
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{t('breakdown')}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-primary/60 rtl:rotate-180" />
        </div>
      </button>
    </motion.div>
  );
}