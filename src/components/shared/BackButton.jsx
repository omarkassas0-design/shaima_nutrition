import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/useLanguage';
import { useAuth } from '@/lib/AuthContext';

/**
 * Consistent, functional in-app back navigation.
 *
 * Returns to the previous in-app page. When there is no meaningful previous
 * page (deep link, fresh tab, post-logout entry) it falls back to the home
 * page for the signed-in user's role.
 */
const ROLE_HOME = {
  super_admin: '/super-admin',
  clinic_admin: '/dashboard',
  doctor: '/dashboard',
  receptionist: '/dashboard',
};

export default function BackButton({ fallbackPath, className = '' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isRTL } = useLanguage();
  const { effectiveRole } = useAuth();

  const Icon = isRTL ? ArrowRight : ArrowLeft;

  const handleBack = () => {
    // location.key === 'default' means this is the first entry in the history
    // stack — going back would leave the app, so use the role home instead.
    const hasInAppHistory = location.key !== 'default' && window.history.length > 1;
    if (hasInAppHistory) {
      navigate(-1);
      return;
    }
    navigate(fallbackPath || ROLE_HOME[effectiveRole] || '/dashboard');
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleBack}
      aria-label={isRTL ? 'رجوع' : 'Back'}
      title={isRTL ? 'رجوع' : 'Back'}
      className={`shrink-0 ${className}`}
    >
      <Icon className="w-5 h-5" />
    </Button>
  );
}