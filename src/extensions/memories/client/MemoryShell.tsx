import type { GroupSummary, Me } from "@shared/api-types";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { ApiError } from "@/api/client";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { useAppFrame } from "@/components/layout/AppShell";
import { LoadFailure } from "@/components/parts/Failure";
import { Empty } from "@/components/parts/Panel";
import { Segmented } from "@/components/parts/Segmented";
import { Button } from "@/components/ui/button";
import { useBack } from "@/lib/use-back";
import { poolColorsOf } from "@/modules/calendar/model";
import { dayIndexOf } from "../shared/days";
import type { MemoryDetail } from "../shared/types";
import { useMemory, useMemoryGroups } from "./api";
import { MemorySheet } from "./MemorySheet";
import { Ambient } from "./parts";

type Face = "shiori" | "day" | "album";
const FACES = [
  { value: "shiori", label: "しおり" },
  { value: "day", label: "1 日" },
  { value: "album", label: "アルバム" },
] as const;

/** 思い出の中の画面が受け取るもの */
export type ShellProps = { detail: MemoryDetail; me: Me; groups: GroupSummary[]; group: GroupSummary | undefined };

/**
 * 思い出の中の画面の枠。上の帯、しおり・1 日・アルバムの切り替え、表紙を広げた奥の色。0024
 * @param face いまの面
 * @param children 面の中身
 * @param side PC の右の列に置くもの
 */
export function MemoryShell({ face, children }: { face: Face; children: (p: ShellProps) => ReactNode }) {
  const { id = "" } = useParams();
  const me = useMe();
  const { groups, ready } = useMemoryGroups();
  const detail = useMemory(id);
  const navigate = useNavigate();
  const goBack = useBack("/memories");
  const [editing, setEditing] = useState(false);
  useAppFrame({ poolColors: poolColorsOf(groups, me.data) });

  if (!me.data || !ready || detail.isPending) return <Loading />;
  if (detail.error && !(detail.error instanceof ApiError && detail.error.status === 404)) {
    return <LoadFailure what="思い出" error={detail.error} onRetry={() => void detail.refetch()} />;
  }
  if (!detail.data) {
    return (
      <>
        <Empty>思い出が見つかりません。削除されたか、グループから抜けた可能性があります。</Empty>
        <Link to="/memories">思い出の一覧へ</Link>
      </>
    );
  }
  const data = detail.data;
  const group = groups.find((g) => g.id === data.memory.groupId);
  const go = (f: Face) => {
    if (f === "shiori") navigate(`/memories/${id}/shiori`, { replace: true });
    if (f === "album") navigate(`/memories/${id}/album`, { replace: true });
    if (f === "day") navigate(`/memories/${id}/days/${todayIndex(data)}`, { replace: true });
  };

  return (
    <>
      <Ambient photo={data.memory.cover} />
      <div className="flex w-full max-w-[760px] flex-col gap-3">
        <header className="glass flex min-h-[58px] items-center gap-1 rounded-full px-1.5 py-1.5">
          <Button asChild variant="ghost" size="icon">
            <Link to={goBack.to} aria-label="思い出の一覧へ戻る" onClick={goBack.onClick}>
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold">{data.memory.title}</h1>
          <Button variant="ghost" size="icon" aria-label="思い出を編集" onClick={() => setEditing(true)}>
            <MoreHorizontal className="size-5" />
          </Button>
        </header>
        <div className="glass rounded-full">
          <Segmented label="面" value={face} options={FACES} onChange={go} full />
        </div>
        {children({ detail: data, me: me.data, groups, group })}
      </div>
      {editing && <MemorySheet groups={groups} me={me.data} memory={data.memory} onClose={() => setEditing(false)} />}
    </>
  );
}

/** 1 日の面で最初に開く日。期間の中なら今日、前なら初日、後なら初日 */
export function todayIndex(detail: MemoryDetail): number {
  const now = Date.now();
  if (now < detail.memory.startsAt || now >= detail.memory.endsAt) return 0;
  return dayIndexOf(now, detail.memory);
}

/** `/memories/:id`。始まる前はしおりへ、期間の中は今日の 1 日へ、後は初日の 1 日へ移す */
export function MemoryRedirect() {
  const { id = "" } = useParams();
  const detail = useMemory(id);
  if (detail.isPending) return <Loading />;
  if (!detail.data) return <Navigate to="/memories" replace />;
  const before = Date.now() < detail.data.memory.startsAt;
  return (
    <Navigate to={before ? `/memories/${id}/shiori` : `/memories/${id}/days/${todayIndex(detail.data)}`} replace />
  );
}
