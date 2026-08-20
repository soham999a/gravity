import * as React from "react";
import { cn } from "@/lib/utils";
export { Badge } from "@/components/ui/badge";

export function PageHeader({
  index,
  eyebrow,
  title,
  titleAccent,
  description,
  children,
}: {
  index?: string;
  eyebrow?: string;
  title: string;
  titleAccent?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border pb-10 mb-10">
      <div className="grid grid-cols-[140px_1fr] gap-12">
        <div>
          {index && <div className="section-number pt-1">{index}</div>}
        </div>
        <div>
          {eyebrow && <div className="kicker mb-3">{eyebrow}</div>}
          <h1 className="section-title mb-4">
            {title} {titleAccent && <em>{titleAccent}</em>}
          </h1>
          {description && <p className="section-desc">{description}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
  headerRight,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}) {
  return (
    <div className={cn("border border-border bg-deep", className)}>
      {title && (
        <div className="panel-header">
          <span className="kicker-gold">{title}</span>
          {headerRight}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

export function KeyValue({ label, value, gold, mono }: {
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

export function Bar({ value, max = 100, color = "gold", label }: {
  value: number;
  max?: number;
  color?: string;
  label?: string;
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
  };
  return (
    <div className="relative">
      <div className="h-2 bg-border w-full">
        <div
          className={cn("h-full transition-all duration-700", colorMap[color] || "bg-gold")}
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

export function StatusDot({ status }: { status: string }) {
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
    <span className={cn("inline-block w-1.5 h-1.5 rounded-full", colorMap[status] || "bg-ivory-faint")} />
  );
}

export function Divider() {
  return <div className="h-px bg-border my-6" />;
}

export function SectionBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("py-20 px-8 lg:px-20 border-b border-border", className)}>
      <div className="max-w-[1200px] mx-auto">{children}</div>
    </div>
  );
}
