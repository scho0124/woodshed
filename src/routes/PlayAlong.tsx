import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { AudioGate, selectClass } from "@/components/AudioGate";
import { audioRestartKey } from "@/components/AudioSettingsPanel";
import { LevelMeter, ListeningBadge } from "@/components/LevelMeter";
import { TabText } from "@/components/TabText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAudioInput } from "@/hooks/useAudioInput";
import { useHotkeys } from "@/hooks/useHotkeys";
import { midiName } from "@/lib/music";
import { initialMatch, matchReducer, scoredNote, stepDetails, summarize } from "@/lib/playAlong";
import type { Loop, MatchAction, MatchOptions, MatchState, RunSummary } from "@/lib/playAlong";
import { parseTab } from "@/lib/tabParser";
import type { ParsedTab, Step } from "@/lib/tabParser";
import { TUNINGS, findTuning, instrumentFor, normalizeTuningName, standardFor } from "@/lib/tunings";
import type { AudioSettings, TabDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Options {
  tuning: string;
  capo: number;
  strict: boolean;
  anyOctave: boolean;
  section: number | null;
}

interface RunResult {
  summary: RunSummary;
  completed: boolean;
  seconds: number;
  hadChords: boolean;
}

type Phase = { kind: "setup" } | { kind: "playing"; run: number } | { kind: "done"; result: RunResult };

const TECHNIQUE_LABEL: Record<string, string> = {
  hammer: "hammer-on",
  pull: "pull-off",
  slide: "slide",
  harmonic: "natural harmonic",
};

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);

function sectionLoop(parsed: ParsedTab, section: number | null): Loop | null {
  const s = section !== null ? parsed.sections[section] : undefined;
  return s && s.lastStep >= s.firstStep ? { start: s.firstStep, end: s.lastStep } : null;
}

export function PlayAlong() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useAppStore((s) => s.profile);

  useEffect(() => {
    if (!profile) navigate("/profiles", { replace: true });
  }, [profile, navigate]);

  const { data: tab, error } = useQuery({
    queryKey: ["tab", id],
    queryFn: () => api.getTab(id!),
    enabled: !!id && !!profile,
  });
  const settings = useQuery({ queryKey: ["audio-settings"], queryFn: api.getAudioSettings });
  const runs = useQuery({
    queryKey: ["playalong-runs", profile?.id, id],
    queryFn: () => api.listPlayAlongRuns(profile!.id, id!),
    enabled: !!id && !!profile,
  });

  const [options, setOptions] = useState<Options | null>(null);
  useEffect(() => {
    if (tab && !options) {
      setOptions({ tuning: tab.tuning, capo: tab.capo, strict: false, anyOctave: true, section: null });
    }
  }, [tab, options]);

  const parsed = useMemo(
    () => (tab?.content != null && options ? parseTab(tab.content, { tuning: options.tuning, capo: options.capo }) : null),
    [tab?.content, options?.tuning, options?.capo],
  );
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });

  const saveRun = useMutation({
    mutationFn: api.createPlayAlongRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playalong-runs", profile?.id, id] });
      queryClient.invalidateQueries({ queryKey: ["progress-stats", profile?.id] });
    },
  });

  function endRun(state: MatchState, startedAt: Date, completed: boolean, next: "summary" | "exit" | "restart") {
    if (!parsed || !options || !tab || !profile) return;
    const summary = summarize(state, parsed.steps, parsed.sections);
    const endedAt = new Date();
    if (summary.notesPlayed > 0) {
      saveRun.mutate({
        profile_id: profile.id,
        tab_id: tab.id,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        completed,
        notes_played: summary.notesPlayed,
        first_try_hits: summary.firstTry,
        retried_hits: summary.retried,
        skipped: summary.skipped,
        wrong_notes: summary.wrong,
        settings: { ...options, loop: state.loop },
        details: { stepCount: parsed.steps.length, steps: stepDetails(state) },
      });
    }
    if (next === "exit") navigate(`/tabs/${tab.id}`);
    else if (next === "restart") setPhase({ kind: "playing", run: Date.now() });
    else
      setPhase({
        kind: "done",
        result: {
          summary,
          completed,
          seconds: (endedAt.getTime() - startedAt.getTime()) / 1000,
          hadChords: parsed.steps.some((s) => s.kind === "chord"),
        },
      });
  }

  if (!profile) return null;

  return (
    <div className="flex h-screen w-screen flex-col bg-bg">
      {error ? (
        <div className="p-12 text-sm text-ink-faint">This tab couldn't be loaded: {String(error)}</div>
      ) : !tab || !options || !settings.data ? (
        <div className="p-12 text-sm text-ink-faint">Loading...</div>
      ) : phase.kind === "setup" || !parsed ? (
        <Setup
          tab={tab}
          parsed={parsed}
          options={options}
          setOptions={setOptions}
          runs={runs.data ?? []}
          onStart={() => setPhase({ kind: "playing", run: Date.now() })}
        />
      ) : phase.kind === "playing" ? (
        <AudioGate onDecline={() => setPhase({ kind: "setup" })}>
          <Run
            key={phase.run}
            tab={tab}
            parsed={parsed}
            loop={sectionLoop(parsed, options.section)}
            matchOptions={{
              toleranceCents: options.strict ? 25 : 50,
              anyOctave: options.anyOctave,
              a4: settings.data.a4_hz,
            }}
            settings={settings.data}
            onEnd={endRun}
          />
        </AudioGate>
      ) : (
        <Summary
          tab={tab}
          result={phase.result}
          saving={saveRun.isPending}
          saveError={saveRun.error ? String(saveRun.error) : null}
          onAgain={() => setPhase({ kind: "playing", run: Date.now() })}
          onSetup={() => setPhase({ kind: "setup" })}
        />
      )}
    </div>
  );
}

function Header({ tab, onBack, children }: { tab: TabDetail; onBack: () => void; children?: ReactNode }) {
  return (
    <div className="flex min-h-[72px] shrink-0 items-center gap-4 border-b border-border px-12 py-3">
      <button onClick={onBack} className="text-lg text-ink-muted" aria-label="Back">
        &larr;
      </button>
      <div className="h-6 w-px bg-border" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-lg font-semibold text-ink">{tab.title}</div>
        <div className="truncate text-[11px] text-ink-faint">Play-along{tab.artist ? ` · ${tab.artist}` : ""}</div>
      </div>
      {children}
    </div>
  );
}

function Setup({
  tab,
  parsed,
  options,
  setOptions,
  runs,
  onStart,
}: {
  tab: TabDetail;
  parsed: ParsedTab | null;
  options: Options;
  setOptions: (o: Options) => void;
  runs: { started_at: string; notes_played: number; first_try_hits: number; completed: boolean }[];
  onStart: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useAppStore((s) => s.profile)!;

  const saveToTab = useMutation({
    mutationFn: () =>
      api.updateTab({ id: tab.id, title: tab.title, artist: tab.artist, tuning: options.tuning, capo: options.capo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tab", tab.id] });
      queryClient.invalidateQueries({ queryKey: ["tabs", profile.id] });
    },
  });

  const steps = parsed?.steps ?? [];
  const notes = steps.filter((s) => s.kind === "note").length;
  const chords = steps.filter((s) => s.kind === "chord").length;
  const canStart = notes + chords > 0;
  const count = parsed?.stringCount ?? 6;
  const matching = TUNINGS.filter((t) => t.strings.length === count);
  const savedName = findTuning(normalizeTuningName(options.tuning))?.name ?? options.tuning;
  const tuneTo = savedName || standardFor(count)?.name || "Standard";
  const differsFromTab = options.tuning !== tab.tuning || options.capo !== tab.capo;
  const best = runs.reduce<number | null>((b, r) => {
    const acc = r.notes_played ? r.first_try_hits / r.notes_played : null;
    return acc !== null && (b === null || acc > b) ? acc : b;
  }, null);

  useHotkeys({
    Enter: () => canStart && onStart(),
    Escape: () => navigate(`/tabs/${tab.id}`),
    t: () => navigate(`/tuner?tuning=${encodeURIComponent(tuneTo)}`),
  });

  return (
    <>
      <Header tab={tab} onBack={() => navigate(`/tabs/${tab.id}`)} />
      <div className="flex flex-1 gap-8 overflow-auto px-12 py-8">
        <div className="flex max-w-xl flex-1 flex-col gap-6">
          {tab.content == null ? (
            <div className="text-sm text-ink-muted">
              Play-along works with text tabs. This file ({tab.file_name}) opens in another app.
            </div>
          ) : !canStart ? (
            <div className="text-sm text-ink-muted">
              No tab staff found in this file. Play-along needs lines like <code className="text-ink">e|---0---3---|</code>;
              chord sheets don't have individual notes to check.
            </div>
          ) : (
            <div className="text-[13px] text-ink-muted">
              {notes} notes{chords > 0 && ` · ${chords} chords`}
              {chords > 0 && (
                <div className="mt-1 text-xs text-ink-faint">
                  Chords move on when you strum. They aren't scored yet; single notes are.
                </div>
              )}
            </div>
          )}

          {parsed && canStart && (
            <>
              <div className="grid grid-cols-[1fr_120px] gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pa-tuning">Tuning</Label>
                  <select
                    id="pa-tuning"
                    className={selectClass}
                    value={matching.some((t) => t.name === savedName) || !options.tuning ? savedName : options.tuning}
                    onChange={(e) => setOptions({ ...options, tuning: e.target.value })}
                  >
                    <option value="">From the tab's string labels</option>
                    {!matching.some((t) => t.name === savedName) && options.tuning && (
                      <option value={options.tuning}>{options.tuning}</option>
                    )}
                    {matching.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {parsed.tuning && (
                    <div className="text-[11px] text-ink-faint">
                      Open strings: {parsed.tuning.map((m) => midiName(m)).join(" ")}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pa-capo">Capo</Label>
                  <Input
                    id="pa-capo"
                    type="number"
                    min={0}
                    max={12}
                    value={options.capo}
                    onChange={(e) =>
                      setOptions({ ...options, capo: Math.min(12, Math.max(0, Number(e.target.value) || 0)) })
                    }
                  />
                </div>
              </div>

              {differsFromTab && (
                <button
                  onClick={() => saveToTab.mutate()}
                  disabled={saveToTab.isPending}
                  className="-mt-3 self-start text-xs text-rhythm hover:underline"
                >
                  Save this tuning and capo to the tab
                </button>
              )}

              <div className="flex flex-col gap-2">
                <Label>Accuracy</Label>
                <div className="flex gap-2">
                  {[
                    { label: "Normal (±50 cents)", strict: false },
                    { label: "Strict (±25 cents)", strict: true },
                  ].map((o) => (
                    <button
                      key={o.label}
                      onClick={() => setOptions({ ...options, strict: o.strict })}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 text-xs font-semibold",
                        options.strict === o.strict
                          ? "bg-tab text-bg"
                          : "border border-border-strong text-ink-muted hover:text-ink",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Switch
                  checked={options.anyOctave}
                  onCheckedChange={(anyOctave) => setOptions({ ...options, anyOctave })}
                  aria-label="Accept any octave"
                />
                <div className="text-[13px] text-ink">
                  Accept the right note in any octave
                  <div className="text-[11px] text-ink-faint">
                    Guards against the pitch detector slipping an octave on low strings.
                  </div>
                </div>
              </div>

              {parsed.sections.some((s) => s.lastStep >= s.firstStep) && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pa-section">Play</Label>
                  <select
                    id="pa-section"
                    className={selectClass}
                    value={options.section ?? ""}
                    onChange={(e) =>
                      setOptions({ ...options, section: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  >
                    <option value="">The whole tab</option>
                    {parsed.sections.map((s, i) =>
                      s.lastStep >= s.firstStep ? (
                        <option key={i} value={i}>
                          {s.name} (looped)
                        </option>
                      ) : null,
                    )}
                  </select>
                </div>
              )}

              {parsed.warnings.length > 0 && (
                <ul className="flex flex-col gap-1 rounded-[10px] border border-rhythm/30 px-4 py-3 text-xs text-rhythm">
                  {parsed.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate(`/tuner?tuning=${encodeURIComponent(tuneTo)}`)}>
              Tune first
            </Button>
            <Button className="flex-1" disabled={!canStart} onClick={onStart}>
              Start &rarr;
            </Button>
          </div>
          <div className="text-[11px] leading-relaxed text-ink-faint">
            While playing: → skip · ← back · click a note to jump · Shift+click to loop from the current note · L loop
            this section or bar · P pause · R restart · Esc stop. Here: Enter start · T tuner.
          </div>
        </div>

        <div className="h-fit w-[280px] shrink-0 rounded-[18px] border border-border bg-surface p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Your runs</div>
          {runs.length === 0 ? (
            <div className="text-xs text-ink-faint">No runs yet.</div>
          ) : (
            <>
              <div className="mb-3 text-[13px] text-ink">Best: {pct(best)}</div>
              <div className="flex flex-col gap-1.5">
                {runs.slice(0, 6).map((r) => (
                  <div key={r.started_at} className="flex justify-between text-xs">
                    <span className="text-ink-muted">
                      {new Date(r.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      {!r.completed && <span className="text-ink-faint"> · partial</span>}
                    </span>
                    <span className="text-ink">
                      {pct(r.notes_played ? r.first_try_hits / r.notes_played : null)}
                      <span className="text-ink-faint"> of {r.notes_played}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function describeStep(step: Step): string {
  if (step.kind === "chord") {
    const names = step.notes.filter((n) => n.scored).map((n) => midiName(n.midi!, false));
    return `Chord (${names.join(" ")}): strum it`;
  }
  const n = scoredNote(step);
  if (!n) return "";
  const where = `String ${step.stringCount - n.string}, fret ${n.fret}`;
  if (n.bendTo !== undefined) return `${where}, bend up to ${midiName(n.bendTo)}`;
  const how = n.technique ? TECHNIQUE_LABEL[n.technique] : undefined;
  return `${where} → ${midiName(n.midi!)}${how ? ` (${how})` : ""}`;
}

function Run({
  tab,
  parsed,
  loop,
  matchOptions,
  settings,
  onEnd,
}: {
  tab: TabDetail;
  parsed: ParsedTab;
  loop: Loop | null;
  matchOptions: MatchOptions;
  settings: AudioSettings;
  onEnd: (state: MatchState, startedAt: Date, completed: boolean, next: "summary" | "exit" | "restart") => void;
}) {
  const optionsRef = useRef(matchOptions);
  optionsRef.current = matchOptions;
  const [state, dispatch] = useReducer(
    (s: MatchState, a: MatchAction) => matchReducer(s, a, parsed.steps, optionsRef.current),
    undefined,
    () => initialMatch(parsed.steps, loop),
  );
  const startedAt = useRef(new Date());
  const [paused, setPaused] = useState(false);
  const [retry, setRetry] = useState(0);

  const audio = useAudioInput({
    enabled: !paused && !state.finished,
    range: instrumentFor(parsed.tuning ?? [40]),
    restartKey: `${audioRestartKey(settings)}|${retry}`,
    onEvent: dispatch,
  });

  useEffect(() => {
    if (state.finished) onEnd(state, startedAt.current, true, "summary");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.finished]);

  const step = parsed.steps[state.index];
  const summary = useMemo(() => summarize(state, parsed.steps, parsed.sections), [state, parsed]);

  function toggleLoop() {
    if (state.loop) {
      dispatch({ type: "loop", loop: null });
      return;
    }
    const section = step.section !== null ? parsed.sections[step.section] : undefined;
    if (section && section.lastStep >= section.firstStep) {
      dispatch({ type: "loop", loop: { start: section.firstStep, end: section.lastStep } });
      return;
    }
    const inBar = parsed.steps.filter((s) => s.bar === step.bar);
    dispatch({ type: "loop", loop: { start: inBar[0].index, end: inBar[inBar.length - 1].index } });
  }

  useHotkeys({
    ArrowRight: () => dispatch({ type: "skip" }),
    ArrowLeft: () => dispatch({ type: "back" }),
    l: toggleLoop,
    p: () => setPaused((p) => !p),
    r: () => onEnd(state, startedAt.current, false, "restart"),
    Escape: () => onEnd(state, startedAt.current, false, "exit"),
  });

  const fb = state.feedback;
  const scoredTotal = parsed.steps.filter((s) => s.kind !== "unscored").length;
  const position = parsed.steps.slice(0, state.index + 1).filter((s) => s.kind !== "unscored").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header tab={tab} onBack={() => onEnd(state, startedAt.current, false, "exit")}>
        <div className="text-right text-xs text-ink-muted">
          <div>
            Step {position} of {scoredTotal}
            {state.loop && <span className="text-tab"> · looping{state.loopPasses > 0 && ` (${state.loopPasses})`}</span>}
          </div>
          <div className="text-ink-faint">First-try accuracy {pct(summary.accuracy)}</div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onEnd(state, startedAt.current, false, "summary")}>
          Finish
        </Button>
      </Header>

      <div className="min-h-0 flex-1 overflow-auto px-12 py-6">
        <TabText
          parsed={parsed}
          status={state.status}
          current={state.index}
          loop={state.loop}
          onStepClick={(index, extend) =>
            dispatch(extend ? { type: "loop", loop: { start: state.index, end: index } } : { type: "jump", index })
          }
        />
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-border px-12 py-4">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Play</div>
            <div className="truncate font-display text-xl font-semibold text-ink">{step ? describeStep(step) : ""}</div>
          </div>
          <div className="shrink-0 text-right text-sm">
            {fb && fb.kind === "wrong" && fb.step === state.index ? (
              <span className="text-danger">
                You played {midiName(fb.playedMidi)}, expected {midiName(fb.expectedMidi)}
              </span>
            ) : fb && fb.kind === "hit" ? (
              <span className="text-success">
                {midiName(fb.playedMidi)} ✓{" "}
                <span className="text-ink-faint">
                  {Math.abs(fb.cents) < 5 ? "dead on" : `${fb.cents > 0 ? "+" : ""}${Math.round(fb.cents)} cents`}
                </span>
              </span>
            ) : null}
          </div>
        </div>
        <ListeningBadge
          status={audio.status}
          error={audio.error}
          deviceName={audio.device?.device_name}
          paused={paused}
          onTogglePause={() => (audio.status === "error" ? setRetry((r) => r + 1) : setPaused((p) => !p))}
        />
        <LevelMeter frame={audio.frame} gateDb={settings.gate_db} status={audio.status} />
      </div>
    </div>
  );
}

function Summary({
  tab,
  result,
  saving,
  saveError,
  onAgain,
  onSetup,
}: {
  tab: TabDetail;
  result: RunResult;
  saving: boolean;
  saveError: string | null;
  onAgain: () => void;
  onSetup: () => void;
}) {
  const navigate = useNavigate();
  const { summary: s } = result;
  useHotkeys({
    Enter: onAgain,
    r: onAgain,
    Escape: () => navigate(`/tabs/${tab.id}`),
  });

  const minutes = Math.floor(result.seconds / 60);
  const seconds = Math.round(result.seconds % 60);
  const counts = [
    { label: "First try", value: s.firstTry, className: "text-success" },
    { label: "After a retry", value: s.retried, className: "text-rhythm" },
    { label: "Skipped", value: s.skipped, className: "text-ink" },
    { label: "Wrong notes played", value: s.wrong, className: "text-danger" },
  ];

  return (
    <>
      <Header tab={tab} onBack={() => navigate(`/tabs/${tab.id}`)} />
      <div className="flex flex-1 justify-center overflow-auto">
        <div className="flex w-[680px] flex-col gap-6 py-10">
          <div>
            <div className="font-display text-5xl font-semibold text-ink">{pct(s.accuracy)}</div>
            <div className="mt-1 text-sm text-ink-muted">
              {s.notesPlayed > 0
                ? `${s.firstTry} of ${s.notesPlayed} notes on the first try`
                : "No single notes were played."}{" "}
              · {result.completed ? "finished" : "stopped early"} in {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
            {result.hadChords && <div className="mt-1 text-xs text-ink-faint">Chords aren't scored yet.</div>}
          </div>

          <div className="grid grid-cols-4 gap-3">
            {counts.map((c) => (
              <div key={c.label} className="rounded-[14px] border border-border bg-surface p-4">
                <div className="text-[11px] text-ink-faint">{c.label}</div>
                <div className={cn("mt-1 font-display text-xl font-semibold", c.className)}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SummaryList
              title="Most missed"
              empty="Nothing missed."
              items={s.mostMissed.map((m) => [m.label, `${m.misses}×`])}
            />
            <SummaryList
              title="Slowest changes"
              empty="No long pauses."
              items={s.slowest.map((x) => [`Bar ${x.bar} · ${x.label}`, `${(x.avgMs / 1000).toFixed(1)} s`])}
            />
            <SummaryList
              title="Weakest bars"
              empty="No weak bars."
              items={s.weakestBars.map((b) => [`Bar ${b.bar}`, `${pct(b.accuracy)} of ${b.notes}`])}
            />
            {s.sections.length > 0 && (
              <SummaryList
                title="By section"
                empty=""
                items={s.sections.map((x) => [x.name, `${pct(x.accuracy)} of ${x.notes}`])}
              />
            )}
          </div>

          <div className="text-xs text-ink-faint">
            {s.notesPlayed === 0
              ? "Nothing to save."
              : saving
                ? "Saving..."
                : saveError
                  ? <span className="text-danger">Couldn't save this run: {saveError}</span>
                  : "Saved to your practice history."}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onSetup}>
              Change settings
            </Button>
            <Button className="flex-1" onClick={onAgain}>
              Play again
            </Button>
          </div>
          <div className="text-[11px] text-ink-faint">Enter or R play again · Esc back to the tab</div>
        </div>
      </div>
    </>
  );
}

function SummaryList({ title, empty, items }: { title: string; empty: string; items: [string, string][] }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-4">
      <div className="mb-2 text-xs font-semibold text-ink-muted">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-ink-faint">{empty}</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 text-xs">
              <span className="truncate text-ink">{label}</span>
              <span className="shrink-0 text-ink-muted">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
