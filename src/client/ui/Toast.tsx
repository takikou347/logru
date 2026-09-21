import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

type ToastInput = { message: string; tone?: "normal" | "error"; action?: { label: string; onClick: () => void }; ms?: number };
type ToastState = ToastInput & { id: number };

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const seq = useRef(0);
  const show = useCallback((t: ToastInput) => setToast({ ...t, id: ++seq.current }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), toast.ms ?? 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status">
        {toast && (
          <div className={`toast${toast.tone === "error" ? " error" : ""}`} key={toast.id}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
