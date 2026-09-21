import { createBrowserRouter, type RouteObject } from "react-router";
import { Agree } from "./routes/Agree";
import { Invite } from "./routes/Invite";
import { Login } from "./routes/Login";
import { NotFound } from "./routes/NotFound";
import { GuestOnly, RequireAuth } from "./routes/RequireAuth";
import { ResetPassword } from "./routes/ResetPassword";
import { Signup } from "./routes/Signup";
import { Verify } from "./routes/Verify";

const devOnly: RouteObject[] = import.meta.env.DEV
  ? [{ path: "/_components", lazy: async () => ({ Component: (await import("./routes/Components")).Components }) }]
  : [];

// 規約の画面は Markdown の変換を使うので、開いたときに読む
async function legal(doc: "terms" | "privacy") {
  const { Legal } = await import("./routes/Legal");
  return { element: <Legal doc={doc} /> };
}

export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: "/login", element: <Login /> },
      { path: "/signup", element: <Signup /> },
    ],
  },
  { path: "/verify", element: <Verify /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/terms", lazy: () => legal("terms") },
  { path: "/privacy", lazy: () => legal("privacy") },
  { path: "/invite/:token", element: <Invite /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/agree", element: <Agree /> },
      { path: "/", lazy: async () => ({ Component: (await import("./routes/Calendar")).Calendar }) },
      { path: "/groups", lazy: async () => ({ Component: (await import("./routes/Groups")).Groups }) },
      { path: "/groups/:id", lazy: async () => ({ Component: (await import("./routes/GroupDetail")).GroupDetail }) },
      { path: "/settings", lazy: async () => ({ Component: (await import("./routes/Settings")).Settings }) },
    ],
  },
  ...devOnly,
  { path: "*", element: <NotFound /> },
]);
