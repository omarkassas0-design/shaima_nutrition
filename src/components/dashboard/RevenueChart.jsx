import React, { useMemo } from 'react';
import { useLanguage } from '@/lib/useLanguage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { formatDisplayDate } from '@/lib/dateFormat';

export default function RevenueChart({ payments }) {
  const { t, lang } = useLanguage();

  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const monthPayments = payments.filter(p => {
        const pDate = p.payment_date ? parseISO(p.payment_date) : p.created_date ? new Date(p.created_date) : null;
        return pDate && isWithinInterval(pDate, { start, end });
      });
      months.push({
        // Month names follow the selected language (was always English).
        month: formatDisplayDate(date, lang, { month: 'short' }),
        revenue: monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
      });
    }
    return months;
  }, [payments]);

  return (
    <Card className="glass border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          {t('revenue')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                }}
              />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}