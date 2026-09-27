import type { AttendeeResponse, GroupSummary, Me } from "@shared/api-types";
import { useState } from "react";
import { memberColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

/** 頭文字の丸、または置いた写真に出す人。#40 */
export type AvatarPerson = {
  id: string;
  name: string;
  color: string;
  response?: AttendeeResponse;
  /** 置いた写真の URL。頭文字を選んでいるか、写真が無ければ null か undefined */
  avatarUrl?: string | null;
};

/** 名前の頭の 1 文字。絵文字や合字を割らないよう、書記素で切る */
function initialOf(name: string): string {
  const seg = new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(name.trim())[Symbol.iterator]().next();
  return seg.done ? "?" : seg.value.segment.toUpperCase();
}

/**
 * 人のアバターの丸。頭文字を選んでいれば色付きの丸、写真を選んでいれば同じ大きさの丸い写真。#28、#40
 * 返事待ちは塗らずに枠線だけ、参加しないは薄くする。カレンダーの予定の見た目と同じ決まり。
 * 置いた写真は、色の枠で囲まない。頭文字の丸と同じ大きさの丸に出すだけ。
 * @param size 丸の直径。px
 */
export function InitialAvatar({
  person,
  size = 22,
  className,
}: {
  person: AvatarPerson;
  size?: number;
  className?: string;
}) {
  const pending = person.response === "pending";
  // 読めなかった URL(相手が消した後の古い URL、期限切れなど)は、壊れた画像を出さず頭文字に戻す。
  // URL が変われば(置き直しなど)、レンダー中に broken を作り直す。React の「props からきた state」の作法
  const [broken, setBroken] = useState({ url: person.avatarUrl, isBroken: false });
  if (broken.url !== person.avatarUrl) setBroken({ url: person.avatarUrl, isBroken: false });
  if (person.avatarUrl && !broken.isBroken) {
    return (
      <img
        src={person.avatarUrl}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onError={() => setBroken({ url: person.avatarUrl, isBroken: true })}
        className={cn(
          "inline-block flex-none rounded-full object-cover leading-none",
          pending && "shadow-[inset_0_0_0_1.5px_var(--ink-2)]",
          person.response === "declined" && "opacity-45",
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full leading-none font-bold",
        `c-${person.color}`,
        pending ? "bg-(--glass-flat) text-ink shadow-[inset_0_0_0_1.5px_var(--c)]" : "bg-(--c) text-[#17202c]",
        person.response === "declined" && "opacity-45",
        className,
      )}
    >
      {initialOf(person.name)}
    </span>
  );
}

/**
 * 頭文字の丸を少しずつ重ねて並べる。入りきらない人は「+n」にまとめる。#28
 * 丸の縁は、下の面の色で切って重なりを見せる。
 * @param max 丸で出す人数。超えた分は「+n」
 */
export function AvatarStack({
  people,
  max = 4,
  size = 18,
  className,
}: {
  people: AvatarPerson[];
  max?: number;
  size?: number;
  className?: string;
}) {
  const shown = people.slice(0, Math.max(0, max));
  const rest = people.length - shown.length;
  const ring = "shadow-[0_0_0_1.5px_var(--glass-flat)]";
  return (
    <span className={cn("inline-flex flex-none items-center", className)} aria-hidden="true">
      {shown.map((p, i) => (
        <InitialAvatar
          key={p.id}
          person={p}
          size={size}
          className={cn(
            ring,
            i > 0 && "-ml-1.5",
            p.response === "pending" && "shadow-[inset_0_0_0_1.5px_var(--c),0_0_0_1.5px_var(--glass-flat)]",
          )}
        />
      ))}
      {rest > 0 && (
        <span
          style={{ height: size, minWidth: size, fontSize: Math.round(size * 0.5) }}
          className={cn(
            "-ml-1.5 inline-flex flex-none items-center justify-center rounded-full bg-field-strong px-1 leading-none font-bold text-ink-2",
            ring,
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

/**
 * 人の ID から、名前・色・アイコンの URL を引く。この 1 か所だけで決める。#152、0064
 * 自分は me から直に引く。ほかの人は、入っているグループのメンバーの一覧から探す。
 * どのグループにもいない人(抜けた後など)は、名前も色も分からないので、灰色の頭文字に戻す。
 */
export function personOf(userId: string, groups: GroupSummary[], me: Me, response?: AttendeeResponse): AvatarPerson {
  if (userId === me.user.id) {
    return { id: userId, name: me.user.name, color: me.settings.userColor, avatarUrl: me.user.avatarUrl, response };
  }
  for (const g of groups) {
    const m = g.members.find((x) => x.id === userId);
    if (m)
      return {
        id: userId,
        name: m.name,
        color: memberColor(userId, m.userColor, me.colorPrefs),
        avatarUrl: m.avatarUrl,
        response,
      };
  }
  return { id: userId, name: "退会した人", color: "nezumi", avatarUrl: null, response };
}

/**
 * 人の ID を渡すだけで出すアバターの丸。名前・色・アイコンの URL は personOf が引く。#152、0064
 * InitialAvatar を直に使わず、これを使う。
 * @param groups 入っているグループ。自分だけを出すときは省いてよい
 */
export function UserAvatar({
  userId,
  groups = [],
  me,
  response,
  size,
  className,
}: {
  userId: string;
  groups?: GroupSummary[];
  me: Me;
  response?: AttendeeResponse;
  size?: number;
  className?: string;
}) {
  return <InitialAvatar person={personOf(userId, groups, me, response)} size={size} className={className} />;
}

/**
 * 人の ID の配列を渡すだけで、重ねて並べる。名前・色・アイコンの URL は personOf が引く。#152、0064
 * AvatarStack を直に使わず、これを使う。
 */
export function UserAvatarStack({
  userIds,
  groups = [],
  me,
  max,
  size,
  className,
}: {
  userIds: string[];
  groups?: GroupSummary[];
  me: Me;
  max?: number;
  size?: number;
  className?: string;
}) {
  const people = userIds.map((id) => personOf(id, groups, me));
  return <AvatarStack people={people} max={max} size={size} className={className} />;
}
