import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, Play, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { TutorialVideo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function watchUrl(v: TutorialVideo) {
  return `https://www.youtube.com/watch?v=${v.video_id}`;
}

/** Plays in Woodshed's player window, or in the browser if the video can't be embedded. */
function watch(v: TutorialVideo) {
  if (!v.embeddable) return openUrl(watchUrl(v));
  return api.watchTutorial(v.video_id, v.title).catch((e) => {
    console.warn("In-app player failed, opening the browser:", e);
    return openUrl(watchUrl(v));
  });
}

function duration(seconds: number) {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Why this video was picked, in the terms it was ranked on. */
function evidence(v: TutorialVideo) {
  const parts = [`${compact.format(v.views)} views`];
  if (v.likes != null && v.views > 0) parts.push(`${((v.likes / v.views) * 100).toFixed(1)}% liked`);
  if (v.comments_sampled > 0) {
    parts.push(`${v.positive_comments} of ${v.comments_sampled} comments say it helped`);
    if (v.negative_comments > 0) parts.push(`${v.negative_comments} report pain or problems`);
  }
  return parts.join(" · ");
}

export function TutorialCard({ skillId }: { skillId: string }) {
  const queryClient = useQueryClient();
  const key = ["skill-tutorial", skillId];
  const { data, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () => api.getSkillTutorial(skillId),
    staleTime: Infinity,
    retry: false,
  });
  const refresh = useMutation({
    mutationFn: () => api.getSkillTutorial(skillId, true),
    onSuccess: (fresh) => queryClient.setQueryData(key, fresh),
  });

  const [best, ...others] = data?.videos ?? [];
  const failure = refresh.error ?? error;

  return (
    <div className="flex max-w-2xl flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <Label>Tutorial</Label>
        {data && !data.missing_api_key && (
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="flex items-center gap-1.5 text-[11px] text-ink-faint hover:text-ink disabled:opacity-50"
            title="Search YouTube again for a fresh pick"
          >
            <RefreshCw size={12} className={cn(refresh.isPending && "animate-spin")} />
            Refresh
          </button>
        )}
      </div>

      {isPending ? (
        <div className="flex gap-4 rounded-2xl border border-border bg-surface p-4">
          <div className="aspect-video w-52 shrink-0 animate-pulse rounded-lg bg-border" />
          <div className="text-[13px] text-ink-faint">Finding a tutorial worth your time...</div>
        </div>
      ) : best ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex gap-4">
            <button
              onClick={() => watch(best)}
              className="relative aspect-video w-52 shrink-0 overflow-hidden rounded-lg bg-border"
              aria-label={`Watch ${best.title}`}
            >
              <img src={best.thumbnail_url} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {duration(best.duration_seconds)}
              </span>
            </button>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{best.title}</div>
              <div className="text-xs text-ink-muted">{best.channel}</div>
              <div className="text-[11px] leading-relaxed text-ink-faint">{evidence(best)}</div>
              <div className="flex-1" />
              <div className="flex items-center gap-3">
                <Button size="sm" className="w-fit" onClick={() => watch(best)}>
                  {best.embeddable ? (
                    <>
                      <Play size={13} /> Watch
                    </>
                  ) : (
                    <>
                      Watch on YouTube <ExternalLink size={13} />
                    </>
                  )}
                </Button>
                {best.embeddable && (
                  <button
                    onClick={() => openUrl(watchUrl(best))}
                    className="flex items-center gap-1 text-[11px] text-ink-faint hover:text-ink"
                  >
                    Open on YouTube <ExternalLink size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>
          {others.length > 0 && (
            <div className="flex flex-col border-t border-border pt-2.5">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Also good
              </div>
              {others.map((v) => (
                <button
                  key={v.video_id}
                  onClick={() => watch(v)}
                  className="flex items-center gap-3 rounded-md py-1.5 text-left hover:text-ink"
                  title={evidence(v)}
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">{v.title}</span>
                  <span className="shrink-0 text-[11px] text-ink-faint">
                    {v.channel} · {compact.format(v.views)} views
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-border-strong p-4">
          <div className="text-[13px] leading-relaxed text-ink-faint">
            {failure
              ? `Couldn't pick a video: ${String(failure)}`
              : data?.missing_api_key
                ? "Add YOUTUBE_API_KEY to src-tauri/.env and restart to have a video picked for you."
                : "No tutorial matched this skill yet."}
          </div>
          {data && (
            <Button variant="outline" size="sm" onClick={() => openUrl(data.search_url)}>
              Search YouTube <ExternalLink size={13} />
            </Button>
          )}
        </div>
      )}

      {best && (
        <div className="text-[11px] text-ink-faint">
          Ranked by views, like rate and a sample of viewer comments. Stop any exercise that hurts.
        </div>
      )}
    </div>
  );
}
