import { Bot, ChartLine, FileChartColumn, MessageSquare, type LucideIcon } from 'lucide-react';
import type { ChatMode } from '../../types/chat';

export interface ChatModeOption {
  value: ChatMode;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const CHAT_MODES: ChatModeOption[] = [
  { value: 'general', label: 'General', description: 'Ask questions and get guidance', icon: MessageSquare },
  { value: 'reporting', label: 'Reporting', description: 'Generate and explain reports', icon: FileChartColumn },
  { value: 'agentic', label: 'Agentic Task', description: 'Let the assistant carry out a task', icon: Bot },
  { value: 'analytics', label: 'Analytics', description: 'Analyse trends and business data', icon: ChartLine },
];

export const chatModeOption = (mode: ChatMode) => CHAT_MODES.find((m) => m.value === mode) ?? CHAT_MODES[0];
