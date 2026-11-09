import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/useLanguage';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, UserRound, CalendarDays, Stethoscope,
  CreditCard, FileBarChart, Settings, X, Globe, LogOut, ChevronLeft, ChevronRight, FlaskConical, TestTube,
  UserPlus, DollarSign, Check, Shield, ArrowLeft, ShoppingCart, MessageSquare, LifeBuoy, FileText, RotateCcw, History, Wallet
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useSuperAdmin } from '@/lib/SuperAdminContext';
import { Button } from '@/components/ui/button';

const ADMIN_ROLES = ['super_admin', 'admin', 'clinic_admin'];
const PAYMENT_ROLES = ['super_admin', 'admin', 'clinic_admin', 'receptionist'];
const TEMPLATE_ROLES = ['super_admin', 'admin', 'clinic_admin', 'receptionist'];
const CLINICAL_ROLES = ['super_admin', 'admin', 'clinic_admin', 'doctor'];

// Nav visibility is driven entirely by effectiveRole via the `roles` arrays.
// No component reads user.data.role or user.role for navigation decisions.
const navItems = [
  { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'patients', icon: Users, path: '/patients' },
  { key: 'doctors', icon: UserRound, path: '/doctors', roles: ADMIN_ROLES },
  { key: 'appointments', icon: CalendarDays, path: '/appointments' },
  { key: 'treatments', icon: Stethoscope, path: '/treatments', roles: CLINICAL_ROLES },

  { key: 'payments', icon: CreditCard, path: '/payments', roles: PAYMENT_ROLES },
  { key: 'invoices', icon: FileText, path: '/invoices', roles: PAYMENT_ROLES },
  { key: 'purchases', icon: ShoppingCart, path: '/purchases', roles: ADMIN_ROLES },
  { key: 'laboratories', icon: FlaskConical, path: '/laboratories', roles: ['super_admin', 'admin', 'clinic_admin', 'doctor', 'receptionist'] },
  { key: 'lab_cases', icon: TestTube, path: '/lab-cases', roles: ['super_admin', 'admin', 'clinic_admin', 'doctor', 'receptionist'] },
  { key: 'staff', icon: UserPlus, path: '/staff', roles: ADMIN_ROLES },
  { key: 'commission', icon: DollarSign, path: '/doctor-commission', roles: ADMIN_ROLES },
  { key: 'monthly_expenses', icon: Wallet, path: '/monthly-expenses', roles: ADMIN_ROLES },
  { key: 'patient_recall', icon: RotateCcw, path: '/patient-recall', roles: ['super_admin', 'admin', 'clinic_admin', 'receptionist'] },
  { key: 'reports', icon: FileBarChart, path: '/reports', roles: ADMIN_ROLES },
  { key: 'audit_log', icon: History, path: '/audit-log' },
  { key: 'message_templates', icon: MessageSquare, path: '/message-templates', roles: TEMPLATE_ROLES },
  { key: 'settings', icon: Settings, path: '/settings', roles: ['super_admin', 'admin', 'clinic_admin', 'doctor', 'receptionist'] },
  { key: 'support', icon: LifeBuoy, path: '/support' },
];

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
];

function LanguagePicker({ collapsed, lang, setLang, isRTL }) {
  const compact = collapsed;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
      >
        <Globe className="w-5 h-5 flex-shrink-0" />
        {!compact && <span className="text-sm font-medium">{current.label}</span>}
      </button>
      {open && (
        <div className={`absolute bottom-full mb-1 ${isRTL ? 'left-2' : 'right-2'} w-40 rounded-xl bg-popover border border-border shadow-xl overflow-hidden z-50`}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 w-full text-sm transition-colors ${
                lang === l.code ? 'bg-primary/10 text-primary font-medium' : 'text-popover-foreground hover:bg-accent'
              }`}
            >
              <span className="flex items-center gap-2"><span className="text-base">{l.flag}</span>{l.label}</span>
              {lang === l.code && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { t, lang, setLang, isRTL } = useLanguage();
  const { effectiveRole, logout } = useAuth();
  const { isManaging, exitManageMode } = useSuperAdmin();
  const location = useLocation();
  const navigate = useNavigate();

  // Single source of truth: nav visibility derives from effectiveRole only.
  const visibleNavItems = navItems.filter(item =>
    !item.roles || item.roles.includes(effectiveRole)
  );

  const handleBackToSuperAdmin = () => {
    exitManageMode();
    navigate('/super-admin');
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const compact = collapsed && !mobileOpen;
  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className={`p-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between border-b border-sidebar-border ${compact ? 'flex-col gap-2' : ''}`}>
        {!compact && (
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-sidebar-foreground">AuraDental</span>
          </div>
        )}
        {compact && (
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center mx-auto">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent md:flex hidden"
          onClick={() => setCollapsed(!collapsed)}
        >
          {isRTL ? (collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : (collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />)}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {isManaging && (
          <button
            onClick={handleBackToSuperAdmin}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full bg-primary/10 text-primary hover:bg-primary/20 transition-all mb-2 border border-primary/20"
          >
            <Shield className="w-5 h-5 flex-shrink-0" />
            {!compact && <span className="text-sm font-medium">{t('super_admin')}</span>}
            {!compact && <ArrowLeft className="w-3.5 h-3.5 ml-auto rtl:rotate-180" />}
          </button>
        )}
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.key}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              aria-label={t(item.key)}
              title={compact ? t(item.key) : undefined}
              className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 group ${
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sky-500/20'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${active ? '' : 'group-hover:scale-110 transition-transform'}`} />
              {!compact && <span className="text-sm font-medium">{t(item.key)}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-sidebar-border space-y-1">
        <LanguagePicker collapsed={compact} lang={lang} setLang={setLang} isRTL={isRTL} />
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!compact && <span className="text-sm font-medium">{t('logout')}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex shrink-0 flex-col bg-sidebar/95 border-e border-sidebar-border h-dvh sticky top-0 transition-all duration-300 ${collapsed ? 'w-[88px]' : 'w-[272px] lg:w-[288px]'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <motion.aside
            initial={{ x: isRTL ? 280 : -280 }}
            animate={{ x: 0 }}
            exit={{ x: isRTL ? 280 : -280 }}
            className={`absolute top-0 ${isRTL ? 'right-0' : 'left-0'} h-full w-64 bg-sidebar`}
          >
            {sidebarContent}
          </motion.aside>
        </div>
      )}
    </>
  );
}