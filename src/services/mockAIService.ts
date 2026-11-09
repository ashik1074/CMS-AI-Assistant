import type {
  AIService,
  GenerationError,
  GenerationEvent,
  GenerationOptions,
  GenerationRequest,
  GenerationResult,
  TokenUsage,
} from '../types/chat';
import { chunkText } from '../utils/markdown';
import { estimateInputTokens, estimateTokens } from '../utils/tokens';
import { FALLBACK_RESPONSE, MOCK_SCENARIOS, matchScenario, type MockScenario } from '../utils/mockResponses';

export const DEFAULT_GENERATION_OPTIONS: Required<Omit<GenerationOptions, 'signal'>> = {
  chunkDelayMs: 40,
  chunkSize: 2,
  minThinkingMs: 900,
  stepDurationMs: 650,
  enableSteps: true,
};

class AbortedError extends Error {
  constructor() {
    super('Generation aborted');
    this.name = 'AbortError';
  }
}

/** Abortable delay. Clears its timer when the signal fires so nothing keeps running. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new AbortedError());
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortedError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export interface MockAIServiceConfig {
  scenarios?: MockScenario[];
  now?: () => number;
}

export class MockAIService implements AIService {
  private readonly active = new Map<string, AbortController>();
  private readonly scenarios: MockScenario[];
  private readonly now: () => number;

  constructor(config: MockAIServiceConfig = {}) {
    this.scenarios = config.scenarios ?? MOCK_SCENARIOS;
    this.now = config.now ?? (() => Date.now());
  }

  /** Number of in-flight generations (useful for tests and diagnostics). */
  get activeCount(): number {
    return this.active.size;
  }

  isActive(requestId: string): boolean {
    return this.active.has(requestId);
  }

  cancelGeneration(requestId: string): boolean {
    const controller = this.active.get(requestId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  async *streamResponse(request: GenerationRequest, options: GenerationOptions = {}): AsyncGenerator<GenerationEvent, void, void> {
    const opts = { ...DEFAULT_GENERATION_OPTIONS, ...stripUndefined(options) };
    const startedAt = this.now();
    const base = () => ({ requestId: request.requestId, timestamp: this.now() });
    const elapsed = () => this.now() - startedAt;

    if (!request.prompt.trim()) {
      yield { ...base(), type: 'error', status: 'Invalid input', durationMs: 0, error: err('invalid_input', 'Message cannot be empty.', false) };
      return;
    }
    if (this.active.has(request.requestId)) {
      yield { ...base(), type: 'error', status: 'Duplicate request', durationMs: 0, error: err('busy', 'This request is already being generated.', false) };
      return;
    }

    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onExternalAbort, { once: true });
    if (options.signal?.aborted) controller.abort();
    this.active.set(request.requestId, controller);
    const signal = controller.signal;

    const { scenario } = matchScenario(request.prompt, this.scenarios);
    const steps = opts.enableSteps && scenario?.steps ? scenario.steps : [];
    let content = '';
    // Counted like a model would report them: the input up front, the output as it is generated.
    const inputTokens = estimateInputTokens(request.history, request.prompt);
    const usage = (): TokenUsage => ({ inputTokens, outputTokens: estimateTokens(content), estimated: true });

    try {
      yield {
        ...base(),
        type: 'started',
        status: 'Thinking',
        scenarioId: scenario?.id ?? 'fallback',
        steps: steps.map((s) => ({ id: s.id, label: s.label })),
        usage: usage(),
      };

      await delay(opts.minThinkingMs, signal);

      if (scenario?.error?.code === 'unavailable') {
        yield { ...base(), type: 'error', status: 'Unavailable', durationMs: elapsed(), error: err('unavailable', scenario.error.message, true) };
        return;
      }

      for (const step of steps) {
        yield { ...base(), type: 'step_started', status: step.label, stepId: step.id };
        await delay(opts.stepDurationMs, signal);
        yield { ...base(), type: 'step_completed', status: step.label, stepId: step.id };
      }

      if (scenario?.error) {
        yield { ...base(), type: 'error', status: 'Failed', durationMs: elapsed(), error: err(scenario.error.code, scenario.error.message, true) };
        return;
      }

      const agentResult = scenario?.agent?.(request.prompt, request.history, new Date(this.now()));
      const fullText = agentResult ? agentResult.content : scenario ? scenario.respond(request.prompt, request.variant ?? 0) : FALLBACK_RESPONSE;
      for (const token of chunkText(fullText, opts.chunkSize)) {
        await delay(opts.chunkDelayMs, signal);
        content += token;
        yield { ...base(), type: 'token', status: 'Streaming', token };
      }

      yield { ...base(), type: 'completed', status: 'Completed', content, durationMs: elapsed(), usage: usage(), ...(agentResult ? { action: agentResult.action } : {}) };
    } catch (e) {
      if (e instanceof AbortedError || signal.aborted) {
        yield { ...base(), type: 'cancelled', status: 'Cancelled', durationMs: elapsed(), usage: usage() };
        return;
      }
      if (import.meta.env.DEV) console.error('[mockAIService] unexpected failure', e);
      yield { ...base(), type: 'error', status: 'Failed', durationMs: elapsed(), error: err('mock_failure', 'Something went wrong while generating the response.', true) };
    } finally {
      // Runs on completion, cancellation, or if the consumer stops iterating early.
      controller.abort();
      options.signal?.removeEventListener('abort', onExternalAbort);
      this.active.delete(request.requestId);
    }
  }

  async generateResponse(request: GenerationRequest, options?: GenerationOptions): Promise<GenerationResult> {
    let content = '';
    for await (const event of this.streamResponse(request, options)) {
      switch (event.type) {
        case 'token':
          content += event.token;
          break;
        case 'completed':
          return { requestId: request.requestId, content: event.content, durationMs: event.durationMs, status: 'completed' };
        case 'cancelled':
          return { requestId: request.requestId, content, durationMs: event.durationMs, status: 'cancelled' };
        case 'error':
          return { requestId: request.requestId, content, durationMs: event.durationMs, status: 'failed', error: event.error };
      }
    }
    return { requestId: request.requestId, content, durationMs: 0, status: 'cancelled' };
  }
}

function err(code: GenerationError['code'], message: string, retryable: boolean): GenerationError {
  return { code, message, retryable };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([k, v]) => v !== undefined && k !== 'signal')) as Partial<T>;
}

/** Shared instance used by the app. Replace with a real implementation of `AIService` to connect a backend. */
export const mockAIService = new MockAIService();
