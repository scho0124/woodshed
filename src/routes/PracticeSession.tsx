import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { GENERATORS } from "@/generators";
import type { Prompt } from "@/generators";
import { ChordDiagram } from "@/components/ChordDiagram";
import { KeyboardDiagram } from "@/components/KeyboardDiagram";
import { FretboardShape } from "@/components/FretboardShape";
import { TabSnippet } from "@/components/TabSnippet";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/hooks/useHotkeys";
import { cn } from "@/lib/utils";

export function PracticeSession() {
  const navigate = useNavigate();
  const skill = useAppStore((s) => s.activeSkill);
  const sessionConfig = useAppStore((s) => s.sessionConfig);
  const sessionId = useAppStore((s) => s.activeSessionId);

  const generator = skill ? GENERATORS[skill.generator_type] : undefined;

  const [setIndex, setSetIndex] = useState(0);
  const [repIndex, setRepIndex] = useState(0);
  const [misses, setMisses] = useState(0);
  const [phase, setPhase] = useState<"practice" | "resting" | "finishing">("practice");
  const [restRemaining, setRestRemaining] = useState(0);
  const [current, setCurrent] = useState<Prompt | null>(null);
  const [next, setNext] = useState<Prompt | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!skill || !sessionConfig || !sessionId || !generator) {
      navigate("/home", { replace: true });
      return;
    }
    const first = generator({ config: skill.config, selectedPool: sessionConfig.selectedPoolItems });
    const second = generator(
      { config: skill.config, selectedPool: sessionConfig.selectedPoolItems },
      first.label,
    );
    setCurrent(first);
    setNext(second);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "resting") return;
    if (restRemaining <= 0) {
      const fresh = generator!(
        { config: skill!.config, selectedPool: sessionConfig!.selectedPoolItems },
        current?.label,
      );
      const freshNext = generator!(
        { config: skill!.config, selectedPool: sessionConfig!.selectedPoolItems },
        fresh.label,
      );
      setCurrent(fresh);
      setNext(freshNext);
      setPhase("practice");
      return;
    }
    const t = setTimeout(() => setRestRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, restRemaining]);

  const complete = useMutation({
    mutationFn: (finalMisses: number) =>
      api.completeSession({
        session_id: sessionId!,
        sets_completed: sessionConfig!.sets,
        reps_completed: sessionConfig!.sets * sessionConfig!.repsPerSet,
        misses: finalMisses,
        tempo_end: sessionConfig!.tempo,
      }),
    onSuccess: () => navigate("/session/complete"),
  });

  const ready = !!(skill && sessionConfig && sessionId && current && next);

  useHotkeys(
    phase === "practice"
      ? {
          Enter: () => advance("rep_hit"),
          m: () => advance("rep_miss"),
          Escape: () => navigate("/skills"),
        }
      : phase === "resting"
        ? { Enter: () => setRestRemaining(0), Escape: () => navigate("/skills") }
        : {},
    ready,
  );

  if (!ready) return null;

  const cfg = sessionConfig;
  const sk = skill;

  function logEvent(eventType: string, payload: Record<string, unknown>) {
    seqRef.current += 1;
    void api.logSessionEvent({
      session_id: sessionId!,
      seq: seqRef.current,
      event_type: eventType,
      payload,
    });
  }

  function advance(eventType: "rep_hit" | "rep_miss") {
    const missTotal = eventType === "rep_miss" ? misses + 1 : misses;
    if (eventType === "rep_miss") setMisses(missTotal);
    logEvent(eventType, { label: current!.label, set: setIndex + 1, rep: repIndex + 1 });

    const isLastRepOfSet = repIndex + 1 >= cfg.repsPerSet;
    if (!isLastRepOfSet) {
      setRepIndex((r) => r + 1);
      setCurrent(next);
      setNext(
        generator!({ config: sk.config, selectedPool: cfg.selectedPoolItems }, next!.label),
      );
      return;
    }

    logEvent("set_complete", { set: setIndex + 1 });
    const isLastSet = setIndex + 1 >= cfg.sets;
    if (isLastSet) {
      setPhase("finishing");
      complete.mutate(missTotal);
      return;
    }

    setSetIndex((s) => s + 1);
    setRepIndex(0);
    if (cfg.restSeconds > 0) {
      setPhase("resting");
      setRestRemaining(cfg.restSeconds);
    } else {
      setCurrent(next);
      setNext(
        generator!({ config: sk.config, selectedPool: cfg.selectedPoolItems }, next!.label),
      );
    }
  }

  const totalRepsDone = setIndex * sessionConfig.repsPerSet + repIndex;
  const totalReps = sessionConfig.sets * sessionConfig.repsPerSet;
  const overallPct = Math.round((totalRepsDone / totalReps) * 100);

  if (phase === "resting") {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-bg">
        <div className="text-xs uppercase tracking-[2px] text-ink-faint">Rest</div>
        <div className="font-display text-7xl font-semibold text-ink">{restRemaining}s</div>
        <div className="text-sm text-ink-faint">
          Set {setIndex + 1} of {sessionConfig.sets} next
        </div>
        <Button variant="outline" onClick={() => setRestRemaining(0)}>
          Skip rest
        </Button>
        <div className="text-xs text-ink-faint">Enter to skip &middot; Esc to exit</div>
      </div>
    );
  }

  if (phase === "finishing") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg">
        <div className="text-sm text-ink-faint">Saving session...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-bg">
      <div className="flex h-16 shrink-0 items-center px-10">
        <button
          onClick={() => navigate("/skills")}
          className="w-32 text-left text-[13px] text-ink-faint"
        >
          &times; Exit
        </button>
        <div className="flex-1 text-center text-[13px] text-ink-faint">{skill.name}</div>
        <div className="w-32 text-right text-[13px] text-ink-muted">
          {sessionConfig.tempo} BPM &#9834;
        </div>
      </div>
      <div className="h-1 shrink-0 bg-border">
        <div className="h-full bg-rhythm transition-all" style={{ width: `${overallPct}%` }} />
      </div>
      <div className="mt-3.5 text-center text-xs text-ink-faint">
        Set {setIndex + 1} of {sessionConfig.sets} &middot; Rep {repIndex + 1} of{" "}
        {sessionConfig.repsPerSet}
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center",
          current.tab ? "gap-4" : "gap-8",
        )}
      >
        <div className={cn("flex items-center", current.tab ? "gap-10" : "gap-16")}>
          <div
            className={cn(
              "font-display font-bold leading-none text-ink",
              current.tab ? "text-6xl" : "text-[9rem]",
            )}
          >
            {current.label}
          </div>
          {current.chordShapeName && (
            <ChordDiagram name={current.chordShapeName} instrument={current.chordInstrument} />
          )}
          {current.tab && <FretboardShape tab={current.tab} root={current.tabRoot} />}
        </div>
        {current.tab && <TabSnippet lines={current.tab} />}
        {current.keys && <KeyboardDiagram keys={current.keys} roots={current.rootKeys} />}
        {current.detail && <div className="text-sm text-ink-faint">{current.detail}</div>}
        <div className="text-sm text-ink-faint">
          Next: <span className="font-semibold text-ink-muted">{next.label}</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3.5 pb-11">
        <div className="flex gap-4">
          <Button variant="danger" size="lg" onClick={() => advance("rep_miss")}>
            Mark Miss
          </Button>
          <Button size="lg" onClick={() => advance("rep_hit")}>
            Got it &mdash; Next &rarr;
          </Button>
        </div>
        <div className="text-xs text-ink-faint">
          Enter got it &middot; M miss &middot; Esc exit
        </div>
        <button onClick={() => navigate("/skills")} className="text-xs text-ink-faint">
          Skip this skill
        </button>
      </div>
    </div>
  );
}
