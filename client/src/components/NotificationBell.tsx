/**
 * NotificationBell — bell icon with unread badge + dropdown notification list.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TYPE_COLOR: Record<string, string> = {
  funding_round: "bg-blue-100 text-blue-700",
  document_signing: "bg-purple-100 text-purple-700",
  vesting_milestone: "bg-green-100 text-green-700",
  valuation_409a: "bg-amber-100 text-amber-700",
  election_83b: "bg-red-100 text-red-700",
  share_transfer: "bg-cyan-100 text-cyan-700",
  general: "bg-gray-100 text-gray-600",
};

export default function NotificationBell() {
  const { t } = useTranslation("common");

  const TYPE_LABEL: Record<string, string> = {
    funding_round: t("notification.typeFunding"),
    document_signing: t("notification.typeSigning"),
    vesting_milestone: t("notification.typeVesting"),
    valuation_409a: t("notification.type409a"),
    election_83b: t("notification.type83b"),
    share_transfer: t("notification.typeTransfer"),
    general: t("notification.typeGeneral"),
  };

  const utils = trpc.useUtils();
  const { data: unread } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000, // poll every 30s
  });
  const { data: notifications } = trpc.notifications.list.useQuery(
    { limit: 20 },
    { enabled: false }  // only fetch when dropdown opens
  );
  const [open, setOpen] = useState(false);

  const markReadMut = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.invalidate(),
  });
  const markAllReadMut = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.invalidate(),
  });

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Fetch notifications when dropdown opens
      utils.notifications.list.fetch({ limit: 20 });
    }
  };

  const count = unread ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <p className="text-sm font-semibold">{t("notification.title")}</p>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => markAllReadMut.mutate()}
              disabled={markAllReadMut.isPending}
            >
              <CheckCheck className="h-3 w-3" /> {t("btn.markAllRead")}
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t("notification.noNotifications")}
            </div>
          ) : (
            notifications.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-2 px-3 py-2.5 border-b last:border-0 transition-colors ${
                  n.isRead ? "bg-background" : "bg-primary/5"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge
                      className={`text-[10px] px-1.5 py-0 border-transparent ${TYPE_COLOR[n.type] ?? TYPE_COLOR.general}`}
                    >
                      {TYPE_LABEL[n.type] ?? n.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-tight">{n.title}</p>
                  {n.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  )}
                </div>
                {!n.isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0 mt-1"
                    onClick={() => markReadMut.mutate({ id: n.id })}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
