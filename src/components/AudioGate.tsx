import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useHotkeys } from "@/hooks/useHotkeys";
import type { AudioInputInfo } from "@/lib/types";

/** The saved input if it's plugged in, else a guitar interface, else the system default. */
export function preferredInput(inputs: AudioInputInfo[] | undefined, savedId: string | null | undefined) {
  if (!inputs?.length) return null;
  return (
    inputs.find((i) => i.id === savedId) ??
    inputs.find((i) => i.likely_instrument) ??
    inputs.find((i) => i.is_default) ??
    inputs[0]
  );
}

export function inputLabel(input: AudioInputInfo) {
  const extras = [input.likely_instrument ? "guitar input" : null, input.is_default ? "system default" : null];
  const suffix = extras.filter(Boolean).join(", ");
  return suffix ? `${input.name} (${suffix})` : input.name;
}

export const selectClass =
  "h-11 w-full rounded-[10px] border border-border-strong bg-bg px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rhythm/60";

/**
 * Shows `children` only once the current profile has allowed audio input;
 * until then shows what listening involves and asks for permission.
 */
export function AudioGate({ children, onDecline }: { children: ReactNode; onDecline: () => void }) {
  const profile = useAppStore((s) => s.profile);
  if (profile?.audio_consent_at) return <>{children}</>;
  return <AudioConsent onDecline={onDecline} />;
}

function AudioConsent({ onDecline }: { onDecline: () => void }) {
  const queryClient = useQueryClient();
  const profile = useAppStore((s) => s.profile)!;
  const setProfile = useAppStore((s) => s.setProfile);
  const [picked, setPicked] = useState<string | null>(null);

  const inputs = useQuery({ queryKey: ["audio-inputs"], queryFn: api.listAudioInputs });
  const settings = useQuery({ queryKey: ["audio-settings"], queryFn: api.getAudioSettings });
  const chosen = picked ?? preferredInput(inputs.data, settings.data?.device_id)?.id ?? null;
  const hasGuitarInput = !!inputs.data?.some((i) => i.likely_instrument);

  const allow = useMutation({
    mutationFn: async () => {
      const saved = await api.setAudioSettings({ ...settings.data!, device_id: chosen, channel: null });
      queryClient.setQueryData(["audio-settings"], saved);
      return api.setAudioConsent(profile.id, true);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setProfile(updated);
    },
  });

  const canAllow = !!chosen && !!settings.data && !allow.isPending;
  useHotkeys({
    Enter: () => canAllow && allow.mutate(),
    Escape: onDecline,
  });

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto p-8">
      <div className="flex w-[560px] flex-col gap-5 rounded-2xl border border-border bg-surface p-8">
        <div>
          <div className="font-display text-2xl font-semibold text-ink">Let Woodshed listen to your guitar?</div>
          <div className="mt-1 text-xs text-ink-faint">Asked once for {profile.name}. You can take it back any time.</div>
        </div>

        <ul className="flex list-disc flex-col gap-2 pl-5 text-[13px] leading-relaxed text-ink-muted">
          <li>It listens to the input you choose below, and only while the tuner, play-along or a vocal mic check is open.</li>
          <li>
            Sound is analyzed as it arrives to find the notes you play. It is never recorded or saved, and it never
            leaves this computer.
          </li>
          <li>Play-along keeps your results (which notes you hit or missed) so you can see progress.</li>
          <li>To switch inputs or remove permission later, open audio settings from the tuner.</li>
        </ul>

        <div className="flex flex-col gap-2">
          <Label htmlFor="audio-input">Input</Label>
          {inputs.isLoading ? (
            <div className="text-sm text-ink-faint">Looking for audio inputs...</div>
          ) : inputs.error ? (
            <div className="text-sm text-danger">Couldn't list audio inputs: {String(inputs.error)}</div>
          ) : inputs.data?.length ? (
            <select
              id="audio-input"
              className={selectClass}
              value={chosen ?? ""}
              onChange={(e) => setPicked(e.target.value)}
            >
              {inputs.data.map((input) => (
                <option key={input.id} value={input.id}>
                  {inputLabel(input)}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-ink-faint">No audio inputs found.</div>
          )}
          {!inputs.isLoading && !hasGuitarInput && (
            <div className="flex items-center justify-between gap-3 text-xs text-ink-faint">
              <span>Don't see your Real Tone Cable? Plug it in, then refresh.</span>
              <Button variant="outline" size="sm" onClick={() => void inputs.refetch()}>
                Refresh
              </Button>
            </div>
          )}
        </div>

        {allow.error && <div className="text-xs text-danger">{String(allow.error)}</div>}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onDecline}>
            Not now
          </Button>
          <Button className="flex-[2]" disabled={!canAllow} onClick={() => allow.mutate()}>
            Allow listening
          </Button>
        </div>
      </div>
    </div>
  );
}
