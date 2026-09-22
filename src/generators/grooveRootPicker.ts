import type { Generator } from "./types";

/** Random root-note cue for bass groove drills (root-fifth or walking patterns). */
export const grooveRootPicker: Generator = (input, previousLabel) => {
  const roots = (input.config.roots as string[] | undefined) ?? [];
  const pattern = (input.config.pattern as string | undefined) ?? "root_fifth";

  if (roots.length === 0) {
    return { label: "?" };
  }

  let choice = roots[Math.floor(Math.random() * roots.length)];
  if (roots.length > 1 && choice === previousLabel) {
    choice = roots[(roots.indexOf(choice) + 1) % roots.length];
  }

  const detail = pattern === "walking" ? "Walk into the next root" : "Root – fifth – root – fifth";
  return { label: choice, detail };
};
