import { useEffect, useRef } from "react";

export type Hotkeys = Partial<Record<string, () => void>>;

function isTextField(el: Element) {
  return !!el.closest("input, textarea, select, [contenteditable='true']");
}

// Let the focused element keep Enter when it has a native meaning for it: newlines in a
// textarea, or activating a button/link the user deliberately tabbed to. A button that
// merely kept focus after a mouse click doesn't count, so Enter still hits the screen's
// primary action instead of re-clicking it.
function ownsEnter(el: Element) {
  if (el.closest("textarea, select, [contenteditable='true']")) return true;
  return !!el.closest("button, a[href]") && el.matches(":focus-visible");
}

/**
 * Screen-level keyboard shortcuts, keyed by `KeyboardEvent.key` ("Enter", "Escape", or a
 * lowercase letter). Holding a key down does not repeat the action.
 */
export function useHotkeys(hotkeys: Hotkeys, enabled = true) {
  const ref = useRef(hotkeys);
  ref.current = hotkeys;

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target instanceof Element ? e.target : null;
      const isLetter = e.key.length === 1;
      if (target && e.key === "Enter" && ownsEnter(target)) return;
      if (target && isLetter && isTextField(target)) return;

      const handler = ref.current[isLetter ? e.key.toLowerCase() : e.key];
      if (!handler) return;
      e.preventDefault();
      handler();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
