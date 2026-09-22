/**
 * Reads plain-text guitar/bass tabs into a sequence of steps for play-along.
 *
 * A staff is 4-7 consecutive lines like `e|---0---3---|`, with or without
 * string labels. Notes that start in the same column form one step (a chord
 * when more than one is scored). Pitches come from the string's open note,
 * the capo, and the fret.
 */
import { normalizeTuningName, resolveTuning, standardFor, tuningFromNoteNames } from "./tunings";

export type Technique = "hammer" | "pull" | "slide" | "bend" | "harmonic" | "ghost" | "dead";

export interface StepNote {
  /** 0 = the lowest string. */
  string: number;
  fret: number | null;
  /** Sounding MIDI pitch with tuning and capo applied; null for dead notes. */
  midi: number | null;
  /** For bends, the pitch the bend should reach. */
  bendTo?: number;
  technique?: Technique;
  /** Ghost notes, dead notes and unknown harmonics aren't scored. */
  scored: boolean;
}

export interface Step {
  index: number;
  kind: "note" | "chord" | "unscored";
  notes: StepNote[];
  /** A hammer-on, pull-off or slide: it can sound without being picked. */
  legato: boolean;
  block: number;
  /** 1-based bar number across the whole tab. */
  bar: number;
  section: number | null;
  stringCount: number;
  /** Character ranges to highlight in the original text, one per staff line. */
  spans: { line: number; start: number; end: number }[];
}

export interface TabSection {
  name: string;
  firstStep: number;
  lastStep: number;
}

export interface ParsedTab {
  lines: string[];
  steps: Step[];
  sections: TabSection[];
  /** Strings and open notes (lowest first) of the first staff. */
  stringCount: number | null;
  tuning: number[] | null;
  tuningSource: "saved" | "labels" | "standard" | null;
  warnings: string[];
  /** Lines that look like tab but couldn't be read as a staff. */
  unreadableLines: number[];
}

export interface ParseOptions {
  /** The tab's saved tuning: a name like "Drop D" or notes like "D A D G B E". */
  tuning?: string | null;
  capo?: number;
}

interface StaffLine {
  line: number;
  label: string | null;
  bodyStart: number;
  body: string;
}

interface RawNote {
  li: number;
  start: number;
  end: number;
  fret: number | null;
  bendFret?: number;
  technique?: Technique;
  scored: boolean;
}

const LABELLED = /^\s*([A-Ga-g][#b]?)\s*[|:]/;
const TAB_CHARS = /[-0-9|hpbr/\\~xX()<>.*^=\s]/;
const SECTION_BRACKET = /^\s*\[([^\]]{1,40})\]\s*$/;
const SECTION_WORD =
  /^\s*((?:intro|verse|pre-?chorus|chorus|bridge|solo|outro|main riff|riff|interlude|breakdown)(?:\s*\d+)?)\s*:?\s*$/i;
const CHORD_NAME = /^[A-G][#b]?(m|maj|min|dim|aug|sus|add|\d)*$/;

/** Natural harmonic at this fret sounds this many semitones above the open string. */
const HARMONIC_INTERVAL: Record<number, number> = { 12: 12, 7: 19, 19: 19, 5: 24, 24: 24, 4: 28, 9: 28, 16: 28, 3: 31 };

const isDigit = (ch: string | undefined) => ch !== undefined && ch >= "0" && ch <= "9";

function asStaffLine(text: string, line: number): StaffLine | null {
  let label: string | null = null;
  let bodyStart: number;
  const m = LABELLED.exec(text);
  if (m) {
    label = m[1];
    bodyStart = m[0].length;
  } else if (/^\s*\|/.test(text)) {
    bodyStart = text.indexOf("|") + 1;
  } else if (/^\s*-/.test(text)) {
    bodyStart = text.indexOf("-");
  } else {
    return null;
  }
  let body = text.slice(bodyStart).replace(/\s+$/, "");
  // Drop annotations after the last bar line, like "| x2" or "|(x4)", so repeat
  // counts aren't read as frets.
  const lastBar = body.lastIndexOf("|");
  if (lastBar >= 0 && !body.slice(lastBar).includes("-")) body = body.slice(0, lastBar + 1);
  if (body.split("-").length - 1 < 4) return null;
  let tabChars = 0;
  for (const ch of body) if (TAB_CHARS.test(ch)) tabChars++;
  if (tabChars / body.length < 0.7) return null;
  return { line, label, bodyStart, body };
}

/** Bar number at a column: 1 + bar lines before it, ignoring a leading bar line and doubled ones. */
function barAt(body: string, col: number): number {
  let bars = 1;
  for (let i = 1; i < col && i < body.length; i++) {
    if (body[i] === "|" && body[i - 1] !== "|") bars++;
  }
  return bars;
}

function readFret(body: string, at: number): { fret: number; len: number } | null {
  if (!isDigit(body[at])) return null;
  if (isDigit(body[at + 1])) {
    const two = parseInt(body.slice(at, at + 2), 10);
    if (two <= 24) return { fret: two, len: 2 };
  }
  return { fret: parseInt(body[at], 10), len: 1 };
}

function readNotes(body: string, li: number): RawNote[] {
  const notes: RawNote[] = [];
  let c = 0;
  while (c < body.length) {
    const ch = body[c];
    const fret = readFret(body, c);
    if (fret) {
      const before = body[c - 1];
      let technique: Technique | undefined;
      let scored = true;
      if (before === "h") technique = "hammer";
      else if (before === "p") technique = "pull";
      else if (before === "/" || before === "\\") technique = "slide";
      else if (before === "(") {
        technique = "ghost";
        scored = false;
      } else if (before === "<") technique = "harmonic";

      let end = c + fret.len;
      let bendFret: number | undefined;
      if (body[end] === "b") {
        const target = readFret(body, end + 1);
        // "7b" without a target is taken as a whole-step bend.
        bendFret = target ? target.fret : fret.fret + 2;
        end += 1 + (target?.len ?? 0);
        technique = "bend";
        const release = body[end] === "r" ? readFret(body, end + 1) : null;
        if (release) end += 1 + release.len;
      }
      notes.push({ li, start: c, end, fret: fret.fret, bendFret, technique, scored });
      c = end;
      continue;
    }
    if ((ch === "x" || ch === "X") && !isDigit(body[c - 1]) && !isDigit(body[c + 1])) {
      notes.push({ li, start: c, end: c + 1, fret: null, technique: "dead", scored: false });
    }
    c++;
  }
  return notes;
}

function samePitchClasses(a: number[], b: number[]) {
  return a.length === b.length && a.every((m, i) => m % 12 === b[i] % 12);
}

function tuningForStaff(
  staff: StaffLine[],
  saved: string | null | undefined,
  warn: (message: string) => void,
): { strings: number[]; source: "saved" | "labels" | "standard" } {
  const count = staff.length;
  const labels = staff.map((s) => s.label && s.label.charAt(0).toUpperCase() + s.label.slice(1));
  const fromLabels = labels.every((l) => l !== null)
    ? tuningFromNoteNames([...(labels as string[])].reverse())
    : null;
  const savedStrings = saved?.trim() ? resolveTuning(normalizeTuningName(saved)) : null;

  if (savedStrings && savedStrings.length === count) {
    if (fromLabels && !samePitchClasses(savedStrings, fromLabels)) {
      warn(
        `The staff is labelled ${[...(labels as string[])].reverse().join(" ")} but the tab's tuning is ` +
          `${saved}. Using ${saved}.`,
      );
    }
    return { strings: savedStrings, source: "saved" };
  }
  if (savedStrings) {
    warn(`The saved tuning (${saved}) has ${savedStrings.length} strings but the staff has ${count}.`);
  } else if (saved?.trim()) {
    warn(`Couldn't understand the tuning "${saved}".`);
  }
  if (fromLabels) return { strings: fromLabels, source: "labels" };
  return { strings: standardFor(count)!.strings, source: "standard" };
}

export function parseTab(text: string, options: ParseOptions = {}): ParsedTab {
  const capo = options.capo ?? 0;
  const lines = text.split(/\r?\n/);
  const warnings: string[] = [];
  const warn = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message);
  };

  const steps: Step[] = [];
  const sections: TabSection[] = [];
  const unreadableLines: number[] = [];
  let first: { count: number; strings: number[]; source: ParsedTab["tuningSource"] } | null = null;
  let barOffset = 0;
  let blockIndex = 0;
  let pendingSection: string | null = null;

  const finishStaff = (staff: StaffLine[]) => {
    if (staff.length === 0) return;
    if (staff.length < 4 || staff.length > 7) {
      unreadableLines.push(...staff.map((s) => s.line));
      return;
    }
    const { strings, source } = tuningForStaff(staff, options.tuning, warn);
    first ??= { count: staff.length, strings, source };

    if (pendingSection !== null) {
      sections.push({ name: pendingSection, firstStep: steps.length, lastStep: steps.length - 1 });
      pendingSection = null;
    }
    const sectionIndex = sections.length > 0 ? sections.length - 1 : null;

    const raw = staff.flatMap((s, li) => readNotes(s.body, li));
    raw.sort((a, b) => a.start - b.start || a.li - b.li);
    const groups: { start: number; end: number; notes: RawNote[] }[] = [];
    for (const note of raw) {
      const current = groups[groups.length - 1];
      if (current && (note.start < current.end || note.start === current.start)) {
        current.notes.push(note);
        current.end = Math.max(current.end, note.end);
      } else {
        groups.push({ start: note.start, end: note.end, notes: [note] });
      }
    }

    const count = staff.length;
    for (const group of groups) {
      const notes: StepNote[] = group.notes
        .map((r): StepNote => {
          const string = count - 1 - r.li;
          const open = strings[string] + capo;
          let midi: number | null = null;
          if (r.fret !== null) {
            if (r.technique === "harmonic") {
              const interval = HARMONIC_INTERVAL[r.fret];
              midi = interval === undefined ? null : open + interval;
            } else {
              midi = open + r.fret;
            }
          }
          return {
            string,
            fret: r.fret,
            midi,
            bendTo: r.bendFret !== undefined ? open + r.bendFret : undefined,
            technique: r.technique,
            scored: r.scored && midi !== null,
          };
        })
        .sort((a, b) => a.string - b.string);

      const scored = notes.filter((n) => n.scored);
      const kind: Step["kind"] = scored.length === 0 ? "unscored" : scored.length === 1 ? "note" : "chord";
      const technique = scored[0]?.technique;
      steps.push({
        index: steps.length,
        kind,
        notes,
        legato: kind === "note" && (technique === "hammer" || technique === "pull" || technique === "slide"),
        block: blockIndex,
        bar: barOffset + barAt(staff[0].body, group.start),
        section: sectionIndex,
        stringCount: count,
        spans: staff.map((s) => ({ line: s.line, start: s.bodyStart + group.start, end: s.bodyStart + group.end })),
      });
    }

    const body = staff[0].body;
    barOffset += barAt(body, body.length) - (body.endsWith("|") ? 1 : 0);
    blockIndex++;
  };

  let staff: StaffLine[] = [];
  lines.forEach((text, i) => {
    const s = asStaffLine(text, i);
    if (s) {
      staff.push(s);
      return;
    }
    finishStaff(staff);
    staff = [];
    const bracket = SECTION_BRACKET.exec(text)?.[1]?.trim();
    const word = SECTION_WORD.exec(text)?.[1]?.trim();
    const name = bracket && !CHORD_NAME.test(bracket) ? bracket : word;
    if (name) pendingSection = name;
  });
  finishStaff(staff);

  for (const section of sections) {
    const next = sections[sections.indexOf(section) + 1];
    section.lastStep = (next ? next.firstStep : steps.length) - 1;
  }
  if (unreadableLines.length > 0) {
    warn(`${unreadableLines.length} line${unreadableLines.length === 1 ? "" : "s"} looked like tab but couldn't be read.`);
  }

  const f = first as { count: number; strings: number[]; source: ParsedTab["tuningSource"] } | null;
  return {
    lines,
    steps,
    sections,
    stringCount: f?.count ?? null,
    tuning: f?.strings ?? null,
    tuningSource: f?.source ?? null,
    warnings,
    unreadableLines,
  };
}
