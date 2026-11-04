import { DEFAULT_SETTINGS, type Settings, type StreamingSpeed, type Theme } from '../types/conversation';
import type { GenerationOptions } from '../types/chat';

export const SETTINGS_KEY = 'ai-chat:settings:v1';

const THEMES: Theme[] = ['light', 'dark'];
const SPEEDS: StreamingSpeed[] = ['slow', 'normal', 'fast'];

export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS };
  const r = raw as Record<string, unknown>;
  return {
    theme: THEMES.includes(r.theme as Theme) ? (r.theme as Theme) : DEFAULT_SETTINGS.theme,
    streamingSpeed: SPEEDS.includes(r.streamingSpeed as StreamingSpeed) ? (r.streamingSpeed as StreamingSpeed) : DEFAULT_SETTINGS.streamingSpeed,
    enableSteps: typeof r.enableSteps === 'boolean' ? r.enableSteps : DEFAULT_SETTINGS.enableSteps,
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? parseSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    if (import.meta.env.DEV) console.error('[settings] save failed', e);
    return false;
  }
}

export const SPEED_PRESETS: Record<StreamingSpeed, Pick<GenerationOptions, 'chunkDelayMs' | 'chunkSize' | 'stepDurationMs' | 'minThinkingMs'>> = {
  slow: { chunkDelayMs: 80, chunkSize: 1, stepDurationMs: 1000, minThinkingMs: 1200 },
  normal: { chunkDelayMs: 40, chunkSize: 2, stepDurationMs: 650, minThinkingMs: 900 },
  fast: { chunkDelayMs: 15, chunkSize: 4, stepDurationMs: 300, minThinkingMs: 500 },
};
