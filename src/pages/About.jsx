import React from "react";
import { Link } from "react-router-dom";
import { Stethoscope, ShieldCheck, Globe, CalendarDays } from "lucide-react";
import Seo from '@/components/Seo';
import PublicFooter from '@/components/landing/PublicFooter';

export default function About() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title="About AuraDental Cloud — Dental Practice Management Platform"
        description="Learn about AuraDental Cloud, a cloud-based dental practice management platform built to streamline scheduling, patient records, billing, and clinical workflows for modern dental clinics."
        path="/about"
      />
      {/* Top bar */}
      <header className="sticky top-0 z-30 glass border-b border-border/50 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-foreground">AuraDental Cloud</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/about" className="text-primary font-medium">About</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 pt-10 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            About AuraDental Cloud
          </h1>

          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            AuraDental Cloud is a premium, cloud-based practice management platform built for modern
            dental clinics. It brings patient records, scheduling, clinical charting, billing, and
            reporting together in one secure workspace, so teams can spend less time on
            administration and more time on patient care.
          </p>

          <p className="mt-4 text-muted-foreground leading-relaxed">
            The platform is designed for dental practices of every size — from single-doctor offices
            to multi-provider clinics. Dentists, hygienists, receptionists, and clinic administrators
            each get a role-tailored view: doctors focus on clinical notes, treatment plans, and a
            3D dental chart; front-desk staff manage appointments and payments; administrators oversee
            staff, commissions, expenses, and clinic-wide settings. With multilingual support for
            English, Arabic, and Turkish, AuraDental Cloud serves clinics across diverse regions.
          </p>

          <p className="mt-4 text-muted-foreground leading-relaxed">
            AuraDental Cloud is built by the AuraDental team as a secure, multi-tenant SaaS product.
            Every clinic's data is isolated, encrypted at rest, and protected with role-based access
            control and regular automated backups — including off-platform copies — so practice
            information stays private, safe, and always recoverable.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="bg-card rounded-2xl border border-border p-5">
              <ShieldCheck className="w-6 h-6 text-primary mb-3" />
              <h2 className="font-semibold text-foreground">Secure by design</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Clinic-isolated data, role-based access, and automated encrypted backups.
              </p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5">
              <CalendarDays className="w-6 h-6 text-primary mb-3" />
              <h2 className="font-semibold text-foreground">Built for clinics</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Appointments, treatments, payments, lab cases, and reports in one place.
              </p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5">
              <Globe className="w-6 h-6 text-primary mb-3" />
              <h2 className="font-semibold text-foreground">Multilingual</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Full English, Arabic, and Turkish interfaces with RTL support.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-5 h-10 font-medium hover:bg-primary/90"
            >
              Contact us
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-5 h-10 font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}