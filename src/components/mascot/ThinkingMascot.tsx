import { useEffect, useState } from 'react';
import { Mascot } from './Mascot';
import { MascotLauncher } from './RocketRide';

const CAPTIONS = ['Thinking it through…', 'Checking my notes…', 'Connecting the dots…', 'Putting it together…', 'Almost there…'];

/**
 * Shown in the chat while a response is being prepared, so the wait feels alive. Decorative: the
 * processing indicator above it already announces progress to assistive tech.
 */
export function ThinkingMascot() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % CAPTIONS.length), 2200);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="mt-3 flex animate-fade-in items-end gap-3" aria-hidden="true" data-testid="thinking-mascot">
      <MascotLauncher focusable={false} className="shrink-0">
        <Mascot size={52} mood="thinking" className="mascot-enter block" />
      </MascotLauncher>
      <span key={index} className="mb-6 animate-fade-in rounded-2xl rounded-bl-sm bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 dark:bg-brand-500/15 dark:text-brand-200">
        {CAPTIONS[index]}
      </span>
    </div>
  );
}
