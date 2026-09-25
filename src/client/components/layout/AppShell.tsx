import { CalendarDays, SlidersHorizontal, Users } from "lucide-react";
import { createContext, type ReactNode, useContext, useLayoutEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useMe } from "@/api/common";
import { OfflineBand } from "@/components/parts/Failure";
import { useEnabledExtensions } from "@/lib/extensions";
import { useApplyLabExperiments } from "@/lib/lab";
import { cn } from "@/lib/utils";
import { Pools } from "../parts/Pools";
import { ShortcutBand } from "../parts/ShortcutBand";
import { ScrollArea } from "../ui/scroll-area";
import { AccountMenu, navItem } from "./AppLayout";

/** 画面が AppShell に伝える、外枠へ映す値。0071 */
type AppFrame = {
  poolColors: string[];
  poolFocus?: number | null;
  side?: ReactNode;
};

const emptyFrame: AppFrame = { poolColors: [] };

const SetAppFrameContext = createContext<((frame: AppFrame) => void) | null>(null);

/**
 * ログイン後の画面が、外枠(インクだまりの色、PC の左の列に足すもの)を AppShell へ伝える。
 * 画面を移っても外枠(Pools、aside のガラスの面)を作り直さないよう、AppShell を
 * ログイン後の画面の親のルートに 1 つだけ置き、各画面は値だけをここで渡す。0071
 *
 * `useLayoutEffect` を使うのは、色や side が 1 描画分でも初期値(既定の色、空)のまま
 * 塗られてちらつかないようにするため。
 *
 * @param poolColors インクだまりの 3 色
 * @param poolFocus 膨らませる色の番号
 * @param side PC の左の列に足すもの。カレンダーはグループの絞り込みを置く。多いときは、この欄だけが流れる。F-25
 */
export function useAppFrame({ poolColors, poolFocus, side }: AppFrame) {
  const setFrame = useContext(SetAppFrameContext);
  useLayoutEffect(() => {
    setFrame?.({ poolColors, poolFocus, side });
    // 画面を離れるとき既定へ戻す。次の画面が呼び忘れても、前の画面の色や side が残らないようにする
    return () => setFrame?.(emptyFrame);
  }, [setFrame, poolColors, poolFocus, side]);
}

/**
 * ログインした後の画面が共通で使う外枠。スマホは縦に積み、1024px 以上は左にメニューの列を置く。
 *
 * 画面ごとに作り直さないよう、ログイン後の画面を束ねる親のルートに 1 つだけ置く。中身は
 * `<Outlet />` が描き、各画面は `useAppFrame` で色や side を渡すだけになる。0071
 */
export function AppShell() {
  const navs = useEnabledExtensions().flatMap((x) => (x.nav ? [x.nav] : []));
  const [frame, setFrame] = useState<AppFrame>(emptyFrame);
  // ログインした画面はすべてこの枠を通るので、ここで 1 か所、ラボの入り切りを掛け直す。0039、F-35
  const me = useMe();
  useApplyLabExperiments(me.data?.showLab);
  return (
    <SetAppFrameContext.Provider value={setFrame}>
      <main
        className={cn(
          "mx-auto flex min-h-dvh max-w-[560px] flex-col gap-3 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[var(--dock-clearance)]",
          "lg:m-0 lg:grid lg:max-w-none lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start lg:gap-4 lg:p-4",
        )}
      >
        <Pools colors={frame.poolColors} focus={frame.poolFocus} />
        <aside
          className="glass sticky top-4 hidden h-[calc(100dvh-32px)] flex-col gap-3 rounded-panel px-3.5 py-5.5 lg:flex"
          aria-label="メニュー"
        >
          <div className="pl-2 text-[32px] leading-none font-extrabold tracking-[-0.03em]">Logru</div>
          <nav aria-label="画面">
            <NavLink className={navItem} to="/" end>
              <CalendarDays className="size-4" aria-hidden="true" />
              カレンダー
            </NavLink>
            {navs.slice(0, 6).map((n) => (
              <NavLink key={n.path} className={navItem} to={n.path}>
                <n.icon className="size-4" aria-hidden="true" />
                {n.label}
              </NavLink>
            ))}
            <NavLink className={navItem} to="/groups">
              <Users className="size-4" aria-hidden="true" />
              グループ
            </NavLink>
            {/* 設定の目次(SettingsToc)にも「機能」があり、同じ行き先を選ばれた色で二重に見せないよう、
                ここは NavLink ではなく Link にして「いま開いている場所」の印を持たせない。issue #13 */}
            <Link className={cn(navItem, "min-h-9 text-xs text-ink-2")} to="/settings/extensions">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              機能を足す、外す
            </Link>
          </nav>
          <ShortcutBand compact />
          {frame.side ? (
            <ScrollArea className="min-h-0 flex-1 -mr-1.5">{frame.side}</ScrollArea>
          ) : (
            <div className="flex-1" />
          )}
          <div className="border-t border-line pt-2">
            <AccountMenu wide />
          </div>
        </aside>
        {/*
          オフラインの帯は、中身の最初にある上の帯のすぐ下に並べる。0025
          ほかの中身は order を 0 のままにする。display: contents の孫も 0 で並ぶため
        */}
        <div className="flex min-w-0 flex-col gap-3 *:first:-order-2">
          <Outlet />
          <OfflineBand className="-order-1" />
        </div>
      </main>
    </SetAppFrameContext.Provider>
  );
}
