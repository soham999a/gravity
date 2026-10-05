"use client";

import * as React from "react";
import { create } from "zustand";
import { AlertTriangle, Check, Info, X } from "lucide-react";

export type ToastVariant = "default" | "success" | "error";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  leaving: boolean;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id" | "leaving">) => number;
  dismiss: (id: number) => void;
}

const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = Date.now() + Math.floor(Math.random() * 100000);
    set((state) => ({
      // Cap stack at 3 — newest wins, oldest auto-evicted.
      toasts: [...state.toasts, { ...toast, id, leaving: false }].slice(-3),
    }));
    return id;
  },
  dismiss: (id) =>
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    })),
}));

/**
 * Auto-dismiss in ~2.5s (leave animation) + remove at ~2.8s.
 * Fixed: previous code generated two different ids so dismiss() never matched
 * and toasts stuck on screen until manually closed.
 */
export function toast(
  title: string,
  description?: string,
  variant: ToastVariant = "default",
  durationMs = 2500,
) {
  // push() returns the real id — use it for both timers.
  const id = useToasts.getState().push({ title, description, variant });
  window.setTimeout(() => useToasts.getState().dismiss(id), durationMs);
  window.setTimeout(() => {
    useToasts.setState((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  }, durationMs + 300);
}

const ICONS: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="size-3.5" />,
  success: <Check className="size-3.5" />,
  error: <AlertTriangle className="size-3.5" />,
};

export function Toaster() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);

  return (
    <div className="toaster-root" aria-live="polite" aria-atomic="false">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={`toast-item toast-${item.variant} ${item.leaving ? "toast-leaving" : ""}`}
          role="status"
        >
          <span className="toast-icon">{ICONS[item.variant] ?? ICONS.default}</span>
          <div className="toast-body">
            <p className="toast-title">{item.title}</p>
            {item.description ? <p className="toast-desc">{item.description}</p> : null}
          </div>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss notification"
            onClick={() => dismiss(item.id)}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}