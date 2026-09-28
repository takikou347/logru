/**
 * data の有無だけで、読み込み中・失敗・中身を出し分ける。0078
 *
 * 月やグループを移るたびに `useQuery` のキーが変わっても、`placeholderData` で前の中身を
 * 持たせておけば `data` は空にならない。この部品は data が届いていないときだけ骨組みか
 * 失敗の面を出すので、両方が同時に出ることはない。60dvh の全面の `Loading` は使わない。
 *
 * 前の中身を出している間に裏で読み直しているときは、面の隅に小さく回る印(`RefreshingMark`)を
 * 添える。前の中身は薄くしない。ちらつかないよう、読み直しが 300ms ほど続いたときだけ出す。0078、#249
 */
import { RefreshCw } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LoadFailure } from "./Failure";

/** `useQuery`、`useQueries` を包んだ hook が持つべき最小限の形 */
export type LoadableQuery<T> = {
  data: T | undefined;
  error: Error | null;
  isPending: boolean;
  /** 前の中身を出したまま裏で読み直しているか。無ければ出さない(既存の呼び出し側を壊さない)。#249 */
  isFetching?: boolean;
  refetch: () => void;
};

/**
 * @param what 読めなかったときに出す名前。例は「家計簿」
 * @param skeleton 読み込み中に、面の中に出す小さな骨組み
 * @param children data が届いてから呼ぶ
 */
export function LoadableSection<T>({
  query,
  what,
  skeleton,
  children,
}: {
  query: LoadableQuery<T>;
  what: string;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) {
    return (
      <div className="relative">
        {children(query.data)}
        <RefreshingMark active={query.isFetching ?? false} />
      </div>
    );
  }
  if (query.isPending) return <>{skeleton}</>;
  return (
    <LoadFailure
      what={what}
      error={query.error ?? new Error("読み込めませんでした。")}
      onRetry={() => query.refetch()}
    />
  );
}

/**
 * 前の中身を出したまま裏で読み直していることを示す、小さく回る印。面の見出しの右の隅に添える。0078、#249
 *
 * 短い読み込みでちらつかないよう、`active` が 300ms ほど続いたときだけ出す。動きを減らす設定
 * (prefers-reduced-motion)では回さない。点滅にもせず、静止の印のまま出す。
 */
function RefreshingMark({ active }: { active: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(timer);
  }, [active]);
  if (!show) return null;
  return (
    <RefreshCw
      aria-hidden="true"
      data-testid="loadable-refreshing"
      className={cn(
        "pointer-events-none absolute top-3.5 right-4 size-3.5 animate-spin text-ink-3",
        "motion-reduce:animate-none",
      )}
    />
  );
}

/** 薄い面。光が流れる表現(シマー)は使わない。動くのは opacity のパルスだけ。0044、0048、#98 */
function Block({ width }: { width: string }) {
  return <div aria-hidden="true" className="h-4 animate-pulse rounded-md bg-field" style={{ width }} />;
}

/**
 * 面の骨組み。ガラスの `Panel` と同じ枠で、中に薄い帯を並べる。60dvh の `Loading` の代わりに、
 * 読み込み中の面だけをこれに替える。0078
 * @param lines 帯の数。既定は 3
 */
export function PanelSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-label="読み込んでいます"
      className={cn("glass flex flex-col gap-2.5 rounded-3xl px-4 py-3.5", className)}
    >
      {Array.from({ length: lines }, (_, i) => (
        <Block key={i} width={`${100 - Math.min(i * 18, 60)}%`} />
      ))}
    </div>
  );
}
