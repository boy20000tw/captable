'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Landmark,
  Plus,
  CheckCircle2,
  Pencil,
  Trash2,
  Settings,
  AlertCircle,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { FeatureGate } from '@/components/FeatureGate';
import { trpc } from '@/lib/trpc';
import { formatDate } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';

type DividendPriorityType = 'cumulative' | 'non_cumulative' | 'participating' | 'none';
type ParValueType = 'par' | 'no_par';
type TransferRestrictionType = 'none' | 'board_approval' | 'shareholder_approval' | 'custom';

type ShareRightFormData = {
  shareClassName: string;
  shareClassId?: number;
  votesPerShare: number;
  hasVetoRight: boolean;
  vetoMatters?: string;
  guaranteedBoardSeats: number;
  boardObserverRights: boolean;
  dividendPriority: DividendPriorityType;
  dividendRate?: number;
  liquidationPriority: number;
  liquidationMultiple?: number;
  isConvertible: boolean;
  conversionRatio?: number;
  conversionTrigger?: string;
  customProvisions?: string;
  notes?: string;
};

const defaultShareRightForm: ShareRightFormData = {
  shareClassName: '',
  votesPerShare: 1.0,
  hasVetoRight: false,
  guaranteedBoardSeats: 0,
  boardObserverRights: false,
  dividendPriority: 'none',
  liquidationPriority: 0,
  isConvertible: false,
};

export default function ClosedCompanyPage() {
  const { t } = useTranslation("compliance");
  const { t: tPages } = useTranslation("pages");
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRightId, setEditingRightId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ShareRightFormData>(
    defaultShareRightForm
  );

  // Dividend priority labels
  const dividendPriorityLabels: Record<DividendPriorityType, string> = {
    cumulative: t("closedCompany.cumulative"),
    non_cumulative: t("closedCompany.nonCumulative"),
    participating: t("closedCompany.participating"),
    none: '-',
  };

  // Company provision queries
  const provisionQuery = trpc.closedCompany.getProvision.useQuery();
  const upsertProvisionMutation = trpc.closedCompany.upsertProvision.useMutation({
    onSuccess: () => {
      provisionQuery.refetch();
      setIsEditingCompany(false);
    },
  });

  // Share rights queries
  const rightsQuery = trpc.closedCompany.listRights.useQuery();
  const deleteRightMutation = trpc.closedCompany.deleteRight.useMutation({
    onSuccess: () => {
      rightsQuery.refetch();
    },
  });
  const createRightMutation = trpc.closedCompany.createRight.useMutation({
    onSuccess: () => {
      rightsQuery.refetch();
      resetForm();
      setIsDialogOpen(false);
    },
  });
  const updateRightMutation = trpc.closedCompany.updateRight.useMutation({
    onSuccess: () => {
      rightsQuery.refetch();
      resetForm();
      setIsDialogOpen(false);
    },
  });

  const provision = provisionQuery.data;
  const isClosedCompany = provision?.isClosedCompany || false;

  const resetForm = () => {
    setFormData(defaultShareRightForm);
    setEditingRightId(null);
  };

  const handleOpenDialog = (right?: any) => {
    if (right) {
      setFormData({
        shareClassName: right.shareClassName,
        shareClassId: right.shareClassId ?? undefined,
        votesPerShare: Number(right.votesPerShare) || 1.0,
        hasVetoRight: right.hasVetoRight,
        vetoMatters: right.vetoMatters ?? undefined,
        guaranteedBoardSeats: right.guaranteedBoardSeats || 0,
        boardObserverRights: right.boardObserverRights || false,
        dividendPriority: (right.dividendPriority as DividendPriorityType) || 'none',
        dividendRate: right.dividendRate ? Number(right.dividendRate) : undefined,
        liquidationPriority: right.liquidationPriority || 0,
        liquidationMultiple: right.liquidationMultiple ? Number(right.liquidationMultiple) : undefined,
        isConvertible: right.isConvertible,
        conversionRatio: right.conversionRatio ? Number(right.conversionRatio) : undefined,
        conversionTrigger: right.conversionTrigger ?? undefined,
        customProvisions: right.customProvisions ?? undefined,
        notes: right.notes ?? undefined,
      });
      setEditingRightId(right.id);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSaveRight = async () => {
    if (!formData.shareClassName.trim()) {
      alert(t("closedCompany.nameRequired"));
      return;
    }

    const rightData = {
      shareClassName: formData.shareClassName,
      shareClassId: formData.shareClassId,
      votesPerShare: formData.votesPerShare.toFixed(2),
      hasVetoRight: formData.hasVetoRight,
      vetoMatters: formData.hasVetoRight ? formData.vetoMatters : undefined,
      guaranteedBoardSeats: formData.guaranteedBoardSeats,
      boardObserverRights: formData.boardObserverRights,
      dividendPriority: formData.dividendPriority,
      dividendRate: formData.dividendRate != null ? String(formData.dividendRate) : undefined,
      liquidationPriority: formData.liquidationPriority,
      liquidationMultiple: formData.liquidationMultiple != null ? String(formData.liquidationMultiple) : undefined,
      isConvertible: formData.isConvertible,
      conversionRatio: formData.isConvertible && formData.conversionRatio != null ? String(formData.conversionRatio) : undefined,
      conversionTrigger: formData.isConvertible ? formData.conversionTrigger : undefined,
      customProvisions: formData.customProvisions,
      notes: formData.notes,
    };

    if (editingRightId) {
      await updateRightMutation.mutateAsync({
        id: editingRightId,
        data: rightData,
      });
    } else {
      await createRightMutation.mutateAsync(rightData);
    }
  };

  const handleDeleteRight = async (id: number) => {
    if (confirm(t("closedCompany.confirmDelete"))) {
      await deleteRightMutation.mutateAsync({ id });
    }
  };

  const handleSaveCompanySettings = async () => {
    const rawParValue = (
      document.getElementById('parValueType') as HTMLSelectElement
    )?.value || 'par';
    const rawTransfer = (
      document.getElementById('transferRestriction') as HTMLSelectElement
    )?.value || 'none';

    const settingsData = {
      isClosedCompany: isClosedCompany,
      parValueType: rawParValue as ParValueType,
      transferRestriction: rawTransfer as TransferRestrictionType,
      transferDescription: (
        document.getElementById('transferDescription') as HTMLInputElement
      )?.value || undefined,
      articlesUrl: (
        document.getElementById('articlesUrl') as HTMLInputElement
      )?.value || undefined,
      effectiveDate: (
        document.getElementById('effectiveDate') as HTMLInputElement
      )?.value || undefined,
    };

    await upsertProvisionMutation.mutateAsync(settingsData);
  };

  const exportToPdf = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Get company name or use default
      const companyName = 'Company';
      const titleText = t('closedCompany.exportPdfTitle');

      // Add title
      doc.setFontSize(14);
      doc.text(titleText, 14, 15);

      // Add company name and date
      doc.setFontSize(10);
      doc.text(`${companyName}`, 14, 22);
      doc.setFontSize(9);
      doc.text(`${t('shared.date')}: ${new Date().toLocaleDateString()}`, 14, 28);

      // Prepare table data
      const headers = [
        t('closedCompany.shareClass'),
        t('closedCompany.votesPerShare'),
        t('closedCompany.vetoRight'),
        t('closedCompany.boardSeats'),
        t('closedCompany.dividendPriority'),
        t('closedCompany.liquidationPriority'),
        t('closedCompany.convertible'),
      ];

      const rows = rights.map((right: any) => [
        right.shareClassName,
        `${Number(right.votesPerShare).toFixed(2)}`,
        right.hasVetoRight ? t('closedCompany.yes') : t('closedCompany.no'),
        right.guaranteedBoardSeats > 0 ? right.guaranteedBoardSeats.toString() : '-',
        dividendPriorityLabels[right.dividendPriority as DividendPriorityType] || '-',
        right.liquidationPriority > 0 ? right.liquidationPriority.toString() : '-',
        right.isConvertible ? t('closedCompany.yes') : t('closedCompany.no'),
      ]);

      // Add table using autoTable
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 35,
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
      });

      // Add footer with timestamp
      const pageCount = (doc as any).internal.getNumberOfPages?.() || 1;
      doc.setFontSize(8);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(
          `${t('closedCompany.exportedOn')} ${new Date().toLocaleString()}`,
          14,
          doc.internal.pageSize.getHeight() - 10
        );
      }

      // Save PDF
      doc.save(`${companyName}-share-rights.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert(t('closedCompany.exportError'));
    }
  };

  const exportToExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(t('closedCompany.shareRightsTitle'));

      // Set column widths
      worksheet.columns = [
        { header: t('closedCompany.shareClass'), key: 'shareClass', width: 20 },
        { header: t('closedCompany.votesPerShare'), key: 'votesPerShare', width: 18 },
        { header: t('closedCompany.vetoRight'), key: 'vetoRight', width: 12 },
        { header: t('closedCompany.boardSeats'), key: 'boardSeats', width: 15 },
        { header: t('closedCompany.dividendPriority'), key: 'dividendPriority', width: 18 },
        { header: t('closedCompany.liquidationPriority'), key: 'liquidationPriority', width: 18 },
        { header: t('closedCompany.convertible'), key: 'convertible', width: 12 },
      ];

      // Style header row
      worksheet.getRow(1).eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2980B9' },
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });

      // Add data rows
      rights.forEach((right: any) => {
        worksheet.addRow({
          shareClass: right.shareClassName,
          votesPerShare: Number(right.votesPerShare).toFixed(2),
          vetoRight: right.hasVetoRight ? t('closedCompany.yes') : t('closedCompany.no'),
          boardSeats: right.guaranteedBoardSeats > 0 ? right.guaranteedBoardSeats : '-',
          dividendPriority: dividendPriorityLabels[right.dividendPriority as DividendPriorityType] || '-',
          liquidationPriority: right.liquidationPriority > 0 ? right.liquidationPriority : '-',
          convertible: right.isConvertible ? t('closedCompany.yes') : t('closedCompany.no'),
        });
      });

      // Alternate row colors
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          if (rowNumber % 2 === 0) {
            row.eachCell((cell) => {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF5F5F5' },
              };
            });
          }
          row.eachCell((cell) => {
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          });
        }
      });

      // Generate and save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const companyName = 'Company';
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${companyName}-share-rights.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel export error:', error);
      alert(t('closedCompany.exportError'));
    }
  };

  const rights = rightsQuery.data || [];
  const isLoading =
    provisionQuery.isLoading ||
    rightsQuery.isLoading ||
    upsertProvisionMutation.isPending ||
    createRightMutation.isPending ||
    updateRightMutation.isPending;

  return (
    <DashboardLayout>
      <FeatureGate feature="compliance.closedCompany">
        <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Landmark className="h-6 w-6 text-primary" />
              {tPages("compliance.closedCompany.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tPages("compliance.closedCompany.desc")}
            </p>
          </div>
        </div>

        {/* Company Settings Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("closedCompany.companySettings")}
              </CardTitle>
              <CardDescription>
                {t("closedCompany.companySettingsDesc")}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main toggle */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="isClosedCompany"
                checked={isClosedCompany}
                onCheckedChange={(checked) => {
                  // This will be handled through form submission
                  const currentValue =
                    document.getElementById('isClosedCompany') as HTMLInputElement;
                  if (currentValue) {
                    currentValue.checked = checked === true;
                  }
                }}
              />
              <Label htmlFor="isClosedCompany" className="font-semibold">
                {t("closedCompany.isClosedCompany")}
              </Label>
            </div>

            {isClosedCompany && (
              <div className="space-y-4 border-t pt-4">
                {/* Par Value Type */}
                <div className="grid gap-2">
                  <Label htmlFor="parValueType">{t("closedCompany.parValueType")}</Label>
                  <Select
                    defaultValue={provision?.parValueType || 'par'}
                  >
                    <SelectTrigger id="parValueType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="par">{t("closedCompany.par")}</SelectItem>
                      <SelectItem value="no_par">{t("closedCompany.noPar")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Transfer Restriction */}
                <div className="grid gap-2">
                  <Label htmlFor="transferRestriction">{t("closedCompany.transferRestriction")}</Label>
                  <Select
                    defaultValue={provision?.transferRestriction || 'none'}
                  >
                    <SelectTrigger id="transferRestriction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("closedCompany.none")}</SelectItem>
                      <SelectItem value="board_approval">
                        {t("closedCompany.boardApproval")}
                      </SelectItem>
                      <SelectItem value="shareholder_approval">
                        {t("closedCompany.shareholderApproval")}
                      </SelectItem>
                      <SelectItem value="custom">{t("closedCompany.custom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Transfer Description (conditional) */}
                {provision?.transferRestriction === 'custom' && (
                  <div className="grid gap-2">
                    <Label htmlFor="transferDescription">{t("closedCompany.customTransferDesc")}</Label>
                    <Textarea
                      id="transferDescription"
                      placeholder={t("closedCompany.customTransferPlaceholder")}
                      defaultValue={provision?.transferDescription || ''}
                      rows={4}
                    />
                  </div>
                )}

                {/* Articles URL */}
                <div className="grid gap-2">
                  <Label htmlFor="articlesUrl">{t("closedCompany.articlesUrl")}</Label>
                  <Input
                    id="articlesUrl"
                    type="url"
                    placeholder="https://..."
                    defaultValue={provision?.articlesUrl || ''}
                  />
                </div>

                {/* Effective Date */}
                <div className="grid gap-2">
                  <Label htmlFor="effectiveDate">{t("closedCompany.effectiveDate")}</Label>
                  <Input
                    id="effectiveDate"
                    type="date"
                    defaultValue={
                      provision?.effectiveDate
                        ? provision.effectiveDate.split('T')[0]
                        : ''
                    }
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleSaveCompanySettings}
              disabled={isLoading}
              className="mt-4"
            >
              {t("closedCompany.saveSettings")}
            </Button>
          </CardContent>
        </Card>

        {/* Share Class Rights Section (only visible when closed company is enabled) */}
        {isClosedCompany && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-2xl font-bold text-gray-900">
                {t("closedCompany.shareRightsTitle")}
              </h2>
              <div className="flex gap-2">
                {rights.length > 0 && (
                  <>
                    <Button
                      onClick={exportToPdf}
                      variant="outline"
                      className="gap-2"
                      disabled={isLoading}
                      size="sm"
                    >
                      <FileText className="h-4 w-4" />
                      {t("closedCompany.exportPdf")}
                    </Button>
                    <Button
                      onClick={exportToExcel}
                      variant="outline"
                      className="gap-2"
                      disabled={isLoading}
                      size="sm"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      {t("closedCompany.exportExcel")}
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => handleOpenDialog()}
                  className="gap-2"
                  disabled={isLoading}
                >
                  <Plus className="h-4 w-4" />
                  {t("closedCompany.addShareClass")}
                </Button>
              </div>
            </div>

            {rights.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("closedCompany.emptyState")}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("closedCompany.shareClass")}</TableHead>
                      <TableHead className="text-center">{t("closedCompany.votesPerShare")}</TableHead>
                      <TableHead className="text-center">{t("closedCompany.vetoRight")}</TableHead>
                      <TableHead className="text-center">{t("closedCompany.boardSeats")}</TableHead>
                      <TableHead>{t("closedCompany.dividendPriority")}</TableHead>
                      <TableHead className="text-center">{t("closedCompany.liquidationPriority")}</TableHead>
                      <TableHead className="text-center">{t("closedCompany.convertible")}</TableHead>
                      <TableHead className="text-right">{t("shared.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rights.map((right: any) => (
                      <TableRow key={right.id}>
                        <TableCell className="font-semibold">
                          {right.shareClassName}
                        </TableCell>
                        <TableCell className="text-center">
                          {Number(right.votesPerShare).toFixed(2)} {t("closedCompany.votesUnit")}
                        </TableCell>
                        <TableCell className="text-center">
                          {right.hasVetoRight ? (
                            <Badge variant="secondary">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              {t("closedCompany.yes")}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">{t("closedCompany.no")}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {right.guaranteedBoardSeats > 0
                            ? t("closedCompany.seats", { count: right.guaranteedBoardSeats })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {dividendPriorityLabels[right.dividendPriority as DividendPriorityType] || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {right.liquidationPriority > 0
                            ? t("closedCompany.priorityRank", { rank: right.liquidationPriority })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {right.isConvertible ? (
                            <Badge variant="outline">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              {t("closedCompany.convertibleBadge")}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">{t("closedCompany.noConvert")}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(right)}
                              disabled={isLoading}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRight(right.id)}
                              disabled={isLoading}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Share Right Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRightId ? t("closedCompany.editShareClass") : t("closedCompany.newShareClass")}
              </DialogTitle>
              <DialogDescription>
                {t("closedCompany.dialogDesc")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Share Class Name */}
              <div className="grid gap-2">
                <Label htmlFor="shareClassName">
                  {t("closedCompany.shareClassName")} <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="shareClassName"
                  placeholder={t("closedCompany.shareClassPlaceholder")}
                  value={formData.shareClassName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shareClassName: e.target.value,
                    })
                  }
                />
              </div>

              {/* Votes Per Share */}
              <div className="grid gap-2">
                <Label htmlFor="votesPerShare">{t("closedCompany.votesPerShare")}</Label>
                <Input
                  id="votesPerShare"
                  type="number"
                  step={0.01}
                  value={formData.votesPerShare}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      votesPerShare: parseFloat(e.target.value) || 1.0,
                    })
                  }
                />
              </div>

              {/* Veto Right */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="hasVetoRight"
                    checked={formData.hasVetoRight}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        hasVetoRight: checked === true,
                      })
                    }
                  />
                  <Label htmlFor="hasVetoRight">{t("closedCompany.hasVetoRight")}</Label>
                </div>

                {formData.hasVetoRight && (
                  <div className="ml-6 grid gap-2">
                    <Label htmlFor="vetoMatters">{t("closedCompany.vetoMatters")}</Label>
                    <Textarea
                      id="vetoMatters"
                      placeholder={t("closedCompany.vetoPlaceholder")}
                      value={formData.vetoMatters || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vetoMatters: e.target.value,
                        })
                      }
                      rows={3}
                    />
                  </div>
                )}
              </div>

              {/* Board Seats */}
              <div className="grid gap-2">
                <Label htmlFor="guaranteedBoardSeats">{t("closedCompany.boardSeats")}</Label>
                <Input
                  id="guaranteedBoardSeats"
                  type="number"
                  min="0"
                  value={formData.guaranteedBoardSeats}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      guaranteedBoardSeats: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              {/* Board Observer Rights */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="boardObserverRights"
                  checked={formData.boardObserverRights}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      boardObserverRights: checked === true,
                    })
                  }
                />
                <Label htmlFor="boardObserverRights">{t("closedCompany.boardObserver")}</Label>
              </div>

              {/* Dividend Priority */}
              <div className="grid gap-2">
                <Label htmlFor="dividendPriority">{t("closedCompany.dividendOrder")}</Label>
                <Select
                  value={formData.dividendPriority}
                  onValueChange={(value: any) =>
                    setFormData({
                      ...formData,
                      dividendPriority: value,
                    })
                  }
                >
                  <SelectTrigger id="dividendPriority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("closedCompany.dividendNone")}</SelectItem>
                    <SelectItem value="cumulative">{t("closedCompany.cumulative")}</SelectItem>
                    <SelectItem value="non_cumulative">{t("closedCompany.nonCumulative")}</SelectItem>
                    <SelectItem value="participating">{t("closedCompany.participating")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dividend Rate */}
              {formData.dividendPriority !== 'none' && (
                <div className="grid gap-2">
                  <Label htmlFor="dividendRate">{t("closedCompany.dividendRate")}</Label>
                  <Input
                    id="dividendRate"
                    type="number"
                    step={0.01}
                    min="0"
                    max="100"
                    value={formData.dividendRate || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dividendRate: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              )}

              {/* Liquidation Priority */}
              <div className="grid gap-2">
                <Label htmlFor="liquidationPriority">{t("closedCompany.liquidationOrder")}</Label>
                <Input
                  id="liquidationPriority"
                  type="number"
                  min="0"
                  value={formData.liquidationPriority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      liquidationPriority: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              {/* Liquidation Multiple */}
              {formData.liquidationPriority > 0 && (
                <div className="grid gap-2">
                  <Label htmlFor="liquidationMultiple">{t("closedCompany.liquidationMultiple")}</Label>
                  <Input
                    id="liquidationMultiple"
                    type="number"
                    step={0.01}
                    min="1"
                    value={formData.liquidationMultiple || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        liquidationMultiple: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              )}

              {/* Conversion Rights */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="isConvertible"
                    checked={formData.isConvertible}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        isConvertible: checked === true,
                      })
                    }
                  />
                  <Label htmlFor="isConvertible">{t("closedCompany.isConvertible")}</Label>
                </div>

                {formData.isConvertible && (
                  <div className="ml-6 space-y-3">
                    <div className="grid gap-2">
                      <Label htmlFor="conversionRatio">{t("closedCompany.conversionRatio")}</Label>
                      <Input
                        id="conversionRatio"
                        type="number"
                        step={0.01}
                        placeholder={t("closedCompany.conversionRatioPlaceholder")}
                        value={formData.conversionRatio || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            conversionRatio: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="conversionTrigger">{t("closedCompany.conversionTrigger")}</Label>
                      <Textarea
                        id="conversionTrigger"
                        placeholder={t("closedCompany.conversionTriggerPlaceholder")}
                        value={formData.conversionTrigger || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            conversionTrigger: e.target.value,
                          })
                        }
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Provisions */}
              <div className="grid gap-2">
                <Label htmlFor="customProvisions">{t("closedCompany.customProvisions")}</Label>
                <Textarea
                  id="customProvisions"
                  placeholder={t("closedCompany.customProvisionsPlaceholder")}
                  value={formData.customProvisions || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      customProvisions: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>

              {/* Notes */}
              <div className="grid gap-2">
                <Label htmlFor="notes">{t("shared.notes")}</Label>
                <Textarea
                  id="notes"
                  placeholder={t("closedCompany.notesPlaceholder")}
                  value={formData.notes || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      notes: e.target.value,
                    })
                  }
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoading}
              >
                {t("shared.cancel")}
              </Button>
              <Button onClick={handleSaveRight} disabled={isLoading}>
                {editingRightId ? t("closedCompany.updateShareClass") : t("closedCompany.addShareClass")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
