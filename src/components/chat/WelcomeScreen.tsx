import { ChartPie, CreditCard, FileText, ListChecks, type LucideIcon } from 'lucide-react';
import { SUGGESTIONS } from '../../utils/mockResponses';
import { Mascot } from '../mascot/Mascot';
import { MascotLauncher } from '../mascot/RocketRide';

const ICONS: Record<(typeof SUGGESTIONS)[number]['id'], LucideIcon> = {
  visual: ChartPie,
  product: CreditCard,
  summarize: FileText,
  plan: ListChecks,
};

interface WelcomeScreenProps {
  onSuggestion: (prompt: string) => void;
  disabled?: boolean;
}

export function WelcomeScreen({ onSuggestion, disabled }: WelcomeScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6" data-testid="welcome-screen">
      <MascotLauncher className="mb-3">
        <Mascot size={72} mood="idle" className="mascot-enter block text-zinc-900 dark:text-white" />
      </MascotLauncher>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-brand-600 sm:text-3xl dark:text-zinc-100">What can I help you with?</h1>
      <p className="mt-2 max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
        Ask a question or pick a suggestion. This is a demo — answers come from local, pre-written mock responses.
      </p>
      <ul className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Suggestions">
        {SUGGESTIONS.map((s) => {
          const Icon = ICONS[s.id];
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSuggestion(s.prompt)}
                className="group flex h-full w-full items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-50 dark:border-zinc-700 dark:bg-transparent dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 transition-colors group-hover:text-brand-700 dark:text-zinc-400 dark:group-hover:text-zinc-100" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-medium">{s.title}</span>
                  <span className="mt-0.5 block text-sm text-zinc-500 dark:text-zinc-400">{s.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
