/** Where the mascot's centre sits inside the rider box (mascot astride the rocket). */
export const ANCHOR_X = 65;
export const ANCHOR_Y = 34;

/** Camera distance for the 3D flights; smaller means stronger depth. */
export const PERSPECTIVE = 900;

const SAMPLES = 120;

/**
 * The tricks the mascot can do when clicked. One is picked at random each time.
 * - `orbit`: rocket loop into the screen, out to one side and back past the viewer.
 * - `corkscrew`: rocket spirals up around a column twice, then spirals back down.
 * - `loop`: stunt-plane loop-the-loop, pitching all the way round, with a little depth.
 * - `flyby`: rocket swoops out and zooms right up to the viewer in a barrel roll, then zips home.
 * - `jetpack`: no rocket; the mascot blasts up on its own thrusters, backflips twice, spins and lands.
 */
export const RIDE_KINDS = ['orbit', 'corkscrew', 'loop', 'flyby', 'jetpack'] as const;
export type RideKind = (typeof RIDE_KINDS)[number];

export interface FlightOptions {
  origin: { x: number; y: number };
  viewport: { width: number; height: number };
  kind?: RideKind;
}

/** Where the rider is and which way it faces at one moment (degrees; yaw 0 = nose pointing right). */
interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Nose up/down. Worked out from the climb when a ride leaves it out. */
  pitch?: number;
  /** Bank or tumble around the rocket's own length. */
  roll?: number;
}

/** Room around the mascot that every ride shapes itself to. */
interface Space {
  origin: { x: number; y: number };
  /** +1 heads right, -1 heads left: towards the roomier half of the window. */
  side: 1 | -1;
  /** Horizontal reach towards `side`. */
  reach: number;
  /** Vertical reach, negative when going up. */
  rise: number;
}

interface RideSpec {
  durationMs: number;
  rocket: boolean;
  pose: (t: number, s: Space) => Pose;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const deg = (rad: number) => (rad * 180) / Math.PI;
const easeInOutSine = (u: number) => -(Math.cos(Math.PI * u) - 1) / 2;
/** 0 before `a`, 1 after `b`, a smooth S-curve in between. */
const smoothstep = (a: number, b: number, t: number) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
/** Mirror a heading for rides that set off to the left. */
const facing = (yaw: number, side: 1 | -1) => (side > 0 ? yaw : 180 - yaw);

/**
 * Heading for a circular path in the x–z plane: a full turn with the circle, sped up through the
 * moments when the flat rocket faces the camera edge-on and slowed while it is broadside.
 */
const orbitYaw = (phi: number) => deg(Math.PI / 2 - (phi + 0.42 * Math.sin(2 * phi)));

const RIDES: Record<RideKind, RideSpec> = {
  orbit: {
    durationMs: 5200,
    rocket: true,
    pose: (t, { origin, side, reach, rise }) => {
      const phi = 2 * Math.PI * t;
      const s = Math.sin(phi);
      const rx = Math.min(reach / 2, 240);
      return {
        x: origin.x + side * rx * (1 - Math.cos(phi)),
        y: origin.y + rise * Math.sin(Math.PI * t),
        z: -s * (s > 0 ? 420 : 150),
        yaw: facing(orbitYaw(phi), side),
        roll: -24 * Math.sin(Math.PI * t) * side,
      };
    },
  },
  corkscrew: {
    durationMs: 5600,
    rocket: true,
    pose: (t, { origin, side, reach, rise }) => {
      const phi = 4 * Math.PI * t;
      const r = Math.min(reach / 2, 130);
      return {
        x: origin.x + side * r * (1 - Math.cos(phi)),
        y: origin.y + rise * Math.sin(Math.PI * t),
        z: -Math.sin(phi) * 260,
        yaw: facing(orbitYaw(phi), side),
        roll: -30 * side,
      };
    },
  },
  loop: {
    durationMs: 4400,
    rocket: true,
    pose: (t, { origin, side, reach, rise }) => {
      // Run out, loop the loop, run back: the loop is a full circle in the screen plane.
      const run = smoothstep(0, 0.22, t) - smoothstep(0.78, 1, t);
      const looping = smoothstep(0.22, 0.78, t);
      const phi = 2 * Math.PI * looping;
      const r = clamp(Math.abs(rise) * 0.55, 50, 95);
      const up = rise < 0 ? -1 : 1;
      const dx = Math.min(reach * 0.45, 200);
      return {
        x: origin.x + side * (dx * run + r * Math.sin(phi)),
        y: origin.y + up * r * (1 - Math.cos(phi)),
        z: -120 * Math.sin(Math.PI * t),
        // Turns round in 3D to head home after the loop.
        yaw: facing(180 * smoothstep(0.78, 0.9, t), side),
        // Nose sweeps round with the loop (up first when the loop climbs).
        pitch: up * deg(phi),
        roll: 0,
      };
    },
  },
  flyby: {
    durationMs: 4300,
    rocket: true,
    pose: (t, { origin, side, reach, rise }) => {
      const out = Math.sin(Math.PI * t);
      const rx = Math.min(reach * 0.5, 220);
      return {
        x: origin.x + side * rx * out,
        y: origin.y + rise * 0.7 * out,
        // Comes right up to the camera at the peak: about 1.8 times bigger.
        z: 400 * out * out,
        // Barrel roll on the way in, then a 3D turn to head home.
        yaw: facing(180 * smoothstep(0.58, 0.8, t), side),
        roll: 360 * smoothstep(0.22, 0.55, t),
      };
    },
  },
  jetpack: {
    durationMs: 3800,
    rocket: false,
    pose: (t, { origin, side, rise }) => {
      const hop = Math.sin(Math.PI * t);
      // A small settle-bounce on landing.
      const bounce = t > 0.82 ? -Math.sin(((t - 0.82) / 0.18) * Math.PI) * 14 : 0;
      return {
        x: origin.x + side * 50 * Math.sin(Math.PI * t),
        y: origin.y + (rise < 0 ? -1 : 1) * Math.max(Math.abs(rise), 120) * hop + bounce,
        z: 160 * hop,
        yaw: 360 * smoothstep(0.62, 0.86, t),
        pitch: 0,
        roll: -720 * smoothstep(0.18, 0.6, t),
      };
    },
  },
};

export const rideDurationMs = (kind: RideKind) => RIDES[kind].durationMs;
export const rideHasRocket = (kind: RideKind) => RIDES[kind].rocket;

/** Any ride but the one just shown, so two clicks in a row never look the same. */
export function pickRide(previous: RideKind | null, random: () => number = Math.random): RideKind {
  const choices = RIDE_KINDS.filter((k) => k !== previous);
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

function spaceAround(origin: FlightOptions['origin'], { width: w, height: h }: FlightOptions['viewport']): Space {
  const side = origin.x > w / 2 ? -1 : 1;
  const reach = Math.max(140, side > 0 ? w - origin.x - 90 : origin.x - 90);
  const roomUp = origin.y - 100;
  const roomDown = h - origin.y - 150;
  const up = roomUp >= 140 || roomUp >= roomDown;
  const rise = clamp(up ? roomUp : roomDown, 40, 170) * (up ? -1 : 1);
  return { origin, side, reach, rise };
}

/**
 * Keyframes for one ride near the mascot that was clicked, starting and ending on it. The path is
 * sampled densely (with ease-in-out timing) so the motion is continuous; the rider turns in real 3D
 * (rotateY), pitches with its climb, and banks or tumbles (rotateX).
 */
export function flightKeyframes({ origin, viewport, kind = 'orbit' }: FlightOptions): Keyframe[] {
  const space = spaceAround(origin, viewport);
  const { pose } = RIDES[kind];
  const frames: Keyframe[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES;
    const t = easeInOutSine(u);
    const p = pose(t, space);
    let pitch = p.pitch;
    if (pitch === undefined) {
      const a = pose(Math.max(0, t - 0.004), space);
      const b = pose(Math.min(1, t + 0.004), space);
      pitch = clamp(deg(Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z) || 1)), -28, 28);
    }
    const fade = clamp(Math.min(u, 1 - u) / 0.05, 0, 1);
    const scale = 0.6 + 0.4 * fade;
    frames.push({
      offset: u,
      opacity: fade,
      transform:
        `translate3d(${(p.x - ANCHOR_X).toFixed(2)}px, ${(p.y - ANCHOR_Y).toFixed(2)}px, ${p.z.toFixed(2)}px) ` +
        `rotateY(${p.yaw.toFixed(2)}deg) rotateZ(${pitch.toFixed(2)}deg) rotateX(${(p.roll ?? 0).toFixed(2)}deg) scale(${scale.toFixed(3)})`,
    });
  }
  return frames;
}
