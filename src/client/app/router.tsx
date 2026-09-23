import { createBrowserRouter, type RouteObject } from "react-router";
import { AgreePage } from "@/modules/auth/AgreePage";
import { LoginPage } from "@/modules/auth/LoginPage";
import { ResetPasswordPage } from "@/modules/auth/ResetPasswordPage";
import { SignupPage } from "@/modules/auth/SignupPage";
import { VerifyEmailPage } from "@/modules/auth/VerifyEmailPage";
import { NotFound, RouteError } from "./errors";
import { extensionRoutes } from "./extension-routes";
import { GuestOnly, RequireAuth } from "./guards";
import { LegacyRedirect } from "./legacy-redirect";

/** 規約とよくある質問の画面は Markdown の変換を使うので、開いたときに読む */
async function legal(doc: "terms" | "privacy" | "help") {
  const { LegalPage } = await import("@/modules/legal/LegalPage");
  return { element: <LegalPage doc={doc} /> };
}

/**
 * 画面の一覧。
 *
 * ログインまわりの画面は最初の読み込みに入れる。ログインした後の画面は、開いたときに読む。
 * 拡張の画面は、拡張の側で pages に書くと、ログインした人の画面の下に並ぶ。0019
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
  { path: "/help", lazy: () => legal("help") },
  {
    path: "/invite/:token",
    lazy: async () => ({ Component: (await import("@/modules/groups/InvitePage")).InvitePage }),
  },
  {
    element: <RequireAuth />,
    children: [
      { path: "/agree", element: <AgreePage /> },
      { path: "/", lazy: async () => ({ Component: (await import("@/modules/calendar/CalendarPage")).CalendarPage }) },
      {
        path: "/spiral/:year",
        lazy: async () => ({ Component: (await import("@/modules/calendar/spiral/SpiralPage")).SpiralPage }),
      },
      { path: "/groups", lazy: async () => ({ Component: (await import("@/modules/groups/GroupsPage")).GroupsPage }) },
      {
        path: "/groups/:id",
        lazy: async () => ({ Component: (await import("@/modules/groups/GroupDetailPage")).GroupDetailPage }),
      },
      // 設定は目次と、見た目・通知・機能・使い方・アカウントの 5 節。issue #102
      {
        path: "/settings",
        lazy: async () => ({ Component: (await import("@/modules/settings/SettingsIndexPage")).SettingsIndexPage }),
      },
      {
        path: "/settings/appearance",
        lazy: async () => ({
          Component: (await import("@/modules/settings/AppearanceSettingsPage")).AppearanceSettingsPage,
        }),
      },
      {
        path: "/settings/notifications",
        lazy: async () => ({
          Component: (await import("@/modules/settings/NotificationsSettingsPage")).NotificationsSettingsPage,
        }),
      },
      {
        path: "/settings/extensions",
        lazy: async () => ({
          Component: (await import("@/modules/settings/ExtensionsSettingsPage")).ExtensionsSettingsPage,
        }),
      },
      {
        path: "/settings/extensions/:key",
        lazy: async () => ({ Component: (await import("@/modules/settings/ExtensionDetailPage")).ExtensionDetailPage }),
      },
      {
        path: "/settings/usage",
        lazy: async () => ({ Component: (await import("@/modules/settings/UsageSettingsPage")).UsageSettingsPage }),
      },
      {
        path: "/settings/account",
        lazy: async () => ({ Component: (await import("@/modules/settings/AccountSettingsPage")).AccountSettingsPage }),
      },
      // 古い URL。機能の一覧は設定の「機能」へ移した。issue #102
      { path: "/extensions", element: <LegacyRedirect to="/settings/extensions" /> },
      ...extensionRoutes,
    ],
  },
  ...(import.meta.env.DEV
    ? [
        {
          path: "/_components",
          lazy: async () => ({ Component: (await import("@/modules/dev/ComponentsPage")).ComponentsPage }),
        },
      ]
    : []),
  { path: "*", element: <NotFound /> },
];

/** アプリの道順 */
export const router = createBrowserRouter([{ errorElement: <RouteError />, children: routes }]);
