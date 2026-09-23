import { useEffect, useRef, useState } from "react";
import type { AudioStatus, FrameEvent } from "@/hooks/useAudioInput";
import { cn } from "@/lib/utils";

const FLOOR_DB = -80;
const NO_SIGNAL_MS = 5000;
const CLIP_HOLD_MS = 2000;

/** Input level with the noise gate marked, plus hints for no signal or clipping. */
export function LevelMeter({
  frame,
  gateDb,
  status,
}: {
  frame: FrameEvent | null;
  gateDb: number;
  status: AudioStatus;
}) {
  const lastSignal = useRef(Date.now());
  const lastClip = useRef(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (status === "listening") lastSignal.current = Date.now();
  }, [status]);
  useEffect(() => {
    if (!frame) return;
    if (frame.level_db >= gateDb) lastSignal.current = Date.now();
    if (frame.clipping) lastClip.current = Date.now();
  }, [frame, gateDb]);
  // Re-check the hints even when frames stop arriving.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const pct = (db: number) => Math.min(100, Math.max(0, ((db - FLOOR_DB) / -FLOOR_DB) * 100));
  const level = frame?.level_db ?? FLOOR_DB;
  const clipping = Date.now() - lastClip.current < CLIP_HOLD_MS;
  const silent = status === "listening" && Date.now() - lastSignal.current > NO_SIGNAL_MS;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-border" aria-label="Input level">
        <div
          className={cn("h-full transition-[width] duration-75", clipping ? "bg-danger" : level >= gateDb ? "bg-success" : "bg-ink-faint")}
          style={{ width: `${pct(level)}%` }}
        />
        <div className="absolute top-0 h-full w-0.5 bg-ink-muted" style={{ left: `${pct(gateDb)}%` }} title="Noise gate" />
      </div>
      <div className="h-4 text-[11px]">
        {clipping ? (
          <span className="text-danger">Too loud: turn your guitar's volume down a little.</span>
        ) : silent ? (
          <span className="text-ink-faint">No signal yet. Check the cable and your guitar's volume knob.</span>
        ) : null}
      </div>
    </div>
  );
}

export function ListeningBadge({
  status,
  error,
  deviceName,
  paused,
  onTogglePause,
}: {
  status: AudioStatus;
  error: string | null;
  deviceName: string | undefined;
  paused: boolean;
  onTogglePause: () => void;
}) {
  const text =
    status === "error"
      ? (error ?? "Audio input error")
      : paused
        ? "Paused"
        : status === "listening"
          ? `Listening · ${deviceName ?? "input"}`
          : status === "starting"
            ? "Connecting to input..."
            : "Not listening";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          status === "listening" && !paused ? "animate-pulse bg-success" : status === "error" ? "bg-danger" : "bg-ink-faint",
        )}
      />
      <span className={cn("truncate text-xs", status === "error" ? "text-danger" : "text-ink-muted")} title={text}>
        {text}
      </span>
      <button onClick={onTogglePause} className="shrink-0 text-xs text-ink-faint hover:text-ink">
        {paused || status === "error" ? "Resume" : "Pause"}
      </button>
    </div>
  );
}
