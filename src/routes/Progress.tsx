import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { DIFFICULTY_LABELS, PATH_ACCENT } from "@/lib/types";
import type { Difficulty } from "@/lib/types";
import { useHotkeys } from "@/hooks/useHotkeys";

function formatHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function downloadExport(profileId: string) {
  const json = await api.exportSessionsJson(profileId);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `woodshed-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Progress() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);

  useEffect(() => {
    if (!profile) navigate("/profiles", { replace: true });
  }, [profile, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["progress-stats", profile?.id],
    queryFn: () => api.getProgressStats(profile!.id),
    enabled: !!profile,
  });

  const { data: sessions } = useQuery({
    queryKey: ["recent-sessions", profile?.id, "history"],
    queryFn: () => api.listRecentSessions(profile!.id, 8),
    enabled: !!profile,
  });

  useHotkeys({ Escape: () => navigate("/home") });

  if (!profile) return null;

  const weeks = stats?.weekly_session_counts ?? [];
  const maxCount = Math.max(1, ...weeks.map((w) => w.session_count));
  const barW = 40;
  const gap = 16;
  const chartH = 106;
  const chartTop = 34;

  return (
    <div className="flex h-screen w-screen flex-col bg-bg">
      <div className="flex h-[72px] shrink-0 items-center gap-4 border-b border-border px-12">
        <button onClick={() => navigate("/home")} className="text-lg text-ink-muted" aria-label="Back">
          &larr;
        </button>
        <div className="h-6 w-px bg-border" />
        <div className="font-display text-lg font-semibold text-ink">
          Your Progress &mdash; {profile.name}
        </div>
      </div>

      <div className="flex flex-1 gap-7 overflow-auto px-12 py-7">
        <div className="flex flex-1 flex-col gap-5">
          <div className="grid grid-cols-4 gap-3.5">
            <div className="rounded-[14px] border border-border bg-surface p-4">
              <div className="text-[11px] text-ink-faint">Total sessions</div>
              <div className="mt-1 font-display text-[22px] font-semibold text-ink">
                {stats?.total_sessions ?? "–"}
              </div>
            </div>
            <div className="rounded-[14px] border border-border bg-surface p-4">
              <div className="text-[11px] text-ink-faint">Current streak</div>
              <div className="mt-1 font-display text-[22px] font-semibold text-ink">
                {stats?.current_streak_days ?? 0} days
              </div>
            </div>
            <div className="rounded-[14px] border border-border bg-surface p-4">
              <div className="text-[11px] text-ink-faint">Practice time</div>
              <div className="mt-1 font-display text-[22px] font-semibold text-ink">
                {stats ? formatHms(stats.total_practice_seconds) : "–"}
              </div>
            </div>
            <div className="rounded-[14px] border border-border bg-surface p-4">
              <div className="text-[11px] text-ink-faint">Skills mastered</div>
              <div className="mt-1 font-display text-[22px] font-semibold text-ink">
                {stats?.skills_mastered ?? 0}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface px-6 py-5">
            <div className="mb-1.5 text-xs font-semibold text-ink-muted">Sessions per week</div>
            {weeks.length === 0 ? (
              <div className="py-8 text-center text-sm text-ink-faint">
                No sessions yet — your weekly volume will show up here.
              </div>
            ) : (
              <>
                <svg width={weeks.length * (barW + gap)} height={160}>
                  <line
                    x1={0}
                    y1={chartTop + chartH}
                    x2={weeks.length * (barW + gap)}
                    y2={chartTop + chartH}
                    stroke="#262019"
                  />
                  {weeks.map((w, i) => {
                    const h = (w.session_count / maxCount) * chartH;
                    return (
                      <rect
                        key={w.week_start}
                        x={i * (barW + gap) + 10}
                        y={chartTop + chartH - h}
                        width={barW}
                        height={h}
                        rx={4}
                        fill="#E3A458"
                      />
                    );
                  })}
                </svg>
                <div className="flex" style={{ gap }}>
                  {weeks.map((w) => (
                    <div key={w.week_start} className="w-10 text-center text-[10px] text-ink-faint">
                      {new Date(w.week_start).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-1 flex-col overflow-hidden rounded-[14px] border border-border">
            <div className="flex items-center gap-3.5 border-b border-border bg-[#1A1712] px-4.5 py-2.5">
              <span className="w-16 text-[10px] font-semibold uppercase text-ink-faint">Date</span>
              <span className="w-16 text-[10px] font-semibold uppercase text-ink-faint">Path</span>
              <span className="flex-1 text-[10px] font-semibold uppercase text-ink-faint">Skill</span>
              <span className="w-14 text-[10px] font-semibold uppercase text-ink-faint">Time</span>
              <span className="w-20 text-[10px] font-semibold uppercase text-ink-faint">Feedback</span>
            </div>
            {(sessions ?? []).map((s) => {
              const accent = PATH_ACCENT[s.path];
              const durationMin = s.ended_at
                ? Math.round(
                    (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000,
                  )
                : 0;
              return (
                <div key={s.id} className="flex items-center gap-3.5 border-b border-border/60 px-4.5 py-2.5 last:border-b-0">
                  <span className="w-16 text-xs text-ink-muted">
                    {new Date(s.started_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className={`w-16 rounded-full px-2 py-0.5 text-[11px] ${accent.tint} ${accent.text}`}>
                    {s.path}
                  </span>
                  <span className="flex-1 text-[13px] text-ink">{s.skill_name}</span>
                  <span className="w-14 text-xs text-ink-faint">{durationMin}m</span>
                  <span className="w-20 text-[11px] text-ink-muted">
                    {s.difficulty ? DIFFICULTY_LABELS[s.difficulty as Difficulty] : "–"}
                  </span>
                </div>
              );
            })}
            {(sessions ?? []).length === 0 && (
              <div className="px-4.5 py-6 text-center text-sm text-ink-faint">
                No completed sessions yet.
              </div>
            )}
          </div>
        </div>

        <div className="h-fit w-[300px] shrink-0 rounded-[18px] border border-border bg-surface p-6">
          <div className="font-display text-[17px] font-semibold text-ink">
            Export for AI-assisted review
          </div>
          <div className="mt-2 text-xs leading-relaxed text-ink-muted">
            Download your session and feedback history as structured data to analyze progress
            trends with Claude or another LLM.
          </div>
          <pre className="mt-4 overflow-hidden rounded-[10px] border border-border bg-bg p-3 text-[10px] leading-relaxed text-ink-faint">
{`{
  "profile": "${profile.name}",
  "sessions": [
    { "date": "...",
      "path": "lead",
      "skill": "minor_pentatonic_box1",
      "sets": 3, "reps": 24,
      "tempo": [76, 84],
      "difficulty": "just_right" }
  ]
}`}
          </pre>
          <Button className="mt-4 w-full" onClick={() => downloadExport(profile.id)}>
            Export Session Log (.json)
          </Button>
        </div>
      </div>
    </div>
  );
}
