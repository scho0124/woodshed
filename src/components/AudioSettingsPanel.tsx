import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { inputLabel, preferredInput, selectClass } from "@/components/AudioGate";
import type { AudioSettings } from "@/lib/types";

/** Stable key for restarting capture when settings that affect it change. */
export function audioRestartKey(settings: AudioSettings | undefined) {
  return settings ? `${settings.device_id}|${settings.channel}|${settings.gate_db}` : "";
}

export function AudioSettingsPanel({ showReference = false }: { showReference?: boolean }) {
  const queryClient = useQueryClient();
  const profile = useAppStore((s) => s.profile)!;
  const setProfile = useAppStore((s) => s.setProfile);

  const inputs = useQuery({ queryKey: ["audio-inputs"], queryFn: api.listAudioInputs });
  const settings = useQuery({ queryKey: ["audio-settings"], queryFn: api.getAudioSettings });
  const [gate, setGate] = useState<number | null>(null);
  const [a4, setA4] = useState<number | null>(null);
  useEffect(() => {
    setGate(null);
    setA4(null);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (patch: Partial<AudioSettings>) => api.setAudioSettings({ ...settings.data!, ...patch }),
    onSuccess: (saved) => queryClient.setQueryData(["audio-settings"], saved),
  });

  const revoke = useMutation({
    mutationFn: () => api.setAudioConsent(profile.id, false),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setProfile(updated);
    },
  });

  if (!settings.data) return <div className="text-sm text-ink-faint">Loading audio settings...</div>;
  const current = preferredInput(inputs.data, settings.data.device_id);
  const gateValue = gate ?? settings.data.gate_db;
  const a4Value = a4 ?? settings.data.a4_hz;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-input">Input</Label>
        <div className="flex gap-2">
          <select
            id="settings-input"
            className={selectClass}
            value={current?.id ?? ""}
            onChange={(e) => save.mutate({ device_id: e.target.value, channel: null })}
          >
            {inputs.data?.map((input) => (
              <option key={input.id} value={input.id}>
                {inputLabel(input)}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" className="h-11" onClick={() => void inputs.refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {current && current.channels > 1 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="settings-channel">Channel</Label>
          <select
            id="settings-channel"
            className={selectClass}
            value={settings.data.channel ?? "mix"}
            onChange={(e) => save.mutate({ channel: e.target.value === "mix" ? null : Number(e.target.value) })}
          >
            <option value="mix">Mix all channels</option>
            {Array.from({ length: current.channels }, (_, c) => (
              <option key={c} value={c}>
                Channel {c + 1}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <Label>Noise gate: {Math.round(gateValue)} dB</Label>
        <Slider
          value={[gateValue]}
          min={-80}
          max={-20}
          step={1}
          onValueChange={([v]) => setGate(v)}
          onValueCommit={([v]) => save.mutate({ gate_db: v })}
        />
        <div className="text-[11px] text-ink-faint">
          Sound below this level is ignored. Raise it if the tuner reacts to hum when you're not playing.
        </div>
      </div>

      {showReference && (
        <div className="flex flex-col gap-2.5">
          <Label>Reference pitch: A = {Math.round(a4Value)} Hz</Label>
          <Slider
            value={[a4Value]}
            min={430}
            max={450}
            step={1}
            onValueChange={([v]) => setA4(v)}
            onValueCommit={([v]) => save.mutate({ a4_hz: v })}
          />
        </div>
      )}

      {save.error && <div className="text-xs text-danger">Couldn't save: {String(save.error)}</div>}

      <div className="border-t border-border pt-4">
        <Button variant="danger" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate()}>
          Stop listening and remove permission
        </Button>
      </div>
    </div>
  );
}
