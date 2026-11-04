import type { Message, ProcessingPhase } from '../../types/chat';

/** Derives the lifecycle phase purely from message state written by mock-service events. */
export function getProcessingPhase(message: Message): ProcessingPhase {
  switch (message.status) {
    case 'pending':
      return message.steps && message.steps.length > 0 ? 'steps' : 'thinking';
    case 'streaming':
      return 'streaming';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
  }
}
