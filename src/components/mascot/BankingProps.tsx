import type { CSSProperties, ReactNode } from 'react';
import type { RideScene } from '../../utils/rocketFlight';

/*
 * Props for the banking tricks. Vehicles (the card and the chart arrow) ride along in the rider box.
 * Scenes are drawn around the stage, the spot the mascot rises to, and timed in step with its pose:
 * every delay and duration is a share of the ride, so a shorter test ride stays in sync.
 */

/** A bank card, seen flat: it becomes a surfboard under the mascot, or the card it taps to pay. */
/** `plain` leaves out the printed text, for when the card can be seen from behind (mirrored). */
export function BankCardArt({ width = 100, plain, className, style }: { width?: number; plain?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} width={width} height={width * 0.63} viewBox="0 0 100 63" aria-hidden="true">
      <defs>
        <linearGradient id="bank-card-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="99" height="62" rx="7" fill="url(#bank-card-face)" stroke="#c4b5fd" strokeWidth="1" />
      <path d="M0 40 Q40 22 100 34 V56 Q100 62 93 62 H7 Q0 62 0 56 Z" fill="#ffffff" opacity="0.08" />
      {/* Chip */}
      <rect x="11" y="20" width="15" height="12" rx="2.5" fill="#fcd34d" stroke="#b45309" strokeWidth="0.6" />
      <path d="M11 26 h15 M18.5 20 v12" stroke="#b45309" strokeWidth="0.6" />
      {/* Contactless mark */}
      <path d="M33 22 q3 4 0 8 M37 20 q5 6 0 12 M41 18 q7 8 0 16" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
      {plain ? (
        <path d="M10 45 h56 M10 53 h30" stroke="#e0e7ff" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      ) : (
        <>
          <text x="10" y="47" fontSize="7.5" fontFamily="ui-monospace, monospace" fill="#e0e7ff" letterSpacing="1">
            4213 •••• 0927
          </text>
          <text x="10" y="56" fontSize="5" fontFamily="system-ui, sans-serif" fill="#c7d2fe">
            AI ASSISTANT
          </text>
        </>
      )}
      <circle cx="80" cy="51" r="6" fill="#f59e0b" opacity="0.9" />
      <circle cx="88" cy="51" r="6" fill="#ef4444" opacity="0.75" />
    </svg>
  );
}

/**
 * The card the mascot surfs on, tilted flat under its feet. The tilt is drawn flat (its own perspective,
 * no shared 3D space), so the card never cuts through the mascot standing on it.
 */
export function CardBoard() {
  return (
    <div className="absolute left-[15px] top-[30px]" style={{ transform: 'perspective(260px) rotateX(62deg)' }}>
      <BankCardArt width={100} plain />
    </div>
  );
}

/** A rising chart arrow pointing right, with a growth badge; the mascot sits astride it. */
export function ChartArrow() {
  return (
    <svg className="absolute left-0 top-[34px]" width="130" height="56" viewBox="0 0 130 56" aria-hidden="true">
      <defs>
        <linearGradient id="chart-arrow-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4ade80" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      {/* The chart line it leaves behind */}
      <path className="chart-trail" d="M2 40 L12 30 L20 36 L30 24" fill="none" stroke="#86efac" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 18 H96 V6 L128 28 L96 50 V38 H30 Q24 28 30 18 Z" fill="url(#chart-arrow-body)" stroke="#166534" strokeWidth="1" />
      {/* A growth badge: a chevron along the arrow, so it still reads right when the arrow flies left (mirrored). */}
      <circle cx="80" cy="28" r="7.5" fill="#ffffff" opacity="0.95" />
      <path d="M78.5 24 l4 4 l-4 4" fill="none" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Coin({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#f59e0b" />
      <circle cx="12" cy="12" r="8.5" fill="#fcd34d" stroke="#d97706" strokeWidth="1" />
      <text x="12" y="16.2" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#b45309">
        ৳
      </text>
      <ellipse cx="8.5" cy="7.5" rx="2.6" ry="1.4" fill="#ffffff" opacity="0.6" transform="rotate(-35 8.5 7.5)" />
    </svg>
  );
}

function Banknote() {
  return (
    <svg width="44" height="22" viewBox="0 0 44 22" aria-hidden="true">
      <rect x="0.5" y="0.5" width="43" height="21" rx="2.5" fill="#86efac" stroke="#15803d" strokeWidth="1" />
      <rect x="3" y="3" width="38" height="16" rx="1.5" fill="none" stroke="#16a34a" strokeWidth="0.7" strokeDasharray="2 1.5" />
      <circle cx="22" cy="11" r="5.5" fill="#bbf7d0" stroke="#15803d" strokeWidth="0.8" />
      <text x="22" y="14.2" textAnchor="middle" fontSize="8" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#166534">
        ৳
      </text>
      <text x="6" y="9" fontSize="5" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#166534">
        500
      </text>
    </svg>
  );
}

function PiggyBank() {
  return (
    <svg width="78" height="58" viewBox="0 0 78 58" aria-hidden="true">
      <ellipse cx="38" cy="32" rx="28" ry="21" fill="#f9a8d4" stroke="#db2777" strokeWidth="1.2" />
      {/* Ear, snout, eye, tail and legs; it faces right. */}
      <path d="M46 14 L52 4 L56 16 Z" fill="#f472b6" stroke="#db2777" strokeWidth="1" strokeLinejoin="round" />
      <ellipse cx="66" cy="33" rx="7" ry="8" fill="#f472b6" stroke="#db2777" strokeWidth="1.2" />
      <circle cx="64.5" cy="31" r="1.2" fill="#9d174d" />
      <circle cx="68" cy="31" r="1.2" fill="#9d174d" />
      <circle cx="54" cy="24" r="2.2" fill="#1f2937" />
      <circle cx="54.7" cy="23.3" r="0.7" fill="#ffffff" />
      <path d="M10 28 q-7 -2 -5 -8 q2 -4 5 0" fill="none" stroke="#db2777" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="20" y="46" width="8" height="10" rx="3" fill="#f472b6" stroke="#db2777" strokeWidth="1" />
      <rect x="46" y="46" width="8" height="10" rx="3" fill="#f472b6" stroke="#db2777" strokeWidth="1" />
      {/* Coin slot on its back */}
      <rect x="30" y="11.5" width="14" height="3" rx="1.5" fill="#831843" />
      <ellipse cx="30" cy="24" rx="9" ry="5" fill="#ffffff" opacity="0.35" transform="rotate(-20 30 24)" />
    </svg>
  );
}

function PaymentTerminal() {
  return (
    <svg width="46" height="72" viewBox="0 0 46 72" aria-hidden="true">
      <rect x="1" y="1" width="44" height="70" rx="8" fill="#334155" stroke="#0f172a" strokeWidth="1.5" />
      <rect x="6" y="7" width="34" height="22" rx="3" fill="#0f172a" />
      {/* Turns green with a tick once paid. */}
      <g className="terminal-paid">
        <rect x="6" y="7" width="34" height="22" rx="3" fill="#22c55e" />
        <path d="M15 18 l5 5 l10 -10" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={8 + (i % 3) * 11} y={35 + Math.floor(i / 3) * 10} width="8" height="6" rx="1.5" fill="#64748b" />
      ))}
      <path d="M17 3.5 h12" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** A popping speech-bubble label, like "+৳1,000" or "Paid ✓". */
function Bubble({ children, tone }: { children: ReactNode; tone: 'gold' | 'green' | 'pink' }) {
  const colors = { gold: 'bg-amber-400 text-amber-950', green: 'bg-emerald-500 text-white', pink: 'bg-pink-500 text-white' }[tone];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-bold shadow-lg ${colors}`}>{children}</span>;
}

/** Positions a prop by its centre, at (x, y) px from the stage; `x` is flipped for rides heading left. */
function At({ x = 0, y = 0, children, anim, delay, duration, style }: { x?: number; y?: number; children: ReactNode; anim: string; delay: number; duration: number; style?: CSSProperties }) {
  return (
    <div className="absolute" style={{ left: `calc(var(--side) * ${x}px)`, top: y, transform: 'translate(-50%, -50%)' }}>
      <div className={anim} style={{ animationDelay: `${Math.round(delay)}ms`, animationDuration: `${Math.round(duration)}ms`, ...style }}>
        {children}
      </div>
    </div>
  );
}

export interface SceneProps {
  scene: RideScene;
  stage: { x: number; y: number; side: 1 | -1 };
  durationMs: number;
  /** Props behind the mascot (piggy bank, terminal) or in front of it (coins, notes, labels). */
  layer: 'back' | 'front';
}

const COIN_X = [-58, 34, -18, 62, -40, 12, 50, -6, -66, 24];
const NOTES: { dx: number; rot: number }[] = [
  { dx: -90, rot: -24 },
  { dx: 80, rot: 18 },
  { dx: -40, rot: 30 },
  { dx: 40, rot: -16 },
  { dx: -120, rot: 12 },
  { dx: 116, rot: -28 },
  { dx: 0, rot: 22 },
];

/** The props of one banking trick, centred on the stage. */
export function BankScene({ scene, stage, durationMs: d, layer }: SceneProps) {
  const at = (share: number) => d * share;
  const style = { left: stage.x, top: stage.y, '--side': stage.side } as CSSProperties;
  let content: ReactNode = null;

  if (scene === 'coinShower' && layer === 'front') {
    content = (
      <>
        {COIN_X.map((x, i) => (
          <At key={i} x={x} y={-6} anim="bank-coin-fall" delay={at(0.16 + i * 0.045)} duration={at(0.17)} style={{ '--from-x': `calc(var(--side) * ${-x * 0.4}px)` } as CSSProperties}>
            <Coin />
          </At>
        ))}
        <At y={-82} anim="bank-pop-float" delay={at(0.68)} duration={at(0.26)}>
          <Bubble tone="gold">+৳1,000</Bubble>
        </At>
      </>
    );
  }

  if (scene === 'cashRain' && layer === 'front') {
    content = (
      <>
        {NOTES.map((n, i) => (
          <At key={i} anim="bank-note-flutter" delay={at(0.2 + i * 0.018)} duration={at(0.6)} style={{ '--dx': `${n.dx}px`, '--rot': `${n.rot}deg` } as CSSProperties}>
            <Banknote />
          </At>
        ))}
        <At y={-92} anim="bank-pop-float" delay={at(0.34)} duration={at(0.4)}>
          <Bubble tone="green">Cashback!</Bubble>
        </At>
      </>
    );
  }

  if (scene === 'piggyBank') {
    content =
      layer === 'back' ? (
        <At x={88} y={24} anim="bank-prop-life" delay={0} duration={d}>
          {/* The piggy faces the mascot, and jiggles when the coin goes in. */}
          <div style={{ scale: 'calc(var(--side) * -1) 1' }}>
            <div className="bank-piggy-jiggle" style={{ animationDelay: `${Math.round(at(0.5))}ms`, animationDuration: `${Math.round(at(0.12))}ms` }}>
              <PiggyBank />
            </div>
          </div>
        </At>
      ) : (
        <>
          <At x={88} y={-10} anim="bank-coin-drop" delay={at(0.4)} duration={at(0.11)}>
            <Coin size={18} />
          </At>
          {[-22, 0, 22].map((dx, i) => (
            <At key={dx} x={88 + dx} y={-46} anim="bank-pop-float" delay={at(0.52 + i * 0.03)} duration={at(0.24)}>
              <span className="text-xl text-pink-500">♥</span>
            </At>
          ))}
          <At x={88} y={-96} anim="bank-pop-float" delay={at(0.56)} duration={at(0.26)}>
            <Bubble tone="pink">Saved ৳100</Bubble>
          </At>
        </>
      );
  }

  if (scene === 'tapToPay') {
    content =
      layer === 'back' ? (
        <At x={98} y={10} anim="bank-prop-life" delay={0} duration={d} style={{ '--paid-at': `${Math.round(at(0.52))}ms` } as CSSProperties}>
          <PaymentTerminal />
          {[0, 1, 2].map((i) => (
            <span key={i} className="bank-nfc-wave absolute left-1/2 top-[18px]" style={{ animationDelay: `${Math.round(at(0.32 + i * 0.06))}ms`, animationDuration: `${Math.round(at(0.16))}ms` }} />
          ))}
        </At>
      ) : (
        <>
          <At anim="bank-card-tap" delay={at(0.2)} duration={at(0.42)}>
            <BankCardArt width={46} />
          </At>
          <At x={98} y={-56} anim="bank-pop-float" delay={at(0.54)} duration={at(0.3)}>
            <Bubble tone="green">Paid ✓</Bubble>
          </At>
        </>
      );
  }

  if (!content) return null;
  return (
    <div className="absolute" style={style} data-testid={layer === 'front' ? 'ride-scene' : undefined} data-scene={layer === 'front' ? scene : undefined}>
      {content}
    </div>
  );
}
