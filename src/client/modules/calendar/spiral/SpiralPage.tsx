import { ChevronLeft, ChevronRight, Grid3x3, X } from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useGroups, useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { LoadFailure } from "@/components/parts/Failure";
import { Button } from "@/components/ui/button";
import { dateKey } from "@/lib/dates";
import { useMediaQuery } from "@/lib/use-media-query";
import { decorate } from "../model";
import { useYearCalendar } from "./api";
import { FlatYear } from "./FlatYear";
import { summarizeDays } from "./summarize";
import { REDUCED_MOTION_QUERY, supportsWebGL } from "./support";
import { daysInYear } from "./year-range";

type ScenePropsShape = { summaries: ReturnType<typeof summarizeDays>; onPressDay: (date: Date) => void };

/**
 * 1 年を 3D のらせんで見る画面。F-39、0051
 *
 * 月の表の年の数字から開く。日ごとに予定の色の点と、ひとコマの小さな写真をらせんに並べる。
 * WebGL が使えない端末と、動きを減らす設定の端末では、平らな年の表にする。
 * three.js を使う本体は、3D で描けるときだけ動的 import する。
 */
export function SpiralPage() {
  const params = useParams();
  const navigate = useNavigate();
  const year = Number(params.year);
  const validYear = Number.isFinite(year) ? year : new Date().getFullYear();

  const me = useMe();
  const groups = useGroups();
  const { items, isLoading, isError } = useYearCalendar(validYear);

  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const webgl = useMemo(() => supportsWebGL(), []);
  const [flat, setFlat] = useState(reducedMotion || !webgl);
  // 動きを減らす設定に途中で変わったら、平らな表へ切り替える
  useEffect(() => {
    if (reducedMotion) setFlat(true);
  }, [reducedMotion]);

  const [Scene, setScene] = useState<ComponentType<ScenePropsShape> | null>(null);
  const want3D = webgl && !flat;
  useEffect(() => {
    if (!want3D) return;
    let cancelled = false;
    import("./SpiralScene").then((m) => {
      if (!cancelled) setScene(() => m.SpiralScene as ComponentType<ScenePropsShape>);
    });
    return () => {
      cancelled = true;
    };
  }, [want3D]);

  const days = useMemo(() => daysInYear(validYear), [validYear]);
  const decorated = useMemo(
    () => (me.data ? decorate(items, groups.data ?? [], me.data) : []),
    [items, groups.data, me.data],
  );
  const summaries = useMemo(() => summarizeDays(days, decorated), [days, decorated]);

  const onPressDay = (date: Date) => navigate(`/?date=${dateKey(date)}&view=day`);

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "var(--ground)" }}>
      <header className="glass m-3 flex items-center gap-2 rounded-panel px-3 py-2">
        <Button variant="ghost" size="icon" aria-label="カレンダーへ戻る" onClick={() => navigate("/")}>
          <X className="size-5" />
        </Button>
        <div className="flex flex-1 items-center justify-center gap-1">
          <Button variant="ghost" size="icon" aria-label="前の年" asChild>
            <Link to={`/spiral/${validYear - 1}`}>
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
          <span className="w-16 text-center text-[20px] font-bold">{validYear}</span>
          <Button variant="ghost" size="icon" aria-label="次の年" asChild>
            <Link to={`/spiral/${validYear + 1}`}>
              <ChevronRight className="size-5" />
            </Link>
          </Button>
        </div>
        {webgl && !reducedMotion && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={flat ? "らせんで見る" : "平らな表で見る"}
            aria-pressed={flat}
            onClick={() => setFlat((f) => !f)}
          >
            <Grid3x3 className="size-5" />
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1">
        {isLoading && !isError ? (
          <Loading>1 年ぶんを読み込んでいます</Loading>
        ) : isError ? (
          <LoadFailure
            what="1 年のらせん"
            error={new Error("読み込みに失敗しました")}
            onRetry={() => location.reload()}
          />
        ) : want3D && Scene ? (
          <Scene summaries={summaries} onPressDay={onPressDay} />
        ) : (
          <FlatYear year={validYear} summaries={summaries} today={new Date()} />
        )}
      </div>
    </div>
  );
}
