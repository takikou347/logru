import { type InputHTMLAttributes, type ReactNode, useId } from "react";

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": error || hint ? msgId : undefined })}
      {error ? (
        <span className="msg" id={msgId}>
          {error}
        </span>
      ) : hint ? (
        <span className="hint" id={msgId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  full,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  full?: boolean;
}) {
  return (
    <div className={`seg${full ? " full" : ""}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Swatches({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: readonly { key: string; label: string }[];
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={o.key === value}
          aria-label={o.label}
          title={o.label}
          className={`swatch c-${o.key}`}
          onClick={() => onChange(o.key)}
        />
      ))}
    </div>
  );
}

export function Dot({ color, size }: { color: string; size?: number }) {
  return <span className={`dot c-${color}`} style={size ? { width: size, height: size } : undefined} aria-hidden="true" />;
}
