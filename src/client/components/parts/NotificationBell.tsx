/**
 * 上の帯に置く、お知らせの入口。ベルの印に未読の数を出し、押すとシートで一覧を開く。#32
 *
 * 一覧の 1 件の文言と行き先は、積んだ拡張の describeNotification が決める。カレンダーはお知らせの中身を知らない。
 */
import { clientExtension } from "@extensions/client/registry";
import type { NotificationItem } from "@shared/api-types";
import { Bell, Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadCount,
} from "@/modules/notifications/api";
import { EmptyState } from "./EmptyState";
import { ResponsiveSheet } from "./ResponsiveSheet";

/** 何分前かなどの、ざっくりした時刻。1 分未満は「今」 */
function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "今";
  if (min < 60) return `${min} 分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 時間前`;
  const day = Math.floor(hour / 24);
  return `${day} 日前`;
}

/** 拡張が決めた文言と行き先。拡張がお知らせを出さなくなっていたら、押しても何も起きない */
function describe(item: NotificationItem): { text: string; path: string } | null {
  const [extKey] = item.kind.split(".");
  const ext = extKey ? clientExtension(extKey) : undefined;
  return ext?.describeNotification?.(item.kind, item.payload) ?? null;
}

function NotificationRow({ item, onOpen }: { item: NotificationItem; onOpen: (item: NotificationItem) => void }) {
  const info = describe(item);
  if (!info) return null;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn("flex w-full items-start gap-2.5 rounded-[16px] px-3 py-2.5 text-left", !item.readAt && "bg-field")}
    >
      <span className={cn("mt-2 size-2 shrink-0 rounded-full", !item.readAt && "bg-destructive")} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-medium">{info.text}</span>
        <span className="text-xs text-ink-2">{relativeTime(item.createdAt)}</span>
      </span>
    </button>
  );
}

function NotificationList({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const list = useNotificationList(true);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  const open = (item: NotificationItem) => {
    const info = describe(item);
    if (!item.readAt) markRead.mutate(item.id);
    onClose();
    if (info) navigate(info.path);
  };

  return (
    <ResponsiveSheet title="お知らせ" onClose={onClose}>
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-2">{items.length} 件</span>
          <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <Check className="size-4" />
            すべて既読にする
          </Button>
        </div>
      )}
      {list.isLoading ? (
        <p className="py-6 text-center text-sm text-ink-2">読み込んでいます…</p>
      ) : items.length === 0 ? (
        <EmptyState
          pose="bell"
          bordered={false}
          action={{
            label: "グループを見る",
            onClick: () => {
              onClose();
              navigate("/groups");
            },
          }}
        >
          お知らせはまだありません。
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <NotificationRow item={item} onOpen={open} />
            </li>
          ))}
        </ul>
      )}
      {list.hasNextPage && (
        <Button variant="ghost" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
          もっと読む
        </Button>
      )}
    </ResponsiveSheet>
  );
}

/** ベルの印。未読があれば右上に丸を出す */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount(true);
  const count = unread.data ?? 0;
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={count > 0 ? `お知らせ。未読 ${count} 件` : "お知らせ"}
        className="relative"
        onClick={() => setOpen(true)}
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span
            className="absolute top-1 right-1 grid min-w-[16px] place-items-center rounded-full bg-destructive px-1 text-[10px] leading-[16px] font-bold text-white"
            aria-hidden="true"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>
      {open && <NotificationList onClose={() => setOpen(false)} />}
    </>
  );
}
