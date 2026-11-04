export function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 150, 300].map((delayMs) => (
        <span key={delayMs} className="h-1.5 w-1.5 animate-dot rounded-full bg-zinc-500 dark:bg-zinc-400" style={{ animationDelay: `${delayMs}ms` }} />
      ))}
    </span>
  );
}
