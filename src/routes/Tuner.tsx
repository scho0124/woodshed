import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { AudioGate, selectClass } from "@/components/AudioGate";
import { AudioSettingsPanel, audioRestartKey } from "@/components/AudioSettingsPanel";
import { LevelMeter, ListeningBadge } from "@/components/LevelMeter";
import { Button } from "@/components/ui/button";
import { useAudioInput } from "@/hooks/useAudioInput";
import type { FrameEvent } from "@/hooks/useAudioInput";
import { useHotkeys } from "@/hooks/useHotkeys";
import { hzToMidi, median, midiName, midiToHz } from "@/lib/music";
import { TUNINGS, findTuning, instrumentFor, normalizeTuningName, resolveTuning } from "@/lib/tunings";
import type { Tuning } from "@/lib/tunings";
import { cn } from "@/lib/utils";

const IN_TUNE_CENTS = 3;
const IN_TUNE_HOLD_SECS = 0.5;
const HOLD_READING_SECS = 1.5;

function tuningFrom(value: string | null): Tuning {
  if (value) {
    const known = findTuning(normalizeTuningName(value));
    if (known) return known;
    const strings = resolveTuning(value);
    if (strings) return { name: value, instrument: instrumentFor(strings), strings };
  }
  return TUNINGS[0];
}

/** Median of the last few pitch readings, held briefly after the note fades. */
function useSmoothedPitch(frame: FrameEvent | null, a4: number) {
  const recent = useRef<{ t: number; midi: number }[]>([]);
  const lastHeard = useRef(-Infinity);
  const [reading, setReading] = useState<{ midi: number; hz: number; t: number } | null>(null);

  useEffect(() => {
    if (!frame) return;
    if (frame.hz) {
      const midi = hzToMidi(frame.hz, a4);
      recent.current = [...recent.current.filter((r) => frame.t - r.t <= 0.25), { t: frame.t, midi }].slice(-5);
      lastHeard.current = frame.t;
      const m = median(recent.current.map((r) => r.midi));
      setReading({ midi: m, hz: midiToHz(m, a4), t: frame.t });
    } else if (frame.t - lastHeard.current > HOLD_READING_SECS) {
      recent.current = [];
      setReading(null);
    }
  }, [frame, a4]);

  return reading;
}

function Needle({ cents, inTune }: { cents: number | null; inTune: boolean }) {
  const clamped = Math.max(-50, Math.min(50, cents ?? 0));
  const point = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return [r * Math.sin(rad), -r * Math.cos(rad)];
  };
  const arc = (from: number, to: number, r: number) => {
    const [x1, y1] = point(from, r);
    const [x2, y2] = point(to, r);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const color =
    cents === null ? "stroke-ink-faint" : inTune ? "stroke-success" : Math.abs(cents) < 15 ? "stroke-rhythm" : "stroke-lead";

  return (
    <svg viewBox="-180 -170 360 190" className="w-[420px] max-w-full">
      <path d={arc(-60, 60, 150)} className="stroke-border-strong" strokeWidth={2} fill="none" />
      <path d={arc(-IN_TUNE_CENTS * 1.2, IN_TUNE_CENTS * 1.2, 150)} className="stroke-success" strokeWidth={6} fill="none" />
      {Array.from({ length: 11 }, (_, i) => {
        const c = -50 + i * 10;
        const [x1, y1] = point(c * 1.2, c === 0 ? 128 : 138);
        const [x2, y2] = point(c * 1.2, 150);
        return <line key={c} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-ink-faint" strokeWidth={c === 0 ? 2.5 : 1.5} />;
      })}
      <text x={-150} y={14} className="fill-ink-faint text-[12px]" textAnchor="middle">
        flat
      </text>
      <text x={150} y={14} className="fill-ink-faint text-[12px]" textAnchor="middle">
        sharp
      </text>
      <g style={{ transform: `rotate(${clamped * 1.2}deg)`, transition: "transform 90ms linear" }}>
        <line x1={0} y1={0} x2={0} y2={-140} className={color} strokeWidth={4} strokeLinecap="round" />
      </g>
      <circle r={7} className="fill-ink" />
    </svg>
  );
}

export function Tuner() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const profile = useAppStore((s) => s.profile);
  const storedTuning = useAppStore((s) => s.tunerTuning);
  const setStoredTuning = useAppStore((s) => s.setTunerTuning);

  const [tuning, setTuning] = useState(() => tuningFrom(params.get("tuning") ?? storedTuning));
  const [chromatic, setChromatic] = useState(false);
  const [locked, setLocked] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [retry, setRetry] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const inTuneSince = useRef<number | null>(null);

  useEffect(() => {
    if (!profile) navigate("/profiles", { replace: true });
  }, [profile, navigate]);

  const settings = useQuery({ queryKey: ["audio-settings"], queryFn: api.getAudioSettings });
  const a4 = settings.data?.a4_hz ?? 440;
  const audio = useAudioInput({
    enabled: !paused && !!settings.data,
    range: tuning.instrument,
    restartKey: `${audioRestartKey(settings.data)}|${retry}`,
  });
  const reading = useSmoothedPitch(audio.frame, a4);

  const nearestString = reading
    ? tuning.strings.reduce((best, s, i) => (Math.abs(reading.midi - s) < Math.abs(reading.midi - tuning.strings[best]) ? i : best), 0)
    : null;
  const activeString = chromatic ? null : (locked ?? nearestString);
  const target = reading ? (chromatic ? Math.round(reading.midi) : tuning.strings[activeString!]) : null;
  const cents = reading && target !== null ? (reading.midi - target) * 100 : null;

  let inTune = false;
  if (cents !== null && reading && Math.abs(cents) <= IN_TUNE_CENTS) {
    inTuneSince.current ??= reading.t;
    inTune = reading.t - inTuneSince.current >= IN_TUNE_HOLD_SECS;
  } else {
    inTuneSince.current = null;
  }

  function chooseTuning(name: string) {
    const next = tuningFrom(name);
    setTuning(next);
    setLocked(null);
    setStoredTuning(next.name);
  }

  function moveLock(delta: number) {
    setChromatic(false);
    setLocked((l) => {
      const from = l ?? (delta > 0 ? -1 : tuning.strings.length);
      return Math.min(tuning.strings.length - 1, Math.max(0, from + delta));
    });
  }

  useHotkeys(
    {
      Escape: () => (showSettings ? setShowSettings(false) : navigate(-1)),
      ArrowLeft: () => moveLock(-1),
      ArrowRight: () => moveLock(1),
      a: () => {
        setChromatic(false);
        setLocked(null);
      },
      c: () => setChromatic((c) => !c),
    },
    audio.allowed,
  );

  if (!profile) return null;

  const tuningOptions = TUNINGS.some((t) => t.name === tuning.name) ? TUNINGS : [tuning, ...TUNINGS];

  return (
    <div className="flex h-screen w-screen flex-col bg-bg">
      <div className="flex h-[72px] shrink-0 items-center gap-4 border-b border-border px-12">
        <button onClick={() => navigate(-1)} className="text-lg text-ink-muted" aria-label="Back">
          &larr;
        </button>
        <div className="h-6 w-px bg-border" />
        <div className="flex-1 font-display text-lg font-semibold text-ink">Tuner</div>
        <select
          aria-label="Tuning"
          className={cn(selectClass, "h-9 w-60")}
          value={tuning.name}
          onChange={(e) => chooseTuning(e.target.value)}
        >
          {tuningOptions.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
        {audio.allowed && (
          <Button variant={showSettings ? "primary" : "outline"} size="sm" onClick={() => setShowSettings((s) => !s)}>
            Audio settings
          </Button>
        )}
      </div>

      <AudioGate onDecline={() => navigate(-1)}>
        <div className="flex min-h-0 flex-1">
          <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-auto px-8 py-6">
            <div className="flex gap-2">
              {[
                { label: "Strings", on: !chromatic, pick: () => setChromatic(false) },
                { label: "Chromatic", on: chromatic, pick: () => setChromatic(true) },
              ].map((m) => (
                <button
                  key={m.label}
                  onClick={m.pick}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold",
                    m.on ? "bg-rhythm text-bg" : "border border-border-strong text-ink-muted hover:text-ink",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex h-28 items-end gap-1 font-display text-ink">
              {target !== null ? (
                <>
                  <span className={cn("text-8xl font-semibold leading-none", inTune && "text-success")}>
                    {midiName(target, false)}
                  </span>
                  <span className="pb-2 text-2xl text-ink-muted">{Math.floor(target / 12) - 1}</span>
                </>
              ) : (
                <span className="pb-4 text-2xl text-ink-faint">
                  {audio.status === "listening" && !paused ? "Play a string" : " "}
                </span>
              )}
            </div>

            <Needle cents={cents} inTune={inTune} />

            <div className="h-5 text-sm">
              {cents === null ? null : inTune ? (
                <span className="font-semibold text-success">In tune</span>
              ) : (
                <span className="text-ink-muted">
                  {cents > 0 ? "+" : ""}
                  {Math.round(cents)} cents ·{" "}
                  {Math.abs(cents) <= IN_TUNE_CENTS ? "hold it..." : cents > 0 ? "tune down" : "tune up"}
                  {reading && <span className="ml-3 text-ink-faint">{reading.hz.toFixed(1)} Hz</span>}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {tuning.strings.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setChromatic(false);
                    setLocked((l) => (l === i ? null : i));
                  }}
                  title={locked === i ? "Locked. Click to go back to auto" : "Lock to this string"}
                  className={cn(
                    "flex w-14 flex-col items-center rounded-xl border py-2",
                    activeString === i
                      ? inTune
                        ? "border-success bg-success/10 text-success"
                        : "border-rhythm bg-rhythm-tint text-rhythm"
                      : "border-border-strong text-ink-muted hover:text-ink",
                    locked === i && "ring-2 ring-rhythm/60",
                  )}
                >
                  <span className="text-[10px] text-ink-faint">{tuning.strings.length - i}</span>
                  <span className="font-display text-lg font-semibold">{midiName(s, false)}</span>
                  <span className="text-[10px] text-ink-faint">{midiName(s)}</span>
                </button>
              ))}
            </div>
            <div className="text-[11px] text-ink-faint">
              {locked !== null ? "Locked to one string · " : ""}← → lock a string · A auto · C chromatic · Esc back
            </div>
          </div>

          {showSettings && (
            <aside className="w-[340px] shrink-0 overflow-auto border-l border-border p-6">
              <div className="mb-4 font-display text-[17px] font-semibold text-ink">Audio settings</div>
              <AudioSettingsPanel showReference />
            </aside>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-border px-12 py-4">
          <ListeningBadge
            status={audio.status}
            error={audio.error}
            deviceName={audio.device?.device_name}
            paused={paused}
            onTogglePause={() => (audio.status === "error" ? setRetry((r) => r + 1) : setPaused((p) => !p))}
          />
          <LevelMeter frame={audio.frame} gateDb={settings.data?.gate_db ?? -55} status={audio.status} />
        </div>
      </AudioGate>
    </div>
  );
}
