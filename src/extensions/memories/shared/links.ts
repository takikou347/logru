/**
 * 予定がどの思い出に入るかを決める。0020
 *
 * 思い出には、期間に重なる同じグループの予定が自動で入る。外した予定は入らない。
 * 同じ期間に思い出が 2 つあれば、始まりが早い方に入る。同じなら ID の順。予定は 1 つの思い出にだけ入る。
 */

type EventLike = { id: string; groupId: string; startsAt: number; endsAt: number | null };
type MemoryLike = { id: string; groupId: string; startsAt: number; endsAt: number; excludedEventIds: string[] };

/** 予定が思い出の期間に重なるか。終わりの無い予定は、始まりの時刻だけで見る */
export function overlaps(event: EventLike, memory: Pick<MemoryLike, "startsAt" | "endsAt">): boolean {
  const end = event.endsAt ?? event.startsAt + 1;
  return event.startsAt < memory.endsAt && end > memory.startsAt;
}

/** 予定に重なる、同じグループの思い出。始まりの早い順 */
export function candidatesOf<M extends MemoryLike>(event: EventLike, memories: M[]): M[] {
  return memories
    .filter((m) => m.groupId === event.groupId && overlaps(event, m))
    .sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id));
}

/** 予定が入る思い出。どれにも入らなければ undefined */
export function memoryOfEvent<M extends MemoryLike>(event: EventLike, memories: M[]): M | undefined {
  return candidatesOf(event, memories).find((m) => !m.excludedEventIds.includes(event.id));
}
