import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Number Formatting ────────────────────────────────────────────────────────
export function formatNumber(value: number | string | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatShares(value: number | string | null | undefined): string {
  return formatNumber(value, 0);
}

export function formatPercent(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "—";
  return (n * 100).toFixed(decimals) + "%";
}

export function formatCurrency(
  value: number | string | null | undefined,
  currency: "NTD" | "USD" = "NTD",
  exchangeRate = 0.03128
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "—";
  if (currency === "USD") {
    const usd = n * exchangeRate;
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
    return `$${usd.toFixed(2)}`;
  } else {
    if (n >= 100_000_000) return `NT$${(n / 100_000_000).toFixed(2)}億`;
    if (n >= 10_000) return `NT$${(n / 10_000).toFixed(0)}萬`;
    return `NT$${n.toLocaleString("en-US")}`;
  }
}

export function formatValuation(
  ntdValue: number | string | null | undefined,
  currency: "NTD" | "USD" = "NTD",
  exchangeRate = 0.03128
): string {
  if (ntdValue === null || ntdValue === undefined || ntdValue === "") return "—";
  const n = typeof ntdValue === "string" ? parseFloat(ntdValue) : ntdValue;
  if (isNaN(n)) return "—";
  if (currency === "USD") {
    const usd = n * exchangeRate;
    if (usd >= 1_000_000) return `USD ${(usd / 1_000_000).toFixed(2)}M`;
    return `USD ${(usd / 1_000).toFixed(0)}K`;
  } else {
    if (n >= 100_000_000) return `NT$ ${(n / 100_000_000).toFixed(2)}億`;
    if (n >= 10_000_000) return `NT$ ${(n / 10_000_000).toFixed(1)}千萬`;
    if (n >= 10_000) return `NT$ ${(n / 10_000).toFixed(0)}萬`;
    return `NT$ ${n.toLocaleString("en-US")}`;
  }
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export const ROUND_LABELS: Record<string, string> = {
  founder: "Founder", angel: "Angel", seed: "Seed", seed_plus: "Seed+",
  pre_a: "Pre-A", bridge: "Bridge", series_a: "Series A",
  pre_b: "Pre-B", series_b: "Series B", pre_c: "Pre-C", series_c: "Series C",
  esop: "ESOP", other: "Other",
};

// Symptom Trace CIS: teal-based palette (#4BBFB5 primary)
export const ROUND_COLORS: Record<string, string> = {
  founder: "#2C3E50",  // dark navy (founders)
  angel:   "#7DD3CE",  // light teal
  seed:    "#4BBFB5",  // brand teal
  seed_plus: "#3AADA3", // deeper teal
  pre_a:   "#2D9E94",  // dark teal
  bridge:  "#A8D8D5",  // pale teal
  series_a: "#1A8C82", // forest teal
  pre_b:   "#5BA89E",  // mid teal
  series_b: "#3D7A8C", // teal-blue
  pre_c:   "#6BBFB5",  // medium teal
  series_c: "#2D5A6B", // dark teal-blue
  esop:    "#9BC8C4",  // soft teal
  other:   "#B0CECE",  // muted teal
};

// Symptom Trace CIS-aligned chart palette
export const ROUND_CHART_COLORS = [
  "#4BBFB5", // brand teal
  "#2C3E50", // dark navy
  "#7DD3CE", // light teal
  "#1A8C82", // deep teal
  "#A8D8D5", // pale teal
  "#3D7A8C", // teal-blue
  "#5BA89E", // mid teal
  "#2D5A6B", // dark teal-blue
  "#9BC8C4", // soft teal
  "#1E6B62", // forest teal
  "#6BBFB5", // medium teal
  "#3AADA3", // accent teal
];

export function getRoundLabel(type: string): string {
  return ROUND_LABELS[type] || type;
}

export function getRoundColor(type: string): string {
  return ROUND_COLORS[type] || ROUND_COLORS.other;
}
