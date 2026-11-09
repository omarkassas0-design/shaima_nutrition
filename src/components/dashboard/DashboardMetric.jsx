import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const tones = { sky: 'metric-sky', teal: 'metric-teal', violet: 'metric-violet', amber: 'metric-amber', rose: 'metric-rose', indigo: 'metric-indigo' };
export default function DashboardMetric({ icon: Icon, label, value, sub, color = 'sky', loading, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`aura-metric ${tones[color] || tones.sky} relative flex h-full min-w-0 flex-col justify-between rounded-xl border border-border/40 p-2.5 sm:p-3 text-start shadow-soft transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}>
    <div className="flex items-start gap-2">
      <div className="metric-icon grid h-8 w-8 shrink-0 place-items-center rounded-lg"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium leading-snug text-muted-foreground break-words">{label}</p>
        {loading ? <Skeleton className="mt-1 h-5 w-14" /> : <p className="mt-0.5 text-base sm:text-lg font-bold leading-tight tabular-nums break-words">{value ?? '—'}</p>}
        {sub && !loading && <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground break-words">{sub}</p>}
      </div>
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-primary/60 rtl:rotate-180" />}
    </div>
  </Tag>;
}