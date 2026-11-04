import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../types/conversation';
import { loadProjects, MAX_PROJECT_DESCRIPTION, MAX_PROJECT_NAME, saveProjects } from '../services/projectService';
import { createId } from '../utils/id';

export interface ProjectInput {
  name: string;
  description?: string;
}

/** Projects with local persistence; the list is saved whenever it changes. */
export function useProjects(onSaveError?: () => void) {
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const onErrorRef = useRef(onSaveError);
  useEffect(() => {
    onErrorRef.current = onSaveError;
  }, [onSaveError]);

  const loaded = useRef(true);
  useEffect(() => {
    // Skip the initial render: nothing has changed yet.
    if (loaded.current) {
      loaded.current = false;
      return;
    }
    if (!saveProjects(projects)) onErrorRef.current?.();
  }, [projects]);

  const sorted = useMemo(() => [...projects].sort((a, b) => b.updatedAt - a.updatedAt), [projects]);

  const getProject = useCallback((id: string | null | undefined) => (id ? projects.find((p) => p.id === id) : undefined), [projects]);

  /** Returns the new project, or null for an empty name. */
  const create = useCallback((input: ProjectInput): Project | null => {
    const name = input.name.trim().slice(0, MAX_PROJECT_NAME);
    if (!name) return null;
    const now = Date.now();
    const project: Project = { id: createId(), name, description: (input.description ?? '').trim().slice(0, MAX_PROJECT_DESCRIPTION), createdAt: now, updatedAt: now };
    setProjects((prev) => [project, ...prev]);
    return project;
  }, []);

  const update = useCallback((id: string, input: ProjectInput) => {
    const name = input.name.trim().slice(0, MAX_PROJECT_NAME);
    if (!name) return false;
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name, description: (input.description ?? '').trim().slice(0, MAX_PROJECT_DESCRIPTION), updatedAt: Date.now() } : p)),
    );
    return true;
  }, []);

  /** Marks a project as recently used so it rises to the top of the list. */
  const touch = useCallback((id: string) => setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, updatedAt: Date.now() } : p))), []);

  const remove = useCallback((id: string) => setProjects((prev) => prev.filter((p) => p.id !== id)), []);

  return { projects: sorted, getProject, create, update, touch, remove };
}
