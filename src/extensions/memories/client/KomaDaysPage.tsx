import { Camera, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar } from "@/components/AppLayout";
import { LoadFailure } from "@/components/Failure";
import { Dot, Empty } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { groupColor } from "@/lib/colors";
import { useMe } from "@/lib/queries";
import { poolColorsOf } from "@/modules/calendar/model";
import { startOfDayIn } from "../shared/days";
import type { KomaDay, MemoryRecord } from "../shared/types";
import { useMemoryGroups } from "./api";
import { deviceTimeZone, useKomaDays, useKomaNow } from "./koma-api";
import { KomaLinkSheet } from "./KomaLinkSheet";
import { KomaStrip } from "./KomaStrip";
import { Dock } from "./Dock";
import { RecordSheet } from "./RecordSheet";

/**
 * ひとコマの確認。自分のひとコマを日ごとに新しい順で並べる。F-128
 * 日ごとに、つないだグループと思い出をチップで出し、押すとつなぎ直せる。F-129
 * 思い出の題名を押すと、その思い出の 1 日へ移る。写真を押すと、一言を直すか消せる。
 */
export function KomaDaysPage() {
  const me = useMe();
  const { groups, ready } = useMemoryGroups();
  const days = useKomaDays();
  const now = useKomaNow();
  const navigate = useNavigate();
  const [linking, setLinking] = useState<KomaDay | "today" | null>(null);
  const [editing, setEditing] = useState<MemoryRecord | null>(null);

  if (!me.data || !ready || days.isPending) return <Loading />;
  const data = me.data;
  const list = days.data ?? [];
  const today = now.data?.day;
  const startedToday = now.data?.started;

  return (
    <AppLayout poolColors={poolColorsOf(groups, data)}>
      <Page>
        <PageBar title="ひとコマ" back="/memories" />
        {days.error && <LoadFailure what="ひとコマ" error={days.error} onRetry={() => void days.refetch()} />}
        {!startedToday && now.data && (
          <section className="glass flex flex-col gap-3 rounded-3xl p-4">
            <p className="text-sm leading-relaxed">思い出がない日でも、1 時間に 1 枚ずつ写真を撮って 1 日を残せます。</p>
            <Button onClick={() => setLinking("today")}>今日のひとコマを始める</Button>
          </section>
        )}
        {list.length === 0 && <Empty>まだひとコマはありません。</Empty>}
        {list.map((d) => {
          const group = groups.find((g) => g.id === d.groupId);
          const label = `${d.day.slice(5).replace("-", ".")} ${new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "UTC" }).format(Date.parse(d.day))}`;
          return (
            <KomaStrip
              key={d.day}
              dayStart={startOfDayIn(d.day, d.timeZone)}
              timeZone={d.timeZone}
              records={d.records}
              title={label}
              nowPath={d.day === today ? "/memories/koma/now" : undefined}
              onOpen={setEditing}
              header={
                <span className="flex min-w-0 items-center gap-1.5">
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-(--glass-edge) bg-field pr-2 pl-2.5 text-xs font-bold"
                    aria-label={`${label} の共有先と思い出を変える`}
                    onClick={() => setLinking(d)}
                  >
                    {group && <Dot color={groupColor(group, data.colorPrefs)} />}
                    {d.memory ? d.memory.title : `${group?.isPersonal ? "自分だけ" : (group?.name ?? "")}・思い出を選ぶ`}
                    <ChevronRight className="size-3.5 text-ink-3" aria-hidden="true" />
                  </button>
                  {d.memory && (
                    <Link to={`/memories/${d.memory.id}/days/${d.memory.dayIndex}`} className="text-[11px] text-ink-2">
                      思い出を開く
                    </Link>
                  )}
                </span>
              }
            />
          );
        })}
        {startedToday && now.data?.open[0] && (
          <Dock label="ひとコマの操作">
            <Button onClick={() => navigate("/memories/koma/now")}>
              <Camera className="size-5" />
              {now.data.open[0].hour} 時のひとコマを{now.data.taken ? "撮り直す" : "撮る"}
            </Button>
          </Dock>
        )}
      </Page>
      {linking === "today" && today && <KomaLinkSheet day={today} groups={groups} me={data} onClose={() => setLinking(null)} />}
      {linking && linking !== "today" && (
        <KomaLinkSheet
          day={linking.day}
          groups={groups}
          me={data}
          current={{ groupId: linking.groupId, memoryId: linking.memory?.id ?? null, timeZone: linking.timeZone ?? deviceTimeZone() }}
          onClose={() => setLinking(null)}
        />
      )}
      {editing && <RecordSheet groups={groups} me={data} record={editing} onClose={() => setEditing(null)} />}
    </AppLayout>
  );
}
