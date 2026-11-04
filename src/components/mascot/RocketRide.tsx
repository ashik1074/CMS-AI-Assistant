import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MascotRideContext, useMascotRide } from '../../hooks/useMascotRide';
import { cn } from '../../utils/cn';
import { ANCHOR_X, ANCHOR_Y, PERSPECTIVE, flightKeyframes, pickRide, rideDurationMs, rideHasRocket, type RideKind } from '../../utils/rocketFlight';
import { Mascot } from './Mascot';

interface Point {
  x: number;
  y: number;
}

function RocketFlight({ kind, origin, durationMs }: { kind: RideKind; origin: Point; durationMs: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;
    // The ride is decoration: if the browser rejects the animation, skip it rather than break the page.
    try {
      const frames = flightKeyframes({ kind, origin, viewport: { width: window.innerWidth, height: window.innerHeight } });
      const anim = el.animate(frames, { duration: durationMs, easing: 'linear', fill: 'both' });
      return () => anim.cancel();
    } catch {
      el.style.display = 'none';
    }
  }, [kind, origin, durationMs]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
      style={{ perspective: `${PERSPECTIVE}px`, perspectiveOrigin: `${origin.x}px ${origin.y - 80}px` }}
      aria-hidden="true"
      data-testid="rocket-ride"
      data-ride={kind}
    >
      <div
        ref={ref}
        className="absolute left-0 top-0 h-[90px] w-[130px] opacity-0"
        style={{ transformOrigin: `${ANCHOR_X}px ${ANCHOR_Y}px`, transformStyle: 'preserve-3d', willChange: 'transform, opacity' }}
      >
        {rideHasRocket(kind) ? (
          <div className="rocket-shake absolute inset-0">
            <Mascot size={46} mood="working" className="absolute left-[42px] top-0 text-zinc-900 dark:text-white" />
            <Rocket />
            <span className="rocket-puff absolute left-0 top-[55px]" />
            <span className="rocket-puff rocket-puff-2 absolute left-0 top-[52px]" />
            <span className="rocket-puff rocket-puff-3 absolute left-0 top-[58px]" />
          </div>
        ) : (
          // Jetpack: the mascot flies on its own thrusters, a little bigger, centred on the same anchor.
          <Mascot size={56} mood="working" className="absolute left-[37px] top-[-8px] text-zinc-900 dark:text-white" />
        )}
      </div>
    </div>
  );
}

/** A small cartoon rocket pointing right; the mascot sits astride it, legs tucked behind the hull. */
function Rocket() {
  return (
    <svg className="absolute left-0 top-[34px]" width="130" height="56" viewBox="0 0 130 56" aria-hidden="true">
      <defs>
        <linearGradient id="rocket-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#e2e8f0" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="rocket-fire" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#fff7d6" />
          <stop offset="0.35" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="rocket-fire" d="M24 19 Q-4 28 24 37 Z" fill="url(#rocket-fire)" />
      <rect x="20" y="20" width="8" height="16" rx="2" fill="#475569" />
      <path d="M32 12 L20 1 L50 12 Z" fill="#ef4444" />
      <path d="M32 44 L20 55 L50 44 Z" fill="#ef4444" />
      <path d="M28 12 H92 Q120 14 127 28 Q120 42 92 44 H28 Q23 28 28 12 Z" fill="url(#rocket-hull)" stroke="#64748b" strokeWidth="1" />
      <path d="M104 15.5 Q120 20 127 28 Q120 36 104 40.5 Q108 28 104 15.5 Z" fill="#ef4444" />
      <rect x="84" y="12.5" width="5" height="31" fill="#ef4444" opacity="0.85" />
      <circle cx="96" cy="28" r="6" fill="#1e2a55" stroke="#93c5fd" strokeWidth="2" />
      <circle cx="94" cy="26" r="1.8" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

/**
 * Lets any mascot on screen be clicked to do a short 3D trick around its spot and come back: one of
 * several rides, picked at random and never the same twice in a row. Purely for fun: it never blocks
 * the page, and it is skipped when the user prefers reduced motion.
 */
export function MascotRideProvider({ children, durationMs }: { children: ReactNode; /** Fixed length for every ride (tests); otherwise each ride's own. */ durationMs?: number }) {
  const [ride, setRide] = useState<{ id: number; kind: RideKind; origin: Point; durationMs: number } | null>(null);
  const riding = useRef(false);
  const lastKind = useRef<RideKind | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const launch = useCallback(
    (from: HTMLElement) => {
      if (riding.current) return;
      if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const r = from.getBoundingClientRect();
      const kind = pickRide(lastKind.current);
      const length = durationMs ?? rideDurationMs(kind);
      lastKind.current = kind;
      riding.current = true;
      setRide({ id: Date.now(), kind, origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, durationMs: length });
      timer.current = setTimeout(() => {
        riding.current = false;
        setRide(null);
      }, length);
    },
    [durationMs],
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ riding: ride !== null, launch }), [ride, launch]);
  return (
    <MascotRideContext.Provider value={value}>
      {children}
      {ride && createPortal(<RocketFlight key={ride.id} kind={ride.kind} origin={ride.origin} durationMs={ride.durationMs} />, document.body)}
    </MascotRideContext.Provider>
  );
}

interface MascotLauncherProps {
  children: ReactNode;
  className?: string;
  /** Keep it out of the tab order where the mascot is purely decorative. */
  focusable?: boolean;
}

/** Wraps a mascot so clicking it plays a random trick; it hides here until it comes back. */
export function MascotLauncher({ children, className, focusable = true }: MascotLauncherProps) {
  const { riding, launch } = useMascotRide();
  return (
    <button
      type="button"
      onClick={(e) => launch(e.currentTarget)}
      tabIndex={focusable ? undefined : -1}
      aria-label="Play with the mascot"
      title="Click me!"
      className={cn(
        'pointer-events-auto cursor-pointer rounded-full transition-[opacity,transform] duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        riding && 'scale-75 opacity-0',
        className,
      )}
      data-testid="mascot-launcher"
    >
      {children}
    </button>
  );
}
