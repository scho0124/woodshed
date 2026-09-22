import { describe, expect, it } from "vitest";
import { parseTab } from "./tabParser";

// MIDI: E2=40 A2=45 D3=50 G3=55 B3=59 E4=64
const midis = (tab: ReturnType<typeof parseTab>) =>
  tab.steps.map((s) => s.notes.filter((n) => n.scored).map((n) => n.midi));

describe("parseTab", () => {
  it("reads a labelled single-note riff with exact pitches and columns", () => {
    const text = [
      "e|-----------------|",
      "B|-----------------|",
      "G|-----------------|",
      "D|-----0-----------|",
      "A|---------2-------|",
      "E|-0-3-----------5-|",
    ].join("\n");
    const tab = parseTab(text);
    expect(tab.stringCount).toBe(6);
    expect(tab.tuningSource).toBe("labels");
    expect(tab.tuning).toEqual([40, 45, 50, 55, 59, 64]);
    expect(midis(tab)).toEqual([[40], [43], [50], [47], [45]]);
    expect(tab.steps.every((s) => s.kind === "note")).toBe(true);
    // Highlight spans cover the same column on every staff line.
    expect(tab.steps[2].spans).toHaveLength(6);
    expect(tab.steps[2].spans.every((sp) => text.split("\n")[sp.line].slice(sp.start, sp.end).length === 1)).toBe(true);
    expect(text.split("\n")[3].slice(tab.steps[2].spans[3].start, tab.steps[2].spans[3].end)).toBe("0");
  });

  it("groups notes in one column into a chord, including right-aligned two-digit frets", () => {
    const text = [
      "e|-------|",
      "B|-------|",
      "G|-------|",
      "D|--12---|",
      "A|--12---|",
      "E|---9---|",
    ].join("\n");
    const tab = parseTab(text);
    expect(tab.steps).toHaveLength(1);
    expect(tab.steps[0].kind).toBe("chord");
    expect(midis(tab)).toEqual([[49, 57, 62]]);
  });

  it("reads hammer-ons, pull-offs, slides, bends, ghost notes, dead notes and harmonics", () => {
    const text = [
      "e|------------------------------|",
      "B|------------------------------|",
      "G|--5h7p5--7b9--5/7--(5)--x--<12>-|",
      "D|------------------------------|",
      "A|------------------------------|",
      "E|------------------------------|",
    ].join("\n");
    const tab = parseTab(text);
    const g = tab.steps.map((s) => s.notes[0]);
    expect(g.map((n) => n.technique)).toEqual([
      undefined, "hammer", "pull", "bend", undefined, "slide", "ghost", "dead", "harmonic",
    ]);
    expect(g.map((n) => n.midi)).toEqual([60, 62, 60, 62, 60, 62, 60, null, 67]);
    expect(g[3].bendTo).toBe(64);
    expect(tab.steps.map((s) => s.legato)).toEqual([false, true, true, false, false, true, false, false, false]);
    expect(tab.steps.map((s) => s.kind)).toEqual([
      "note", "note", "note", "note", "note", "note", "unscored", "unscored", "note",
    ]);
  });

  it("uses the saved tuning over the labels and warns when they disagree", () => {
    const text = ["e|-----|", "B|-----|", "G|-----|", "D|-----|", "A|-----|", "E|--0--|"].join("\n");
    const tab = parseTab(text, { tuning: "Half step down" });
    expect(tab.tuningSource).toBe("saved");
    expect(midis(tab)).toEqual([[39]]);
    expect(tab.warnings.join()).toMatch(/labelled E A D G B E/);
  });

  it("understands tuning text like 'Eb standard' and note names", () => {
    const text = ["|-----|", "|-----|", "|-----|", "|-----|", "|-----|", "|--0--|"].join("\n");
    expect(midis(parseTab(text, { tuning: "Eb standard" }))).toEqual([[39]]);
    expect(midis(parseTab(text, { tuning: "D A D G B E" }))).toEqual([[38]]);
  });

  it("reads drop tunings from the staff labels", () => {
    const text = ["e|-----|", "B|-----|", "G|-----|", "D|-----|", "A|-----|", "D|--0--|"].join("\n");
    const tab = parseTab(text);
    expect(tab.tuning).toEqual([38, 45, 50, 55, 59, 64]);
    expect(midis(tab)).toEqual([[38]]);
  });

  it("falls back to standard tuning for unlabelled staffs", () => {
    const text = ["|-----|", "|-----|", "|-----|", "|--2--|", "|-----|", "|-----|"].join("\n");
    const tab = parseTab(text);
    expect(tab.tuningSource).toBe("standard");
    expect(midis(tab)).toEqual([[52]]);
  });

  it("applies the capo", () => {
    const text = ["e|--0--|", "B|-----|", "G|-----|", "D|-----|", "A|-----|", "E|-----|"].join("\n");
    expect(midis(parseTab(text, { capo: 3 }))).toEqual([[67]]);
  });

  it("reads 4-string bass staffs", () => {
    const text = ["G|-------|", "D|-------|", "A|-------|", "E|-0--3--|"].join("\n");
    const tab = parseTab(text);
    expect(tab.tuning).toEqual([28, 33, 38, 43]);
    expect(midis(tab)).toEqual([[28], [31]]);
  });

  it("skips lyrics, chord names and repeat marks, numbers bars across staffs, and finds sections", () => {
    const text = [
      "Tuning: Standard",
      "",
      "[Intro]",
      "e|---0---|---2---|",
      "B|-------|-------|",
      "G|-------|-------|",
      "D|-------|-------|",
      "A|-------|-------|",
      "E|-------|-------| x2",
      "",
      "Am        C",
      "Some lyrics here",
      "[Verse 1]",
      "e|-------|",
      "B|---1---|",
      "G|-------|",
      "D|-------|",
      "A|-------|",
      "E|-------|",
    ].join("\n");
    const tab = parseTab(text);
    expect(midis(tab)).toEqual([[64], [66], [60]]);
    expect(tab.steps.map((s) => s.bar)).toEqual([1, 2, 3]);
    expect(tab.sections.map((s) => [s.name, s.firstStep, s.lastStep])).toEqual([
      ["Intro", 0, 1],
      ["Verse 1", 2, 2],
    ]);
    expect(tab.steps.map((s) => s.section)).toEqual([0, 0, 1]);
    expect(tab.unreadableLines).toEqual([]);
  });

  it("reports staffs with the wrong number of lines instead of guessing", () => {
    const text = ["e|---0---|", "B|---1---|", "G|---0---|"].join("\n");
    const tab = parseTab(text);
    expect(tab.steps).toHaveLength(0);
    expect(tab.unreadableLines).toEqual([0, 1, 2]);
    expect(tab.warnings.join()).toMatch(/3 lines looked like tab/);
  });

  it("returns nothing for chord sheets without a staff", () => {
    const tab = parseTab("{title: Song}\n[C]Hello [G]world\nAm F C G");
    expect(tab.steps).toHaveLength(0);
    expect(tab.stringCount).toBeNull();
  });
});
