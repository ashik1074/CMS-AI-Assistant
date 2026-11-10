import { Bot, ChartLine, MessageSquare, UserSearch, type LucideIcon } from 'lucide-react';
import type { ChatMode } from '../../types/chat';

export interface ChatModeOption {
  value: ChatMode;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const CHAT_MODES: ChatModeOption[] = [
  { value: 'general', label: 'General', description: 'Ask questions and get guidance', icon: MessageSquare },
  { value: 'customerSearch', label: 'Customer Search', description: 'Find a customer by phone, CIF ID or NID', icon: UserSearch },
  { value: 'agentic', label: 'Agentic Task', description: 'Let the assistant carry out a task', icon: Bot },
  { value: 'analytics', label: 'Analytics', description: 'Analyse trends and business data', icon: ChartLine },
];

export const chatModeOption = (mode: ChatMode) => CHAT_MODES.find((m) => m.value === mode) ?? CHAT_MODES[0];
