/**
 * Caploom sign-in card (v2.69) — replaces Clerk's <SignIn/>.
 * Google OAuth + passwordless 6-digit email code. Rendered instantly: no
 * third-party script has to load before the form appears.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { authClient } from "@/lib/authClient";
import { prefetchDashboard } from "@/lib/prefetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Props = {
  /** Where to land after a successful sign-in (defaults to the current URL). */
  callbackURL?: string;
  /** Called after email-code sign-in succeeds (Google does a full redirect). */
  onSignedIn?: () => void;
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_KEY = "caploom-signin-draft";

// Remember "code sent to X" for 10 minutes so a reload / tab switch doesn't
// throw the user back to step 1 while they fetch the code from their inbox.
function readDraft(): { email: string; at: number } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d.email === "string" && Date.now() - d.at < 10 * 60 * 1000 ? d : null;
  } catch { return null; }
}
function writeDraft(email: string | null) {
  try {
    if (email) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ email, at: Date.now() }));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch { /* storage unavailable */ }
}

export default function SignInCard({ callbackURL, onSignedIn }: Props) {
  const { t } = useTranslation("common");
  const [draft] = useState(readDraft);
  // Returning to the code step (reload / tab switch): the user is about to sign in.
  if (draft) prefetchDashboard();
  const [step, setStep] = useState<"start" | "code">(draft ? "code" : "start");
  const [email, setEmail] = useState(draft?.email ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "google" | "send" | "verify">(null);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const target = callbackURL ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");

  const startCountdown = () => {
    setResendIn(30);
    const id = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const signInWithGoogle = async () => {
    prefetchDashboard();
    setError(null);
    setBusy("google");
    const { error: err } = await authClient.signIn.social({ provider: "google", callbackURL: target });
    if (err) { setError(t("auth.errorGeneric")); setBusy(null); }
    // success → browser navigates to Google
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) { setError(t("auth.errorEmail")); return; }
    setError(null);
    setBusy("send");
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email: addr, type: "sign-in" });
    setBusy(null);
    if (err) {
      setError(err.status === 429 ? t("auth.errorTooMany") : t("auth.errorGeneric"));
      return;
    }
    setEmail(addr);
    setCode("");
    setStep("code");
    writeDraft(addr);
    startCountdown();
  };

  const verify = async (value: string) => {
    if (value.length !== 6) return;
    setError(null);
    setBusy("verify");
    const { error: err } = await authClient.signIn.emailOtp({ email, otp: value });
    if (err) {
      setBusy(null);
      setCode("");
      setError(err.status === 429 ? t("auth.errorTooMany") : t("auth.errorCode"));
      return;
    }
    writeDraft(null);
    if (onSignedIn) { setBusy(null); onSignedIn(); }
    else window.location.assign(target);
  };

  return (
    <div className="w-full max-w-sm rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-5">
      {step === "start" ? (
        <>
          <div className="space-y-1 text-center">
            <h2 className="text-lg font-semibold">{t("auth.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("auth.subtitle")}</p>
          </div>

          <Button type="button" variant="outline" className="w-full gap-2" onClick={signInWithGoogle} disabled={busy !== null}>
            {busy === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            {t("auth.google")}
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {t("auth.or")}
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={sendCode} className="space-y-3">
            <label htmlFor="signin-email" className="text-sm font-medium">{t("auth.emailLabel")}</label>
            <Input
              id="signin-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={prefetchDashboard}
              disabled={busy !== null}
            />
            <Button type="submit" className="w-full gap-2" disabled={busy !== null || !email}>
              {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {t("auth.sendCode")}
            </Button>
          </form>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => { setStep("start"); setError(null); writeDraft(null); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> {t("auth.back")}
          </button>
          <div className="space-y-1 text-center">
            <h2 className="text-lg font-semibold">{t("auth.codeTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("auth.codeSent", { email })}</p>
          </div>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(v) => { setCode(v); if (v.length === 6) void verify(v); }}
              disabled={busy === "verify"}
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {busy === "verify" && (
            <div className="flex justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("auth.verifying")}
            </div>
          )}
          <div className="text-center text-xs text-muted-foreground">
            {resendIn > 0 ? (
              t("auth.resendIn", { s: resendIn })
            ) : (
              <button type="button" className="underline hover:text-foreground" onClick={() => void sendCode()} disabled={busy !== null}>
                {t("auth.resend")}
              </button>
            )}
          </div>
        </>
      )}

      {error && <p className="text-sm text-destructive text-center" role="alert">{error}</p>}

      <p className="text-[11px] leading-relaxed text-muted-foreground text-center">
        {t("auth.agree")}{" "}
        <a href="/terms" className="underline hover:text-foreground">{t("auth.terms")}</a>
        {" · "}
        <a href="/privacy" className="underline hover:text-foreground">{t("auth.privacy")}</a>
      </p>
    </div>
  );
}
