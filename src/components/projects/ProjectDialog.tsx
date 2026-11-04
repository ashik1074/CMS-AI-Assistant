import { useId, useState, type FormEvent } from 'react';
import type { Project } from '../../types/conversation';
import { MAX_PROJECT_DESCRIPTION, MAX_PROJECT_NAME } from '../../services/projectService';
import type { ProjectInput } from '../../hooks/useProjects';
import { Modal } from '../common/Modal';

interface ProjectDialogProps {
  open: boolean;
  /** Edit this project; omit to create a new one. */
  project?: Project;
  onSubmit: (input: ProjectInput) => void;
  onClose: () => void;
}

export function ProjectDialog({ open, project, onSubmit, onClose }: ProjectDialogProps) {
  return (
    <Modal
      open={open}
      title={project ? 'Edit project' : 'Create a project'}
      description={project ? undefined : 'Group related chats together and start new chats inside the project.'}
      onClose={onClose}
      className="max-w-lg"
    >
      {/* Keyed so the fields reset each time the dialog opens for a different project. */}
      {open && <ProjectForm key={project?.id ?? 'new'} project={project} onSubmit={onSubmit} onClose={onClose} />}
    </Modal>
  );
}

function ProjectForm({ project, onSubmit, onClose }: Omit<ProjectDialogProps, 'open'>) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [error, setError] = useState('');
  const nameId = useId();
  const descId = useId();
  const errorId = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    onSubmit({ name, description });
  };

  return (
    <form onSubmit={submit} className="mt-2 space-y-4">
      <div>
        <label htmlFor={nameId} className="mb-1.5 block text-sm font-medium">
          Name
        </label>
        <input
          id={nameId}
          value={name}
          maxLength={MAX_PROJECT_NAME}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError('');
          }}
          placeholder="e.g. Merchant onboarding"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-3 focus:ring-brand-100 aria-[invalid=true]:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500 dark:focus:ring-0"
        />
        {error && (
          <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={descId} className="mb-1.5 block text-sm font-medium">
          Description <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
        </label>
        <textarea
          id={descId}
          value={description}
          maxLength={MAX_PROJECT_DESCRIPTION}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What is this project about?"
          className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-3 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500 dark:focus:ring-0"
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {project ? 'Save changes' : 'Create project'}
        </button>
      </div>
    </form>
  );
}
