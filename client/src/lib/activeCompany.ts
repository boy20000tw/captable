// Active company state — stored in localStorage and read synchronously by the
// tRPC client to build the `x-company-id` request header. When the user picks a
// different company from the switcher, we write here and call
// `queryClient.invalidateQueries()` to refetch everything under the new scope.

const STORAGE_KEY = "active-company-id";

export function getActiveCompanyId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setActiveCompanyId(id: number | null) {
  if (typeof window === "undefined") return;
  if (id == null) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, String(id));
  }
  // Notify listeners (sidebar switcher)
  window.dispatchEvent(new CustomEvent("active-company-change", { detail: id }));
}

export function onActiveCompanyChange(cb: (id: number | null) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const id = (e as CustomEvent<number | null>).detail;
    cb(id ?? null);
  };
  window.addEventListener("active-company-change", handler);
  return () => window.removeEventListener("active-company-change", handler);
}
