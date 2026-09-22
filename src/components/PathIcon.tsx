import type { GuitarPath } from "@/lib/types";

/** Icon for a practice path, or for the tab library that sits alongside them. */
export function PathIcon({ path, className }: { path: GuitarPath | "tabs"; className?: string }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    className,
  };

  if (path === "rhythm") {
    return (
      <svg {...common}>
        <path d="M4 8h10M4 12h16M4 16h8" />
      </svg>
    );
  }

  if (path === "lead") {
    return (
      <svg {...common}>
        <path d="M4 18l5-4 4 2 7-9" />
        <circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="9" cy="14" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="13" cy="16" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="20" cy="7" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (path === "piano") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="1.5" />
        <path d="M8 19v-5M12 19v-5M16 19v-5" />
        <path d="M6.5 5v9h3V5M14.5 5v9h3V5" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (path === "tabs") {
    return (
      <svg {...common}>
        <path d="M3 6h18M3 10h18M3 14h18M3 18h18" strokeWidth={1.25} opacity={0.55} />
        <circle cx="8" cy="10" r="2.1" fill="currentColor" stroke="none" />
        <circle cx="13" cy="14" r="2.1" fill="currentColor" stroke="none" />
        <circle cx="17.5" cy="6" r="2.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M2 12c2 0 2-6 4-6s2 12 4 12 2-12 4-12 2 6 4 6 2-4 4-4" />
    </svg>
  );
}
