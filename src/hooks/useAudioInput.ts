import { useEffect, useRef, useState } from "react";
import { Channel } from "@tauri-apps/api/core";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import type { AudioEvent, StartedInput } from "@/lib/types";
import type { Instrument } from "@/lib/tunings";

export type AudioStatus = "idle" | "starting" | "listening" | "error";
export type FrameEvent = Extract<AudioEvent, { type: "frame" }>;

/**
 * Listens to the configured audio input while `enabled` and the profile has
 * given permission; stops on unmount. `frame` updates at most once per
 * animation frame; every event also goes to `onEvent`. Change `restartKey`
 * (e.g. after audio settings change) to reopen the input.
 */
export function useAudioInput({
  enabled,
  range,
  restartKey,
  onEvent,
}: {
  enabled: boolean;
  range: Instrument;
  restartKey?: string;
  onEvent?: (event: AudioEvent) => void;
}) {
  const profile = useAppStore((s) => s.profile);
  const allowed = !!profile?.audio_consent_at;
  const [status, setStatus] = useState<AudioStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<StartedInput | null>(null);
  const [frame, setFrame] = useState<FrameEvent | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !allowed || !profile) {
      setStatus("idle");
      setFrame(null);
      return;
    }
    let cancelled = false;
    let latest: FrameEvent | null = null;
    let raf = 0;

    const channel = new Channel<AudioEvent>();
    channel.onmessage = (event) => {
      if (cancelled) return;
      if (event.type === "frame") {
        latest = event;
        raf ||= requestAnimationFrame(() => {
          raf = 0;
          if (!cancelled) setFrame(latest);
        });
      } else if (event.type === "error") {
        setStatus("error");
        setError(event.message);
      }
      onEventRef.current?.(event);
    };

    setStatus("starting");
    setError(null);
    const started = api.startAudioInput(profile.id, range, channel);
    started
      .then((info) => {
        if (cancelled) return;
        setDevice(info);
        setStatus("listening");
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus("error");
        setError(String(e));
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      // Stop this capture once it has started; a newer one is left alone.
      started.then((info) => api.stopAudioInput(info.session)).catch(() => {});
    };
  }, [enabled, allowed, profile?.id, range, restartKey]);

  return { status, error, device, frame, allowed };
}
