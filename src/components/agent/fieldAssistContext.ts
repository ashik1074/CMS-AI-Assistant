import { createContext, useContext } from 'react';
import type { FieldAnswer } from '../../utils/fieldAssist';

/** AI help for the fields of a form. Fields show the AI button only inside a provider. */
export interface FieldAssistApi {
  disabled: boolean;
  /** Fills in the field. Returns false if there was nothing to fill in. */
  autofill: (key: string, label: string) => boolean;
  answer: (key: string, label: string, question: string) => FieldAnswer;
  currentValue: (key: string) => string;
}

export const FieldAssistContext = createContext<FieldAssistApi | null>(null);

export const useFieldAssist = () => useContext(FieldAssistContext);
