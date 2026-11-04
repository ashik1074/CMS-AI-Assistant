import { describe, expect, it } from 'vitest';
import { ANCHOR_X, ANCHOR_Y, RIDE_KINDS, flightKeyframes, pickRide, rideHasRocket } from './rocketFlight';

const translate = (frame: Keyframe) => {
  const m = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px, (-?[\d.]+)px\)/.exec(String(frame.transform));
  if (!m) throw new Error(`no translate in ${String(frame.transform)}`);
  return { x: Number(m[1]) + ANCHOR_X, y: Number(m[2]) + ANCHOR_Y, z: Number(m[3]) };
};

const viewports = [
  { width: 1920, height: 870 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
];
const origins = [
  { x: 960, y: 180 },
  { x: 1240, y: 640 },
  { x: 120, y: 420 },
  { x: 330, y: 700 },
];

describe('flightKeyframes', () => {
  it('produces offsets the Web Animations API accepts: from exactly 0 to exactly 1, never decreasing', () => {
    for (const kind of RIDE_KINDS) for (const viewport of viewports) {
      for (const origin of origins) {
        const offsets = flightKeyframes({ kind, origin, viewport }).map((f) => f.offset as number);
        expect(offsets[0]).toBe(0);
        expect(offsets.at(-1)).toBe(1);
        offsets.forEach((o, i) => {
          expect(o).toBeGreaterThanOrEqual(0);
          expect(o).toBeLessThanOrEqual(1);
          if (i > 0) expect(o).toBeGreaterThanOrEqual(offsets[i - 1]);
        });
      }
    }
  });

  it('starts and ends at the mascot, faded out, and stays within part of the screen', () => {
    const origin = { x: 960, y: 640 };
    const frames = flightKeyframes({ origin, viewport: { width: 1920, height: 870 } });
    for (const edge of [frames[0], frames.at(-1)!]) {
      const p = translate(edge);
      expect(p.x).toBeCloseTo(origin.x, 0);
      expect(p.y).toBeCloseTo(origin.y, 0);
      expect(edge.opacity).toBe(0);
    }
    const points = frames.map(translate);
    const xs = points.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(480);
    expect(Math.min(...points.map((p) => p.z))).toBeLessThan(-200); // goes into the screen
    expect(Math.max(...points.map((p) => p.z))).toBeGreaterThan(50); // and comes past the viewer
  });

  it('turns smoothly, without jumps in heading between frames', () => {
    const frames = flightKeyframes({ origin: { x: 600, y: 500 }, viewport: { width: 1280, height: 800 } });
    const yaws = frames.map((f) => Number(/rotateY\((-?[\d.]+)deg\)/.exec(String(f.transform))![1]));
    yaws.slice(1).forEach((y, i) => expect(Math.abs(y - yaws[i])).toBeLessThan(25));
  });

  it('heads into the roomier half of the window', () => {
    const right = flightKeyframes({ origin: { x: 1200, y: 600 }, viewport: { width: 1280, height: 800 } }).map(translate);
    expect(Math.min(...right.map((p) => p.x))).toBeLessThan(1200 - 100);
    expect(Math.max(...right.map((p) => p.x))).toBeLessThanOrEqual(1201);
  });

  it.each(RIDE_KINDS)('%s: starts and ends on the mascot, faded out, stays nearby, and moves without jumps', (kind) => {
    for (const viewport of viewports) {
      for (const origin of origins) {
        const frames = flightKeyframes({ kind, origin, viewport });
        for (const edge of [frames[0], frames.at(-1)!]) {
          const p = translate(edge);
          expect(Math.abs(p.x - origin.x)).toBeLessThan(1);
          expect(Math.abs(p.y - origin.y)).toBeLessThan(1);
          expect(edge.opacity).toBe(0);
        }
        const points = frames.map(translate);
        points.forEach((p) => {
          expect(Math.abs(p.x - origin.x)).toBeLessThanOrEqual(500);
          expect(Math.abs(p.y - origin.y)).toBeLessThanOrEqual(200);
        });
        points.slice(1).forEach((p, i) => expect(Math.hypot(p.x - points[i].x, p.y - points[i].y, p.z - points[i].z)).toBeLessThan(60));
        const angle = (f: Keyframe, fn: string) => Number(String(f.transform).split(`${fn}(`)[1].split('deg')[0]);
        for (const fn of ['rotateY', 'rotateZ', 'rotateX']) {
          const values = frames.map((f) => angle(f, fn));
          values.slice(1).forEach((v, i) => expect(Math.abs(v - values[i])).toBeLessThan(40));
        }
      }
    }
  });

  it('only the jetpack trick leaves the rocket behind', () => {
    expect(RIDE_KINDS.filter((k) => !rideHasRocket(k))).toEqual(['jetpack']);
    expect(RIDE_KINDS.length).toBeGreaterThanOrEqual(5);
  });

  it('picks a random trick, never the one just shown', () => {
    for (const previous of RIDE_KINDS) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.9999]) {
        const next = pickRide(previous, () => r);
        expect(RIDE_KINDS).toContain(next);
        expect(next).not.toBe(previous);
      }
    }
    const seen = new Set([0, 0.3, 0.55, 0.8].map((r) => pickRide(null, () => r)));
    expect(seen.size).toBe(4);
  });
});
