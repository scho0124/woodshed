import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { PathIcon } from "@/components/PathIcon";
import { PATH_ACCENT, PATH_LABELS } from "@/lib/types";
import type { SkillWithProgress } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useHotkeys } from "@/hooks/useHotkeys";

export function SkillList() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const path = useAppStore((s) => s.activePath);
  const setActiveSkill = useAppStore((s) => s.setActiveSkill);

  useEffect(() => {
    if (!profile) navigate("/profiles", { replace: true });
    else if (!path) navigate("/home", { replace: true });
  }, [profile, path, navigate]);

  const { data: skills } = useQuery({
    queryKey: ["skills", profile?.id, path],
    queryFn: () => api.listSkillsByPath(profile!.id, path!),
    enabled: !!profile && !!path,
  });

  useHotkeys({ Escape: () => navigate("/home") });

  if (!profile || !path) return null;

  const categories = Array.from(new Set((skills ?? []).map((s) => s.category)));
  const startedCount = (skills ?? []).filter((s) => s.total_reps > 0).length;

  function openSkill(skill: SkillWithProgress) {
    setActiveSkill(skill);
    navigate("/session/setup");
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-bg">
      <div className="flex h-[72px] shrink-0 items-center gap-4 border-b border-border px-12">
        <button onClick={() => navigate("/home")} className="text-lg text-ink-muted" aria-label="Back to Home">
          &larr;
        </button>
        <div className="h-6 w-px bg-border" />
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-[10px]", PATH_ACCENT[path].tint, PATH_ACCENT[path].text)}>
          <PathIcon path={path} className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="font-display text-lg font-semibold text-ink">{PATH_LABELS[path]}</div>
          <div className="text-[11px] text-ink-faint">
            {startedCount} of {skills?.length ?? 0} skills started
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-12 py-8">
        {categories.map((category) => (
          <div key={category} className="mb-9">
            <div className="mb-3.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {category}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(skills ?? [])
                .filter((s) => s.category === category)
                .map((skill) => {
                  const pct = Math.min(100, (skill.total_reps / skill.mastery_reps) * 100);
                  const status =
                    skill.total_reps === 0
                      ? "Not started"
                      : pct >= 100
                        ? "Mastered"
                        : "In progress";
                  const dot =
                    status === "Mastered"
                      ? "bg-success"
                      : status === "In progress"
                        ? "bg-rhythm"
                        : "bg-border-strong";
                  const label =
                    status === "Mastered"
                      ? "text-success"
                      : status === "In progress"
                        ? "text-rhythm"
                        : "text-ink-faint";

                  return (
                    <button
                      key={skill.id}
                      autoFocus={skill.id === skills?.[0]?.id}
                      onClick={() => openSkill(skill)}
                      className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-5 text-left hover:bg-surface-hover"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("h-[7px] w-[7px] rounded-full", dot)} />
                        <span className={cn("text-[11px] font-semibold", label)}>{status}</span>
                      </div>
                      <div className="text-[15px] font-semibold text-ink">{skill.name}</div>
                      <div className="text-xs text-ink-faint">
                        {skill.last_practiced_at
                          ? `Last practiced ${new Date(skill.last_practiced_at).toLocaleDateString()}${skill.best_tempo ? ` · ${skill.best_tempo} bpm best` : ""}`
                          : skill.description}
                      </div>
                      <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-border">
                        <div
                          className={cn("h-full", dot)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong p-5 text-center">
                <div className="text-xl text-ink-faint">+</div>
                <div className="text-[13px] font-semibold text-ink-muted">
                  Build a custom skill
                </div>
                <div className="text-[11px] text-ink-faint">
                  Define your own drills as you improve
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
