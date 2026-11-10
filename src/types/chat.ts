import type { MessageAction } from './product';

export type MessageRole = 'user' | 'assistant';

export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'cancelled' | 'failed';

export type Feedback = 'up' | 'down';

export type ProcessingStepStatus = 'pending' | 'active' | 'completed';

export interface ProcessingStep {
  id: string;
  label: string;
  status: ProcessingStepStatus;
}

/** Lifecycle phase of an assistant response, driven by mock-service events. */
export type ProcessingPhase = 'idle' | 'thinking' | 'steps' | 'streaming' | 'completed' | 'cancelled' | 'failed';

/** What kind of help the user wants; lets a backend route the request to the right agent. */
export type ChatMode = 'general' | 'customerSearch' | 'agentic' | 'analytics';

/** A file the user attached to a message. Only metadata and a small image thumbnail are stored. */
export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Downscaled data-URL preview, present for images only. */
  previewUrl?: string;
}

/** Tokens a response used: the prompt and conversation sent to the model, and the text it generated. */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** Counted in the browser rather than reported by a model (always so in the demo). */
  estimated?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status: MessageStatus;
  /** Measured elapsed time from request start to terminal state, in ms. */
  durationMs?: number;
  steps?: ProcessingStep[];
  feedback?: Feedback;
  /** User-facing error description for failed responses. */
  error?: string;
  /** Incremented each time the response is regenerated. */
  revision?: number;
  editedAt?: number;
  attachments?: Attachment[];
  /** Mode chosen in the composer when a user message was sent. Omitted for 'general'. */
  mode?: ChatMode;
  /** Agentic task the assistant proposed in this response, e.g. a product waiting for approval. */
  action?: MessageAction;
  /** Tokens used by an assistant response. While it is generating, only the input is known. */
  usage?: TokenUsage;
}

/* ---------- Service contracts ---------- */

export interface ChatHistoryEntry {
  role: MessageRole;
  content: string;
}

export interface GenerationRequest {
  requestId: string;
  conversationId: string;
  prompt: string;
  history: ChatHistoryEntry[];
  /** Selects an alternate template when regenerating (0 = first generation). */
  variant?: number;
  mode?: ChatMode;
}

export interface GenerationOptions {
  signal?: AbortSignal;
  /** Milliseconds between streamed chunks. */
  chunkDelayMs?: number;
  /** Number of words per streamed chunk. */
  chunkSize?: number;
  /** Minimum duration of the thinking phase so the indicator is perceptible. */
  minThinkingMs?: number;
  /** Duration of each simulated processing step. */
  stepDurationMs?: number;
  /** Whether multi-step progress should be simulated for complex scenarios. */
  enableSteps?: boolean;
}

export type GenerationEventType =
  | 'started'
  | 'step_started'
  | 'step_completed'
  | 'token'
  | 'completed'
  | 'cancelled'
  | 'error';

interface BaseEvent {
  requestId: string;
  type: GenerationEventType;
  /** Human-readable status. */
  status: string;
  timestamp: number;
}

export interface StartedEvent extends BaseEvent {
  type: 'started';
  scenarioId: string;
  steps: { id: string; label: string }[];
  /** Input tokens, known as soon as the request is read (output tokens are 0). */
  usage?: TokenUsage;
}
export interface StepEvent extends BaseEvent {
  type: 'step_started' | 'step_completed';
  stepId: string;
}
export interface TokenEvent extends BaseEvent {
  type: 'token';
  token: string;
}
export interface CompletedEvent extends BaseEvent {
  type: 'completed';
  content: string;
  durationMs: number;
  /** Set when the response proposes an action for the user to review. */
  action?: MessageAction;
  usage?: TokenUsage;
}
export interface CancelledEvent extends BaseEvent {
  type: 'cancelled';
  durationMs: number;
  /** Tokens used up to the point the response was stopped. */
  usage?: TokenUsage;
}
export interface ErrorEvent extends BaseEvent {
  type: 'error';
  error: GenerationError;
  durationMs: number;
}

export type GenerationEvent = StartedEvent | StepEvent | TokenEvent | CompletedEvent | CancelledEvent | ErrorEvent;

export type GenerationErrorCode = 'mock_failure' | 'unavailable' | 'invalid_input' | 'busy';

export interface GenerationError {
  code: GenerationErrorCode;
  message: string;
  retryable: boolean;
}

export interface GenerationResult {
  requestId: string;
  content: string;
  durationMs: number;
  status: 'completed' | 'cancelled' | 'failed';
  error?: GenerationError;
}

/** Contract an AI backend must satisfy. The mock implementation can be swapped for a real one. */
export interface AIService {
  streamResponse(request: GenerationRequest, options?: GenerationOptions): AsyncGenerator<GenerationEvent, void, void>;
  generateResponse(request: GenerationRequest, options?: GenerationOptions): Promise<GenerationResult>;
  cancelGeneration(requestId: string): boolean;
}
