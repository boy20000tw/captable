/**
 * Tax Calculation Display Card for Tech Share / RSA tracking
 * Shows detailed tax calculation results with breakdown
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { calculateTechShareTax, type TaxCalcResult } from "@shared/techShareTaxCalc";
import { formatCurrency } from "@/lib/utils";

type TaxCalculationCardProps = {
  // Record data
  sharesAcquired: number;
  acquisitionFmv: number;
  paidAmount: number;
  vestingFmv?: number;
  dispositionFmv?: number;
  isDeferralEligible: boolean;
};

export function TaxCalculationCard(props: TaxCalculationCardProps) {
  const { t } = useTranslation("compliance");
  const [expanded, setExpanded] = useState(false);

  // Calculate tax
  const taxResult = calculateTechShareTax({
    sharesAcquired: props.sharesAcquired,
    acquisitionFmv: props.acquisitionFmv,
    paidAmount: props.paidAmount,
    vestingFmv: props.vestingFmv,
    dispositionFmv: props.dispositionFmv,
    isDeferralEligible: props.isDeferralEligible,
  });

  const renderAmount = (value: number, isNegative?: boolean) => {
    const formatted = formatCurrency(Math.abs(value), "NTD", 0);
    const color = value < 0 ? "text-green-600" : isNegative ? "text-green-600" : "text-red-600";
    return <span className={`font-medium ${color}`}>{value < 0 ? "-" : ""}{formatted}</span>;
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{t("techShare.taxCalc.title")}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                {t("techShare.taxCalc.details")}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                {t("techShare.taxCalc.details")}
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary View - Always Visible */}
        <div className="grid grid-cols-2 gap-4">
          {/* Total Taxable Income */}
          <div className="rounded-lg border border-blue-100 bg-white p-3">
            <p className="text-xs text-muted-foreground mb-1">
              {t("techShare.taxCalc.totalTaxable")}
            </p>
            <p className="text-lg font-bold text-blue-700">
              {formatCurrency(taxResult.totalTaxableIncome, "NTD", 0)}
            </p>
          </div>

          {/* Estimated Tax */}
          <div className="rounded-lg border border-red-100 bg-white p-3">
            <p className="text-xs text-muted-foreground mb-1">
              {t("techShare.taxCalc.estimatedTax")}
            </p>
            <p className="text-lg font-bold text-red-600">
              {formatCurrency(taxResult.estimatedTax, "NTD", 0)}
            </p>
          </div>

          {/* Effective Tax Rate */}
          <div className="rounded-lg border border-amber-100 bg-white p-3">
            <p className="text-xs text-muted-foreground mb-1">
              {t("techShare.taxCalc.effectiveRate")}
            </p>
            <p className="text-lg font-bold text-amber-700">
              {(taxResult.effectiveTaxRate * 100).toFixed(2)}%
            </p>
          </div>

          {/* Deferred Amount (if eligible) */}
          {taxResult.deferralAmount > 0 && (
            <div className="rounded-lg border border-amber-100 bg-white p-3">
              <p className="text-xs text-muted-foreground mb-1">
                {t("techShare.taxCalc.deferralAmount")}
              </p>
              <p className="text-lg font-bold text-amber-700">
                {formatCurrency(taxResult.deferralAmount, "NTD", 0)}
              </p>
            </div>
          )}
        </div>

        {/* Detailed Breakdown - Collapsible */}
        {expanded && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              {t("techShare.taxCalc.details")}
            </p>

            {/* Acquisition Income */}
            <div className="flex items-center justify-between rounded-lg bg-white p-2.5">
              <div>
                <p className="text-sm">{t("techShare.taxCalc.acquisitionIncome")}</p>
                <p className="text-xs text-muted-foreground">
                  ({props.acquisitionFmv} × {props.sharesAcquired} - {formatCurrency(props.paidAmount, "NTD", 0)})
                </p>
              </div>
              {renderAmount(taxResult.acquisitionIncome)}
            </div>

            {/* Deferral vs Taxable at Acquisition */}
            {taxResult.deferralAmount > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-amber-50 p-2.5 border border-amber-100">
                <p className="text-sm text-amber-800">
                  {t("techShare.taxCalc.deferralAmount")}
                </p>
                <Badge variant="outline" className="text-amber-700 border-amber-300">
                  {formatCurrency(taxResult.deferralAmount, "NTD", 0)}
                </Badge>
              </div>
            )}

            {taxResult.taxableAtAcquisition > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-blue-50 p-2.5 border border-blue-100">
                <p className="text-sm text-blue-800">
                  {t("techShare.taxCalc.taxableAtAcquisition")}
                </p>
                <Badge className="bg-blue-100 text-blue-700 border-transparent">
                  {formatCurrency(taxResult.taxableAtAcquisition, "NTD", 0)}
                </Badge>
              </div>
            )}

            {/* Vesting Income */}
            {taxResult.vestingIncome > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-white p-2.5">
                <div>
                  <p className="text-sm">{t("techShare.taxCalc.vestingIncome")}</p>
                  {props.vestingFmv && (
                    <p className="text-xs text-muted-foreground">
                      ({props.vestingFmv} - {props.acquisitionFmv}) × {props.sharesAcquired}
                    </p>
                  )}
                </div>
                {renderAmount(taxResult.vestingIncome)}
              </div>
            )}

            {/* Disposition Gain/Loss */}
            {taxResult.dispositionGain !== 0 && (
              <div className="flex items-center justify-between rounded-lg bg-white p-2.5">
                <div>
                  <p className="text-sm">{t("techShare.taxCalc.dispositionGain")}</p>
                  {props.dispositionFmv && (
                    <p className="text-xs text-muted-foreground">
                      ({props.dispositionFmv} - {props.vestingFmv || props.acquisitionFmv}) × {props.sharesAcquired}
                    </p>
                  )}
                </div>
                {renderAmount(
                  taxResult.dispositionGain,
                  taxResult.dispositionGain < 0,
                )}
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
          <p className="text-xs text-amber-800">
            {t("techShare.taxCalc.disclaimer")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
