import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Send, Bell, Clock, Globe, Mail, MonitorSmartphone } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  in_app: MonitorSmartphone,
  email: Mail,
  both: Globe,
};

export default function AdminNotificationsPage() {
  const { t } = useTranslation("admin");
  const utils = trpc.useUtils();

  const broadcasts = trpc.admin.listBroadcasts.useQuery(undefined, { retry: false });

  const sendMut = trpc.admin.broadcastNotification.useMutation({
    onSuccess: (data) => {
      utils.admin.listBroadcasts.invalidate();
      toast.success(t("notifications.sendSuccess", { count: data.count }));
      setTitle("");
      setMessage("");
      setLinkUrl("");
    },
    onError: (err) => toast.error(err.message),
  });

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<"in_app" | "email" | "both">("in_app");
  const [linkUrl, setLinkUrl] = useState("");

  const canSend = title.trim().length > 0 && message.trim().length > 0 && !sendMut.isPending;

  function handleSend() {
    if (!canSend) return;
    sendMut.mutate({
      title: title.trim(),
      message: message.trim(),
      channel,
      linkUrl: linkUrl.trim() || undefined,
    });
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* ── Header ───────────────────────────────────────────── */}
        <div>
          <h1 className="font-serif text-2xl font-bold">{t("notifications.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("notifications.desc")}</p>
        </div>

        {/* ── Send Form ────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />
              {t("notifications.sendNew")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-sm font-medium">{t("notifications.formTitle")}</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("notifications.formTitlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
              />
            </div>

            {/* Message */}
            <div>
              <label className="text-sm font-medium">{t("notifications.formMessage")}</label>
              <textarea
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
                placeholder={t("notifications.formMessagePlaceholder")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={5000}
              />
            </div>

            {/* Channel */}
            <div>
              <label className="text-sm font-medium">{t("notifications.formChannel")}</label>
              <div className="mt-1 flex gap-2">
                {(["in_app", "email", "both"] as const).map((ch) => {
                  const Icon = CHANNEL_ICONS[ch];
                  return (
                    <button
                      key={ch}
                      onClick={() => setChannel(ch)}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        channel === ch
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-input text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t(`notifications.channel_${ch}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Link URL */}
            <div>
              <label className="text-sm font-medium">{t("notifications.formLink")}</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="/pricing"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                maxLength={500}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("notifications.formLinkHint")}</p>
            </div>

            {/* Submit */}
            <Button onClick={handleSend} disabled={!canSend} className="gap-2">
              <Send className="h-4 w-4" />
              {sendMut.isPending ? t("notifications.sending") : t("notifications.sendBtn")}
            </Button>
          </CardContent>
        </Card>

        {/* ── Broadcast History ─────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              {t("notifications.history")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {broadcasts.isLoading && <p className="text-sm text-muted-foreground">{t("notifications.loading")}</p>}
            {broadcasts.data && broadcasts.data.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("notifications.empty")}</p>
            )}
            {broadcasts.data && broadcasts.data.length > 0 && (
              <div className="space-y-3">
                {/* Deduplicate: group by createdAt (same broadcast batch has same timestamp) */}
                {deduplicateBroadcasts(broadcasts.data).map((b) => {
                  const ChIcon = CHANNEL_ICONS[b.channel] ?? Bell;
                  return (
                    <div key={b.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <Bell className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{b.title}</span>
                          <Badge variant="outline" className="gap-1 text-xs">
                            <ChIcon className="h-3 w-3" />
                            {b.channel}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            → {b.companiesCount} {t("notifications.companies")}
                          </span>
                        </div>
                        {b.message && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{b.message}</p>}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(b.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

/** Group broadcast rows (one per company) into unique broadcasts by timestamp + title. */
function deduplicateBroadcasts(
  rows: Array<{ id: number; title: string; message: string | null; channel: string; createdAt: Date; linkUrl: string | null }>
) {
  const map = new Map<string, { id: number; title: string; message: string | null; channel: string; createdAt: Date; companiesCount: number }>();
  for (const r of rows) {
    const key = `${r.title}__${new Date(r.createdAt).toISOString().slice(0, 19)}`;
    const existing = map.get(key);
    if (existing) {
      existing.companiesCount++;
    } else {
      map.set(key, { id: r.id, title: r.title, message: r.message, channel: r.channel, createdAt: r.createdAt, companiesCount: 1 });
    }
  }
  return Array.from(map.values());
}
