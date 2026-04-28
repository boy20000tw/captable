import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { getActiveCompanyId, setActiveCompanyId } from "@/lib/activeCompany";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Check, ChevronsUpDown, LogOut, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Props = {
  collapsed: boolean;
  user?: { name?: string | null; email?: string | null } | null;
  onSignOut?: () => void;
};

export function CompanySwitcher({ collapsed, user, onSignOut }: Props) {
  const { t } = useTranslation("common");
  const utils = trpc.useUtils();
  const myCompanies = trpc.companies.myCompanies.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const createCompany = trpc.companies.create.useMutation({
    onSuccess: (company) => {
      setActiveCompanyId(company.id);
      myCompanies.refetch();
      utils.invalidate();
      toast.success(t("company.created", { name: company.name }));
      setNewName("");
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const [activeId, setActiveId] = useState<number | null>(() => getActiveCompanyId());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const companies = myCompanies.data ?? [];

  // If no active company stored, pick the first membership
  useEffect(() => {
    if (activeId == null && companies.length > 0) {
      setActiveCompanyId(companies[0].companyId);
      setActiveId(companies[0].companyId);
    }
  }, [companies, activeId]);

  const active = companies.find(c => c.companyId === activeId);

  function handlePick(id: number) {
    setActiveCompanyId(id);
    setActiveId(id);
  }

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded transition-colors focus:outline-none"
            aria-label="Switch company"
            title={active?.companyName ?? "Select company"}
          >
            <Building2 className="h-4 w-4 text-sidebar-foreground/70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {companies.map(c => (
            <DropdownMenuItem
              key={c.companyId}
              onClick={() => handlePick(c.companyId)}
              className="cursor-pointer flex items-center gap-2"
            >
              <Check className={`h-3.5 w-3.5 ${c.companyId === activeId ? "opacity-100" : "opacity-0"}`} />
              <span className="flex-1 truncate">{c.companyName}</span>
              <span className="text-[10px] text-muted-foreground uppercase">{c.role}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)} className="cursor-pointer">
            <Plus className="h-3.5 w-3.5 mr-2" />
            {t("company.newCompany")}
          </DropdownMenuItem>
          {onSignOut && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onSignOut}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-3.5 w-3.5 mr-2" />
                <span>{t("signOut")}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
        {renderDialog()}
      </DropdownMenu>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-sidebar-accent transition-colors w-full text-left focus:outline-none"
            aria-label="Switch company"
          >
            {/* User avatar as the leading icon */}
            {user ? (
              <Avatar className="h-7 w-7 border border-sidebar-border shrink-0">
                <AvatarFallback className="text-[10px] font-medium bg-sidebar-accent text-sidebar-accent-foreground">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-7 w-7 flex items-center justify-center rounded bg-sidebar-accent text-sidebar-accent-foreground shrink-0">
                <Building2 className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-sidebar-foreground leading-tight">
                {active?.companyName ?? t("company.noCompanySelected")}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate mt-0.5">
                {user?.name || active?.role || "—"}
              </p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {/* User info header */}
          {user && (
            <>
              <div className="px-2 py-2">
                <p className="text-xs font-medium truncate text-foreground">
                  {user.name || "User"}
                </p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {user.email || ""}
                </p>
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          {companies.map(c => (
            <DropdownMenuItem
              key={c.companyId}
              onClick={() => handlePick(c.companyId)}
              className="cursor-pointer flex items-center gap-2"
            >
              <Check className={`h-3.5 w-3.5 ${c.companyId === activeId ? "opacity-100" : "opacity-0"}`} />
              <span className="flex-1 truncate">{c.companyName}</span>
              <span className="text-[10px] text-muted-foreground uppercase">{c.role}</span>
            </DropdownMenuItem>
          ))}
          {companies.length === 0 && (
            <DropdownMenuItem disabled>
              <span className="text-xs text-muted-foreground">{t("company.noCompanies")}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)} className="cursor-pointer">
            <Plus className="h-3.5 w-3.5 mr-2" />
            {t("company.newCompany")}
          </DropdownMenuItem>
          {onSignOut && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onSignOut}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-3.5 w-3.5 mr-2" />
                <span>{t("signOut")}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {renderDialog()}
    </>
  );

  function renderDialog() {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("company.createNew")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-company-name">{t("company.companyName")}</Label>
            <Input
              id="new-company-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Acme Biotech"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t("btn.cancel")}</Button>
            <Button
              onClick={() => {
                const name = newName.trim();
                if (!name) { toast.error("Name is required"); return; }
                createCompany.mutate({ name });
              }}
              disabled={createCompany.isPending || !newName.trim()}
            >
              {createCompany.isPending ? t("company.creating") : t("btn.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}
