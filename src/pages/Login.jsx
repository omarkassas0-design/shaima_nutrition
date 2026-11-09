import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { appClient } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, Stethoscope, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/useLanguage";
import AuthBackground from "@/components/AuthBackground";
import GoogleIcon from "@/components/GoogleIcon";
import Seo from "@/components/Seo";
import { loginWithMfa } from "@/lib/authMfa";

const WHATSAPP_NUMBER = "+963 930 478 389";
const CONTACT_EMAIL = "auradentalcloud@gmail.com";

const LANGUAGES = [
  { code: "en", labelKey: "lang_english" },
  { code: "ar", labelKey: "lang_arabic" },
  { code: "tr", labelKey: "lang_turkish" },
];

/**
 * Sign-in screen — the first thing an unauthenticated visitor sees.
 *
 * Localised in English / Arabic / Turkish with the correct text direction on the
 * page root, and the language can be chosen here (it persists to the same
 * storage the signed-in app reads). The layout is deliberately compact so the
 * whole interface — branding, form, Google sign-in, contact details, links and
 * footer — fits a single mobile screen without scrolling in any language.
 */
export default function Login() {
  const navigate = useNavigate();
  const { t, lang, setLang, isRTL } = useLanguage();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isLoadingAuth, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await loginWithMfa(email, password);
      if (result?.mfa_required) {
        window.location.href = "/mfa?flow=signin";
        return;
      }
      // Hard redirect to re-initialize auth state from Supabase session
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message || t("login_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-3"
    >
      <Seo title="Sign In — AuraDental Cloud" description="Sign in to your AuraDental Cloud dental clinic management account." path="/login" noindex />
      <AuthBackground />

      <div className="relative w-full max-w-sm">
        <div className="mb-2.5 flex items-center justify-center gap-1">
          {LANGUAGES.map(({ code, labelKey }) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={
                lang === code
                  ? "rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                  : "rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              }
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        <div className="mb-2.5 text-center">
          <div className="mb-1.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl gradient-primary shadow-lg">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold leading-tight text-foreground">{t("login_welcome")}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("login_subtitle")}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          {error && (
            <div className="mb-3 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">{t("email")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 pl-9 text-sm rtl:pl-3 rtl:pr-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs">{t("password")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pl-9 text-sm rtl:pl-3 rtl:pr-9"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-10 w-full font-medium gradient-primary text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" />
                  {t("signing_in")}
                </>
              ) : (
                t("sign_in")
              )}
            </Button>
          </form>

          <div className="my-2.5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t("or")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full"
            onClick={() => appClient.auth.loginWithProvider("google", "/dashboard")}
          >
            <GoogleIcon className="h-5 w-5" />
            {t("continue_with_google")}
          </Button>

          <div className="mt-2.5 border-t border-border pt-2.5">
            <p className="mb-1.5 text-center text-xs font-medium text-foreground/80">
              {t("subscribe_learn_more")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <a
                href="https://wa.me/963930478389"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[#25D366]" />
                <span className="bidi-ltr">{WHATSAPP_NUMBER}</span>
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="bidi-ltr">{CONTACT_EMAIL}</span>
              </a>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border pt-2.5">
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              {t("forgot_password")}
            </Link>
            <span className="text-xs text-muted-foreground">
              {t("need_account")}{" "}
              <Link to="/register" className="font-medium text-primary hover:underline">
                {t("sign_up")}
              </Link>
            </span>
          </div>
        </div>

        <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
          {t("secure_access_only")}
        </p>

        <nav className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Link to="/about" className="hover:text-foreground hover:underline">{t("nav_about")}</Link>
          <Link to="/contact" className="hover:text-foreground hover:underline">{t("nav_contact")}</Link>
          <Link to="/privacy" className="hover:text-foreground hover:underline">{t("nav_privacy")}</Link>
          <Link to="/terms" className="hover:text-foreground hover:underline">{t("nav_terms")}</Link>
        </nav>

        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} AuraDental Cloud. {t("all_rights_reserved")}
        </p>
      </div>
    </div>
  );
}
