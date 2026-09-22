import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import type { TabSortKey } from "@/store/useAppStore";
import { PathIcon } from "@/components/PathIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHotkeys } from "@/hooks/useHotkeys";
import { MAX_TAB_BYTES, TUNING_SUGGESTIONS, draftFromFile } from "@/lib/tabMetadata";
import type { TabDraft } from "@/lib/tabMetadata";
import type { TabSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMNS: { key: TabSortKey; label: string; className: string }[] = [
  { key: "title", label: "Title", className: "flex-[2]" },
  { key: "artist", label: "Artist", className: "flex-[1.5]" },
  { key: "tuning", label: "Tuning", className: "w-40" },
  { key: "created_at", label: "Added", className: "w-20 justify-end text-right" },
];

function compareTabs(a: TabSummary, b: TabSummary, key: TabSortKey, dir: "asc" | "desc") {
  const av = a[key];
  const bv = b[key];
  // Blank artists/tunings sort last whichever direction the column is sorted.
  if (!av !== !bv) return av ? -1 : 1;
  const cmp =
    key === "created_at"
      ? Date.parse(av) - Date.parse(bv)
      : av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true });
  const signed = dir === "asc" ? cmp : -cmp;
  return signed || a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
}

function fileBadge(tab: TabSummary): string | null {
  if (tab.mime_type.startsWith("text/")) return null;
  return tab.file_name.split(".").pop()?.toUpperCase() ?? "FILE";
}

export function TabLibrary() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useAppStore((s) => s.profile);
  const filters = useAppStore((s) => s.tabFilters);
  const setFilters = useAppStore((s) => s.setTabFilters);

  const searchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<TabDraft[] | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) navigate("/profiles", { replace: true });
  }, [profile, navigate]);

  const { data: tabs, isLoading } = useQuery({
    queryKey: ["tabs", profile?.id],
    queryFn: () => api.listTabs(profile!.id),
    enabled: !!profile,
  });

  const tuningCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tabs ?? []) if (t.tuning) counts.set(t.tuning, (counts.get(t.tuning) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [tabs]);

  const visible = useMemo(() => {
    const tokens = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
    return (tabs ?? [])
      .filter((t) => !filters.tuning || t.tuning === filters.tuning)
      .filter((t) => {
        const haystack = `${t.title} ${t.artist} ${t.tuning}`.toLowerCase();
        return tokens.every((tok) => haystack.includes(tok));
      })
      .sort((a, b) => compareTabs(a, b, filters.sortKey, filters.sortDir));
  }, [tabs, filters]);

  const saveDrafts = useMutation({
    mutationFn: async (items: TabDraft[]) => {
      for (const d of items) {
        const data = Array.from(new Uint8Array(await d.file.arrayBuffer()));
        await api.createTab({
          profile_id: profile!.id,
          title: d.title,
          artist: d.artist,
          tuning: d.tuning,
          file_name: d.file.name,
          mime_type: d.isText ? "text/plain" : d.file.type || "application/octet-stream",
          data,
        });
        // Drop each draft once saved so a retry after a failure doesn't duplicate it.
        setDrafts((prev) => prev?.filter((x) => x !== d) ?? null);
      }
    },
    onSuccess: () => setDrafts(null),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tabs", profile?.id] }),
  });

  const canSave = !!drafts?.length && drafts.every((d) => d.title.trim()) && !saveDrafts.isPending;

  async function onFilesChosen(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (list.length === 0) return;
    setRejected(list.filter((f) => f.size > MAX_TAB_BYTES).map((f) => f.name));
    const accepted = list.filter((f) => f.size <= MAX_TAB_BYTES);
    saveDrafts.reset();
    setDrafts(accepted.length ? await Promise.all(accepted.map(draftFromFile)) : null);
  }

  function updateDraft(index: number, patch: Partial<TabDraft>) {
    setDrafts((prev) => prev?.map((d, i) => (i === index ? { ...d, ...patch } : d)) ?? null);
  }

  function toggleSort(key: TabSortKey) {
    if (filters.sortKey === key) {
      setFilters({ sortDir: filters.sortDir === "asc" ? "desc" : "asc" });
    } else {
      setFilters({ sortKey: key, sortDir: key === "created_at" ? "desc" : "asc" });
    }
  }

  useHotkeys(
    drafts
      ? {
          Enter: () => canSave && saveDrafts.mutate(drafts),
          Escape: () => setDrafts(null),
        }
      : {
          "/": () => searchRef.current?.focus(),
          Enter: () => filters.query && visible[0] && navigate(`/tabs/${visible[0].id}`),
          Escape: () => (filters.query ? setFilters({ query: "" }) : navigate("/home")),
        },
  );

  if (!profile) return null;

  return (
    <div className="flex h-screen w-screen flex-col bg-bg">
      <div className="flex h-[72px] shrink-0 items-center gap-4 border-b border-border px-12">
        <button onClick={() => navigate("/home")} className="text-lg text-ink-muted" aria-label="Back to Home">
          &larr;
        </button>
        <div className="h-6 w-px bg-border" />
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tab-tint text-tab">
          <PathIcon path="tabs" className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1">
          <div className="font-display text-lg font-semibold text-ink">Tab Library</div>
          <div className="text-[11px] text-ink-faint">
            {tabs?.length ?? 0} tab{tabs?.length === 1 ? "" : "s"}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.tab,.crd,.chopro,.cho,.chordpro,.pro,.pdf,.gp,.gp3,.gp4,.gp5,.gpx,.png,.jpg,.jpeg,text/*"
          className="hidden"
          onChange={(e) => void onFilesChosen(e.target.files)}
        />
        <Button size="sm" onClick={() => fileInputRef.current?.click()}>
          Upload tabs
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-auto px-12 py-7">
        {rejected.length > 0 && (
          <div className="rounded-[10px] border border-danger/40 px-4 py-2.5 text-xs text-danger">
            Skipped (over {MAX_TAB_BYTES / 1024 / 1024} MB): {rejected.join(", ")}
          </div>
        )}

        {drafts && (
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
            <div>
              <div className="font-display text-[17px] font-semibold text-ink">
                Check the details
              </div>
              <div className="mt-1 text-xs text-ink-faint">
                Filled in from the file name and the tab itself. Fix anything that's off, then
                save. Enter saves &middot; Esc cancels.
              </div>
            </div>
            <datalist id="tuning-suggestions">
              {[...new Set([...TUNING_SUGGESTIONS, ...tuningCounts.map(([t]) => t)])].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            {drafts.map((d, i) => (
              <div key={`${d.file.name}-${i}`} className="flex items-end gap-3">
                <label className="flex flex-[2] flex-col gap-1">
                  <span className="truncate text-[11px] text-ink-faint">{d.file.name}</span>
                  <Input
                    value={d.title}
                    placeholder="Song title"
                    autoFocus={i === 0}
                    onChange={(e) => updateDraft(i, { title: e.target.value })}
                  />
                </label>
                <Input
                  className="flex-[1.5]"
                  value={d.artist}
                  placeholder="Artist"
                  aria-label="Artist"
                  onChange={(e) => updateDraft(i, { artist: e.target.value })}
                />
                <Input
                  className="w-44"
                  value={d.tuning}
                  placeholder="Tuning"
                  aria-label="Tuning"
                  list="tuning-suggestions"
                  onChange={(e) => updateDraft(i, { tuning: e.target.value })}
                />
                <button
                  aria-label={`Remove ${d.file.name}`}
                  onClick={() => setDrafts((prev) => (prev && prev.length > 1 ? prev.filter((_, j) => j !== i) : null))}
                  className="h-11 px-2 text-ink-faint hover:text-ink"
                >
                  &times;
                </button>
              </div>
            ))}
            {saveDrafts.error && (
              <div className="text-xs text-danger">Couldn't save: {String(saveDrafts.error)}</div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setDrafts(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={!canSave} onClick={() => saveDrafts.mutate(drafts)}>
                {saveDrafts.isPending
                  ? "Saving..."
                  : `Save ${drafts.length} tab${drafts.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Input
            ref={searchRef}
            value={filters.query}
            autoFocus={!drafts}
            placeholder="Search by title, artist or tuning   ( / )"
            aria-label="Search tabs"
            onChange={(e) => setFilters({ query: e.target.value })}
          />
          {tuningCounts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {[null, ...tuningCounts.map(([t]) => t)].map((t) => (
                <button
                  key={t ?? "__any"}
                  onClick={() => setFilters({ tuning: t })}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold",
                    filters.tuning === t
                      ? "bg-tab text-bg"
                      : "border border-border-strong text-ink-muted hover:text-ink",
                  )}
                >
                  {t ?? "Any tuning"}
                  {t && (
                    <span className="ml-1.5 opacity-60">
                      {tuningCounts.find(([name]) => name === t)?.[1]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col overflow-hidden rounded-[14px] border border-border">
          <div className="flex items-center gap-3.5 border-b border-border bg-[#1A1712] px-4.5 py-2.5">
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className={cn(
                  "flex items-center gap-1 text-left text-[10px] font-semibold uppercase",
                  filters.sortKey === col.key ? "text-ink" : "text-ink-faint hover:text-ink-muted",
                  col.className,
                )}
                aria-label={`Sort by ${col.label}`}
              >
                {col.label}
                {filters.sortKey === col.key && (
                  <span aria-hidden>{filters.sortDir === "asc" ? "↑" : "↓"}</span>
                )}
              </button>
            ))}
          </div>

          {visible.map((tab) => {
            const badge = fileBadge(tab);
            return (
              <button
                key={tab.id}
                onClick={() => navigate(`/tabs/${tab.id}`)}
                className="flex items-center gap-3.5 border-b border-border/60 px-4.5 py-3 text-left last:border-b-0 hover:bg-surface-hover"
              >
                <span className="flex flex-[2] items-center gap-2 truncate text-[13px] text-ink">
                  <span className="truncate">{tab.title}</span>
                  {badge && (
                    <span className="rounded bg-tab-tint px-1.5 py-0.5 text-[10px] font-semibold text-tab">
                      {badge}
                    </span>
                  )}
                </span>
                <span className="flex-[1.5] truncate text-xs text-ink-muted">{tab.artist || "–"}</span>
                <span className="w-40 truncate text-xs text-ink-muted">{tab.tuning || "–"}</span>
                <span className="w-20 text-right text-xs text-ink-faint">
                  {new Date(tab.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </button>
            );
          })}

          {!isLoading && visible.length === 0 && (
            <div className="px-4.5 py-8 text-center text-sm text-ink-faint">
              {tabs?.length
                ? "No tabs match that search."
                : "No tabs yet. Upload text tabs (.txt, ChordPro), PDFs or Guitar Pro files."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
