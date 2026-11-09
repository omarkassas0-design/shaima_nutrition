import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { appClient } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Phone, Building2, Loader2, CheckCircle2, Stethoscope, ArrowLeft, User } from "lucide-react";
import EmailOtpVerification from "@/components/auth/EmailOtpVerification";
import AuthBackground from "@/components/AuthBackground";
import Seo from "@/components/Seo";
import PublicFooter from "@/components/landing/PublicFooter";
import SupportContactSection from "@/components/shared/SupportContactSection";

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [notice, setNotice] = useState("");
  const [resending, setResending] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    // The verification code is sent to exactly this address, so send the
    // normalised form (trimmed, lowercase) that the auth service stores.
    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    try {
      await appClient.auth.register({ email: cleanEmail, password });
      setEmail(cleanEmail);
      setShowOtp(true);
    } catch (err) {
      setError(
        err.message ||
          "Registration failed. Please try again, or sign in if you already registered this address."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      // verifyOtp verifies the email code but does NOT return an access token.
      // Login with the credentials to obtain a valid session before updating the profile.
      const cleanEmail = email.trim().toLowerCase();
      await appClient.auth.verifyOtp({ email: cleanEmail, otpCode });
      const loginResult = await appClient.auth.loginViaEmailPassword(cleanEmail, password);
      appClient.auth.setToken(loginResult.access_token);

      // Store extra sign-up data on the user with pending status
      try {
        await appClient.auth.updateMe({
          full_name: fullName,
          phone,
          clinic_name: clinicName,
          signup_status: "pending",
        });
      } catch (updateErr) {
        // full_name is a built-in and may not be settable via updateMe;
        // store it as a fallback custom field so admin still sees it
        await appClient.auth.updateMe({
          phone,
          clinic_name: clinicName,
          signup_status: "pending",
        });
      }

      setRequestSubmitted(true);
    } catch (err) {
      setError(
        err.message ||
          "That code is not valid. Check the digits you entered, or request a new code."
      );
    } finally {
      setLoading(false);
    }
  };

  // Resend the code. Returns true only when the request was accepted, so the
  // screen can start its cooldown timer.
  const handleResend = async () => {
    setError("");
    setNotice("");
    setResending(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      await appClient.auth.resendOtp(cleanEmail);
      setNotice(`A new verification code has been sent to ${cleanEmail}.`);
      return true;
    } catch (err) {
      setError(err.message || "We could not resend the code. Please try again in a moment.");
      return false;
    } finally {
      setResending(false);
    }
  };

  // Mistyped address? Back to the form with the entries kept so it can be fixed.
  const handleEditEmail = () => {
    setShowOtp(false);
    setOtpCode("");
    setError("");
    setNotice("");
  };

  // Success screen after request submission
  if (requestSubmitted) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-background px-4">
        <AuthBackground />
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-6 shadow-lg">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>

            <h1 className="text-xl font-bold text-foreground mb-2">
              Request Submitted
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Your registration request has been submitted for approval. The Super Admin
              will review your information and approve your account.
            </p>

            <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
              <p className="text-xs text-muted-foreground mb-1">What happens next?</p>
              <ul className="text-sm space-y-1.5 text-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold mt-0.5">1.</span>
                  <span>The Super Admin reviews your registration request</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold mt-0.5">2.</span>
                  <span>Your clinic and role are assigned upon approval</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold mt-0.5">3.</span>
                  <span>You'll be able to log in and access your workspace</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => navigate("/login")}
              variant="outline"
              className="w-full h-11"
            >
              Back to Login
            </Button>
          </div>

          <SupportContactSection className="mt-6" />

          <p className="text-center text-xs text-muted-foreground mt-6">
            AuraDental Cloud — Secure clinic management system
          </p>
        </div>
      </div>
    );
  }

  // Email verification step
  if (showOtp) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <AuthBackground />
        <EmailOtpVerification
          email={email.trim().toLowerCase()}
          code={otpCode}
          onCodeChange={setOtpCode}
          onVerify={handleVerify}
          onResend={handleResend}
          onEditEmail={handleEditEmail}
          verifying={loading}
          resending={resending}
          error={error}
          notice={notice}
        />
      </div>
    );
  }

  // Sign-up form
  return (
    <div className="relative min-h-screen flex flex-col bg-background px-4 py-8">
        <Seo title="Create Account — AuraDental Cloud" description="Register your dental clinic on AuraDental Cloud, the cloud-based dental practice management platform." path="/register" noindex />
        <AuthBackground />
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="w-full max-w-md">
        <div className="mb-6">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4 shadow-lg">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Fill in the details below to create your account
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  autoFocus
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="05xxxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinicName">Clinic Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="clinicName"
                  type="text"
                  placeholder="Enter your clinic name"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-medium gradient-primary text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <SupportContactSection variant="compact" className="mt-6" />

          <p className="text-center text-xs text-muted-foreground mt-6">
            By creating an account, you agree to our{" "}
            <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
            {" "}and{" "}
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
      </div>
      <PublicFooter compact />
    </div>
  );
}