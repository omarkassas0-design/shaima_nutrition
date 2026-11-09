import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { Stethoscope, LogIn, UserPlus } from 'lucide-react';
import AuthBackground from '@/components/AuthBackground';
import Seo from '@/components/Seo';
import PublicFooter from '@/components/landing/PublicFooter';

export default function Landing() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, isLoadingAuth, navigate]);

  return (
    <div className="relative min-h-screen flex flex-col px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <Seo
        title="AuraDental Cloud — Dental Clinic Management Software"
        description="AuraDental Cloud is a cloud-based dental clinic management software for patient records, appointment scheduling, 3D dental charting, billing, and reporting. Manage your dental practice in one secure, multilingual platform."
        path="/"
      />
      <AuthBackground />
      <div className="flex-1 flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center text-center"
      >
        <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center shadow-2xl shadow-sky-500/30 mb-6">
          <Stethoscope className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">AuraDental Cloud</h1>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <Link to="/login" className="flex-1 inline-flex items-center justify-center gap-2 rounded-md gradient-primary text-white px-6 h-12 font-medium shadow-lg shadow-sky-500/20 hover:opacity-95">
            <LogIn className="w-4 h-4" /> Sign In
          </Link>
          <Link to="/register" className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-input bg-card px-6 h-12 font-medium hover:bg-accent">
            <UserPlus className="w-4 h-4" /> Create New Account
          </Link>
        </div>
      </motion.div>
      </div>
      <PublicFooter compact />
    </div>
  );
}