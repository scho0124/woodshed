import { KEYBOARD_KEYS } from "@/lib/pianoTheory";
import { cn } from "@/lib/utils";

const WHITE_W = 26;
const WHITE_H = 120;
const BLACK_W = 16;
const BLACK_H = 74;

const WHITE_INDEX: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
/** For each black key, the white key whose right edge it straddles. */
const BLACK_AFTER: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };

/** Two octaves starting on C, with `keys` pressed and `roots` marked with a dot. */
export function KeyboardDiagram({ keys, roots = [] }: { keys: number[]; roots?: number[] }) {
  const pressed = new Set(keys);
  const rootSet = new Set(roots);
  const all = Array.from({ length: KEYBOARD_KEYS }, (_, k) => k);
  const white = all.filter((k) => k % 12 in WHITE_INDEX);
  const black = all.filter((k) => k % 12 in BLACK_AFTER);
  const width = white.length * WHITE_W;

  const whiteX = (k: number) => (WHITE_INDEX[k % 12] + Math.floor(k / 12) * 7) * WHITE_W;
  const blackX = (k: number) =>
    (BLACK_AFTER[k % 12] + 1 + Math.floor(k / 12) * 7) * WHITE_W - BLACK_W / 2;

  return (
    <svg width={width + 2} height={WHITE_H + 2} viewBox={`-1 -1 ${width + 2} ${WHITE_H + 2}`}>
      {white.map((k) => (
        <g key={k}>
          <rect
            x={whiteX(k)}
            y={0}
            width={WHITE_W}
            height={WHITE_H}
            rx={3}
            className={cn(pressed.has(k) ? "fill-piano" : "fill-ink", "stroke-bg")}
            strokeWidth={1.5}
          />
          {rootSet.has(k) && (
            <circle cx={whiteX(k) + WHITE_W / 2} cy={WHITE_H - 16} r={5} className="fill-bg" />
          )}
        </g>
      ))}
      {black.map((k) => (
        <g key={k}>
          <rect
            x={blackX(k)}
            y={0}
            width={BLACK_W}
            height={BLACK_H}
            rx={2}
            className={cn(pressed.has(k) ? "fill-piano" : "fill-bg", "stroke-bg")}
            strokeWidth={1.5}
          />
          {rootSet.has(k) && (
            <circle cx={blackX(k) + BLACK_W / 2} cy={BLACK_H - 12} r={4} className="fill-ink" />
          )}
        </g>
      ))}
    </svg>
  );
}
