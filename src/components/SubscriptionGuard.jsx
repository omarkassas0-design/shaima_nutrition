import React from 'react';
import { useSubscriptionCheck } from '@/lib/useSubscriptionCheck';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function SubscriptionGuard({ children }) {
  const { isSubscriptionActive, isExpired, clinic } = useSubscriptionCheck();

  if (!clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isExpired()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="w-6 h-6" />
              <h2 className="text-xl font-bold">Subscription Expired</h2>
            </div>
            <p className="text-muted-foreground">
              Your subscription to {clinic.name} has expired. Please renew your subscription to continue accessing AuraDental Cloud.
            </p>
            <p className="text-sm text-muted-foreground">
              Your data is safe and will be available once you renew.
            </p>
            <Button className="w-full" onClick={() => window.location.href = '/subscriptions'}>
              Renew Subscription
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isSubscriptionActive()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold">Welcome to AuraDental Cloud</h2>
            <p className="text-muted-foreground">
              Start your 14-day free trial to access all features.
            </p>
            <Button className="w-full" onClick={() => window.location.href = '/subscriptions'}>
              Start Free Trial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
}