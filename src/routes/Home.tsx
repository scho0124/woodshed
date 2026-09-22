import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { PathIcon } from "@/components/PathIcon";
import { Progress } from "@/components/ui/progress";
import type { GuitarPath } from "@/lib/types";
import { PATH_LABELS } from "@/lib/types";
import { useHotkeys } from "@/hooks/useHotkeys";

const PATHS: GuitarPath[] = ["rhythm", "lead", "bass", "piano"];

const PATH_STYLE: Record<GuitarPath, { text: string; iconBg: string; blurb: string }> = {
  rhythm: {
    text: "text-rhythm",
    iconBg: "bg-rhythm-tint",
    blurb: "Chords, strumming patterns and timing. The foundation everything else sits on.",
  },
  lead: {
    text: "text-lead",
    iconBg: "bg-lead-tint",
    blurb: "Scales, licks and phrasing. Pentatonic runs, bends and improvisation drills.",
  },
  bass: {
    text: "text-bass",
    iconBg: "bg-bass-tint",
    blurb: "Root movement, walking lines and locking in with a click track.",
  },
  piano: {
    text: "text-piano",
    iconBg: "bg-piano-tint",
    blurb: "Triads, inversions and scales on the keys, plus note finding for reading.",
  },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "Not started yet";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function Home() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const setActivePath = useAppStore((s) => s.setActivePath);

  useEffect(() => {
    if (!profile) navigate("/profiles", { replace: true });
  }, [profile, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["progress-stats", profile?.id],
    queryFn: () => api.getProgressStats(profile!.id),
    enabled: !!profile,
  });

  const { data: recent } = useQuery({
    queryKey: ["recent-sessions", profile?.id],
    queryFn: () => api.listRecentSessions(profile!.id, 20),
    enabled: !!profile,
  });

  const pathQueries = useQueries({
    queries: PATHS.map((path) => ({
      queryKey: ["skills", profile?.id, path],
      queryFn: () => api.listSkillsByPath(profile!.id, path),
      enabled: !!profile,
    })),
  });

  const { data: tabs } = useQuery({
    queryKey: ["tabs", profile?.id],
    queryFn: () => api.listTabs(profile!.id),
    enabled: !!profile,
  });

  useHotkeys({ Escape: () => navigate("/profiles") });

  if (!profile) return null;

  function goToPath(path: GuitarPath) {
    setActivePath(path);
    navigate("/skills");
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-bg">
      <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-border px-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-rhythm font-display text-sm font-bold text-bg">
            W
          </div>
          <span className="font-display text-[17px] font-semibold text-ink">Woodshed</span>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-sm text-ink-muted">
            {stats ? `${stats.current_streak_days}-day streak` : "·"}
          </div>
          <button
            onClick={() => navigate("/profiles")}
            className="flex items-center gap-2"
            title="Switch profile"
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full font-display text-xs font-semibold text-bg"
              style={{ background: profile.color }}
            >
              {profile.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="text-sm text-ink">{profile.name}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-7 overflow-auto px-12 py-9">
        <div>
          <div className="font-display text-[28px] font-semibold text-ink">
            What are we practicing today?
          </div>
          <div className="mt-1 text-sm text-ink-faint">
            Pick a path to pick up where you left off, or open your tab library.
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
          {PATHS.map((path, i) => {
            const style = PATH_STYLE[path];
            const skills = pathQueries[i].data ?? [];
            const lastSession = recent?.find((s) => s.path === path);
            const avgProgress =
              skills.length > 0
                ? skills.reduce(
                    (sum, s) => sum + Math.min(1, s.total_reps / s.mastery_reps),
                    0,
                  ) / skills.length
                : 0;

            return (
              <button
                key={path}
                autoFocus={i === 0}
                onClick={() => goToPath(path)}
                className="flex flex-col gap-3.5 rounded-2xl border border-border bg-surface p-6 text-left hover:bg-surface-hover"
              >
                <div className={`flex h-13 w-13 items-center justify-center rounded-[14px] ${style.iconBg} ${style.text}`} style={{ height: 52, width: 52 }}>
                  <PathIcon path={path} />
                </div>
                <div className="font-display text-xl font-semibold text-ink">
                  {PATH_LABELS[path]}
                </div>
                <div className="text-[13px] leading-relaxed text-ink-muted">{style.blurb}</div>
                <div className="flex-1" />
                <div className="text-xs text-ink-faint">
                  {lastSession
                    ? `Last: ${lastSession.skill_name} · ${timeAgo(lastSession.ended_at)}`
                    : "No sessions yet"}
                </div>
                <Progress value={avgProgress * 100} indicatorClassName={style.text.replace("text-", "bg-")} />
                <div
                  className={`rounded-[10px] border py-2.5 text-center text-[13px] font-semibold ${style.text}`}
                  style={{ borderColor: "currentColor" }}
                >
                  Continue
                </div>
              </button>
            );
          })}

          <button
            onClick={() => navigate("/tabs")}
            className="flex flex-col gap-3.5 rounded-2xl border border-border bg-surface p-6 text-left hover:bg-surface-hover"
          >
            <div
              className="flex items-center justify-center rounded-[14px] bg-tab-tint text-tab"
              style={{ height: 52, width: 52 }}
            >
              <PathIcon path="tabs" />
            </div>
            <div className="font-display text-xl font-semibold text-ink">Tab Library</div>
            <div className="text-[13px] leading-relaxed text-ink-muted">
              Upload your tabs and find any song fast by title, artist or tuning.
            </div>
            <div className="flex-1" />
            <div className="text-xs text-ink-faint">
              {tabs?.length ? `${tabs.length} tab${tabs.length === 1 ? "" : "s"} saved` : "No tabs yet"}
            </div>
            <div
              className="rounded-[10px] border py-2.5 text-center text-[13px] font-semibold text-tab"
              style={{ borderColor: "currentColor" }}
            >
              Open Library
            </div>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Recent sessions
          </span>
          <button onClick={() => navigate("/progress")} className="text-[13px] text-rhythm">
            View progress &rarr;
          </button>
        </div>

        <div className="flex flex-col overflow-hidden rounded-[14px] border border-border">
          {(recent ?? []).slice(0, 3).map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3.5 border-b border-border/60 bg-[#1A1712] px-4.5 py-3 last:border-b-0"
            >
              <div className={`h-2 w-2 rounded-full ${PATH_STYLE[s.path].text.replace("text-", "bg-")}`} />
              <span className="flex-1 text-[13px] text-ink">{s.skill_name}</span>
              <span className="text-xs text-ink-faint">{s.sets_completed} sets</span>
              <span className="w-20 text-right text-xs text-ink-faint">
                {timeAgo(s.ended_at)}
              </span>
            </div>
          ))}
          {(recent ?? []).length === 0 && (
            <div className="px-4.5 py-6 text-center text-sm text-ink-faint">
              No sessions logged yet — pick a path above to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
