/**
 * Admin Team Management — list platform admins, manage roles,
 * add/remove admins (super_admin only).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { Users, UserPlus, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700 border-transparent",
  admin: "bg-blue-100 text-blue-700 border-transparent",
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  super_admin: ShieldAlert,
  admin: ShieldCheck,
};

export default function AdminTeamPage() {
  return (
    <AdminLayout>
      <AdminTeamContent />
    </AdminLayout>
  );
}

function AdminTeamContent() {
  const { t: tPages } = useTranslation("pages");
  const { t } = useTranslation("admin");
  const { user, adminCapabilities } = useAuth();
  const utils = trpc.useUtils();

  const { data: team, isLoading } = trpc.admin.listAdminTeam.useQuery();

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<string>("admin");

  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState("");

  const [removeConfirm, setRemoveConfirm] = useState<{ userId: number; name: string } | null>(null);
  const [transferConfirm, setTransferConfirm] = useState<{ userId: number; name: string } | null>(null);

  const canManage = adminCapabilities?.canManageAdminTeam ?? false;

  const addMut = trpc.admin.addAdmin.useMutation({
    onSuccess: () => {
      toast.success(t("team.adminAdded"));
      utils.admin.listAdminTeam.invalidate();
      setAddOpen(false);
      setAddEmail("");
      setAddRole("admin");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRoleMut = trpc.admin.updateAdminRole.useMutation({
    onSuccess: () => {
      toast.success(t("team.roleUpdated"));
      utils.admin.listAdminTeam.invalidate();
      setEditOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMut = trpc.admin.removeAdmin.useMutation({
    onSuccess: () => {
      toast.success(t("team.adminRemoved"));
      utils.admin.listAdminTeam.invalidate();
      setRemoveConfirm(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const transferMut = trpc.admin.transferSuperAdmin.useMutation({
    onSuccess: () => {
      toast.success(t("team.superAdminTransferred"));
      utils.admin.listAdminTeam.invalidate();
      setTransferConfirm(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const openEditRole = (userId: number, currentRole: string) => {
    setEditUserId(userId);
    setEditRole(currentRole);
    setEditOpen(true);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> {t("team.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("team.desc")}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
            <UserPlus className="h-4 w-4" /> {t("team.addAdmin")}
          </Button>
        )}
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-2 gap-4">
        {(["super_admin", "admin"] as const).map((role) => {
          const count = team?.filter((m: any) => m.adminRole === role).length ?? 0;
          const Icon = ROLE_ICONS[role];
          return (
            <Card key={role}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t(`team.role_${role}`)}</span>
                </div>
                <p className="text-2xl font-bold mt-1">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Team table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("team.members")}</CardTitle>
          <CardDescription>{t("team.membersDesc", { count: team?.length ?? 0 })}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
            </div>
          ) : !team || team.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">{t("team.noMembers")}</div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("team.colName")}</TableHead>
                  <TableHead>{t("team.colEmail")}</TableHead>
                  <TableHead>{t("team.colRole")}</TableHead>
                  <TableHead>{t("team.colLastLogin")}</TableHead>
                  {canManage && <TableHead className="w-32">{t("team.colActions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((m: any) => {
                  const isSelf = m.id === user?.id;
                  const Icon = ROLE_ICONS[m.adminRole] ?? ShieldCheck;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-sm">
                        {m.name || "—"}
                        {isSelf && <span className="text-xs text-muted-foreground ml-1">({t("team.you")})</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.email || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`${ROLE_COLORS[m.adminRole] ?? ""} text-xs gap-1`}>
                          <Icon className="h-3 w-3" />
                          {t(`team.role_${m.adminRole}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(m.lastSignedIn)}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-1">
                            {!isSelf && m.adminRole !== "super_admin" && (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 text-xs"
                                  onClick={() => openEditRole(m.id, m.adminRole)}>
                                  {t("team.editRole")}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                                  onClick={() => setRemoveConfirm({ userId: m.id, name: m.name || m.email || "—" })}>
                                  {t("team.remove")}
                                </Button>
                              </>
                            )}
                            {!isSelf && m.adminRole !== "super_admin" && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-purple-600 hover:text-purple-700"
                                onClick={() => setTransferConfirm({ userId: m.id, name: m.name || m.email || "—" })}>
                                {t("team.transfer")}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Admin Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("team.addAdminTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("team.emailLabel")}</Label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("team.roleLabel")}</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("team.role_admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t("team.cancel")}</Button>
            <Button
              onClick={() => addMut.mutate({ email: addEmail, adminRole: addRole as any })}
              disabled={!addEmail || addMut.isPending}
            >
              {t("team.addButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("team.editRoleTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("team.roleLabel")}</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("team.role_admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("team.cancel")}</Button>
            <Button
              onClick={() => editUserId && updateRoleMut.mutate({ userId: editUserId, adminRole: editRole as any })}
              disabled={updateRoleMut.isPending}
            >
              {t("team.saveRole")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeConfirm} onOpenChange={(open) => !open && setRemoveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("team.removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("team.removeDesc", { name: removeConfirm?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("team.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeConfirm && removeMut.mutate({ userId: removeConfirm.userId })}
            >
              {t("team.confirmRemove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Super Admin Confirmation */}
      <AlertDialog open={!!transferConfirm} onOpenChange={(open) => !open && setTransferConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("team.transferTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("team.transferDesc", { name: transferConfirm?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("team.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:pointer-events-none"
              disabled={transferMut.isPending}
              onClick={() => transferConfirm && transferMut.mutate({ targetUserId: transferConfirm.userId })}
            >
              {t("team.confirmTransfer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
