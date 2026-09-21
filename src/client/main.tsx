import "@fontsource/murecho/400.css";
import "@fontsource/murecho/500.css";
import "@fontsource/murecho/700.css";
import "@fontsource/murecho/800.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/auth.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { queryClient } from "./lib/queries";
import { applyTheme, readStoredTheme, watchSystemTheme } from "./lib/theme";
import { router } from "./router";
import { ToastProvider } from "./ui/Toast";

const stored = readStoredTheme();
applyTheme(stored.mode, stored.accent);
watchSystemTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
