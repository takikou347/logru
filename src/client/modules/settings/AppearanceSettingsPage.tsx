import type { BgTheme, Me, ThemeMode } from "@shared/api-types";
import { ACCENT_COLORS, GROUP_COLORS } from "@shared/colors";
import { useState } from "react";
import { useColorPref, useGroups, useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { ColorSheet } from "@/components/parts/ColorSheet";
import { ColorSwatches } from "@/components/parts/ColorSwatches";
import { Dot, FieldMessage, Panel, RowButton } from "@/components/parts/Panel";
import { Segmented } from "@/components/parts/Segmented";
import { groupColor, memberColor } from "@/lib/colors";
import { poolColorsOf } from "../calendar/model";
import { AvatarSection } from "./AvatarSection";
import { useUpdateSettings } from "./api";
import { LabSection } from "./components/LabSection";
import { SettingsShell } from "./components/SettingsShell";

const MODES = [
  { value: "system", label: "端末と同じ" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
] as const;

/** 背景のテーマ。明るさとは別の軸。#50 */
const BG_THEMES = [
  { value: "glass", label: "ガラス" },
  { value: "flat", label: "平ら" },
] as const;

type Target = { type: "group" | "user"; id: string; title: string; fallback: string };

/**
 * 設定の「見た目」。アバター、明るさ、背景のテーマ、テーマカラー、自分の色、グループとメンバーの色、ラボ。
 * F-13〜F-15、F-18、0038、0039、F-35。見た目の設定は、押した瞬間に画面に効かせてから送る。issue #102
 */
export function AppearanceSettingsPage() {
  const me = useMe();
  const groups = useGroups();
  const colorPref = useColorPref();
  const [target, setTarget] = useState<Target | null>(null);
  const settings = useUpdateSettings();

  if (!me.data) return <Loading />;
  const data = me.data;
  const s = data.settings;
  const prefs = data.colorPrefs;
  const list = groups.data ?? [];
  const shared = list.filter((g) => !g.isPersonal);
  const others = otherMembers(shared, data.user.id);
  const change = (patch: Partial<Me["settings"]>) => settings.mutate({ ...s, ...patch });
  const isCustom = (type: "group" | "user", id: string) =>
    prefs.some((p) => p.targetType === type && p.targetId === id);

  return (
    <SettingsShell title="見た目" poolColors={poolColorsOf(list, data)}>
      <AvatarSection me={data} />

      <Panel title="明るさ">
        <Segmented<ThemeMode>
          full
          label="明るさ"
          value={s.themeMode}
          options={MODES}
          onChange={(themeMode) => change({ themeMode })}
        />
      </Panel>

      <Panel title="背景のテーマ">
        <FieldMessage>ガラスは奥を透かします。平らは透かさず塗り、文字が読みやすくなります。</FieldMessage>
        <Segmented<BgTheme>
          full
          label="背景のテーマ"
          value={s.bgTheme}
          options={BG_THEMES}
          onChange={(bgTheme) => change({ bgTheme })}
        />
      </Panel>

      <Panel title="テーマカラー">
        <FieldMessage>主ボタンと今日の印に使います。</FieldMessage>
        <ColorSwatches
          label="テーマカラー"
          value={s.accentColor}
          options={ACCENT_COLORS}
          onChange={(accentColor) => change({ accentColor })}
        />
      </Panel>

      <Panel title="自分の色">
        <FieldMessage>
          カレンダーの「自分だけの予定」の色になります。グループのメンバーにも、この色で見えます。
        </FieldMessage>
        <ColorSwatches
          label="自分の色"
          value={s.userColor}
          options={GROUP_COLORS}
          onChange={(userColor) => change({ userColor })}
        />
      </Panel>

      {(shared.length > 0 || others.length > 0) && (
        <Panel title="グループとメンバーの色" aria-label="グループとメンバーの色">
          <FieldMessage>ほかの人の画面は変わりません。</FieldMessage>
          <div>
            {shared.map((g) => (
              <RowButton
                key={g.id}
                onClick={() => setTarget({ type: "group", id: g.id, title: `${g.name} の色`, fallback: g.color })}
              >
                <Dot color={groupColor(g, prefs)} className="size-3" />
                <span className="flex-1">{g.name}</span>
                <span className="text-xs text-ink-2">
                  {isCustom("group", g.id) ? "自分だけ変えた" : "グループの色のまま"}
                </span>
              </RowButton>
            ))}
            {others.map((o) => (
              <RowButton
                key={o.id}
                onClick={() => setTarget({ type: "user", id: o.id, title: `${o.name} の色`, fallback: o.userColor })}
              >
                <Dot color={memberColor(o.id, o.userColor, prefs)} className="size-3" />
                <span className="flex-1">{o.name}</span>
                <span className="text-xs text-ink-2">{o.groups.join("、")}のメンバー</span>
              </RowButton>
            ))}
          </div>
        </Panel>
      )}

      <LabSection />

      {target && (
        <ColorSheet
          title={target.title}
          value={prefs.find((p) => p.targetType === target.type && p.targetId === target.id)?.color ?? target.fallback}
          isCustom={isCustom(target.type, target.id)}
          onPick={(color) => colorPref.mutate({ type: target.type, id: target.id, color })}
          onReset={() => colorPref.mutate({ type: target.type, id: target.id, color: null })}
          onClose={() => setTarget(null)}
        />
      )}
    </SettingsShell>
  );
}

/**
 * 共有のグループのメンバーを、自分を除いて 1 人 1 行にまとめる。
 * 同じ人が複数のグループにいれば、グループの名前を並べる。
 */
function otherMembers(
  shared: { name: string; members: { id: string; name: string; userColor: string }[] }[],
  myId: string,
) {
  const others = new Map<string, { id: string; name: string; userColor: string; groups: string[] }>();
  for (const g of shared) {
    for (const m of g.members) {
      if (m.id === myId) continue;
      const cur = others.get(m.id) ?? { id: m.id, name: m.name, userColor: m.userColor, groups: [] };
      cur.groups.push(g.name);
      others.set(m.id, cur);
    }
  }
  return [...others.values()];
}
