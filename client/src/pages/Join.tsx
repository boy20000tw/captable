import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Shield, Check, X, Clock, LogIn } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", cfo: "CFO", lawyer: "Lawyer", investor: "Investor", viewer: "Viewer",
};

export default function Join() {
  const { user, loading: authLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
  }, []);

  const { data: inviteData, isLoading: inviteLoading } = trpc.invitations.accept.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  if (!token) {
    return (
      <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <X className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="font-serif text-2xl font-bold">Invalid Link</h1>
          <p className="text-muted-foreground">This invitation link is missing a token. Please request a new invitation.</p>
        </div>
      </div>
    );
  }

  if (inviteLoading || authLoading) {
    return (
      <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center">
        <div className="text-muted-foreground">Verifying invitation...</div>
      </div>
    );
  }

  if (!inviteData?.valid) {
    const reason = (inviteData as any)?.reason;
    const messages: Record<string, string> = {
      not_found: "This invitation link does not exist.",
      expired: "This invitation link has expired.",
      revoked: "This invitation link has been revoked.",
      accepted: "This invitation has already been accepted.",
    };
    return (
      <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <Clock className="h-12 w-12 text-amber-400 mx-auto" />
          <h1 className="font-serif text-2xl font-bold">Invitation Unavailable</h1>
          <p className="text-muted-foreground">{messages[reason] ?? "This invitation is no longer valid."}</p>
          <a href="/" className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90">
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const invitation = (inviteData as any).invitation;

  // If user is already logged in, show success state
  if (user) {
    return (
      <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="font-serif text-2xl font-bold">You're In!</h1>
            <p className="text-muted-foreground">
              You've been invited to join as <strong>{ROLE_LABELS[invitation.appRole] ?? invitation.appRole}</strong>.
              Your access has been configured.
            </p>
          </div>
          <div className="border border-border rounded-sm p-4 bg-white space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Role:</span>
              <span className="font-medium">{ROLE_LABELS[invitation.appRole] ?? invitation.appRole}</span>
            </div>
            {invitation.email && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{invitation.email}</span>
              </div>
            )}
          </div>
          <a
            href="/"
            className="block w-full text-center px-4 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
          >
            Go to Dashboard →
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
          <h1 className="font-serif text-2xl font-bold">You've Been Invited</h1>
          <p className="text-muted-foreground">
            You've been invited to join Cap Table Manager as{" "}
            <strong>{ROLE_LABELS[invitation.appRole] ?? invitation.appRole}</strong>.
          </p>
        </div>
        <div className="border border-border rounded-sm p-4 bg-white space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Role:</span>
            <span className="font-medium">{ROLE_LABELS[invitation.appRole] ?? invitation.appRole}</span>
          </div>
          {invitation.notes && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Note:</span>
              <span>{invitation.notes}</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Sign in to accept this invitation.
        </p>
        <a
          href="/"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
        >
          <LogIn className="h-4 w-4" /> Sign In to Accept
        </a>
      </div>
    </div>
  );
}
