import { describe, expect, it } from "vitest";
import { placeInPosition, placeLine, scalePosition, writeTab } from "./fretboard";
import { parseTab } from "./tabParser";

const frets = (notes: { string: number; fret: number }[] | null) => notes?.map((n) => `${n.string}:${n.fret}`);

describe("scalePosition", () => {
  // A minor pentatonic, two notes per string from the low E up.
  const BOXES: Record<number, number[]> = {
    1: [5, 8, 5, 7, 5, 7, 5, 7, 5, 8, 5, 8],
    2: [8, 10, 7, 10, 7, 10, 7, 9, 8, 10, 8, 10],
    3: [10, 12, 10, 12, 10, 12, 9, 12, 10, 13, 10, 12],
    4: [12, 15, 12, 15, 12, 14, 12, 14, 13, 15, 12, 15],
    5: [15, 17, 15, 17, 14, 17, 14, 17, 15, 17, 15, 17],
  };

  it.each(Object.entries(BOXES))("plays A minor pentatonic position %s", (position, expected) => {
    const notes = scalePosition("guitar", 9, [0, 3, 5, 7, 10], Number(position), 2);
    expect(notes.map((n) => n.fret)).toEqual(expected);
    expect(notes.map((n) => n.string)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
});

describe("placeLine", () => {
  it("puts root, fifth and octave in the usual bass shapes", () => {
    expect(frets(placeLine("bass", 4, [0, 7, 12]))).toEqual(["0:0", "1:2", "2:2"]);
    expect(frets(placeLine("bass", 2, [0, 7, 12]))).toEqual(["1:5", "2:7", "3:7"]);
    expect(frets(placeLine("bass", 0, [0, 7, 12]))).toEqual(["1:3", "2:5", "3:5"]);
  });

  it("moves up an octave when the line goes below the lowest string", () => {
    expect(frets(placeLine("bass", 4, [0, -2, -5]))).toEqual(["2:2", "2:0", "1:2"]);
  });

  it("keeps to movable shapes when open strings are off", () => {
    const notes = placeLine("guitar", 4, [0, 4, 7, 10], false);
    expect(notes).not.toBeNull();
    expect(notes!.every((n) => n.fret > 0)).toBe(true);
  });

  it("stretches a fret for lines that don't fit in four", () => {
    const pitches = [0, 2, 3, 4, 7, 9, 10, 11, 12].map((o) => 38 + o);
    const notes = placeInPosition("bass", pitches)!;
    const fretted = notes.map((n) => n.fret);
    expect(Math.max(...fretted) - Math.min(...fretted)).toBe(4);
  });
});

describe("writeTab", () => {
  it("writes a tab that reads back as the same notes", () => {
    const tab = writeTab("guitar", [
      [{ string: 0, text: "5" }],
      [{ string: 1, text: "7" }],
      "rest",
      "bar",
      [
        { string: 3, text: "12" },
        { string: 4, text: "13" },
      ],
    ]);
    expect(tab).toEqual([
      "e|--------|----|",
      "B|--------|-13-|",
      "G|--------|-12-|",
      "D|--------|----|",
      "A|----7---|----|",
      "E|--5-----|----|",
    ]);
    const notes = parseTab(tab.join("\n")).steps.map((s) => s.notes.map((n) => `${n.string}:${n.fret}`));
    expect(notes).toEqual([["0:5"], ["1:7"], ["3:12", "4:13"]]);
  });
});
