import { TUNINGS, normalizeTuningName } from "./tunings";

/** Largest file the library accepts; files cross the IPC bridge as a JSON byte array. */
export const MAX_TAB_BYTES = 20 * 1024 * 1024;

const TEXT_EXTENSIONS = ["txt", "tab", "crd", "chopro", "cho", "chordpro", "pro"];

/** Tuning names offered as suggestions when editing. */
export const TUNING_SUGGESTIONS = TUNINGS.map((t) => t.name);

export interface TabDraft {
  file: File;
  title: string;
  artist: string;
  tuning: string;
  capo: number;
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

  const lowToHigh = [...block].reverse().map((n) => n.charAt(0).toUpperCase() + n.slice(1));
  return normalizeTuningName(lowToHigh.join(" "));
}

const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12,
};

/** "Capo 2", "capo on 3rd fret", "Capo III" -> the fret; "no capo" or nothing -> 0. */
export function detectCapo(text: string): number {
  const m = /\bcapo\s*[:=]?\s*(?:on\s*)?(?:(?:the\s*)?fret\s*)?(?:(\d{1,2})(?:st|nd|rd|th)?|([ivx]{1,4}))\b/i.exec(text);
  if (!m) return 0;
  const fret = m[1] ? parseInt(m[1], 10) : (ROMAN[m[2].toLowerCase()] ?? 0);
  return fret >= 1 && fret <= 12 ? fret : 0;
}

/** Best-guess title/artist/tuning for an uploaded file, for the user to confirm. */
export async function draftFromFile(file: File): Promise<TabDraft> {
  const isText = isTextFile(file);
  const guess = fromFileName(file.name);
  let title = guess.title;
  let artist = guess.artist;
  let tuning = "";
  let capo = 0;

  if (isText) {
    const text = (await file.text()).slice(0, 200_000);
    title = headerField(text, ["title", "song", "t"]) ?? title;
    artist = headerField(text, ["artist", "band", "subtitle", "st"]) ?? artist;
    const header = headerField(text, ["tuning"]);
    tuning = header ? normalizeTuningName(header) : (tuningFromStaff(text) ?? "");
    capo = detectCapo(text);
  }

  return { file, title, artist, tuning, capo, isText };
}
