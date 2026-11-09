import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { formatNumber } from '@/lib/currencyUtils';

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' } }) };

const COLORS = {
  sky: { grad: 'from-sky-500 to-cyan-400', soft: 'bg-sky-50 dark:bg-sky-950/30', text: 'text-sky-600 dark:text-sky-400' },
  indigo: { grad: 'from-indigo-500 to-blue-400', soft: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-600 dark:text-indigo-400' },
  teal: { grad: 'from-teal-500 to-emerald-400', soft: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-600 dark:text-teal-400' },
  violet: { grad: 'from-violet-500 to-purple-400', soft: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-600 dark:text-violet-400' },
};

export default function SuperAdminStatCard({ index = 0, icon: Icon, label, value, color = 'sky', loading }) {
  const c = COLORS[color] || COLORS.sky;

  return (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible">
      <Card className="border border-border/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden relative group">
        <div className={`absolute inset-0 bg-gradient-to-br ${c.grad} opacity-[0.03] pointer-events-none`} />
        <CardContent className="p-4 sm:p-5 relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-relaxed mb-1.5 break-words">{label}</p>
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums leading-none">{formatNumber(value)}</p>
              )}
            </div>
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${c.grad} flex items-center justify-center shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}