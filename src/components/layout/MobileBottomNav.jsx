import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, FileBarChart, Settings } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/useLanguage';

const ADMIN_ROLES = ['super_admin', 'admin', 'clinic_admin'];

export default function MobileBottomNav() {
  const { effectiveRole } = useAuth();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const isAdmin = ADMIN_ROLES.includes(effectiveRole);

  // Admins see 5 items (Dashboard, Patients, Appointments, Reports, Settings).
  // Doctors/Receptionists see 4 items (Dashboard, Patients, Appointments, Settings).
  const items = [
    { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard', label: t('dashboard') || 'Home' },
    { key: 'patients', icon: Users, path: '/patients', label: t('patients') },
    { key: 'appointments', icon: CalendarDays, path: '/appointments', label: t('appointments') },
    ...(isAdmin ? [{ key: 'reports', icon: FileBarChart, path: '/reports', label: t('reports') }] : []),
    { key: 'settings', icon: Settings, path: '/settings', label: t('settings') },
  ];

  const isActive = (path) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 mx-2 mb-2 rounded-3xl bg-card/95 backdrop-blur-xl shadow-soft border border-border/50 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className={`grid ${items.length === 5 ? 'grid-cols-5' : 'grid-cols-4'} gap-1`}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.key}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-colors ${
                active
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-[11px] font-medium leading-snug break-words text-center max-w-full">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}