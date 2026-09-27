import { Navigate, useLocation } from "react-router";

/**
 * 古い URL から、新しい場所へ移す。検索条件と #(ハッシュ)は残す。issue #102
 * @param to 新しい場所
 */
export function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}
