import { chordShape, type ChordInstrument } from "@/lib/chordShapes";

export function ChordDiagram({
  name,
  instrument = "guitar",
  size = "lg",
}: {
  name: string;
  instrument?: ChordInstrument;
  size?: "lg" | "sm";
}) {
  const shape = chordShape(name, instrument);
  const scale = size === "lg" ? 1 : 0.62;
  const w = 170 * scale;
  const h = 212 * scale;

  if (!shape) {
    return (
      <div
        style={{ width: w, height: h }}
        className="flex items-center justify-center rounded-xl border border-dashed border-border-strong text-xs text-ink-faint"
      >
        No diagram
      </div>
    );
  }

  const { frets, baseFret } = shape;
  const fretCount = 4;
  // Strings spread evenly between x=10 and x=150, however many there are.
  const stringX = frets.map((_, i) => 10 + (i * 140) / (frets.length - 1));

  return (
    <div style={{ width: w, height: h, position: "relative" }}>
      <svg width={w} height={h} viewBox="0 0 170 212">
        {baseFret === 1 ? (
          <rect x={5} y={20} width={160} height={4} fill="#F3EEE4" />
        ) : (
          <text x={0} y={30} fontSize={12} fill="#B3A797" fontFamily="Manrope, sans-serif">
            {baseFret}fr
          </text>
        )}
        {Array.from({ length: fretCount }).map((_, i) => (
          <rect key={i} x={5} y={20 + (i + 1) * 45} width={160} height={2} fill="#453D32" />
        ))}
        {stringX.map((x, i) => (
          <rect key={i} x={x} y={20} width={2} height={180} fill="#453D32" />
        ))}
        {frets.map((fret, i) => {
          const x = stringX[i];
          if (fret === -1) {
            return (
              <text
                key={i}
                x={x - 4}
                y={14}
                fontSize={13}
                fill="#7A705F"
                fontFamily="Manrope, sans-serif"
              >
                &times;
              </text>
            );
          }
          if (fret === 0) {
            return (
              <text
                key={i}
                x={x - 4}
                y={14}
                fontSize={12}
                fill="#7A705F"
                fontFamily="Manrope, sans-serif"
              >
                O
              </text>
            );
          }
          const relativeFret = fret - baseFret + 1;
          const cy = 20 + relativeFret * 45 - 22;
          return <circle key={i} cx={x + 1} cy={cy} r={7} fill="#E3A458" />;
        })}
      </svg>
    </div>
  );
}
