import React from 'react';
import { MessageCircle, Phone, Mail, LifeBuoy } from 'lucide-react';
import { cn } from '@/lib/utils';

// Official AuraDental Cloud support contacts (same values used on the
// Contact, Support, Terms and Privacy pages).
const SUPPORT_PHONE_DISPLAY = '+963 930 478 389';
const SUPPORT_PHONE_E164 = '+963930478389';
const SUPPORT_WHATSAPP_URL = 'https://wa.me/963930478389';
const SUPPORT_EMAIL = 'auradentalcloud@gmail.com';
const EMAIL_SUBJECT = 'AuraDental Cloud Access Request';
const EMAIL_BODY = [
  'Hello AuraDental Cloud Support,',
  '',
  'I have submitted a request to access AuraDental Cloud and would like help with the approval.',
  '',
  'My account email:',
  'My clinic name:',
  '',
  'Thank you.',
].join('\n');

/**
 * Support block used on the sign-up and access-request screens: lets a user
 * contact the administrator by WhatsApp, phone or email.
 * The default variant is a standalone card; variant="compact" renders the slim
 * in-card version (WhatsApp + email) placed under the sign-up form.
 */
export default function SupportContactSection({ className, variant = 'full' }) {
  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    EMAIL_SUBJECT
  )}&body=${encodeURIComponent(EMAIL_BODY)}`;

  if (variant === 'compact') {
    return (
      <div className={cn('border-t border-border pt-5 text-start', className)}>
        <p className="text-sm font-semibold text-foreground">
          Need help? Contact us
        </p>

        <div className="mt-3 space-y-2">
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Message AuraDental Cloud support on WhatsApp at ${SUPPORT_PHONE_DISPLAY}`}
            className="flex items-center gap-3 min-h-11 rounded-xl border border-input px-3.5 py-2.5 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <MessageCircle className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">WhatsApp</span>
              <span className="bidi-iso block text-sm font-medium text-foreground">
                {SUPPORT_PHONE_DISPLAY}
              </span>
            </span>
          </a>

          <a
            href={mailtoHref}
            aria-label={`Email AuraDental Cloud support at ${SUPPORT_EMAIL}`}
            className="flex items-center gap-3 min-h-11 rounded-xl border border-input px-3.5 py-2.5 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Mail className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">Email</span>
              <span className="block text-sm font-medium text-foreground break-all">
                {SUPPORT_EMAIL}
              </span>
            </span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-card rounded-2xl border border-border shadow-sm p-6 text-start',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
          <LifeBuoy className="w-5 h-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">
            Need help accessing AuraDental Cloud?
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Contact our support team with any question about your access request.
            We are happy to help while your request is being reviewed.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a
          href={SUPPORT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Message AuraDental Cloud support on WhatsApp at ${SUPPORT_PHONE_DISPLAY}`}
          className="inline-flex items-center justify-center gap-2 min-h-12 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90"
        >
          <MessageCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>WhatsApp</span>
          <span className="bidi-iso font-semibold">{SUPPORT_PHONE_DISPLAY}</span>
        </a>

        <a
          href={`tel:${SUPPORT_PHONE_E164}`}
          aria-label={`Call AuraDental Cloud support at ${SUPPORT_PHONE_DISPLAY}`}
          className="inline-flex items-center justify-center gap-2 min-h-12 rounded-xl border border-input px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Phone className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>Call</span>
          <span className="bidi-iso font-semibold">{SUPPORT_PHONE_DISPLAY}</span>
        </a>
      </div>

      <a
        href={mailtoHref}
        aria-label={`Email AuraDental Cloud support at ${SUPPORT_EMAIL}`}
        className="mt-3 flex items-center gap-3 min-h-12 rounded-xl border border-input px-4 py-2.5 transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Mail className="w-5 h-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">
            Email support
          </span>
          <span className="block text-xs text-muted-foreground break-all">
            {SUPPORT_EMAIL}
          </span>
        </span>
      </a>
    </div>
  );
}