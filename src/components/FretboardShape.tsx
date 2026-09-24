import { useMemo } from "react";
import { parseTab } from "@/lib/tabParser";

/**
 * Every note in a tab, drawn on a stretch of the neck the way the tab reads:
 * highest string on top. Root notes are orange, open strings are rings left
 * of the nut.
 */
export function FretboardShape({ tab, root }: { tab: string[]; root?: number }) {
  const { strings, notes } = useMemo(() => {
    const parsed = parseTab(tab.join("\n"));
    const seen = new Map<string, { string: number; fret: number; isRoot: boolean }>();
    for (const step of parsed.steps) {
      for (const n of step.notes) {
        if (n.fret === null || n.midi === null) continue;
        seen.set(`${n.string}:${n.fret}`, {
          string: n.string,
          fret: n.fret,
          isRoot: root !== undefined && n.midi % 12 === root,
        });
      }
    }
    return { strings: parsed.stringCount ?? 6, notes: [...seen.values()] };
  }, [tab, root]);

  const fretted = notes.filter((n) => n.fret > 0).map((n) => n.fret);
  const low = fretted.length ? Math.min(...fretted) : 1;
  const high = fretted.length ? Math.max(...fretted) : 4;
  const first = low <= 3 ? 1 : low;
  const last = Math.max(high, first + 3);
  const count = last - first + 1;
  const fretW = Math.min(40, Math.floor(420 / count));
  const gap = 16;
  const nutX = 20;
  const top = 10;
  const bottom = top + (strings - 1) * gap;
  const width = nutX + count * fretW + 4;
  const y = (string: number) => top + (strings - 1 - string) * gap;
  const x = (fret: number) => (fret === 0 ? nutX - 10 : nutX + (fret - first + 0.5) * fretW);

  return (
    <svg width={width} height={bottom + 22} role="img" aria-label="Fretboard shape">
      {Array.from({ length: strings }, (_, s) => (
        <rect key={s} x={nutX} y={y(s) - 0.5} width={count * fretW} height={1} fill="#453D32" />
      ))}
      {Array.from({ length: count + 1 }, (_, i) => (
        <rect
          key={i}
          x={nutX + i * fretW - (i === 0 && first === 1 ? 2 : 0.5)}
          y={top - 4}
          width={i === 0 && first === 1 ? 4 : 1}
          height={bottom - top + 8}
          fill={i === 0 && first === 1 ? "#F3EEE4" : "#453D32"}
        />
      ))}
      {Array.from({ length: count }, (_, i) => (
        <text
          key={i}
          x={nutX + (i + 0.5) * fretW}
          y={bottom + 18}
          fontSize={10}
          textAnchor="middle"
          fill="#7A705F"
          fontFamily="Manrope, sans-serif"
        >
          {first + i}
        </text>
      ))}
      {notes.map((n) => {
        const color = n.isRoot ? "#E3A458" : "#F3EEE4";
        return n.fret === 0 ? (
          <circle key={`${n.string}:0`} cx={x(0)} cy={y(n.string)} r={5} fill="none" stroke={color} strokeWidth={1.5} />
        ) : (
          <circle key={`${n.string}:${n.fret}`} cx={x(n.fret)} cy={y(n.string)} r={6} fill={color} />
        );
      })}
    </svg>
  );
}
