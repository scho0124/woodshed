import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Volume2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { useAudioInput } from "@/hooks/useAudioInput";
import { LevelMeter } from "@/components/LevelMeter";
import { selectClass } from "@/components/AudioGate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { hzToMidi, median, midiName, midiToHz } from "@/lib/music";
import { pitchClass } from "@/lib/pianoTheory";
import {
  listenSeconds,
  needsSpeakingLevel,
  scoreCheck,
  type CheckResult,
  type MicCheckConfig,
  type Verdict,
  type VoiceFrame,
} from "@/lib/voiceCheck";
import type { AudioInputInfo } from "@/lib/types";

const QUIET_SECS = 1.5;
const SPEAK_SECS = 3;

const WHAT_IT_CHECKS: Record<MicCheckConfig["kind"], string> = {
  breath: "Times one breath and checks the air comes out evenly.",
  hold: "Checks how long you hold the note, whether it's in tune and how steady it stays.",
  vibrato: "Measures how fast and how wide your vibrato is while you hold a note.",
  notes: "Finds each note you hold, checks it's in tune and listens for cracks.",
  belt: "Checks your notes are in tune and your volume stays in a safe range above your speaking voice.",
  fry: "Checks the fry stays quiet, steady and below your speaking volume.",
  scream:
    "Listens for distortion and for safety signs: pushing past your speaking volume, bursts that run long and too little rest.",
};

const DOT: Record<Verdict, string> = { good: "bg-success", ok: "bg-rhythm", bad: "bg-danger" };

/** The saved mic if it's plugged in, else a USB mic, else the system default. Never a guitar input. */
function preferredMic(inputs: AudioInputInfo[] | undefined, savedId: string | null | undefined) {
  const mics = (inputs ?? []).filter((i) => !i.likely_instrument);
  return (
    mics.find((i) => i.id === savedId) ?? mics.find((i) => i.likely_usb) ?? mics.find((i) => i.is_default) ?? mics[0] ?? null
  );
}

/** A short reference tone between A3 and G#4, played before listening so the mic doesn't hear it. */
function playNote(note: string, a4: number) {
  const midi = 57 + ((pitchClass(note)! - 9 + 12) % 12);
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = midiToHz(midi, a4);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.04);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
  osc.connect(gain).connect(ctx.destination);
  osc.onended = () => void ctx.close();
  osc.start();
  osc.stop(ctx.currentTime + 1.6);
}

/**
 * A vocal skill's mic check: listens through a mic (never the guitar input)
 * while you do a short exercise, then reports pitch, sustain and safety signs.
 * `pool` is the skill's selected pool, for checks that aim at a note from it.
 */
export function MicCheck({
  check,
  pool,
  onBusyChange,
}: {
  check: MicCheckConfig;
  pool: string[];
  onBusyChange?: (busy: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const profile = useAppStore((s) => s.profile)!;
  const setProfile = useAppStore((s) => s.setProfile);
  const speakingLevel = useAppStore((s) => s.speakingLevel);
  const setSpeakingLevel = useAppStore((s) => s.setSpeakingLevel);

  const inputs = useQuery({ queryKey: ["audio-inputs"], queryFn: api.listAudioInputs });
  const settings = useQuery({ queryKey: ["audio-settings"], queryFn: api.getAudioSettings });
  const mics = (inputs.data ?? []).filter((i) => !i.likely_instrument);
  const mic = preferredMic(inputs.data, settings.data?.voice_device_id);
  const a4 = settings.data?.a4_hz ?? 440;

  const [picked, setPicked] = useState<string | null>(null);
  const target = check.target_from_pool ? (picked && pool.includes(picked) ? picked : (pool[0] ?? null)) : null;

  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [missedSpeaking, setMissedSpeaking] = useState(false);
  const [felt, setFelt] = useState<"fine" | "hurt" | null>(null);
  const frames = useRef<VoiceFrame[]>([]);
  const plan = useRef({ speak: false, singFrom: QUIET_SECS, end: QUIET_SECS });
  const finished = useRef(true);

  useEffect(() => onBusyChange?.(phase === "running"), [phase, onBusyChange]);

  const knownLevel =
    speakingLevel && speakingLevel.profileId === profile.id && speakingLevel.deviceId === (mic?.id ?? null)
      ? speakingLevel.db
      : null;

  const audio = useAudioInput({
    enabled: phase === "running",
    range: "voice",
    restartKey: settings.data?.voice_device_id ?? "",
    onEvent: (event) => {
      if (event.type !== "frame" || finished.current) return;
      const f = frames.current;
      f.push({ t: event.t, hz: event.hz, level_db: event.level_db, clipping: event.clipping });
      if (event.t - f[0].t >= plan.current.end) finish();
    },
  });

  useEffect(() => {
    if (audio.frame && frames.current.length) setElapsed(audio.frame.t - frames.current[0].t);
  }, [audio.frame]);

  const allow = useMutation({
    mutationFn: () => api.setAudioConsent(profile.id, true),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setProfile(updated);
    },
  });

  const chooseMic = useMutation({
    mutationFn: (id: string) => api.setAudioSettings({ ...settings.data!, voice_device_id: id }),
    onSuccess: (saved) => queryClient.setQueryData(["audio-settings"], saved),
  });

  async function start() {
    if (!mic || !settings.data) return;
    if (settings.data.voice_device_id !== mic.id) await chooseMic.mutateAsync(mic.id);
    const speak = needsSpeakingLevel(check) && knownLevel === null;
    const singFrom = QUIET_SECS + (speak ? SPEAK_SECS : 0);
    plan.current = { speak, singFrom, end: singFrom + listenSeconds(check) };
    frames.current = [];
    finished.current = false;
    setResult(null);
    setFelt(null);
    setMissedSpeaking(false);
    setElapsed(0);
    setPhase("running");
  }

  function finish() {
    if (finished.current) return;
    finished.current = true;
    const f = frames.current;
    const t0 = f[0]?.t ?? 0;
    const at = (x: VoiceFrame) => x.t - t0;
    const { speak, singFrom } = plan.current;
    const gate = settings.data?.gate_db ?? -55;
    const room = f.filter((x) => at(x) < QUIET_SECS).map((x) => x.level_db);
    const threshold = Math.max(gate, (room.length ? median(room) : gate) + 10);

    let speaking = knownLevel;
    if (speak) {
      const spoken = f
        .filter((x) => at(x) >= QUIET_SECS && at(x) < singFrom && x.level_db >= threshold)
        .map((x) => x.level_db);
      speaking = spoken.length >= 20 ? median(spoken) : null;
      setMissedSpeaking(speaking === null);
      if (speaking !== null) setSpeakingLevel({ profileId: profile.id, deviceId: mic?.id ?? null, db: speaking });
    }

    setResult(
      scoreCheck(
        check,
        f.filter((x) => at(x) >= singFrom),
        { threshold, speaking, targetMidi: target ? 60 + pitchClass(target)! : null, a4 },
      ),
    );
    setPhase("done");
  }

  function stop() {
    if (elapsed >= plan.current.singFrom + 1) {
      finish();
    } else {
      finished.current = true;
      setPhase("idle");
    }
  }

  const step =
    elapsed < QUIET_SECS ? "quiet" : plan.current.speak && elapsed < plan.current.singFrom ? "speak" : "sing";
  const stepEnd = step === "quiet" ? QUIET_SECS : step === "speak" ? plan.current.singFrom : plan.current.end;
  const secondsLeft = Math.max(0, Math.ceil(stepEnd - elapsed));
  const live = audio.frame?.hz ? hzToMidi(audio.frame.hz, a4) : null;
  const safetyCheck = check.kind === "scream" || check.kind === "fry" || check.kind === "belt";

  let body;
  if (!profile.audio_consent_at) {
    body = (
      <div className="flex items-center justify-between gap-4">
        <div className="text-[13px] leading-relaxed text-ink-muted">
          Mic checks listen to your mic while you do the exercise. Sound is analyzed as it arrives and is never recorded
          or saved.
        </div>
        <Button size="sm" disabled={allow.isPending} onClick={() => allow.mutate()}>
          Allow listening
        </Button>
      </div>
    );
  } else if (inputs.isLoading || settings.isLoading) {
    body = <div className="text-[13px] text-ink-faint">Looking for a microphone...</div>;
  } else if (!mic) {
    body = (
      <div className="flex items-center justify-between gap-4">
        <div className="text-[13px] leading-relaxed text-ink-muted">
          No microphone found. Plug in a mic, ideally a USB one, then refresh. Guitar inputs aren't used for mic checks.
        </div>
        <Button variant="outline" size="sm" onClick={() => void inputs.refetch()}>
          Refresh
        </Button>
      </div>
    );
  } else if (phase === "running") {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <div className="text-[15px] font-semibold text-ink">
            {audio.status === "error"
              ? "The mic stopped"
              : audio.status !== "listening"
                ? "Opening the mic..."
                : step === "quiet"
                  ? "Stay quiet for a moment"
                  : step === "speak"
                    ? "Now count from one to ten at your normal speaking volume"
                    : check.prompt}
          </div>
          {audio.status === "listening" && <div className="font-display text-2xl font-semibold text-ink">{secondsLeft}</div>}
        </div>
        {audio.error && <div className="text-xs text-danger">{audio.error}</div>}
        {target && step === "sing" && <div className="text-xs text-ink-faint">Target: {target}, in any octave</div>}
        <LevelMeter frame={audio.frame} gateDb={settings.data!.gate_db} status={audio.status} />
        <div className="flex items-center justify-between">
          <div className="text-[13px] text-ink-muted">
            {step === "sing" && live !== null
              ? `Hearing ${midiName(Math.round(live))}, ${Math.round((live - Math.round(live)) * 100)} cents`
              : " "}
          </div>
          <Button variant="outline" size="sm" onClick={stop}>
            {step === "sing" ? "Stop and score" : "Cancel"}
          </Button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-3">
        {phase === "done" && result && (
          <div className="flex flex-col gap-3">
            {!result.heard ? (
              <div className="text-[13px] text-ink-muted">
                Didn't hear anything above the room. Check the right mic is chosen and the level meter moves when you
                sing, then try again.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {result.readings.map((r) => (
                  <div key={r.label} className="flex items-start gap-3">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[r.verdict])} />
                    <div className="flex-1">
                      <div className="flex justify-between gap-3 text-[13px]">
                        <span className="text-ink-muted">{r.label}</span>
                        <span className="text-right text-ink">{r.value}</span>
                      </div>
                      {r.hint && <div className="text-[11px] leading-relaxed text-ink-faint">{r.hint}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {missedSpeaking && (
              <div className="text-xs text-ink-faint">
                Didn't hear you count, so loudness wasn't compared. Try again and count out loud at your normal volume.
              </div>
            )}
            {result.warnings.map((w) => (
              <div key={w} className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] leading-relaxed text-ink">
                {w}
              </div>
            ))}
            {safetyCheck && result.heard && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <div className="text-[13px] text-ink">Did anything scratch, tickle or hurt?</div>
                <div className="flex gap-2">
                  <Button size="sm" variant={felt === "fine" ? "primary" : "outline"} onClick={() => setFelt("fine")}>
                    Felt fine
                  </Button>
                  <Button size="sm" variant={felt === "hurt" ? "danger" : "outline"} onClick={() => setFelt("hurt")}>
                    Something hurt
                  </Button>
                </div>
                {felt === "hurt" && (
                  <div className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] leading-relaxed text-ink">
                    Stop for today. Rest your voice, sip water, and don't try to push through it. If pain or hoarseness
                    lasts more than two weeks, see a doctor or a voice specialist.
                  </div>
                )}
                {felt === "fine" && (
                  <div className="text-xs text-ink-faint">Good. Keep sessions short and rest between sets.</div>
                )}
              </div>
            )}
          </div>
        )}

        {phase === "idle" && (
          <div className="text-[13px] leading-relaxed text-ink-muted">
            {check.prompt} {WHAT_IT_CHECKS[check.kind]}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label htmlFor="mic-input" className="text-[11px] text-ink-faint">
              Microphone
            </label>
            <select
              id="mic-input"
              className={selectClass}
              value={mic.id}
              onChange={(e) => chooseMic.mutate(e.target.value)}
            >
              {mics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.likely_usb ? " (USB)" : ""}
                </option>
              ))}
            </select>
          </div>
          {target && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mic-target" className="text-[11px] text-ink-faint">
                Target note
              </label>
              <div className="flex gap-2">
                <select
                  id="mic-target"
                  className={cn(selectClass, "w-20")}
                  value={target}
                  onChange={(e) => setPicked(e.target.value)}
                >
                  {pool.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <Button variant="outline" className="h-11" onClick={() => playNote(target, a4)} aria-label="Hear the note">
                  <Volume2 size={15} />
                </Button>
              </div>
            </div>
          )}
          <Button className="h-11" onClick={() => void start()} disabled={chooseMic.isPending}>
            {phase === "done" ? "Check again" : "Start check"}
          </Button>
        </div>
        <div className="text-[11px] leading-relaxed text-ink-faint">
          {!mic.likely_usb && "This looks like a built-in or analog mic; a USB mic gives steadier readings. "}
          Keep the mic about a fist away, the same distance every time.
          {knownLevel !== null && needsSpeakingLevel(check) && (
            <>
              {" "}
              <button className="underline hover:text-ink" onClick={() => setSpeakingLevel(null)}>
                Measure your speaking level again
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-2.5">
      <Label>Mic check</Label>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        {body}
        {safetyCheck && phase !== "running" && (
          <div className="text-[11px] leading-relaxed text-ink-faint">
            The mic hears the sound, not your throat. Stop any exercise that scratches, tickles or hurts.
          </div>
        )}
      </div>
    </div>
  );
}
