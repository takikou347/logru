import { ACCENT_COLORS, GROUP_COLORS } from "@shared/colors";
import { Camera, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/parts/Chip";
import { ColorSwatches } from "@/components/parts/ColorSwatches";
import { EmptyState } from "@/components/parts/EmptyState";
import { Field } from "@/components/parts/Field";
import type { MascotPose } from "@/components/parts/Mascot";
import { Dot, Empty, Panel, PanelRow } from "@/components/parts/Panel";
import { Pools } from "@/components/parts/Pools";
import { Segmented } from "@/components/parts/Segmented";
import { ShortcutLink } from "@/components/parts/ShortcutBand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

/** 部品見本。開発のときだけ `/_components` に出す */
export function ComponentsPage() {
  const [toggle, setToggle] = useState(true);
  const [seg, setSeg] = useState<"month" | "week" | "day">("month");
  const [color, setColor] = useState("wakatake");
  const [accent, setAccent] = useState("aizumi");
  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-3 p-4">
      <Pools colors={["wakatake", "yamabuki", "asagi"]} />
      <h1 className="text-[32px] font-extrabold">部品見本</h1>
      <Panel title="ボタン">
        <div className="flex flex-wrap gap-2">
          <Button>
            <Plus className="size-5" />
            予定を足す
          </Button>
          <Button variant="secondary">招待リンクを作る</Button>
          <Button variant="ghost">やめる</Button>
          <Button variant="danger">予定を消す</Button>
          <Button variant="destructive">アカウントを消す</Button>
          <Button disabled>使えない</Button>
        </div>
      </Panel>
      <Panel title="入力">
        <Field label="題名" hint="例: 歯医者">
          {(p) => <Input {...p} placeholder="例: 歯医者" />}
        </Field>
        <Field label="題名" error="題名を入れてください。">
          {(p) => <Input {...p} />}
        </Field>
      </Panel>
      <Panel title="切り替え">
        <div className="flex flex-wrap gap-2">
          <Chip aria-pressed>すべて</Chip>
          <Chip aria-pressed={false}>
            <Dot color="yamabuki" />
            ふたり
          </Chip>
        </div>
        <Segmented
          label="表示の単位"
          value={seg}
          onChange={setSeg}
          options={[
            { value: "month", label: "月" },
            { value: "week", label: "週" },
            { value: "day", label: "日" },
          ]}
        />
        <PanelRow>
          終日
          <Switch checked={toggle} onCheckedChange={setToggle} aria-label="終日" />
        </PanelRow>
      </Panel>
      <Panel title="色">
        <ColorSwatches label="グループの色" value={color} onChange={setColor} options={GROUP_COLORS} />
        <ColorSwatches label="テーマカラー" value={accent} onChange={setAccent} options={ACCENT_COLORS} />
      </Panel>
      <Panel title="流れる欄と近道">
        <ScrollArea orientation="horizontal" viewportClassName="pb-1.5">
          <div className="flex w-max gap-2">
            {["すべて", "自分だけ", "ふたり", "実家", "大学の友人", "フットサル", "町内会", "読書会"].map((n) => (
              <Chip key={n} aria-pressed={n === "すべて"}>
                {n}
              </Chip>
            ))}
          </div>
        </ScrollArea>
        <ScrollArea className="h-32 rounded-2xl border border-line">
          <ul className="p-3 text-sm leading-8">
            {Array.from({ length: 10 }, (_, i) => (
              <li key={i}>グループ {i + 1}</li>
            ))}
          </ul>
        </ScrollArea>
        <ShortcutLink
          shortcut={{
            label: "14 時のひとコマ",
            sub: "箱根 1 泊・15:00 まで残せる",
            path: "/_components",
            action: "撮る",
            icon: Camera,
          }}
        />
      </Panel>
      <Panel title="知らせと空の状態">
        <Button variant="secondary" className="self-start" onClick={() => toast("予定を保存しました")}>
          知らせを出す
        </Button>
        <Empty>
          足せる拡張はまだありません。
          <br />
          予定はいつも使えます。
        </Empty>
      </Panel>
      <Panel title="マスコット">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {(["calendar", "camera", "coin", "compass", "bell", "search"] as MascotPose[]).map((pose) => (
            <EmptyState key={pose} pose={pose} action={{ label: "試す", onClick: () => toast(pose) }}>
              {pose}
            </EmptyState>
          ))}
        </div>
      </Panel>
    </main>
  );
}
