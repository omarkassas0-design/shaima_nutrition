import React, { useEffect, useState } from 'react';
import { Mail, Loader2, AlertCircle, CheckCircle2, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

// One resend per minute: enough to recover from a lost or expired code
// without hammering the verification service.
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Email verification step of sign-up. Shows exactly which address the code was
 * sent to, lets the user resend it (rate limited), correct a mistyped address,
 * and shows success/failure messages inline.
 */
export default function EmailOtpVerification({
  email,
  code,
  onCodeChange,
  onVerify,
  onResend,
  onEditEmail,
  verifying = false,
  resending = false,
  error = '',
  notice = '',
}) {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    const accepted = await onResend();
    if (accepted) setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4 shadow-lg">
          <Mail className="w-8 h-8 text-white" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          We sent a 6-digit verification code to
        </p>
        <p className="text-foreground font-medium text-sm mt-0.5 break-all">{email}</p>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
        <p className="text-xs text-muted-foreground mb-4 text-start">
          The email can take a minute to arrive. If you don't see it, check your spam or junk
          folder and add the sender address shown in the email to your contacts so future codes reach you.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-sm"
          >
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={onCodeChange}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          className="w-full h-11 font-medium gradient-primary text-white"
          onClick={onVerify}
          disabled={verifying || code.length < 6}
        >
          {verifying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify & Submit Request"
          )}
        </Button>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          Didn't receive the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            className="text-primary font-medium hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
          >
            {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </div>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={onEditEmail}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <PencilLine className="w-3.5 h-3.5" aria-hidden="true" />
            Wrong email address? Edit it
          </button>
        </div>
      </div>
    </div>
  );
}
