// Background prefetch of lazy route chunks (v2.69.1). Same dynamic-import
// specifier as the route's lazy() → Vite serves it from the same chunk/cache.
let dashboardRequested = false;

/** Start downloading the dashboard (and recharts) without blocking anything. */
export function prefetchDashboard() {
  if (dashboardRequested) return;
  dashboardRequested = true;
  void import("@/pages/Home").catch(() => { dashboardRequested = false; });
}
