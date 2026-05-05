import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useClerk } from "@clerk/clerk-react";
import { Shield, Check, X, Clock, LogIn, Loader2 } from "lucide-react";

export default function Join() {
  const { t } = useTranslation("pages");
  const { user, loading: authLoading } = useAuth();
  const { openSignIn } = useClerk();

  const ROLE_LABELS: Record<string, string> = {
    admin: t("join.roleAdmin"),
    cfo: t("join.roleCfo"),
    lawyer: t("join.roleLawyer"),
    investor: t("join.roleInvestor"),
    viewer: t("join.roleViewer"),
  };
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
  }, []);

  // Step 1: validate the token (public, read-only)
  const { data: inviteData, isLoading: inviteLoading } = trpc.invitations.accept.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  // Step 2: accept the invitation (authenticated mutation)
  const acceptMutation = trpc.invitations.acceptInvitation.useMutation();
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // When user is logged in + invite is valid + not yet accepted → auto-accept
  useEffect(() => {
    if (
      user &&
      token &&
      inviteData?.valid &&
      !accepted &&
      !acceptMutation.isPending &&
      !acceptError
    ) {
      acceptMutation.mutate(
        { token },
        {
          onSuccess: () => setAccepted(true),
          onError: (err) => {
            // If already accepted (e.g. page refresh), treat as success
            if (err.message?.includes("accepted")) {
              setAccepted(true);
            } else {
              setAcceptError(err.message ?? t("join.acceptFailed"));
            }
          },
        }
      );
    }
  }, [user, token, inviteData?.valid, accepted, acceptMutation.isPending, acceptError]);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <X className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="font-serif text-2xl font-bold">{t("join.invalidLink")}</h1>
          <p className="text-muted-foreground">{t("join.invalidLinkDesc")}</p>
        </div>
      </div>
    );
  }

  if (inviteLoading || authLoading) {
    return (
      <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center">
        <div className="text-muted-foreground">{t("join.verifying")}</div>
      </div>
    );
  }

  if (!inviteData?.valid) {
    const reason = (inviteData as any)?.reason;
    const messages: Record<string, string> = {
      not_found: t("join.notFound"),
      expired: t("join.expired"),
      revoked: t("join.revoked"),
      accepted: t("join.alreadyAccepted"),
    };
    return (
      <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <Clock className="h-12 w-12 text-amber-400 mx-auto" />
          <h1 className="font-serif text-2xl font-bold">{t("join.unavailable")}</h1>
          <p className="text-muted-foreground">{messages[reason] ?? t("join.invalidDefault")}</p>
          <a href="/" className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90">
            {t("join.goToDashboard")}
          </a>
        </div>
      </div>
    );
  }

  const invitation = (inviteData as any).invitation;

  // User is logged in — accepting or accepted
  if (user) {
    // Still processing the accept mutation
    if (acceptMutation.isPending || (!accepted && !acceptError)) {
      return (
        <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-4">
            <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
            <h1 className="font-serif text-2xl font-bold">{t("join.accepting")}</h1>
          </div>
        </div>
      );
    }

    // Accept failed
    if (acceptError) {
      return (
        <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-4">
            <X className="h-12 w-12 text-red-400 mx-auto" />
            <h1 className="font-serif text-2xl font-bold">{t("join.acceptFailedTitle")}</h1>
            <p className="text-muted-foreground">{acceptError}</p>
            <a href="/" className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90">
              {t("join.goToDashboard")}
            </a>
          </div>
        </div>
      );
    }

    // Successfully accepted
    return (
      <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="font-serif text-2xl font-bold">{t("join.youreIn")}</h1>
            <p className="text-muted-foreground" dangerouslySetInnerHTML={{
              __html: t("join.accessConfigured", {role: ROLE_LABELS[invitation.appRole] ?? invitation.appRole})
            }} />
          </div>
          <div className="border border-border rounded-sm p-4 bg-white space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("join.role")}:</span>
              <span className="font-medium">{ROLE_LABELS[invitation.appRole] ?? invitation.appRole}</span>
            </div>
            {invitation.email && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t("join.email")}:</span>
                <span className="font-medium">{invitation.email}</span>
              </div>
            )}
          </div>
          <a
            href="/"
            className="block w-full text-center px-4 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
          >
            {t("join.goToDashboard")} →
          </a>
        </div>
      </div>
    );
  }

  // Not logged in — prompt to sign in
  return (
    <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-bold">{t("join.youveBeenInvited")}</h1>
          <p className="text-muted-foreground" dangerouslySetInnerHTML={{
            __html: t("join.invitedAs", {role: ROLE_LABELS[invitation.appRole] ?? invitation.appRole})
          }} />
        </div>
        <div className="border border-border rounded-sm p-4 bg-white space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("join.role")}:</span>
            <span className="font-medium">{ROLE_LABELS[invitation.appRole] ?? invitation.appRole}</span>
          </div>
          {invitation.notes && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t("join.note")}:</span>
              <span>{invitation.notes}</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground text-center">
          {t("join.signInToAccept")}
        </p>
        <button
          onClick={() => openSignIn({ afterSignInUrl: `/join?token=${token}`, afterSignUpUrl: `/join?token=${token}` })}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
        >
          <LogIn className="h-4 w-4" /> {t("join.signInBtn")}
        </button>
      </div>
    </div>
  );
}
