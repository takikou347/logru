import { type ReactNode, useId } from "react";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "./Panel";

/** 入力欄に渡す、ラベルと説明のつながり */
export type FieldControlProps = { id: string; "aria-invalid": boolean; "aria-describedby"?: string };

/**
 * ラベル付きの入力欄。ラベルと入力欄と説明を、読み上げでもつなげる。
 *
 * @param label 入力欄の名前
 * @param error 誤りの文。あれば朱で出し、入力欄を誤りの見た目にする
 * @param hint 説明。誤りが無いときだけ出す
 * @param children 入力欄を作る関数。受け取った props をそのまま入力欄に渡す
 * @example
 * <Field label="題名" error={error}>{(p) => <Input {...p} value={title} />}</Field>
 */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-ink-2">
        {label}
      </Label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": error || hint ? msgId : undefined })}
      {error ? (
        <FieldMessage id={msgId} error>
          {error}
        </FieldMessage>
      ) : hint ? (
        <FieldMessage id={msgId}>{hint}</FieldMessage>
      ) : null}
    </div>
  );
}
