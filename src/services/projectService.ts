import type { Project } from '../types/conversation';

export const PROJECTS_KEY = 'ai-chat:projects:v1';
export const MAX_PROJECT_NAME = 80;
export const MAX_PROJECT_DESCRIPTION = 500;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseProject(raw: unknown): Project | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  if (typeof raw.createdAt !== 'number' || typeof raw.updatedAt !== 'number') return null;
  return {
    id: raw.id,
    name: raw.name.trim().slice(0, MAX_PROJECT_NAME),
    description: typeof raw.description === 'string' ? raw.description.slice(0, MAX_PROJECT_DESCRIPTION) : '',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function loadProjects(storage: Storage | null = safeStorage()): Project[] {
  try {
    const raw = storage?.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.map(parseProject).filter((p): p is Project => p !== null && !seen.has(p.id) && !!seen.add(p.id));
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[], storage: Storage | null = safeStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    return true;
  } catch (e) {
    if (import.meta.env.DEV) console.error('[projects] save failed', e);
    return false;
  }
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
