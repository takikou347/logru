import type { Me } from "@shared/api-types";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { InitialAvatar } from "@/components/parts/Avatars";
import { FieldMessage, Panel } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { prepareAvatarPhoto } from "@/lib/avatar-photo";
import { useResetAvatar, useUploadAvatar } from "./api";

/**
 * 設定の「アバター」。頭文字か、置いた写真から選ぶ。#40
 *
 * 写真は選んだ端末で 256 px の正方形に縮めてから送る。写真でないファイルは断る。
 * 押した瞬間にプレビューへは効かせず、送り終わってから画面に反映する。
 */
export function AvatarSection({ me }: { me: Me }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadAvatar();
  const reset = useResetAvatar();
  const [busy, setBusy] = useState(false);
  const busyNow = busy || upload.isPending || reset.isPending;

  async function onPick(file: File) {
    setBusy(true);
    try {
      const photo = await prepareAvatarPhoto(file);
      await upload.mutateAsync(photo);
      toast("アバターを写真にしました");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onReset() {
    try {
      await reset.mutateAsync();
      toast("アバターを頭文字に戻しました");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const person = { id: me.user.id, name: me.user.name, color: me.settings.userColor, avatarUrl: me.user.avatarUrl };

  return (
    <Panel title="アバター">
      <div className="flex items-center gap-4">
        <InitialAvatar person={person} size={64} />
        <div className="flex flex-col gap-2">
          <Button type="button" variant="secondary" disabled={busyNow} onClick={() => inputRef.current?.click()}>
            写真を選ぶ
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busyNow || me.settings.avatarKind === "initial"}
            onClick={onReset}
          >
            頭文字に戻す
          </Button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="アバターの写真を選ぶ"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onPick(file);
        }}
      />
      <FieldMessage>写真は 256 px の正方形に縮めて置きます。同じグループのメンバーに見えます。</FieldMessage>
    </Panel>
  );
}
