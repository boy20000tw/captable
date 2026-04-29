import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Clock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

const STATUS_CONFIG: Record<TicketStatus, { cls: string; Icon: typeof CheckCircle2 }> = {
  open: { cls: "bg-yellow-50 text-yellow-700 border-yellow-200", Icon: AlertCircle },
  in_progress: { cls: "bg-blue-50 text-blue-700 border-blue-200", Icon: Clock },
  resolved: { cls: "bg-green-50 text-green-700 border-green-200", Icon: CheckCircle2 },
  closed: { cls: "bg-gray-100 text-gray-600 border-gray-200", Icon: XCircle },
};

export default function AdminTicketsPage() {
  const { t } = useTranslation("support");
  const utils = trpc.useUtils();
  const tickets = trpc.admin.adminTickets.useQuery(undefined, { retry: false });
  const updateTicket = trpc.admin.adminUpdateTicket.useMutation({
    onSuccess: () => {
      utils.admin.adminTickets.invalidate();
      toast.success("Ticket updated");
    },
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <AdminLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("admin.ticketsTitle")}</h1>
          </div>
        </div>

        {tickets.isLoading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading...</div>
        ) : !tickets.data || tickets.data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">{t("admin.noTickets")}</div>
        ) : (
          <div className="space-y-2">
            {tickets.data.map(ticket => {
              const isExpanded = expandedId === ticket.id;
              const statusConf = STATUS_CONFIG[(ticket.status as TicketStatus) ?? "open"];
              return (
                <Card key={ticket.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                    className="w-full text-left px-4 py-3 flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{ticket.subject}</span>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${statusConf.cls}`}>
                          <statusConf.Icon className="h-3 w-3 mr-1" />
                          {t(`tickets.status.${ticket.status}`)}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">{ticket.type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ticket.userName ?? "Unknown"} · {ticket.userEmail ?? ""} · {new Date(ticket.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </button>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-4 space-y-3">
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-muted-foreground">{t("admin.updateStatus")}:</label>
                        <div className="flex gap-1.5">
                          {(["open", "in_progress", "resolved", "closed"] as TicketStatus[]).map(s => (
                            <button
                              key={s}
                              onClick={() => updateTicket.mutate({ id: ticket.id, status: s })}
                              disabled={ticket.status === s}
                              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                ticket.status === s
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background hover:bg-muted border-border text-muted-foreground"
                              }`}
                            >
                              {t(`tickets.status.${s}`)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
