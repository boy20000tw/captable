import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";

export function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency();
  return (
    <div className="flex items-center gap-1 border rounded-md p-0.5">
      <Button
        size="sm"
        variant={currency === "NTD" ? "default" : "ghost"}
        className="h-6 px-2 text-xs"
        onClick={() => setCurrency("NTD")}
      >
        TWD
      </Button>
      <Button
        size="sm"
        variant={currency === "USD" ? "default" : "ghost"}
        className="h-6 px-2 text-xs"
        onClick={() => setCurrency("USD")}
      >
        USD
      </Button>
    </div>
  );
}
