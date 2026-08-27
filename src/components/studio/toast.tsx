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
  push: (toast: Omit<ToastItem, "id" | "leaving">) => void;
  dismiss: (id: number) => void;
}

const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id, leaving: false }] }));
  },
  dismiss: (id) =>
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    })),
}));

let counter = 0;

export function toast(
  title: string,
  description?: string,
  variant: ToastVariant = "default",
) {
  counter += 1;
  const id = Date.now() % 10000 + counter;
  useToasts.getState().push({ title, description, variant });
  window.setTimeout(() => useToasts.getState().dismiss(id), 4200);
  window.setTimeout(() => {
    useToasts.setState((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  }, 4450);
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