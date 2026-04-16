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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Props = {
  collapsed: boolean;
};

export function CompanySwitcher({ collapsed }: Props) {
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
      toast.success(`Company "${company.name}" created`);
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
            New company
          </DropdownMenuItem>
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
            <div className="h-7 w-7 flex items-center justify-center rounded bg-sidebar-accent text-sidebar-accent-foreground shrink-0">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-sidebar-foreground leading-tight">
                {active?.companyName ?? "No company"}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate capitalize mt-0.5">
                {active?.role ?? "—"}
              </p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0" />
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
          {companies.length === 0 && (
            <DropdownMenuItem disabled>
              <span className="text-xs text-muted-foreground">No companies yet</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)} className="cursor-pointer">
            <Plus className="h-3.5 w-3.5 mr-2" />
            New company
          </DropdownMenuItem>
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
            <DialogTitle>Create new company</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-company-name">Company name</Label>
            <Input
              id="new-company-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Acme Biotech"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const name = newName.trim();
                if (!name) { toast.error("Name is required"); return; }
                createCompany.mutate({ name });
              }}
              disabled={createCompany.isPending || !newName.trim()}
            >
              {createCompany.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}
