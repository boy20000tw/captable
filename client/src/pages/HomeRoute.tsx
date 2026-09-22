/**
 * "/" route shell (v2.69.1).
 *
 * DashboardLayout (sidebar + sign-in card) stays in the main bundle so the
 * login page paints immediately. The dashboard body — and with it recharts —
 * is a separate chunk that only downloads once someone is signed in.
 */
import { Suspense, lazy } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageLoader from "@/components/PageLoader";

const DashboardContent = lazy(() => import("@/pages/Home").then((m) => ({ default: m.DashboardContent })));

export default function HomeRoute() {
  return (
    <DashboardLayout>
      <Suspense fallback={<PageLoader />}>
        <DashboardContent />
      </Suspense>
    </DashboardLayout>
  );
}
