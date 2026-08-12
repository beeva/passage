import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "good" | "warning" | "critical" | "info" | "cited";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-ink-800 text-ink-300",
  good: "bg-teal-500/15 text-teal-400",
  warning: "bg-amber-500/15 text-amber-400",
  critical: "bg-rose-500/15 text-rose-400",
  info: "bg-indigo-500/15 text-indigo-400",
  cited: "bg-amber-500/15 text-amber-400",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", children, ...props }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", toneClasses[tone], className)} {...props}>
      {children}
    </span>
  );
}
