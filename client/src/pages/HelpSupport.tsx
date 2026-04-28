import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import {
  Search, MessageSquare, Mail, Send, ChevronDown, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Info,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────
type TicketType = "feedback" | "bug" | "billing" | "feature_request" | "general";
type Priority = "low" | "medium" | "high";
type FaqCategory = "all" | "account" | "subscription" | "equity" | "technical" | "general";

const FAQ_CATEGORIES: FaqCategory[] = ["all", "account", "subscription", "equity", "technical", "general"];
const FEEDBACK_TYPES: TicketType[] = ["feedback", "feature_request", "bug"];
const CONTACT_TYPES: TicketType[] = ["billing", "general", "bug", "feature_request"];

// ─── Static FAQ data (used when DB is empty) ────────────────────────────────
const STATIC_FAQS = [
  { id: 1, category: "account" as const, questionEn: "How do I invite team members?", questionZh: "如何邀請團隊成員？", answerEn: "Go to Settings > Team and click \"Invite member\". Enter their email and select a role. They'll receive an invitation email to join your company.", answerZh: "前往「設定 > 團隊」點擊「邀請成員」，輸入電子郵件並選擇角色，對方會收到邀請信加入您的公司。" },
  { id: 2, category: "account" as const, questionEn: "What roles are available?", questionZh: "有哪些角色可以設定？", answerEn: "Caploom offers six roles: Owner, Admin, CFO, Lawyer, Investor, and Viewer. Owner and Admin have full access, CFO can edit financial data, and other roles have read-only access to relevant sections.", answerZh: "Caploom 提供六種角色：Owner、Admin、CFO、Lawyer、Investor 和 Viewer。Owner 與 Admin 擁有完整權限，CFO 可編輯財務資料，其餘角色僅有對應區域的檢視權限。" },
  { id: 3, category: "subscription" as const, questionEn: "What's included in the Free plan?", questionZh: "免費方案包含哪些功能？", answerEn: "The Free plan includes core cap table management, share register, basic ESOP (up to 5 grants), PDF/Excel export, and data import for 1 company with up to 10 shareholders.", answerZh: "免費方案包含核心持股表管理、股東名冊、基礎 ESOP（最多 5 筆）、PDF/Excel 匯出及資料匯入，適用 1 家公司、最多 10 位股東。" },
  { id: 4, category: "subscription" as const, questionEn: "How do I upgrade my plan?", questionZh: "如何升級方案？", answerEn: "Click the plan badge in the top-right corner or go to Subscription > Change Plan. Select the plan that fits your needs and follow the checkout process.", answerZh: "點擊右上角的方案標籤，或前往「訂閱管理 > 變更方案」，選擇適合的方案後完成結帳流程。" },
  { id: 5, category: "subscription" as const, questionEn: "Can I cancel or downgrade anytime?", questionZh: "可以隨時取消或降級嗎？", answerEn: "Yes, you can change your plan at any time. Downgrades take effect at the end of your current billing period. Your data is preserved but features beyond your new plan's limits will be locked.", answerZh: "可以，您可以隨時變更方案。降級會在當前帳單週期結束後生效，您的資料會保留，但超出新方案上限的功能將被鎖定。" },
  { id: 6, category: "equity" as const, questionEn: "How do I record a new funding round?", questionZh: "如何記錄新的募資輪次？", answerEn: "Go to Fundraising > Funding Rounds and click \"Add Round\". Fill in the round details including name, target amount, valuation, and status. You can then add investor allocations within the round.", answerZh: "前往「募資 > 募資輪次」點擊「新增輪次」，填寫輪次詳情（名稱、目標金額、估值、狀態），然後在該輪次內新增投資人分配。" },
  { id: 7, category: "equity" as const, questionEn: "What happens when an ESOP grant is exercised?", questionZh: "ESOP 行使時會發生什麼？", answerEn: "When a grant is exercised, shares are converted from the ESOP pool to Common Stock. The system atomically updates the grant status, creates a share register entry, and triggers a cap table snapshot.", answerZh: "行使 ESOP 時，股份會從期權池轉換為普通股。系統會自動更新授權狀態、建立股東名冊記錄，並觸發持股表快照。" },
  { id: 8, category: "technical" as const, questionEn: "Can I export my data?", questionZh: "可以匯出資料嗎？", answerEn: "Yes! You can export your cap table as PDF or Excel, and your share register as an Excel workbook. Go to the respective page and click the export button in the top-right corner.", answerZh: "可以！您可以將持股表匯出為 PDF 或 Excel，股東名冊匯出為 Excel 工作簿。前往相應頁面，點擊右上角的匯出按鈕。" },
  { id: 9, category: "technical" as const, questionEn: "Is my data secure?", questionZh: "我的資料安全嗎？", answerEn: "Yes. All data is encrypted in transit (TLS) and at rest. We use industry-standard security practices and your data is stored on enterprise-grade infrastructure.", answerZh: "是的。所有資料在傳輸（TLS）和儲存時均經過加密。我們採用業界標準的安全措施，資料儲存在企業級基礎架構上。" },
  { id: 10, category: "general" as const, questionEn: "How do I switch between companies?", questionZh: "如何切換公司？", answerEn: "Use the company switcher in the top-left corner of the sidebar. Click your company name to see all companies you have access to and select the one you want to work with.", answerZh: "使用側邊欄左上角的公司切換器。點擊公司名稱即可看到您有權限的所有公司，選擇要操作的公司。" },
];

// ─── Main Component ─────────────────────────────────────────────────────────
export default function HelpSupportPage() {
  const { t } = useTranslation("support");

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>

        <Tabs defaultValue="faq" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="faq" className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" />
              {t("tabs.faq")}
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              {t("tabs.feedback")}
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {t("tabs.contact")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="faq"><FaqSection /></TabsContent>
          <TabsContent value="feedback"><FeedbackSection /></TabsContent>
          <TabsContent value="contact"><ContactSection /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ─── FAQ Section ────────────────────────────────────────────────────────────
function FaqSection() {
  const { t } = useTranslation("support");
  const isZh = i18n.language.startsWith("zh");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FaqCategory>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  // Try DB FAQs first, fall back to static
  const dbFaqs = trpc.support.faqs.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const faqs = (dbFaqs.data && dbFaqs.data.length > 0) ? dbFaqs.data : STATIC_FAQS;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return faqs.filter(faq => {
      if (category !== "all" && faq.category !== category) return false;
      if (!q) return true;
      const question = isZh ? faq.questionZh : faq.questionEn;
      const answer = isZh ? faq.answerZh : faq.answerEn;
      return question.toLowerCase().includes(q) || answer.toLowerCase().includes(q);
    });
  }, [faqs, search, category, isZh]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder={t("faq.searchPlaceholder")}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors"
        />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5">
        {FAQ_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              category === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-border text-muted-foreground"
            }`}
          >
            {t(`faq.categories.${cat}`)}
          </button>
        ))}
      </div>

      {/* FAQ list */}
      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">{t("faq.noResults")}</div>
        ) : (
          filtered.map(faq => {
            const isOpen = openId === faq.id;
            return (
              <Card key={faq.id} className="overflow-hidden">
                <button
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  }
                  <span className="text-sm font-medium">{isZh ? faq.questionZh : faq.questionEn}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pl-11">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {isZh ? faq.answerZh : faq.answerEn}
                    </p>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Feedback Section ───────────────────────────────────────────────────────
function FeedbackSection() {
  const { t } = useTranslation("support");
  const [type, setType] = useState<TicketType>("feedback");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const createTicket = trpc.support.createTicket.useMutation({
    onSuccess: () => {
      toast.success(t("feedback.success"));
      setSubject("");
      setMessage("");
      setType("feedback");
    },
    onError: () => {
      toast.error(t("feedback.error"));
    },
  });

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) return;
    createTicket.mutate({ type, subject: subject.trim(), message: message.trim(), priority: "medium" });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{t("feedback.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("feedback.description")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <select
            value={type}
            onChange={e => setType(e.target.value as TicketType)}
            className="w-full h-9 px-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            {FEEDBACK_TYPES.map(ft => (
              <option key={ft} value={ft}>{t(`feedback.types.${ft}`)}</option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder={t("feedback.subjectPlaceholder")}
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full h-9 px-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        <textarea
          placeholder={t("feedback.messagePlaceholder")}
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 text-sm rounded-md border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!subject.trim() || !message.trim() || createTicket.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {t("feedback.submit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Contact Section ────────────────────────────────────────────────────────
function ContactSection() {
  const { t } = useTranslation("support");
  const [type, setType] = useState<TicketType>("billing");
  const [priority, setPriority] = useState<Priority>("medium");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const createTicket = trpc.support.createTicket.useMutation({
    onSuccess: () => {
      toast.success(t("contact.success"));
      setSubject("");
      setMessage("");
      setType("billing");
      setPriority("medium");
    },
    onError: () => {
      toast.error(t("contact.error"));
    },
  });

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) return;
    createTicket.mutate({ type, subject: subject.trim(), message: message.trim(), priority });
  };

  // My tickets
  const myTickets = trpc.support.myTickets.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">{t("contact.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("contact.description")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <select
                value={type}
                onChange={e => setType(e.target.value as TicketType)}
                className="w-full h-9 px-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                {CONTACT_TYPES.map(ct => (
                  <option key={ct} value={ct}>{t(`contact.types.${ct}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                className="w-full h-9 px-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="low">{t("contact.priorities.low")}</option>
                <option value="medium">{t("contact.priorities.medium")}</option>
                <option value="high">{t("contact.priorities.high")}</option>
              </select>
            </div>
          </div>
          <input
            type="text"
            placeholder={t("contact.subjectPlaceholder")}
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full h-9 px-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
          <textarea
            placeholder={t("contact.messagePlaceholder")}
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 text-sm rounded-md border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              <span className="text-xs">{t("contact.info")}</span>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!subject.trim() || !message.trim() || createTicket.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {t("contact.submit")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* My tickets */}
      {myTickets.data && myTickets.data.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("tickets.title")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {myTickets.data.slice(0, 5).map(ticket => (
                <div key={ticket.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <TicketStatusBadge status={ticket.status} t={t} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TicketStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const config: Record<string, { cls: string; Icon: typeof CheckCircle2 }> = {
    open: { cls: "bg-yellow-50 text-yellow-700 border-yellow-200", Icon: AlertCircle },
    in_progress: { cls: "bg-blue-50 text-blue-700 border-blue-200", Icon: Clock },
    resolved: { cls: "bg-green-50 text-green-700 border-green-200", Icon: CheckCircle2 },
    closed: { cls: "bg-gray-100 text-gray-600 border-gray-200", Icon: CheckCircle2 },
  };
  const c = config[status] ?? config.open;
  return (
    <Badge variant="outline" className={`text-[10px] ${c.cls}`}>
      <c.Icon className="h-3 w-3 mr-1" />
      {t(`tickets.status.${status}`)}
    </Badge>
  );
}
