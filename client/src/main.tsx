import { initSentry } from "./lib/sentry";

// Initialize Sentry BEFORE React renders
initSentry();

import { ClerkProvider } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { getActiveCompanyId, onActiveCompanyChange } from "@/lib/activeCompany";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const API_TIMEOUT_MS = 20_000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30s — prevent redundant refetches on mount/focus
      refetchOnWindowFocus: false, // cap table data doesn't change while user tabs away
    },
  },
});

// When the user picks a different company, invalidate all cached queries so
// they refetch with the new `x-company-id` header.
onActiveCompanyChange(() => { queryClient.invalidateQueries(); });

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const id = getActiveCompanyId();
        return id ? { "x-company-id": String(id) } : {};
      },
      fetch(input, init) {
        // Hard client-side timeout: if the API hangs (cold DB, upstream outage)
        // fail fast so the UI can show a real error instead of an endless skeleton.
        const timeout = AbortSignal.timeout(API_TIMEOUT_MS);
        const signal =
          init?.signal && typeof AbortSignal.any === "function"
            ? AbortSignal.any([init.signal, timeout])
            : (init?.signal ?? timeout);
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          signal,
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </ClerkProvider>
);
