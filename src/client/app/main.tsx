/** 画面の入口。index.html から読む */
import "@fontsource-variable/murecho";
import "@/styles/globals.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { queryClient } from "@/lib/queries";
import { applyTheme, readStoredTheme, watchSystemTheme } from "@/lib/theme";
import { AuthProvider } from "./auth";
import { router } from "./router";

const stored = readStoredTheme();
applyTheme(stored.mode, stored.accent);
watchSystemTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
);
