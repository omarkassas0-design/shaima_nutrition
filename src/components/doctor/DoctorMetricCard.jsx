import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

export default function DoctorMetricCard({ icon: Icon, label, value, hint, isLoading, accent = 'bg-primary/10 text-primary' }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5 flex flex-wrap items-start gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground leading-tight">{label}</p>
            {isLoading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{value}</p>
            )}
            {hint && !isLoading && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}