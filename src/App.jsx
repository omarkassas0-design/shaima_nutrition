import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import { LanguageProvider } from '@/lib/useLanguage';
import { ClinicProvider } from '@/lib/useClinic';
import ErrorBoundary from '@/components/ErrorBoundary';
import { setupPWA } from '@/lib/pwaSetup';

import Login from '@/pages/Login';
import Landing from '@/pages/Landing';
import PendingApproval from '@/components/PendingApproval';
import AccountStatusScreen from '@/components/AccountStatusScreen';

import AppLayout from '@/components/layout/AppLayout';
import RoleHome from '@/components/RoleHome';
import { SuperAdminProvider } from '@/lib/SuperAdminContext';
import SuperAdminRoute from '@/components/SuperAdminRoute';
import RoleRoute from '@/components/RoleRoute';
import RoleRefreshOnNavigate from '@/components/RoleRefreshOnNavigate';
import RoleSyncManager from '@/components/RoleSyncManager';

// Lazy-loaded pages — code splitting for faster initial load
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Mfa = lazy(() => import('@/pages/Mfa'));
const OAuthConsent = lazy(() => import('@/pages/OAuthConsent'));
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const Terms = lazy(() => import('@/pages/Terms'));
const SubscriptionGuard = lazy(() => import('@/components/SubscriptionGuard'));
const Patients = lazy(() => import('@/pages/Patients'));
const AddPatient = lazy(() => import('@/pages/AddPatient'));
const PatientProfile = lazy(() => import('@/pages/PatientProfile'));
const Doctors = lazy(() => import('@/pages/Doctors'));
const Treatments = lazy(() => import('@/pages/Treatments'));
const Appointments = lazy(() => import('@/pages/Appointments'));
const Payments = lazy(() => import('@/pages/Payments'));
const Reports = lazy(() => import('@/pages/Reports'));
const Settings = lazy(() => import('@/pages/Settings'));
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const Laboratories = lazy(() => import('@/pages/Laboratories'));
const LabCases = lazy(() => import('@/pages/LabCases'));
const TreatmentPlanPage = lazy(() => import('@/pages/TreatmentPlanPage'));
const Staff = lazy(() => import('@/pages/Staff'));
const DoctorCommission = lazy(() => import('@/pages/DoctorCommission'));
const MonthlyExpenses = lazy(() => import('@/pages/MonthlyExpenses'));
const Purchases = lazy(() => import('@/pages/Purchases'));
const Invoices = lazy(() => import('@/pages/Invoices'));
const MessageTemplates = lazy(() => import('@/pages/MessageTemplates'));
const Support = lazy(() => import('@/pages/Support'));
const PatientRecall = lazy(() => import('@/pages/PatientRecall'));
const AuditLogPage = lazy(() => import('@/pages/AuditLog'));
const SuperAdminDashboard = lazy(() => import('@/pages/SuperAdminDashboard'));


// Register service worker + fix manifest/theme-color (platform overrides HTML head).
// Must run here in App.jsx — the platform's build bypasses src/main.jsx entirely.
setupPWA();

const ProtectedLayout = () => (
  <SuperAdminProvider>
    <ClinicProvider>
      <RoleSyncManager />
      <RoleRefreshOnNavigate />
      <AppLayout />
    </ClinicProvider>
  </SuperAdminProvider>
);

// Entry point: an unauthenticated visitor sees the login screen immediately;
// an authenticated user goes straight to their role dashboard.
const RootEntry = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">AuraDental Cloud</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'mfa_required') {
      return <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-background"><div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}><Mfa /></Suspense>;
    }
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    if (authError.type === 'pending_approval') {
      return <PendingApproval />;
    }
    if (authError.type === 'account_suspended') {
      return <AccountStatusScreen type="account_suspended" />;
    }
    if (authError.type === 'trial_ended') {
      return <AccountStatusScreen type="trial_ended" />;
    }
    // auth_required and any other errors: fall through to routes,
    // ProtectedRoute will redirect to /login
  }

  return (
    <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-background"><div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/mfa" element={<Mfa />} />
      <Route path="/oauth-consent" element={<OAuthConsent />} />
      <Route path="/" element={<RootEntry />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<RoleHome />} />
          <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/add" element={<RoleRoute capability="patients:write"><AddPatient /></RoleRoute>} />
          <Route path="/patients/:id" element={<PatientProfile />} />
          <Route path="/doctors" element={<Doctors />} />
          <Route path="/treatments" element={<Treatments />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/payments" element={<RoleRoute capability="payments:write"><Payments /></RoleRoute>} />
          <Route path="/invoices" element={<RoleRoute capability="invoices:write"><Invoices /></RoleRoute>} />
          <Route path="/reports" element={<RoleRoute mode="admin"><Reports /></RoleRoute>} />
          <Route path="/settings" element={<RoleRoute capability="settings:view"><Settings /></RoleRoute>} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/laboratories" element={<Laboratories />} />
          <Route path="/lab-cases" element={<LabCases />} />
          <Route path="/patients/:id/treatment-plan" element={<TreatmentPlanPage />} />
          <Route path="/staff" element={<RoleRoute mode="admin"><Staff /></RoleRoute>} />
          <Route path="/doctor-commission" element={<RoleRoute mode="admin"><DoctorCommission /></RoleRoute>} />
          <Route path="/monthly-expenses" element={<RoleRoute mode="admin"><MonthlyExpenses /></RoleRoute>} />
          <Route path="/purchases" element={<RoleRoute capability="purchases:write"><Purchases /></RoleRoute>} />
          <Route path="/message-templates" element={<RoleRoute capability="messagetemplates:write"><MessageTemplates /></RoleRoute>} />
          <Route path="/support" element={<Support />} />
          <Route path="/patient-recall" element={<PatientRecall />} />
          <Route path="/audit-log" element={<RoleRoute capability="auditlog:view"><AuditLogPage /></RoleRoute>} />

        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LanguageProvider>
          <ErrorBoundary>
            <Router>
              <AuthenticatedApp />
            </Router>
          </ErrorBoundary>
          <Toaster />
          <SonnerToaster position="top-center" richColors />
        </LanguageProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
