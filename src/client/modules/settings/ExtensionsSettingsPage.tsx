import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { useGroups, useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { ExtensionTileGrid } from "@/components/parts/ExtensionTileGrid";
import { ScreenTour } from "@/components/parts/ScreenTour";
import { BASE_TOURS } from "@/lib/tours";
import { poolColorsOf } from "../calendar/model";
import { SettingsShell } from "./components/SettingsShell";

/**
 * 設定の「機能」。足した機能をアイコンのタイルで並べ、「+」から足す。F-24、0019、issue #145
 *
 * 中身はスマホの機能のシートと同じ ExtensionTileGrid。この画面は PC からと、
 * シートの「+」を経ずに直接 URL で開いたときの入口になる。
 */
export function ExtensionsSettingsPage() {
  const me = useMe();
  const groups = useGroups();
  const [params, setParams] = useSearchParams();

  // 近道などから、まだ足していない拡張の画面を開こうとして、ここへ来たとき。#110
  const off = params.get("off");
  useEffect(() => {
    if (!off) return;
    toast(`${off}はまだ足していません。下の「+」から足せます。`);
    setParams(
      (p) => {
        const q = new URLSearchParams(p);
        q.delete("off");
        return q;
      },
      { replace: true },
    );
  }, [off, setParams]);

  if (!me.data) return <Loading />;

  return (
    <SettingsShell title="機能" poolColors={poolColorsOf(groups.data ?? [], me.data)}>
      <ExtensionTileGrid />
      <ScreenTour id="extensions" steps={BASE_TOURS.extensions} />
    </SettingsShell>
  );
}
