/** A short tab as written, with the fret numbers and marks bright and the lines dim. */
export function TabSnippet({ lines }: { lines: string[] }) {
  return (
    <div className="max-w-[calc(100vw-5rem)] overflow-x-auto rounded-xl border border-border bg-surface px-4 py-2.5 font-mono text-[13px] leading-[1.35] text-ink-faint">
      {lines.map((line, i) => (
        <div key={i} className="whitespace-pre">
          {line.split(/([^-|]+)/).map((part, j) =>
            j % 2 === 1 ? (
              <span key={j} className="text-ink">
                {part}
              </span>
            ) : (
              part
            ),
          )}
        </div>
      ))}
    </div>
  );
}
