/** Decorative, slowly drifting colour glows behind the main area. Purely visual. */
export function AmbientBackground() {
  return (
    <div className="ambient-bg pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true" data-testid="ambient-background">
      <div className="ambient-blob ambient-blob-1" />
      <div className="ambient-blob ambient-blob-2" />
      <div className="ambient-blob ambient-blob-3" />
      <div className="ambient-grid" />
    </div>
  );
}
