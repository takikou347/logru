import type { AttendeeResponse } from "@shared/api-types";
import { Check, X } from "lucide-react";
import { type AvatarPerson, InitialAvatar } from "@/components/parts/Avatars";
import { Chip } from "@/components/parts/Chip";
import { FieldMessage } from "@/components/parts/Panel";
import { cn } from "@/lib/utils";

/** 返事の言葉。参加者の一覧に出す */
const RESPONSE_LABEL: Record<AttendeeResponse, string> = {
  accepted: "参加する",
  pending: "返事待ち",
  declined: "参加しない",
};

/**
 * 招待された人がシートを開いたときに、いちばん上に出す返事の欄。#28
 *
 * 返事待ちの間は、カレンダーの予定と同じく、グループの色の枠線で囲む。
 * 「参加する」を返すと、グループの色を薄く塗る。「参加しない」なら塗らない。返事は何度でも変えられる。
 *
 * @param color 予定のグループの色の名前
 * @param inviter 予定を作った人。分からなければ null
 * @param onRespond 返事を押したとき。送り終わるまで押せなくする
 */
export function RsvpBar({
  color,
  inviter,
  response,
  busy,
  onRespond,
}: {
  color: string;
  inviter: AvatarPerson | null;
  response: AttendeeResponse;
  busy: boolean;
  onRespond: (r: "accepted" | "declined") => void;
}) {
  return (
    <section
      aria-label="招待への返事"
      data-response={response}
      className={cn(
        "flex flex-col gap-2.5 rounded-2xl px-3.5 py-3 transition-colors motion-reduce:transition-none",
        `c-${color}`,
        response === "pending" && "shadow-[inset_0_0_0_1.5px_var(--c)]",
        response === "accepted" && "bg-[color-mix(in_srgb,var(--c)_16%,transparent)]",
        response === "declined" && "bg-field",
      )}
    >
      <div className="flex items-center gap-2.5">
        {inviter && <InitialAvatar person={inviter} size={28} />}
        <p className="text-[13px] leading-snug">
          <span className="font-bold">{inviter ? `${inviter.name}さん` : "グループのメンバー"}</span>
          から招待されています
          <span className="block text-xs text-ink-2">
            {response === "pending" ? "まだ返事をしていません。" : "返事は後から変えられます。"}
          </span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="返事">
        <Chip
          aria-pressed={response === "accepted"}
          disabled={busy}
          className="justify-center"
          onClick={() => onRespond("accepted")}
        >
          <Check className="size-4" aria-hidden="true" />
          参加する
        </Chip>
        <Chip
          aria-pressed={response === "declined"}
          disabled={busy}
          className="justify-center"
          onClick={() => onRespond("declined")}
        >
          <X className="size-4" aria-hidden="true" />
          参加しない
        </Chip>
      </div>
    </section>
  );
}

/**
 * 招待する人を選ぶ欄。予定のグループのメンバーを丸いボタンで並べ、押して付け外しする。#28
 * 「全員」で全員を選び、もう一度押すと全員を外す。作った人はいつも参加するので並べない。
 *
 * @param candidates 招待できる人。予定のグループの、作った人を除くメンバー
 * @param selected 招待している人の ID
 * @param disabled 読むだけのとき
 */
export function InvitePicker({
  candidates,
  selected,
  onChange,
  disabled,
}: {
  candidates: (AvatarPerson & { isMe: boolean })[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const all = candidates.length > 0 && candidates.every((c) => selected.has(c.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-2" id="event-invite-label">
        招待する人
      </span>
      {candidates.length === 0 ? (
        <FieldMessage>このグループには、ほかのメンバーがいません。</FieldMessage>
      ) : (
        <>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-labelledby="event-invite-label"
            aria-describedby="event-invite-hint"
          >
            <Chip
              aria-pressed={all}
              disabled={disabled}
              onClick={() => onChange(all ? new Set() : new Set(candidates.map((c) => c.id)))}
            >
              全員
            </Chip>
            {candidates.map((c) => (
              <Chip
                key={c.id}
                aria-pressed={selected.has(c.id)}
                disabled={disabled}
                className="pl-1.5"
                onClick={() => toggle(c.id)}
              >
                <InitialAvatar person={{ ...c, response: undefined }} size={26} />
                {c.isMe ? "自分" : c.name}
              </Chip>
            ))}
          </div>
          <FieldMessage id="event-invite-hint">
            {selected.size === 0
              ? "招待しなくても、グループの予定としてメンバー全員に見えます。"
              : "招待した人は、返事を返せて、この予定を直せます。"}
          </FieldMessage>
        </>
      )}
    </div>
  );
}

/**
 * 参加者と、それぞれの返事の一覧。作った人を先頭に出す。#28
 * 返事待ちは頭文字の丸を枠線だけにし、参加しないは名前に取り消し線を引く。
 * @param people 保存してある参加者
 * @param createdBy 作った人の ID
 */
export function AttendeeList({
  people,
  createdBy,
}: {
  people: (AvatarPerson & { isMe: boolean; response: AttendeeResponse })[];
  createdBy: string | null;
}) {
  const accepted = people.filter((p) => p.response === "accepted").length;
  return (
    <section aria-labelledby="event-attendees-label" className="flex flex-col gap-1">
      <h3 id="event-attendees-label" className="flex items-baseline gap-2 text-xs font-medium text-ink-2">
        参加者
        <span className="font-normal">
          {people.length} 人のうち {accepted} 人が参加する
        </span>
      </h3>
      <ul className="flex flex-col rounded-2xl bg-field px-3.5 py-1">
        {people.map((p) => (
          <li
            key={p.id}
            data-response={p.response}
            className="flex min-h-10 items-center gap-2.5 border-line text-sm not-first:border-t"
          >
            <InitialAvatar person={p} size={24} />
            <span
              className={cn(
                "min-w-0 flex-1 truncate font-medium",
                p.response === "declined" && "text-ink-3 line-through",
              )}
            >
              {p.isMe ? "自分" : p.name}
              {p.id === createdBy && (
                <span className="ml-1.5 text-[11px] font-normal text-ink-2 no-underline">作った人</span>
              )}
            </span>
            <span
              className={cn(
                "flex-none text-xs",
                p.response === "accepted" && "font-bold",
                p.response === "pending" && "rounded-full px-1.5 py-px text-ink-2 shadow-[inset_0_0_0_1px_var(--c)]",
                p.response === "declined" && "text-ink-3",
                `c-${p.color}`,
              )}
            >
              {RESPONSE_LABEL[p.response]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
