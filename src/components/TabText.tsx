import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { ParsedTab } from "@/lib/tabParser";
import type { Loop, StepStatus } from "@/lib/playAlong";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<StepStatus, string> = {
  pending: "",
  hit: "text-success",
  retried: "text-rhythm",
  skipped: "text-ink-faint line-through",
  strummed: "text-ink-muted",
  passed: "text-ink-faint",
};

/**
 * The tab exactly as written, with each step's column colored by its result
 * and the current step highlighted like a cursor. Keeps the cursor in view.
 */
export function TabText({
  parsed,
  status,
  current,
  loop,
  onStepClick,
}: {
  parsed: ParsedTab;
  status: StepStatus[];
  current: number | null;
  loop: Loop | null;
  onStepClick?: (index: number, extend: boolean) => void;
}) {
  const spansByLine = useMemo(() => {
    const map = new Map<number, { start: number; end: number; step: number; first: boolean }[]>();
    for (const step of parsed.steps) {
      step.spans.forEach((sp, k) => {
        const list = map.get(sp.line) ?? [];
        list.push({ start: sp.start, end: sp.end, step: step.index, first: k === 0 });
        map.set(sp.line, list);
      });
    }
    for (const list of map.values()) list.sort((a, b) => a.start - b.start);
    return map;
  }, [parsed]);

  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (current === null) return;
    container.current
      ?.querySelector(`[data-step="${current}"][data-first]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current]);

  return (
    <div ref={container} className="font-mono text-[14px] leading-snug text-ink-faint">
      {parsed.lines.map((line, li) => {
        const spans = spansByLine.get(li);
        if (!spans) {
          return (
            <div key={li} className="whitespace-pre">
              {line || " "}
            </div>
          );
        }
        const parts: ReactNode[] = [];
        let pos = 0;
        for (const sp of spans) {
          if (sp.start > pos) parts.push(line.slice(pos, sp.start));
          const inLoop = loop !== null && sp.step >= loop.start && sp.step <= loop.end;
          parts.push(
            <span
              key={sp.start}
              data-step={sp.step}
              data-first={sp.first || undefined}
              onClick={(e) => onStepClick?.(sp.step, e.shiftKey)}
              className={cn(
                "cursor-pointer rounded-[2px]",
                sp.step === current ? "bg-tab font-semibold text-bg" : STATUS_CLASS[status[sp.step]],
                inLoop && sp.step !== current && "bg-tab-tint",
              )}
            >
              {line.slice(sp.start, sp.end).padEnd(sp.end - sp.start, " ")}
            </span>,
          );
          pos = Math.max(pos, sp.end);
        }
        if (pos < line.length) parts.push(line.slice(pos));
        return (
          <div key={li} className="whitespace-pre text-ink">
            {parts}
          </div>
        );
      })}
    </div>
  );
}
