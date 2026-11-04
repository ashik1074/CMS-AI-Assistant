import { useId } from 'react';
import { cn } from '../../utils/cn';

export type MascotMood = 'idle' | 'thinking' | 'working';

interface MascotProps {
  /** Width in px; the height follows (2:3). */
  size?: number;
  /**
   * `idle` floats, blinks and waves now and then; `thinking` looks around; `working` bobs quickly
   * with brighter thrusters. Motion stops when the user prefers reduced motion.
   */
  mood?: MascotMood;
  className?: string;
  /** Decorative by default. Give a label when the mascot carries meaning on its own. */
  label?: string;
}

/** The assistant's mascot: a small blue robot with a dark visor and thrusters for feet. */
export function Mascot({ size = 80, mood = 'idle', className, label }: MascotProps) {
  const id = useId().replace(/:/g, '');
  const g = (name: string) => `${name}-${id}`;
  return (
    <svg
      width={size}
      height={size * 1.5}
      viewBox="0 0 100 150"
      className={cn('mascot overflow-visible', `mascot-${mood}`, className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="mascot"
      data-mood={mood}
    >
      <defs>
        <linearGradient id={g('skin')} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#5aa9ff" />
          <stop offset="0.55" stopColor="#2f7cf6" />
          <stop offset="1" stopColor="#1d56d8" />
        </linearGradient>
        <linearGradient id={g('flame')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#7cc8ff" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0.15" />
        </linearGradient>
        <radialGradient id={g('visor')} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#1e2a55" />
          <stop offset="1" stopColor="#070b1f" />
        </radialGradient>
      </defs>

      {/* Ground shadow: shrinks as the mascot rises. */}
      <ellipse className="mascot-shadow" cx="50" cy="146" rx="18" ry="3" fill="currentColor" opacity="0.12" />

      <g className="mascot-body">
        {/* Thruster flames */}
        <g className="mascot-flames">
          <path className="mascot-flame" d="M35 117 Q40 145 45 117 Z" fill={`url(#${g('flame')})`} />
          <path className="mascot-flame mascot-flame-2" d="M55 117 Q60 145 65 117 Z" fill={`url(#${g('flame')})`} />
        </g>

        {/* Legs with nozzles */}
        <path d="M34 96 h12 v16 q0 6 -6 6 q-6 0 -6 -6 Z" fill={`url(#${g('skin')})`} />
        <path d="M54 96 h12 v16 q0 6 -6 6 q-6 0 -6 -6 Z" fill={`url(#${g('skin')})`} />
        <rect x="35" y="112" width="10" height="5" rx="2" fill="#163f9e" />
        <rect x="55" y="112" width="10" height="5" rx="2" fill="#163f9e" />

        {/* Arms */}
        <g className="mascot-arm-left">
          <ellipse cx="28" cy="80" rx="6" ry="11" transform="rotate(18 28 80)" fill={`url(#${g('skin')})`} />
        </g>
        <g className="mascot-arm-right">
          <ellipse cx="72" cy="80" rx="6" ry="11" transform="rotate(-18 72 80)" fill={`url(#${g('skin')})`} />
        </g>

        {/* Torso */}
        <ellipse cx="50" cy="84" rx="21" ry="18" fill={`url(#${g('skin')})`} />
        <ellipse cx="44" cy="78" rx="8" ry="5" fill="#ffffff" opacity="0.18" />

        {/* Head: a rounded drop with a tip, like the original */}
        <path d="M50 10 C70 8 80 22 79 40 C78 58 66 66 50 66 C34 66 21 58 21 40 C21 22 33 12 50 10 Z" fill={`url(#${g('skin')})`} />
        <path d="M62 13 C66 6 72 4 76 4 C72 8 70 12 70 17 Z" fill="#2f7cf6" />
        <ellipse cx="38" cy="22" rx="9" ry="5" fill="#ffffff" opacity="0.22" transform="rotate(-20 38 22)" />
        {/* Badge on the head */}
        <circle cx="63" cy="22" r="6" fill="#ffffff" opacity="0.9" />
        <path d="M60.5 19.5 h3.5 a2.2 2.2 0 0 1 0 4.4 h-3.5 Z M60.5 23.9 h4 a2.2 2.2 0 0 1 0 4.4" fill="none" stroke="#2f7cf6" strokeWidth="1.4" strokeLinejoin="round" transform="translate(-1 -3)" />

        {/* Visor and face */}
        <ellipse cx="49" cy="44" rx="20" ry="14" fill={`url(#${g('visor')})`} />
        <g className="mascot-eyes">
          <ellipse cx="42" cy="42" rx="3.3" ry="4.4" fill="#ffffff" />
          <ellipse cx="56" cy="42" rx="3.3" ry="4.4" fill="#ffffff" />
        </g>
        <path d="M44 49 Q49 54 54 49" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
