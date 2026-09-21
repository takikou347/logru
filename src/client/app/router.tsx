import { createBrowserRouter, type RouteObject } from "react-router";
import { AgreePage } from "@/modules/auth/AgreePage";
import { LoginPage } from "@/modules/auth/LoginPage";
import { ResetPasswordPage } from "@/modules/auth/ResetPasswordPage";
import { SignupPage } from "@/modules/auth/SignupPage";
import { VerifyEmailPage } from "@/modules/auth/VerifyEmailPage";
import { NotFound, RouteError } from "./errors";
import { GuestOnly, RequireAuth } from "./guards";

/** 規約の画面は Markdown の変換を使うので、開いたときに読む */
async function legal(doc: "terms" | "privacy") {
  const { LegalPage } = await import("@/modules/legal/LegalPage");
  return { element: <LegalPage doc={doc} /> };
}

/**
 * 画面の一覧。
 *
 * ログインまわりの画面は最初の読み込みに入れる。ログインした後の画面は、開いたときに読む。
 * 拡張の画面は、拡張の側でここに足す。いまは予定の拡張が画面を持たないので、足していない。
 */
const routes: RouteObject[] = [
  {
    element: <GuestOnly />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/signup", element: <SignupPage /> },
    ],
  },
  { path: "/verify-email", element: <VerifyEmailPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/terms", lazy: () => legal("terms") },
  { path: "/privacy", lazy: () => legal("privacy") },
  { path: "/invite/:token", lazy: async () => ({ Component: (await import("@/modules/groups/InvitePage")).InvitePage }) },
  {
    element: <RequireAuth />,
    children: [
      { path: "/agree", element: <AgreePage /> },
      { path: "/", lazy: async () => ({ Component: (await import("@/modules/calendar/CalendarPage")).CalendarPage }) },
      { path: "/groups", lazy: async () => ({ Component: (await import("@/modules/groups/GroupsPage")).GroupsPage }) },
      { path: "/groups/:id", lazy: async () => ({ Component: (await import("@/modules/groups/GroupDetailPage")).GroupDetailPage }) },
      { path: "/settings", lazy: async () => ({ Component: (await import("@/modules/settings/SettingsPage")).SettingsPage }) },
    ],
  },
  ...(import.meta.env.DEV
    ? [{ path: "/_components", lazy: async () => ({ Component: (await import("@/modules/dev/ComponentsPage")).ComponentsPage }) }]
    : []),
  { path: "*", element: <NotFound /> },
];

/** アプリの道順 */
export const router = createBrowserRouter([{ errorElement: <RouteError />, children: routes }]);
