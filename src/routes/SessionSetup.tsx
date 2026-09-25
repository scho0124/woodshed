import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useHotkeys } from "@/hooks/useHotkeys";
import { TutorialCard } from "@/components/TutorialCard";
import { MicCheck } from "@/components/MicCheck";

function Stepper({
  label,
  value,
  onChange,
  min = 1,
  max = 99,
  suffix = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3.5">
        <button
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong text-ink"
        >
          &minus;
        </button>
        <span className="w-14 text-center font-display text-xl font-semibold text-ink">
          {value}
          {suffix}
        </span>
        <button
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-strong text-ink"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function SessionSetup() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const skill = useAppStore((s) => s.activeSkill);
  const setSessionConfig = useAppStore((s) => s.setSessionConfig);
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId);
  const setSessionStartedAt = useAppStore((s) => s.setSessionStartedAt);

  useEffect(() => {
    if (!profile) navigate("/profiles", { replace: true });
    else if (!skill) navigate("/home", { replace: true });
  }, [profile, skill, navigate]);

  const config = (skill?.config ?? {}) as Record<string, any>;
  const pool: string[] | undefined = config.pool;
  const poolLabel: string = config.pool_label ?? "Chord pool";
  const poolNoun: string = config.pool_label?.toLowerCase() ?? "chords";

  const [selected, setSelected] = useState<string[]>(config.default_selected ?? pool ?? []);
  const [sets, setSets] = useState<number>(config.default_sets ?? 4);
  const [repsPerSet, setRepsPerSet] = useState<number>(config.default_reps ?? 8);
  const [tempo, setTempo] = useState<number>(config.default_bpm ?? 80);
  const [restSeconds, setRestSeconds] = useState<number>(60);
  const [autoProgress, setAutoProgress] = useState(true);
  const [micBusy, setMicBusy] = useState(false);

  const minBpm = config.min_bpm ?? 40;
  const maxBpm = config.max_bpm ?? 180;

  function toggleChord(chord: string) {
    setSelected((prev) =>
      prev.includes(chord) ? prev.filter((c) => c !== chord) : [...prev, chord],
    );
  }

  const totalReps = sets * repsPerSet;
  const estSeconds = useMemo(() => {
    const interval = 60 / tempo;
    return Math.round(totalReps * interval + (sets - 1) * restSeconds);
  }, [totalReps, tempo, sets, restSeconds]);
  const estMinutes = Math.max(1, Math.round(estSeconds / 60));

  const createSession = useMutation({
    mutationFn: () =>
      api.createSession({
        profile_id: profile!.id,
        skill_id: skill!.id,
        sets_planned: sets,
        reps_per_set_planned: repsPerSet,
        tempo_start: tempo,
        settings_snapshot: { selected, restSeconds, autoProgress },
      }),
    onSuccess: (session) => {
      setSessionConfig({
        sets,
        repsPerSet,
        tempo,
        restSeconds,
        selectedPoolItems: selected,
        autoProgress,
      });
      setActiveSessionId(session.id);
      setSessionStartedAt(session.started_at);
      navigate("/session/practice");
    },
  });

  const canStart = !createSession.isPending && !(pool && selected.length === 0);

  useHotkeys(
    {
      Enter: () => canStart && createSession.mutate(),
      Escape: () => navigate("/skills"),
    },
    !micBusy,
  );

  if (!profile || !skill) return null;

  return (
    <div className="flex h-screen w-screen flex-col bg-bg">
      <div className="flex h-[72px] shrink-0 items-center gap-4 border-b border-border px-12">
        <button onClick={() => navigate("/skills")} className="text-lg text-ink-muted" aria-label="Back">
          &larr;
        </button>
        <div className="text-xs text-ink-faint">
          {skill.category} <span className="text-border-strong">/</span>{" "}
          <span className="text-rhythm">{skill.name}</span>
        </div>
      </div>

      <div className="flex flex-1 gap-9 overflow-auto px-12 py-8">
        <div className="flex flex-1 flex-col gap-6">
          <div>
            <div className="font-display text-[26px] font-semibold text-ink">{skill.name}</div>
            <div className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">
              {skill.description}
            </div>
          </div>
          {config.tutorial_query && <TutorialCard skillId={skill.id} />}
          {config.mic_check && (
            <MicCheck check={config.mic_check} pool={selected.length ? selected : (pool ?? [])} onBusyChange={setMicBusy} />
          )}

          {pool && (
            <div className="flex flex-col gap-2.5">
              <Label>{poolLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {pool.map((chord) => (
                  <button
                    key={chord}
                    onClick={() => toggleChord(chord)}
                    className={cn(
                      "rounded-full px-4 py-2 text-[13px] font-semibold",
                      selected.includes(chord)
                        ? "bg-rhythm text-bg"
                        : "border border-border-strong text-ink-faint",
                    )}
                  >
                    {chord}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-10">
            <Stepper label="Sets" value={sets} onChange={setSets} min={1} max={12} />
            <Stepper label="Reps per set" value={repsPerSet} onChange={setRepsPerSet} min={1} max={40} />
            <Stepper
              label="Rest between sets"
              value={restSeconds}
              onChange={setRestSeconds}
              min={0}
              max={180}
              suffix="s"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <Label htmlFor="tempo">
              {config.tempo_label ??
                (config.pattern ? "Groove tempo" : config.scale ? "Cue tempo" : "Chord change interval")}
              {" — "}
              {tempo} BPM
            </Label>
            <Slider
              id="tempo"
              value={[tempo]}
              min={minBpm}
              max={maxBpm}
              step={1}
              onValueChange={([v]) => setTempo(v)}
              className="max-w-[420px]"
            />
            <div className="flex max-w-[420px] justify-between text-[11px] text-ink-faint">
              <span>{minBpm}</span>
              <span>{maxBpm}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={autoProgress} onCheckedChange={setAutoProgress} />
            <span className="text-[13px] text-ink">
              Increase tempo automatically after 2 clean sessions
            </span>
          </div>
        </div>

        <div className="h-fit w-[300px] shrink-0 rounded-[18px] border border-border bg-surface p-6">
          <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Session preview
          </div>
          <div className="flex flex-col gap-2.5 text-[13px]">
            <div className="flex justify-between">
              <span className="text-ink-muted">Sets</span>
              <span>{sets}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Total reps</span>
              <span>{totalReps}</span>
            </div>
            {pool && (
              <div className="flex justify-between">
                <span className="text-ink-muted">{poolLabel}</span>
                <span>
                  {selected.length} {poolNoun}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-ink-muted">Est. duration</span>
              <span>~{estMinutes} min</span>
            </div>
          </div>
          <Button
            className="mt-5 w-full"
            disabled={!canStart}
            onClick={() => createSession.mutate()}
          >
            Start Session &rarr;
          </Button>
          <button
            onClick={() => navigate("/skills")}
            className="mt-3 w-full text-center text-[13px] text-ink-faint"
          >
            Back to skills
          </button>
        </div>
      </div>
    </div>
  );
}
