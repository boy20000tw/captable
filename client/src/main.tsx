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

const queryClient = new QueryClient();

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
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
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
