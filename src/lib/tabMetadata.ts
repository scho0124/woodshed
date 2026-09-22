import { pitchClass } from "./pianoTheory";

/** Largest file the library accepts; files cross the IPC bridge as a JSON byte array. */
export const MAX_TAB_BYTES = 20 * 1024 * 1024;

const TEXT_EXTENSIONS = ["txt", "tab", "crd", "chopro", "cho", "chordpro", "pro"];

/** Tunings keyed by pitch classes, low string to high. */
const KNOWN_TUNINGS: [number[], string][] = [
  [[4, 9, 2, 7, 11, 4], "Standard"],
  [[2, 9, 2, 7, 11, 4], "Drop D"],
  [[3, 8, 1, 6, 10, 3], "Half step down"],
  [[2, 7, 0, 5, 9, 2], "Whole step down"],
  [[1, 8, 1, 6, 10, 3], "Drop C#"],
  [[0, 7, 0, 5, 9, 2], "Drop C"],
  [[11, 6, 11, 4, 8, 1], "Drop B"],
  [[2, 9, 2, 7, 9, 2], "DADGAD"],
  [[2, 7, 2, 7, 11, 2], "Open G"],
  [[2, 9, 2, 6, 9, 2], "Open D"],
  [[4, 11, 4, 8, 11, 4], "Open E"],
  [[4, 9, 2, 7], "Standard (bass)"],
  [[2, 9, 2, 7], "Drop D (bass)"],
  [[11, 4, 9, 2, 7], "Standard (5-string bass)"],
];

/** Tuning names offered as suggestions when editing. */
export const TUNING_SUGGESTIONS = KNOWN_TUNINGS.map(([, name]) => name);

export interface TabDraft {
  file: File;
  title: string;
  artist: string;
  tuning: string;
  isText: boolean;
}

export function isTextFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.includes(ext) || file.type.startsWith("text/");
}

/**
 * "Nirvana - Come As You Are (ver 2).txt" -> { artist: "Nirvana", title: "Come As You Are" }.
 * Also understands "Title by Artist".
 */
function fromFileName(name: string): { title: string; artist: string } {
  let base = name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  const noise = /\s*[([]?\b(ver(sion)?\.?\s*\d+|official|tabs?|chords|bass tab|guitar pro|gp\d?)\b[)\]]?\s*$/i;
  while (noise.test(base)) base = base.replace(noise, "").trim();

  const dash = base.split(/\s+[-–—]\s+/);
  if (dash.length >= 2) return { artist: dash[0].trim(), title: dash.slice(1).join(" - ").trim() };
  const by = /^(.+?)\s+by\s+(.+)$/i.exec(base);
  if (by) return { title: by[1].trim(), artist: by[2].trim() };
  return { title: base, artist: "" };
}

function headerField(text: string, names: string[]): string | undefined {
  const alt = names.join("|");
  const chordPro = new RegExp(`\\{\\s*(?:${alt})\\s*:\\s*([^}]+)\\}`, "i").exec(text);
  if (chordPro) return chordPro[1].trim();
  // Short names like "t" are ChordPro directives only; as plain "t: ..." lines they misfire.
  const plainAlt = names.filter((n) => n.length > 2).join("|");
  const plain = new RegExp(`^\\s*(?:${plainAlt})\\s*[:=]\\s*(.+)$`, "im").exec(text);
  return plain?.[1].trim().slice(0, 80);
}

/**
 * Reads the string names off the first block of tab staff lines
 * ("e|---0---", "B|---1---", ...) and names the tuning.
 */
function tuningFromStaff(text: string): string | undefined {
  const lines = text.split(/\r?\n/);
  let block: string[] = [];
  for (const line of lines) {
    const m = /^\s*([A-Ga-g][#b]?)\s*\|/.exec(line);
    if (m && (line.match(/-/g)?.length ?? 0) >= 4) {
      block.push(m[1]);
      continue;
    }
    if (block.length >= 4) break;
    block = [];
  }
  if (block.length < 4 || block.length > 7) return undefined;

  const lowToHigh = [...block].reverse();
  const pcs = lowToHigh.map((n) => pitchClass(n.charAt(0).toUpperCase() + n.slice(1)));
  if (pcs.some((p) => p === null)) return undefined;
  const known = KNOWN_TUNINGS.find(
    ([t]) => t.length === pcs.length && t.every((p, i) => p === pcs[i]),
  );
  return known?.[1] ?? lowToHigh.map((n) => n.toUpperCase()).join(" ");
}

/** Best-guess title/artist/tuning for an uploaded file, for the user to confirm. */
export async function draftFromFile(file: File): Promise<TabDraft> {
  const isText = isTextFile(file);
  const guess = fromFileName(file.name);
  let title = guess.title;
  let artist = guess.artist;
  let tuning = "";

  if (isText) {
    const text = (await file.text()).slice(0, 200_000);
    title = headerField(text, ["title", "song", "t"]) ?? title;
    artist = headerField(text, ["artist", "band", "subtitle", "st"]) ?? artist;
    tuning = headerField(text, ["tuning"]) ?? tuningFromStaff(text) ?? "";
  }

  return { file, title, artist, tuning, isText };
}
