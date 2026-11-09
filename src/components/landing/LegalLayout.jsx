import React from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, ArrowLeft } from 'lucide-react';
import PublicFooter from '@/components/landing/PublicFooter';

export default function LegalLayout({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 glass border-b border-border/50 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center"><Stethoscope className="w-5 h-5 text-white" /></div>
            <span className="font-bold text-lg text-foreground">AuraDental Cloud</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Back</Link>
        </div>
      </header>
      <main className="flex-1 px-4 pt-10 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
          {updated && <p className="text-sm text-muted-foreground mt-2">Last updated: {updated}</p>}
          <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">{children}</div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}