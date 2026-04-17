import { createContext, useContext, useState, ReactNode } from "react";

type Currency = "NTD" | "USD";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  exchangeRate: number;
  formatAmount: (ntdAmount: number | string | null | undefined) => string;
  formatPrice: (ntdAmount: number | string | null | undefined) => string;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("NTD");
  const exchangeRate = 0.03128; // NTD to USD, can be made dynamic later

  function formatAmount(ntdAmount: number | string | null | undefined): string {
    const val = typeof ntdAmount === "string" ? parseFloat(ntdAmount) : ntdAmount;
    if (!val || val === 0) return "—";

    if (currency === "USD") {
      const usd = val * exchangeRate;
      if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
      if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
      return `$${usd.toFixed(0)}`;
    } else {
      if (val >= 100_000_000) return `NT$${(val / 100_000_000).toFixed(2)}億`;
      if (val >= 10_000) return `NT$${(val / 10_000).toFixed(0)}萬`;
      return `NT$${val.toLocaleString()}`;
    }
  }

  function formatPrice(ntdAmount: number | string | null | undefined): string {
    const val = typeof ntdAmount === "string" ? parseFloat(ntdAmount) : ntdAmount;
    if (!val || val === 0) return "—";

    if (currency === "USD") {
      const usd = val * exchangeRate;
      return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    } else {
      return `NT$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    }
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, exchangeRate, formatAmount, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be inside CurrencyProvider");
  return ctx;
}
