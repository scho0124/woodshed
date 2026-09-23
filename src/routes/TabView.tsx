import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHotkeys } from "@/hooks/useHotkeys";
import { TUNING_SUGGESTIONS } from "@/lib/tabMetadata";

interface TabFields {
  title: string;
  artist: string;
  tuning: string;
  capo: number;
}

const MIN_FONT = 10;
const MAX_FONT = 24;

export function TabView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useAppStore((s) => s.profile);

  const [editing, setEditing] = useState<TabFields | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [fontSize, setFontSize] = useState(14);

  useEffect(() => {
    if (!profile) navigate("/profiles", { replace: true });
  }, [profile, navigate]);

  const { data: tab, error } = useQuery({
    queryKey: ["tab", id],
    queryFn: () => api.getTab(id!),
    enabled: !!id && !!profile,
  });

  const { data: runs } = useQuery({
    queryKey: ["playalong-runs", profile?.id, id],
    queryFn: () => api.listPlayAlongRuns(profile!.id, id!),
    enabled: !!id && !!profile,
  });
  const bestAccuracy = (runs ?? []).reduce<number | null>((best, r) => {
    const acc = r.notes_played ? r.first_try_hits / r.notes_played : null;
    return acc !== null && (best === null || acc > best) ? acc : best;
  }, null);
  const canPlayAlong = tab?.content != null;
  const openTuner = () => tab && navigate(`/tuner?tuning=${encodeURIComponent(tab.tuning || "Standard")}`);
  const openPlayAlong = () => canPlayAlong && navigate(`/tabs/${id}/play`);

  function refreshLists() {
    queryClient.invalidateQueries({ queryKey: ["tabs", profile?.id] });
    queryClient.invalidateQueries({ queryKey: ["tab", id] });
  }

  const save = useMutation({
    mutationFn: (fields: TabFields) => api.updateTab({ id: id!, ...fields }),
    onSuccess: () => {
      refreshLists();
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteTab(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tabs", profile?.id] });
      navigate("/tabs");
    },
  });

  const openFile = useMutation({ mutationFn: () => api.openTabFile(id!) });

  const canSave = !!editing?.title.trim() && !save.isPending;
  const bigger = () => setFontSize((f) => Math.min(MAX_FONT, f + 1));
  const smaller = () => setFontSize((f) => Math.max(MIN_FONT, f - 1));
  const startEditing = () =>
    tab && setEditing({ title: tab.title, artist: tab.artist, tuning: tab.tuning, capo: tab.capo });

  useHotkeys(
    editing
      ? {
          Enter: () => canSave && save.mutate(editing),
          Escape: () => setEditing(null),
        }
      : {
          Escape: () => navigate("/tabs"),
          e: startEditing,
          t: openTuner,
          p: openPlayAlong,
          "=": bigger,
          "+": bigger,
          "-": smaller,
        },
  );

  if (!profile) return null;

  return (
    <div className="flex h-screen w-screen flex-col bg-bg">
      <div className="flex min-h-[72px] shrink-0 items-center gap-4 border-b border-border px-12 py-3">
        <button onClick={() => navigate("/tabs")} className="text-lg text-ink-muted" aria-label="Back to Tab Library">
          &larr;
        </button>
        <div className="h-6 w-px bg-border" />

        {editing ? (
          <div className="flex flex-1 items-center gap-3">
            <datalist id="tuning-suggestions-edit">
              {TUNING_SUGGESTIONS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <Input
              className="flex-[2]"
              value={editing.title}
              placeholder="Song title"
              aria-label="Title"
              autoFocus
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
            <Input
              className="flex-[1.5]"
              value={editing.artist}
              placeholder="Artist"
              aria-label="Artist"
              onChange={(e) => setEditing({ ...editing, artist: e.target.value })}
            />
            <Input
              className="w-44"
              value={editing.tuning}
              placeholder="Tuning"
              aria-label="Tuning"
              list="tuning-suggestions-edit"
              onChange={(e) => setEditing({ ...editing, tuning: e.target.value })}
            />
            <Input
              className="w-20"
              type="number"
              min={0}
              max={12}
              value={editing.capo}
              aria-label="Capo"
              title="Capo fret (0 for none)"
              onChange={(e) => setEditing({ ...editing, capo: Math.min(12, Math.max(0, Number(e.target.value) || 0)) })}
            />
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!canSave} onClick={() => save.mutate(editing)}>
              Save
            </Button>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-lg font-semibold text-ink">
                {tab?.title ?? ""}
              </div>
              <div className="truncate text-[11px] text-ink-faint">
                {[
                  tab?.artist,
                  tab?.tuning,
                  tab?.capo ? `Capo ${tab.capo}` : null,
                  bestAccuracy !== null ? `Play-along best ${Math.round(bestAccuracy * 100)}%` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || tab?.file_name}
              </div>
            </div>
            {tab?.content != null && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={smaller} aria-label="Smaller text">
                  A&minus;
                </Button>
                <Button variant="ghost" size="icon" onClick={bigger} aria-label="Larger text">
                  A+
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" disabled={!tab} onClick={openTuner} title="Tuner (T)">
              Tune
            </Button>
            {canPlayAlong && (
              <Button size="sm" onClick={openPlayAlong} title="Play along (P)">
                Play along
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={!tab} onClick={startEditing}>
              Edit
            </Button>
            {confirmingDelete ? (
              <>
                <Button variant="danger" size="sm" disabled={remove.isPending} onClick={() => remove.mutate()}>
                  Confirm delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" disabled={!tab} onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            )}
          </>
        )}
      </div>

      {save.error && (
        <div className="px-12 pt-3 text-xs text-danger">Couldn't save: {String(save.error)}</div>
      )}

      <div className="flex-1 overflow-auto px-12 py-7">
        {error ? (
          <div className="text-sm text-ink-faint">This tab couldn't be loaded: {String(error)}</div>
        ) : !tab ? (
          <div className="text-sm text-ink-faint">Loading...</div>
        ) : tab.content != null ? (
          <pre className="font-mono leading-snug whitespace-pre text-ink" style={{ fontSize }}>
            {tab.content}
          </pre>
        ) : (
          <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center">
            <div className="font-display text-lg font-semibold text-ink">{tab.file_name}</div>
            <div className="text-[13px] text-ink-muted">
              Woodshed can't display this file type, so it opens in your system's default app.
            </div>
            <Button disabled={openFile.isPending} onClick={() => openFile.mutate()}>
              Open file
            </Button>
            {openFile.error && (
              <div className="text-xs text-danger">Couldn't open it: {String(openFile.error)}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
