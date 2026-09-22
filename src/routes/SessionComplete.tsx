import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DIFFICULTY_LABELS } from "@/lib/types";
import type { Difficulty } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useHotkeys } from "@/hooks/useHotkeys";

const DIFFICULTIES: Difficulty[] = ["too_easy", "easy", "just_right", "hard", "too_hard"];
const TAGS = ["Clean transitions", "Buzzing strings", "Lost timing", "Felt great", "Needs more reps"];

function formatDuration(startedAt: string | null): string {
  if (!startedAt) return "–";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SessionComplete() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useAppStore((s) => s.profile);
  const skill = useAppStore((s) => s.activeSkill);
  const sessionConfig = useAppStore((s) => s.sessionConfig);
  const sessionId = useAppStore((s) => s.activeSessionId);
  const sessionStartedAt = useAppStore((s) => s.sessionStartedAt);
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId);
  const setSessionStartedAt = useAppStore((s) => s.setSessionStartedAt);

  useEffect(() => {
    if (!profile || !skill || !sessionConfig || !sessionId) {
      navigate("/home", { replace: true });
    }
  }, [profile, skill, sessionConfig, sessionId, navigate]);

  const [difficulty, setDifficulty] = useState<Difficulty>("just_right");
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      api.submitFeedback({ session_id: sessionId!, difficulty, tags, notes }),
    onSuccess: (_data, _vars, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ["recent-sessions", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["progress-stats", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["skills", profile?.id] });
    },
  });

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function finishTo(path: string) {
    submit.mutate(undefined, {
      onSuccess: () => {
        setActiveSessionId(null);
        setSessionStartedAt(null);
        navigate(path);
      },
    });
  }

  useHotkeys({ Enter: () => !submit.isPending && finishTo("/home") });

  if (!profile || !skill || !sessionConfig || !sessionId) return null;

  const totalReps = sessionConfig.sets * sessionConfig.repsPerSet;

  return (
    <div className="flex h-screen w-screen justify-center overflow-auto bg-bg">
      <div className="flex w-[640px] flex-col gap-6 py-11">
        <div>
          <div className="font-display text-[30px] font-semibold text-ink">
            Nice work, {profile.name}.
          </div>
          <div className="mt-1 text-sm text-ink-muted">
            You completed {skill.name} in {formatDuration(sessionStartedAt)}.
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-[14px] border border-border bg-surface p-4">
            <div className="text-[11px] text-ink-faint">Duration</div>
            <div className="mt-1 font-display text-xl font-semibold text-ink">
              {formatDuration(sessionStartedAt)}
            </div>
          </div>
          <div className="rounded-[14px] border border-border bg-surface p-4">
            <div className="text-[11px] text-ink-faint">Sets</div>
            <div className="mt-1 font-display text-xl font-semibold text-ink">
              {sessionConfig.sets}/{sessionConfig.sets}
            </div>
          </div>
          <div className="rounded-[14px] border border-border bg-surface p-4">
            <div className="text-[11px] text-ink-faint">Reps</div>
            <div className="mt-1 font-display text-xl font-semibold text-ink">
              {totalReps}/{totalReps}
            </div>
          </div>
          <div className="rounded-[14px] border border-border bg-surface p-4">
            <div className="text-[11px] text-ink-faint">Tempo</div>
            <div className="mt-1 font-display text-xl font-semibold text-rhythm">
              {sessionConfig.tempo} bpm
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label>How did that feel?</Label>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "flex-1 rounded-[10px] py-2.5 text-xs font-semibold",
                  difficulty === d
                    ? "bg-rhythm text-bg"
                    : "border border-border-strong text-ink-faint",
                )}
              >
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Anything stand out?</Label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "rounded-full px-3.5 py-2 text-xs font-semibold",
                  tags.includes(tag)
                    ? "bg-rhythm text-bg"
                    : "border border-border-strong text-ink-muted",
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            rows={2}
            placeholder="Anything to remember for next time..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="text-xs text-ink-faint">
          Saved to your practice log. Export anytime from Progress for AI-assisted feedback.
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={submit.isPending}
            onClick={() => finishTo("/session/setup")}
          >
            Practice again
          </Button>
          <Button
            className="flex-[2]"
            disabled={submit.isPending}
            onClick={() => finishTo("/home")}
          >
            Save &amp; Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
