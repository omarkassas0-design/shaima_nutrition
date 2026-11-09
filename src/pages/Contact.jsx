import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Stethoscope, Mail, MessageCircle, MessageSquare, Send, Loader2 } from "lucide-react";
import Seo from '@/components/Seo';
import PublicFooter from '@/components/landing/PublicFooter';

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    // Open the visitor's email client with a prefilled message — no backend needed.
    const subject = encodeURIComponent(`AuraDental Cloud — message from ${name || "a visitor"}`);
    const body = encodeURIComponent(`${message}\n\nFrom: ${name}\nReply to: ${email}`);
    window.location.href = `mailto:auradentalcloud@gmail.com?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSent(true);
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title="Contact AuraDental Cloud — Request a Dental Software Demo"
        description="Get in touch with AuraDental Cloud to request a demo of our dental clinic management software. Ask about scheduling, billing, patient records, and multilingual support for your dental practice."
        path="/contact"
      />
      <header className="sticky top-0 z-30 glass border-b border-border/50 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-foreground">AuraDental Cloud</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link>
            <Link to="/contact" className="text-primary font-medium">Contact</Link>
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 pt-10 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Contact Us
          </h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Have a question about AuraDental Cloud, need a demo for your clinic, or want to request
            an account? We'd love to hear from you. Reach out using the form below or email us
            directly.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Email</h2>
                  <p className="text-sm text-muted-foreground">We usually reply within one business day.</p>
                </div>
              </div>
              <a
                href="mailto:auradentalcloud@gmail.com"
                className="text-primary font-medium hover:underline break-all"
              >
                auradentalcloud@gmail.com
              </a>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">WhatsApp</h2>
                  <p className="text-sm text-muted-foreground">Quick questions and support.</p>
                </div>
              </div>
              <a
                href="https://wa.me/963930478389"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline"
              >
                +963 930 478 389
              </a>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Sales &amp; Support</h2>
                  <p className="text-sm text-muted-foreground">New clinics, demos, and technical help.</p>
                </div>
              </div>
              <Link
                to="/about"
                className="text-primary font-medium hover:underline"
              >
                Learn about the platform
              </Link>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 bg-card rounded-2xl border border-border p-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Your name"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="you@clinic.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium text-foreground">Message</label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="How can we help?"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-5 h-10 font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" /> Send message</>
              )}
            </button>
            {sent && (
              <p className="text-sm text-primary">
                Thanks! Your email client should have opened with your message ready to send.
              </p>
            )}
          </form>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}