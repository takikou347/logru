import { createBrowserRouter, type RouteObject } from "react-router";
import { Agree } from "./routes/Agree";
import { Invite } from "./routes/Invite";
import { Legal } from "./routes/Legal";
import { Login } from "./routes/Login";
import { NotFound } from "./routes/NotFound";
import { GuestOnly, RequireAuth } from "./routes/RequireAuth";
import { ResetPassword } from "./routes/ResetPassword";
import { Signup } from "./routes/Signup";
import { Verify } from "./routes/Verify";

const devOnly: RouteObject[] = import.meta.env.DEV
  ? [{ path: "/_components", lazy: async () => ({ Component: (await import("./routes/Components")).Components }) }]
  : [];

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
  { path: "/terms", element: <Legal doc="terms" /> },
  { path: "/privacy", element: <Legal doc="privacy" /> },
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
