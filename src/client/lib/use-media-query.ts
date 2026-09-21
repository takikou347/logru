import { useSyncExternalStore } from "react";

/**
 * メディアクエリに合っているかを返し、変わったら描き直す。
 * @param query 例は `(min-width: 1024px)`
 * @example const desktop = useMediaQuery("(min-width: 1024px)");
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
