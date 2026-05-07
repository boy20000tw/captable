import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Clock, CheckCircle2, Phone, Mail, FileText, MessageSquare,
  StickyNote, MoreHorizontal, ArrowRight, Users,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureGate } from "@/components/FeatureGate";
import ErrorState from "@/components/ErrorState";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function InvestorPipelinePage() {
  return (
    <DashboardLayout>
      <FeatureGate feature="fundraising.investors">
        <InvestorPipelineContent />
      </FeatureGate>
    </DashboardLayout>
  );
}

type ActivityType = "meeting" | "document" | "discussion" | "follow_up" | "call" | "email" | "note" | "other";

const ACTIVITY_ICONS: Record<ActivityType, typeof CalendarIcon> = {
  meeting: CalendarIcon,
  document: FileText,
  discussion: MessageSquare,
  follow_up: ArrowRight,
  call: Phone,
  email: Mail,
  note: StickyNote,
  other: MoreHorizontal,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  meeting: "bg-blue-500",
  document: "bg-purple-500",
  discussion: "bg-teal-500",
  follow_up: "bg-orange-500",
  call: "bg-green-500",
  email: "bg-indigo-500",
  note: "bg-yellow-500",
  other: "bg-gray-500",
};

const PRIORITY_DOTS: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

function InvestorPipelineContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("fundraising");

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch all activities for the visible month range (±7 days for overflow)
  const fromDate = new Date(viewYear, viewMonth, -6).toISOString().slice(0, 10);
  const toDate = new Date(viewYear, viewMonth + 1, 7).toISOString().slice(0, 10);

  const { data: activities, isLoading, isError, refetch } = trpc.investorActivities.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter as any,
    fromDate,
    toDate,
  });

  // Also get upcoming activities for the sidebar
  const { data: upcoming } = trpc.investorActivities.upcoming.useQuery({ withinDays: 30 });

  if (isError) return <ErrorState onRetry={() => refetch()} />;

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Build calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  // Group activities by date
  const actByDate = useMemo(() => {
    const map: Record<string, typeof activities> = {};
    for (const act of activities ?? []) {
      if (!act.dueDate) continue;
      const key = new Date(act.dueDate).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key]!.push(act);
    }
    return map;
  }, [activities]);

  // Activities without due date
  const noDueDate = useMemo(() => (activities ?? []).filter((a) => !a.dueDate), [activities]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const isToday = (day: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-7 w-7 text-primary" />
            {t("pipeline.title") || "Investor Pipeline"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("pipeline.desc") || "Calendar view of investor activities and follow-ups"}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar */}
        <div className="flex-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={prevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-lg font-semibold min-w-[180px] text-center">{monthLabel}</h2>
                  <Button variant="outline" size="icon" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={goToday} className="ml-2">
                    {t("pipeline.today") || "Today"}
                  </Button>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("pipeline.allStatus") || "All"}</SelectItem>
                    <SelectItem value="pending">{t("activities.pendingSection") || "Pending"}</SelectItem>
                    <SelectItem value="completed">{t("activities.completedSection") || "Completed"}</SelectItem>
                    <SelectItem value="cancelled">{t("activities.cancelledCount") || "Cancelled"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-20 text-center text-muted-foreground text-sm">
                  {t("activities.loading") || "Loading..."}
                </div>
              ) : (
                <div>
                  {/* Week header */}
                  <div className="grid grid-cols-7 mb-1">
                    {weekDays.map((d) => (
                      <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 border-t border-l">
                    {/* Empty cells before first day */}
                    {Array.from({ length: firstDay }).map((_, i) => (
                      <div key={`empty-${i}`} className="border-r border-b min-h-[100px] bg-muted/20" />
                    ))}

                    {/* Day cells */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const dayActivities = actByDate[dateKey] ?? [];
                      const todayClass = isToday(day) ? "bg-primary/5 ring-2 ring-primary/20 ring-inset" : "";

                      return (
                        <div
                          key={day}
                          className={`border-r border-b min-h-[100px] p-1 ${todayClass}`}
                        >
                          <div className={`text-xs font-medium mb-1 ${isToday(day) ? "text-primary font-bold" : "text-muted-foreground"}`}>
                            {day}
                          </div>
                          <div className="space-y-0.5">
                            {dayActivities.slice(0, 3).map((act) => {
                              const Icon = ACTIVITY_ICONS[act.type as ActivityType] ?? MoreHorizontal;
                              const dotColor = PRIORITY_DOTS[act.priority] ?? "bg-gray-400";
                              return (
                                <div
                                  key={act.id}
                                  className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight truncate ${
                                    act.status === "completed" ? "opacity-50 line-through" : ""
                                  }`}
                                  title={`${act.title} (${(act as any).investorName ?? ""})`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                                  <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                                  <span className="truncate">{act.title}</span>
                                </div>
                              );
                            })}
                            {dayActivities.length > 3 && (
                              <div className="text-[10px] text-muted-foreground pl-1">
                                +{dayActivities.length - 3} {t("pipeline.more") || "more"}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Fill remaining cells */}
                    {(() => {
                      const totalCells = firstDay + daysInMonth;
                      const remainder = totalCells % 7;
                      if (remainder === 0) return null;
                      return Array.from({ length: 7 - remainder }).map((_, i) => (
                        <div key={`trail-${i}`} className="border-r border-b min-h-[100px] bg-muted/20" />
                      ));
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* No-date activities */}
          {noDueDate.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">{t("pipeline.noDueDate") || "Without Due Date"}</CardTitle>
                <CardDescription>{noDueDate.length} {t("pipeline.activities") || "activities"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {noDueDate.map((act) => {
                    const Icon = ACTIVITY_ICONS[act.type as ActivityType] ?? MoreHorizontal;
                    return (
                      <div key={act.id} className="flex items-center gap-2 text-sm">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{act.title}</span>
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {(act as any).investorName ?? ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar — Upcoming 30 days */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t("pipeline.upcoming30") || "Upcoming 30 Days"}
              </CardTitle>
              <CardDescription>
                {(upcoming ?? []).length} {t("pipeline.pendingActivities") || "pending activities"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(upcoming ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("pipeline.noUpcoming") || "No upcoming activities"}
                </p>
              ) : (
                <div className="space-y-3">
                  {(upcoming ?? []).slice(0, 15).map((act) => {
                    const Icon = ACTIVITY_ICONS[act.type as ActivityType] ?? MoreHorizontal;
                    const isOverdue = act.dueDate && new Date(act.dueDate) < new Date();
                    return (
                      <div key={act.id} className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{act.title}</span>
                        </div>
                        <div className="flex items-center gap-2 pl-5">
                          <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                            {act.dueDate ? formatDate(act.dueDate) : "—"}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {(act as any).investorName ?? ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {(upcoming ?? []).length > 15 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{(upcoming ?? []).length - 15} {t("pipeline.more") || "more"}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity type legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("pipeline.legend") || "Activity Types"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {(Object.keys(ACTIVITY_ICONS) as ActivityType[]).map((type) => {
                  const Icon = ACTIVITY_ICONS[type];
                  const color = ACTIVITY_COLORS[type];
                  return (
                    <div key={type} className="flex items-center gap-2 text-sm">
                      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{t(`activities.type_${type}`) || type}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
