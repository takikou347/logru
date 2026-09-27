import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Navigate } from "react-router";
import { useGroups, useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { FieldMessage, Panel } from "@/components/parts/Panel";
import { isLabEnabled } from "@/lib/lab";
import { LOOKS, type Look, useStoredLook } from "@/lib/look";
import { cn } from "@/lib/utils";
import { poolColorsOf } from "../calendar/model";
import { SettingsShell } from "./components/SettingsShell";

/**
 * 設定の「テーマ」。/settings/theme。0090、0095、F-43
 *
 * ラボの「新しい見た目」を入れた人だけに出す。入れていなければ設定・見た目へ戻す。
 * 紙・リキッドガラス・水・夜空・木・季節の 6 つの見本を並べ、押した瞬間に画面へ効かせる。
 * 選んだ値はこの端末だけに残る
 */
export function ThemeSettingsPage() {
  const me = useMe();
  const groups = useGroups();
  const [look, setLook] = useStoredLook();

  if (!me.data) return <Loading />;
  if (!me.data.showLab || !isLabEnabled("new-look")) return <Navigate to="/settings/appearance" replace />;

  return (
    <SettingsShell title="テーマ" poolColors={poolColorsOf(groups.data ?? [], me.data)} back="/settings/appearance">
      <Panel title="見た目の土台">
        <FieldMessage>
          画面の配置は変わりません。面の色と質感、背景、動きだけが変わります。選んだ見た目はこの端末に残ります。
        </FieldMessage>
        <RadioGroupPrimitive.Root
          value={look}
          onValueChange={(v) => setLook(v as Look)}
          aria-label="見た目の土台"
          className="grid grid-cols-2 gap-3"
        >
          {LOOKS.map((l) => (
            <RadioGroupPrimitive.Item
              key={l.value}
              value={l.value}
              aria-label={l.label}
              className={cn(
                "flex flex-col gap-2 rounded-2xl border-2 border-transparent p-2 text-left outline-none",
                "focus-visible:ring-2 focus-visible:ring-ink",
                "data-[state=checked]:border-ink",
              )}
            >
              <LookPreview look={l.value} />
              <span className="text-sm font-bold">{l.label}</span>
              <span className="text-xs text-ink-2">{l.description}</span>
            </RadioGroupPrimitive.Item>
          ))}
        </RadioGroupPrimitive.Root>
      </Panel>
    </SettingsShell>
  );
}

/**
 * 見本ごとの、選ぶための固定した見た目。実際のトークン(tokens.css)とは別に、ここだけの値で描く。
 * 6 つを並べて見比べられるよう、どれも同じ大きさ・同じ構図(地の色 + 面 + 2 本の帯)にする
 */
const PREVIEWS: Record<
  Look,
  { rounded: string; ground: string; surface: string; textStrong: string; textWeak: string }
> = {
  glass: {
    rounded: "rounded-3xl",
    ground: "bg-gradient-to-b from-[#d7dee6] to-[#c3ccd8]",
    surface: "border border-white/60 bg-gradient-to-b from-white/70 to-white/35 backdrop-blur-sm",
    textStrong: "bg-white/70",
    textWeak: "bg-white/45",
  },
  paper: {
    rounded: "rounded-[4px]",
    ground: "bg-[#efe6cf]",
    surface: "border border-[#e4d7b8] bg-[#f6eeda]",
    textStrong: "bg-[#8a7a60]/50",
    textWeak: "bg-[#8a7a60]/30",
  },
  water: {
    rounded: "rounded-[26px]",
    ground: "bg-gradient-to-b from-[#e4f4f5] to-[#93c9d1]",
    surface: "border border-white/70 bg-gradient-to-b from-white/60 to-white/25",
    textStrong: "bg-[#0f2c33]/55",
    textWeak: "bg-[#0f2c33]/30",
  },
  night: {
    rounded: "rounded-3xl",
    ground: "bg-gradient-to-b from-[#05060d] to-[#131a30]",
    surface: "border border-white/15 bg-[#12162a]/85",
    textStrong: "bg-white/70",
    textWeak: "bg-white/40",
  },
  wood: {
    rounded: "rounded-[6px]",
    ground: "bg-gradient-to-b from-[#ecd7ab] to-[#d8b378]",
    surface: "border border-[#2b1a0c]/20 bg-[#f1e2bd]",
    textStrong: "bg-[#2b1a0c]/55",
    textWeak: "bg-[#2b1a0c]/30",
  },
  season: {
    rounded: "rounded-[6px]",
    ground: "bg-gradient-to-b from-[#f8e3ea] to-[#f3ece1]",
    surface: "border border-[#241f1a]/15 bg-[#faf5ec]",
    textStrong: "bg-[#d9577a]/70",
    textWeak: "bg-[#241f1a]/25",
  },
};

function LookPreview({ look }: { look: Look }) {
  const p = PREVIEWS[look];
  return (
    <div
      className={cn(
        "flex h-20 flex-col justify-end gap-1.5 p-3 shadow-[0_1px_3px_rgba(23,32,44,0.18)]",
        p.rounded,
        p.ground,
      )}
      aria-hidden="true"
    >
      <div className={cn("flex flex-col gap-1.5 rounded-[10px] p-2", p.surface)}>
        <span className={cn("h-2 w-10 rounded-full", p.textStrong)} />
        <span className={cn("h-2 w-16 rounded-full", p.textWeak)} />
      </div>
    </div>
  );
}
