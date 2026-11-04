import { useId, type ReactNode } from 'react';
import { HardDrive, Moon, Sun } from 'lucide-react';
import type { Settings, StreamingSpeed, Theme } from '../../types/conversation';
import { cn } from '../../utils/cn';
import { Modal } from '../common/Modal';

interface SettingsDialogProps {
  open: boolean;
  settings: Settings;
  conversationCount: number;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onClearAll: () => void;
  onResetPreferences: () => void;
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; icon?: ReactNode }[]; onChange: (v: T) => void }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid grid-flow-col gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500',
              value === o.value ? 'bg-white font-medium shadow-sm dark:bg-zinc-700' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.icon}
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsDialog({ open, settings, conversationCount, onChange, onClose, onClearAll, onResetPreferences }: SettingsDialogProps) {
  const stepsId = useId();
  return (
    <Modal open={open} title="Settings" onClose={onClose} className="max-w-lg">
      <div className="space-y-6">
        <Segmented<Theme>
          label="Theme"
          value={settings.theme}
          onChange={(theme) => onChange({ theme })}
          options={[
            { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" aria-hidden="true" /> },
            { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" aria-hidden="true" /> },
          ]}
        />

        <Segmented<StreamingSpeed>
          label="Mock streaming speed"
          value={settings.streamingSpeed}
          onChange={(streamingSpeed) => onChange({ streamingSpeed })}
          options={[
            { value: 'slow', label: 'Slow' },
            { value: 'normal', label: 'Normal' },
            { value: 'fast', label: 'Fast' },
          ]}
        />

        <div className="flex items-start justify-between gap-4">
          <div>
            <label htmlFor={stepsId} className="text-sm font-medium">
              Simulated multi-step progress
            </label>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Show a step timeline for complex demo requests (code, plans, summaries).</p>
          </div>
          <button
            id={stepsId}
            type="button"
            role="switch"
            aria-checked={settings.enableSteps}
            onClick={() => onChange({ enableSteps: !settings.enableSteps })}
            className={cn('relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', settings.enableSteps ? 'bg-brand-600 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-600')}
          >
            <span
              aria-hidden="true"
              className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-zinc-900', settings.enableSteps ? 'translate-x-[22px]' : 'translate-x-0.5')}
            />
          </button>
        </div>

        <div className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-700">
          <p className="flex items-center gap-2 font-medium">
            <HardDrive className="h-4 w-4" aria-hidden="true" />
            Mock mode · local storage
          </p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            No AI model, API key or server is connected. Responses are simulated in your browser, and conversations ({conversationCount}) are stored only in
            this browser&apos;s local storage. Clearing site data removes them.
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-between dark:border-zinc-700">
          <button type="button" className="btn-secondary" onClick={onResetPreferences}>
            Reset demo preferences
          </button>
          <button type="button" className="btn-danger" onClick={onClearAll} disabled={conversationCount === 0}>
            Clear all conversations
          </button>
        </div>
      </div>
    </Modal>
  );
}
