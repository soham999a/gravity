import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border font-mono text-[8px] tracking-[0.1em] uppercase",
  {
    variants: {
      variant: {
        default: "border-border-light text-ivory-faint",
        gold: "border-gold/30 text-gold bg-gold-pale",
        success: "border-success/30 text-success-text",
        warning: "border-warning/30 text-warning-text",
        danger: "border-danger/30 text-danger-text",
        strategy: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const strategyColors: Record<string, string> = {
  deterministic: "border-strategy-deterministic/30 text-strategy-deterministic",
  statistical: "border-strategy-statistical/30 text-strategy-statistical",
  small_llm: "border-strategy-small-llm/30 text-strategy-small-llm",
  specialist_agent: "border-strategy-agent/30 text-strategy-agent",
  advanced_reasoning: "border-strategy-agent/30 text-strategy-agent",
  multi_agent: "border-strategy-multi/30 text-strategy-multi",
  human: "border-strategy-human/30 text-strategy-human",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  strategy?: string;
}

function Badge({ className, variant, strategy, ...props }: BadgeProps) {
  const strategyClass = variant === "strategy" && strategy ? strategyColors[strategy] : "";
  return (
    <div className={cn(badgeVariants({ variant }), "px-2.5 py-0.5", strategyClass, className)} {...props} />
  );
}

export { Badge, badgeVariants };
