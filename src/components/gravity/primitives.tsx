import * as React from "react";
import { cn } from "@/lib/utils";
export { Badge } from "@/components/ui/badge";

export function Meta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("meta", className)}>{children}</span>;
}

export function SimulatedTag({ label = "Simulated" }: { label?: string }) {
  return (
    <span className="meta border border-border px-1.5 py-0.5 text-gold/80">{label}</span>
  );
}

export function PageHeader({
  index,
  title,
  subtitle,
  actions,
}: {
  index?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="border-b border-border pb-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          {index && <Meta className="text-gold">{index}</Meta>}
          <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">{title}</h1>
          {subtitle ? (
            <p className="mt-3 max-w-2xl text-sm text-ivory-dim">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Panel({
  index,
  title,
  aside,
  children,
  className,
  headerRight,
}: {
  index?: string;
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}) {
  return (
    <section className={cn("border border-border bg-deep", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex min-w-0 items-baseline gap-3">
            {index ? <Meta className="text-gold">{index}</Meta> : null}
            <h2 className="truncate font-sans text-[0.7rem] font-medium tracking-[0.18em] uppercase text-ivory">
              {title}
            </h2>
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : headerRight ? <div className="shrink-0">{headerRight}</div> : null}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Bar({ value, max = 100, color = "gold", label, tone }: {
  value: number;
  max?: number;
  color?: string;
  label?: string;
  tone?: "gold" | "muted";
}) {
  const pct = Math.min((value / max) * 100, 100);
  const colorMap: Record<string, string> = {
    gold: "bg-gold",
    success: "bg-success-text",
    warning: "bg-warning-text",
    danger: "bg-danger-text",
    deterministic: "bg-strategy-deterministic",
    statistical: "bg-strategy-statistical",
    agent: "bg-strategy-agent",
    multi: "bg-strategy-multi",
    muted: "bg-ivory-faint/50",
  };
  return (
    <div className="relative">
      <div className="h-[3px] bg-border-light w-full">
        <div
          className={cn(
            "h-full transition-all duration-700",
            tone === "muted" ? "bg-ivory-faint/50" : colorMap[color] || "bg-gold"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-[8px] text-ivory-faint mix-blend-difference">{label}</span>
        </div>
      )}
    </div>
  );
}

export function KeyValue({ label, value, tone, gold, mono }: {
  label: string;
  value: React.ReactNode;
  tone?: "gold";
  gold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <Meta>{label}</Meta>
      <span
        className={cn(
          "font-mono text-xs tabular-nums",
          (tone === "gold" || gold) ? "text-gold" : mono ? "font-mono text-xs" : "text-ivory-dim",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function KeyValueBlock({ label, value, gold, mono }: {
  label: string;
  value: React.ReactNode;
  gold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="mb-3">
      <div className="kicker mb-1">{label}</div>
      <div className={cn("text-sm", gold && "text-gold", mono && "font-mono text-xs", !gold && "text-ivory-dim")}>
        {value}
      </div>
    </div>
  );
}

export function StatusDot({ tone, status }: { tone?: "ok" | "warn" | "bad" | "idle"; status?: string }) {
  if (tone) {
    const map = {
      ok: "bg-success-text",
      warn: "bg-warning-text",
      bad: "bg-danger-text",
      idle: "bg-ivory-faint/50",
    } as const;
    return <span className={cn("inline-block size-1.5 rounded-full", map[tone])} aria-hidden />;
  }

  const colorMap: Record<string, string> = {
    active: "bg-success-text",
    completed: "bg-success-text",
    running: "bg-gold animate-pulse",
    pending: "bg-warning-text",
    queued: "bg-warning-text",
    failed: "bg-danger-text",
    inactive: "bg-ivory-faint",
    maintenance: "bg-warning-text",
  };
  return (
    <span className={cn("inline-block w-1.5 h-1.5 rounded-full", colorMap[status || "inactive"] || "bg-ivory-faint")} />
  );
}

export function Divider() {
  return <div className="hairline my-10" />;
}

export function SectionBlock({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={cn("py-20 px-8 lg:px-20 border-b border-border", className)}>
      <div className="max-w-[1200px] mx-auto">{children}</div>
    </div>
  );
}

export const money = (n: number) =>
  n === 0 ? "$0.00" : n < 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;

export const dur = (ms: number) => {
  if (ms >= 86400000) return `${Math.round(ms / 86400000)}d`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
};

export const num = (n: number) => n.toLocaleString("en-US");
