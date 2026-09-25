import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/hooks/useHotkeys";

type Shortcut = { keys: string[]; action: string };
type ShortcutGroup = { screen: string; shortcuts: Shortcut[] };

// Keep in sync with the useHotkeys calls on each screen.
const SHORTCUTS: ShortcutGroup[] = [
  {
    screen: "Everywhere",
    shortcuts: [
      { keys: ["Enter"], action: "Do the screen's main action" },
      { keys: ["Esc"], action: "Go back, or cancel what you're editing" },
    ],
  },
  {
    screen: "Home",
    shortcuts: [
      { keys: ["T"], action: "Open the tuner" },
      { keys: ["?"], action: "Show this help" },
      { keys: ["Esc"], action: "Switch profile" },
    ],
  },
  {
    screen: "Session setup",
    shortcuts: [
      { keys: ["Enter"], action: "Start the session" },
      { keys: ["Esc"], action: "Back to skills" },
    ],
  },
  {
    screen: "Practice session",
    shortcuts: [
      { keys: ["Enter"], action: "Mark a rep as hit (or skip the rest timer)" },
      { keys: ["M"], action: "Mark a rep as missed" },
      { keys: ["Esc"], action: "Leave the session" },
    ],
  },
  {
    screen: "Tab library",
    shortcuts: [
      { keys: ["/"], action: "Search" },
      { keys: ["Enter"], action: "Open the top result, or save new uploads" },
      { keys: ["Esc"], action: "Clear the search, or back to Home" },
    ],
  },
  {
    screen: "Tab",
    shortcuts: [
      { keys: ["P"], action: "Play along" },
      { keys: ["T"], action: "Tune to this tab" },
      { keys: ["E"], action: "Edit title, artist, tuning and capo" },
      { keys: ["+", "-"], action: "Bigger or smaller text" },
      { keys: ["Esc"], action: "Back to the library" },
    ],
  },
  {
    screen: "Tuner",
    shortcuts: [
      { keys: ["←", "→"], action: "Lock to a string" },
      { keys: ["A"], action: "Auto-detect the string" },
      { keys: ["C"], action: "Toggle chromatic mode" },
      { keys: ["Esc"], action: "Back" },
    ],
  },
  {
    screen: "Play-along",
    shortcuts: [
      { keys: ["Enter"], action: "Start, or play again when finished" },
      { keys: ["T"], action: "Tune to the tab first" },
      { keys: ["←", "→"], action: "Back or skip a note" },
      { keys: ["L"], action: "Loop the current bar" },
      { keys: ["P"], action: "Pause" },
      { keys: ["R"], action: "Restart" },
      { keys: ["Esc"], action: "Stop, back to the tab" },
    ],
  },
];

const FEATURES: { name: string; detail: string }[] = [
  {
    name: "Practice paths",
    detail:
      "Rhythm, Lead, Bass, Piano, Clean Vocals, Extreme Vocals and Ukulele, each a list of skills with generated drills: chords, scale patterns, grooves, triads, strumming, note finding, singing and scream techniques. Rhythm, Lead and Bass also have genre sections, from blues and rock to metal, punk, funk, reggae, country and jazz. Reps add up toward mastery.",
  },
  {
    name: "Tutorials",
    detail:
      "Genre, Clean Vocals, Extreme Vocals and Ukulele skills pick a tutorial video for you, ranked by views, like rate and a sample of viewer comments. Videos with lots of \"this hurt my throat\" comments get ranked down.",
  },
  {
    name: "Mic checks",
    detail:
      "Every Clean Vocals and Extreme Vocals skill has a mic check on its setup screen. Do a short exercise into a mic and Woodshed scores your pitch, how long and how steadily you held the note, and your vibrato. For screams, fry and belting it also warns when you push past your speaking volume, let bursts run long or rest too little. It never uses the guitar input; a USB mic gives the steadiest readings.",
  },
  {
    name: "Session setup",
    detail:
      "Pick which chords to drill, then set sets, reps, rest and tempo. Tempo can go up automatically after two clean sessions.",
  },
  {
    name: "Practice sessions",
    detail:
      "A prompt per rep. Mark each one hit or missed, with a rest timer between sets. Lead and bass prompts show the tab to play and its fretboard shape, with the root in orange.",
  },
  {
    name: "Progress",
    detail: "Total sessions, current streak, practice time, skills mastered and sessions per week.",
  },
  {
    name: "Tab library",
    detail:
      "Upload text tabs (.txt, ChordPro), PDFs or Guitar Pro files. Search by title, artist or tuning, sort the list, and keep capo and tuning details with each tab.",
  },
  {
    name: "Tuner",
    detail:
      "Listens to your input and finds the string for you, or lock to one. Supports alternate guitar tunings, ukulele tunings and a chromatic mode.",
  },
  {
    name: "Play-along",
    detail:
      "Play through a text tab while Woodshed listens and scores each note, normal or strict. Loop tricky bars, then see your most missed notes, slowest changes and weakest bars.",
  },
  {
    name: "Profiles",
    detail: "Everyone gets their own profile with separate progress and tabs.",
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border-strong bg-bg px-1.5 font-body text-[11px] font-semibold text-ink">
      {children}
    </kbd>
  );
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  useHotkeys({ Escape: onClose, "?": onClose });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="flex max-h-full w-[760px] flex-col overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-8 py-5">
          <div id="help-title" className="font-display text-xl font-semibold text-ink">
            Help
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close help" autoFocus>
            <X size={18} />
          </Button>
        </div>

        <div className="flex flex-col gap-8 overflow-auto px-8 py-6">
          <section className="flex flex-col gap-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Keyboard shortcuts
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-6">
              {SHORTCUTS.map((group) => (
                <div key={group.screen} className="flex flex-col gap-2">
                  <div className="text-[13px] font-semibold text-ink-muted">{group.screen}</div>
                  {group.shortcuts.map((s) => (
                    <div key={s.action} className="flex items-center gap-3">
                      <div className="flex w-16 shrink-0 gap-1">
                        {s.keys.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </div>
                      <span className="text-[13px] text-ink">{s.action}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="text-xs text-ink-faint">
              Letter shortcuts are ignored while you're typing in a text field.
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Features
            </div>
            <div className="flex flex-col gap-3.5">
              {FEATURES.map((f) => (
                <div key={f.name}>
                  <div className="text-[13px] font-semibold text-ink">{f.name}</div>
                  <div className="text-[13px] leading-relaxed text-ink-muted">{f.detail}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
