import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { roleIsReadOnly } from '@/lib/permissions';
import BackButton from '@/components/shared/BackButton';

export default function PageHeader({ title, subtitle, actionLabel, onAction, showBack = true, backPath }) {
  const { effectiveRole } = useAuth();
  // Read-only roles (doctor) never get a create action, on any page.
  const showAction = actionLabel && onAction && !roleIsReadOnly(effectiveRole);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="flex min-w-0 items-center gap-3">
        {showBack && <BackButton fallbackPath={backPath} />}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl leading-snug font-bold text-foreground break-words">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {showAction && (
        <Button onClick={onAction} className="gradient-primary text-white shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-all">
          <Plus className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}