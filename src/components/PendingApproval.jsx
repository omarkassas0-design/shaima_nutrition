import React from 'react';
import { Clock, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import SupportContactSection from '@/components/shared/SupportContactSection';

export default function PendingApproval() {
  const navigate = useNavigate();

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-6 shadow-lg">
          <Stethoscope className="w-8 h-8 text-white" />
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
            <Clock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>

          <h1 className="text-xl font-bold text-foreground mb-2">
            Registration Pending Approval
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your sign-up request has been submitted successfully. The Super Admin
            will review your information and approve your account.
            You will not be able to access the system until your request is approved.
          </p>

          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
            <p className="text-xs text-muted-foreground mb-1">What happens next?</p>
            <ul className="text-sm space-y-1.5 text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold mt-0.5">1.</span>
                <span>The Super Admin reviews your registration request</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold mt-0.5">2.</span>
                <span>Your clinic and role are assigned upon approval</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold mt-0.5">3.</span>
                <span>You'll be able to log in and access your workspace</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={handleBackToLogin}
            variant="outline"
            className="w-full h-11"
          >
            Back to Login
          </Button>
        </div>

        <SupportContactSection className="mt-6" />

        <p className="text-center text-xs text-muted-foreground mt-6">
          AuraDental Cloud — Secure clinic management system
        </p>
      </div>
    </div>
  );
}