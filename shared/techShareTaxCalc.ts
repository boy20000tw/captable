/**
 * Taiwan Tech Share / RSA Tax Calculation
 * Based on 產創條例 §19-1 deferral rules
 *
 * Calculates acquisition income, deferral amounts, vesting income, and disposition gains
 */

export type TaxCalcInputs = {
  sharesAcquired: number;
  acquisitionFmv: number;     // per-share FMV at acquisition
  paidAmount: number;          // total amount paid
  vestingFmv?: number;         // per-share FMV at vesting (for RSA)
  dispositionFmv?: number;     // per-share FMV at disposition
  isDeferralEligible: boolean;
  taxRate?: number;            // default 20% for TW capital gains
};

export type TaxCalcResult = {
  acquisitionIncome: number;     // (acquisitionFmv - paidAmount/shares) × shares
  deferralAmount: number;        // if eligible, = acquisitionIncome (deferred)
  taxableAtAcquisition: number;  // if not eligible, = acquisitionIncome
  vestingIncome: number;         // (vestingFmv - acquisitionFmv) × shares
  dispositionGain: number;       // (dispositionFmv - vestingFmv or acquisitionFmv) × shares
  totalTaxableIncome: number;
  estimatedTax: number;
  effectiveTaxRate: number;
};

/**
 * Calculate tech share tax liability
 *
 * @param inputs - Tax calculation inputs
 * @returns Detailed tax calculation result
 */
export function calculateTechShareTax(inputs: TaxCalcInputs): TaxCalcResult {
  const {
    sharesAcquired,
    acquisitionFmv,
    paidAmount,
    vestingFmv,
    dispositionFmv,
    isDeferralEligible,
    taxRate = 0.20,
  } = inputs;

  // Validate inputs
  if (sharesAcquired <= 0 || acquisitionFmv < 0 || paidAmount < 0) {
    return {
      acquisitionIncome: 0,
      deferralAmount: 0,
      taxableAtAcquisition: 0,
      vestingIncome: 0,
      dispositionGain: 0,
      totalTaxableIncome: 0,
      estimatedTax: 0,
      effectiveTaxRate: 0,
    };
  }

  // ─── Step 1: Calculate Acquisition Income ───────────────────────────────
  // Income = (acquisitionFmv × sharesAcquired) - paidAmount
  const acquisitionIncome = acquisitionFmv * sharesAcquired - paidAmount;

  // ─── Step 2: Deferral vs. Taxable at Acquisition ────────────────────────
  let deferralAmount = 0;
  let taxableAtAcquisition = 0;

  if (isDeferralEligible) {
    // If deferral eligible (§19-1), entire acquisition income is deferred
    deferralAmount = Math.max(0, acquisitionIncome);
    taxableAtAcquisition = 0;
  } else {
    // If not eligible, entire acquisition income is taxable immediately
    taxableAtAcquisition = Math.max(0, acquisitionIncome);
    deferralAmount = 0;
  }

  // ─── Step 3: Calculate Vesting Income (for RSA) ──────────────────────────
  // vestingIncome = (vestingFmv - acquisitionFmv) × sharesAcquired
  let vestingIncome = 0;
  if (vestingFmv && vestingFmv > acquisitionFmv) {
    vestingIncome = (vestingFmv - acquisitionFmv) * sharesAcquired;
  }

  // ─── Step 4: Calculate Disposition Gain/Loss ─────────────────────────────
  // dispositionGain = (dispositionFmv - (vestingFmv || acquisitionFmv)) × sharesAcquired
  let dispositionGain = 0;
  if (dispositionFmv) {
    const baseFmv = vestingFmv || acquisitionFmv;
    const gainPerShare = dispositionFmv - baseFmv;
    dispositionGain = gainPerShare * sharesAcquired;
  }

  // ─── Step 5: Total Taxable Income ───────────────────────────────────────
  // Sum of all taxable components (excluding deferred)
  const totalTaxableIncome = taxableAtAcquisition + vestingIncome + dispositionGain;

  // ─── Step 6: Calculate Estimated Tax ─────────────────────────────────────
  const estimatedTax = Math.max(0, totalTaxableIncome * taxRate);

  // ─── Step 7: Calculate Effective Tax Rate ───────────────────────────────
  // Based on total disposition value (or acquisition value if not disposed)
  const totalValue = dispositionFmv
    ? dispositionFmv * sharesAcquired
    : acquisitionFmv * sharesAcquired;

  const effectiveTaxRate = totalValue > 0 ? estimatedTax / totalValue : 0;

  return {
    acquisitionIncome,
    deferralAmount,
    taxableAtAcquisition,
    vestingIncome,
    dispositionGain,
    totalTaxableIncome,
    estimatedTax,
    effectiveTaxRate,
  };
}
