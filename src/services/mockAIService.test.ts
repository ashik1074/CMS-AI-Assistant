import { describe, expect, it } from 'vitest';
import type { GenerationEvent, GenerationOptions, GenerationRequest } from '../types/chat';
import { MockAIService } from './mockAIService';
import { CAPABILITY_PROMPTS, FALLBACK_RESPONSE, matchScenario } from '../utils/mockResponses';

const FAST: GenerationOptions = { chunkDelayMs: 0, minThinkingMs: 0, stepDurationMs: 0, chunkSize: 3 };

const req = (prompt: string, extra: Partial<GenerationRequest> = {}): GenerationRequest => ({
  requestId: crypto.randomUUID(),
  conversationId: 'c1',
  prompt,
  history: [],
  ...extra,
});

async function collect(it: AsyncGenerator<GenerationEvent>) {
  const events: GenerationEvent[] = [];
  for await (const e of it) events.push(e);
  return events;
}

describe('matchScenario', () => {
  it.each([
    ['Hello there', 'greeting'],
    ['Write a TypeScript debounce function', 'code'],
    ['Explain how large language models work', 'explain'],
    ['Compare REST and GraphQL in a table', 'table'],
    ['Help me plan a website launch', 'plan'],
    ['What is a headless CMS?', 'cms'],
    ['Write a detailed guide about accessibility', 'longform'],
    ['Summarize this: some text', 'summarize'],
    ['Simulate an error', 'error'],
  ])('%s → %s', (prompt, id) => {
    expect(matchScenario(prompt).scenario?.id).toBe(id);
  });

  it('returns no scenario for unmatched prompts', () => {
    expect(matchScenario('qwertyuiop zxcv').scenario).toBeNull();
  });
});

describe('capabilities', () => {
  it.each(['What are your Capabilities', 'what are your capabilities?', 'What can you do?', 'What can you help with', 'What prompts can I use?', 'help'])('"%s" lists the capabilities', (prompt) => {
    expect(matchScenario(prompt).scenario?.id).toBe('capabilities');
  });

  it.each(CAPABILITY_PROMPTS.map((c) => [c.prompt, c.scenario]))('every listed prompt works: %s → %s', (prompt, id) => {
    expect(matchScenario(prompt).scenario?.id).toBe(id);
  });

  it('lists every prompt, grouped', () => {
    const text = matchScenario('What are your Capabilities').scenario!.respond('What are your Capabilities', 0);
    for (const c of CAPABILITY_PROMPTS) expect(text).toContain(`\`${c.prompt}\``);
    expect(text).toContain('**Card products**');
    expect(text.indexOf('**Card products**')).toBeLessThan(text.indexOf('**Explanations**'));
  });
});

describe('MockAIService.streamResponse', () => {
  it('emits started → tokens → completed, and the tokens add up to the content', async () => {
    const service = new MockAIService();
    const events = await collect(service.streamResponse(req('Hello'), FAST));
    expect(events[0].type).toBe('started');
    const tokens = events.filter((e) => e.type === 'token');
    expect(tokens.length).toBeGreaterThan(3);
    const done = events.at(-1)!;
    expect(done.type).toBe('completed');
    if (done.type === 'completed') expect(tokens.map((t) => (t.type === 'token' ? t.token : '')).join('')).toBe(done.content);
    expect(service.activeCount).toBe(0);
  });

  it('returns the honest fallback for unmatched prompts', async () => {
    const result = await new MockAIService().generateResponse(req('asdf qwer zxcv'), FAST);
    expect(result.status).toBe('completed');
    expect(result.content).toBe(FALLBACK_RESPONSE);
    expect(result.content).toMatch(/don't have a real LLM connected/);
  });

  it('emits configured steps in order for complex scenarios', async () => {
    const events = await collect(new MockAIService().streamResponse(req('Help me plan a launch'), FAST));
    const started = events[0];
    expect(started.type === 'started' && started.steps.length).toBe(4);
    const stepEvents = events.filter((e) => e.type === 'step_started' || e.type === 'step_completed').map((e) => e.type);
    expect(stepEvents).toEqual(['step_started', 'step_completed', 'step_started', 'step_completed', 'step_started', 'step_completed', 'step_started', 'step_completed']);
    // Steps complete before any token is streamed.
    const lastStep = events.findLastIndex((e) => e.type === 'step_completed');
    const firstToken = events.findIndex((e) => e.type === 'token');
    expect(lastStep).toBeLessThan(firstToken);
  });

  it('skips steps for simple requests and when disabled', async () => {
    const simple = await collect(new MockAIService().streamResponse(req('Hi'), FAST));
    expect(simple.some((e) => e.type === 'step_started')).toBe(false);
    const disabled = await collect(new MockAIService().streamResponse(req('Help me plan a launch'), { ...FAST, enableSteps: false }));
    expect(disabled.some((e) => e.type === 'step_started')).toBe(false);
  });

  it('cancels mid-stream, stops emitting tokens, and cleans up', async () => {
    const service = new MockAIService();
    const events: GenerationEvent[] = [];
    for await (const e of service.streamResponse(req('Write a detailed guide about accessibility'), { ...FAST, chunkDelayMs: 2, chunkSize: 1 })) {
      events.push(e);
      if (events.filter((x) => x.type === 'token').length === 5) service.cancelGeneration(e.requestId);
    }
    expect(events.at(-1)!.type).toBe('cancelled');
    expect(events.filter((e) => e.type === 'token').length).toBe(5);
    expect(events.some((e) => e.type === 'completed')).toBe(false);
    expect(service.activeCount).toBe(0);
  });

  it('honours an external AbortSignal', async () => {
    const controller = new AbortController();
    const service = new MockAIService();
    const promise = service.generateResponse(req('Hello'), { ...FAST, minThinkingMs: 50, signal: controller.signal });
    setTimeout(() => controller.abort(), 5);
    const result = await promise;
    expect(result.status).toBe('cancelled');
    expect(service.activeCount).toBe(0);
  });

  it('cleans up when the consumer stops iterating early', async () => {
    const service = new MockAIService();
    for await (const e of service.streamResponse(req('Hello'), FAST)) {
      if (e.type === 'token') break;
    }
    expect(service.activeCount).toBe(0);
  });

  it('rejects a duplicate request id while it is active', async () => {
    const service = new MockAIService();
    const r = req('Hello');
    const first = service.streamResponse(r, { ...FAST, minThinkingMs: 30 });
    await first.next(); // started — now active
    const dup = await collect(service.streamResponse(r, FAST));
    expect(dup).toHaveLength(1);
    expect(dup[0].type === 'error' && dup[0].error.code).toBe('busy');
    await first.return();
  });

  it('simulates failures after the processing steps', async () => {
    const events = await collect(new MockAIService().streamResponse(req('Simulate an error'), FAST));
    const last = events.at(-1)!;
    expect(last.type).toBe('error');
    expect(last.type === 'error' && last.error.retryable).toBe(true);
    expect(events.some((e) => e.type === 'token' || e.type === 'completed')).toBe(false);
  });

  it('rejects empty prompts', async () => {
    const events = await collect(new MockAIService().streamResponse(req('   '), FAST));
    expect(events[0].type === 'error' && events[0].error.code).toBe('invalid_input');
  });

  it('measures duration from the injected clock', async () => {
    let t = 1000;
    const service = new MockAIService({ now: () => (t += 100) });
    const result = await service.generateResponse(req('Hi'), FAST);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.durationMs % 100).toBe(0);
  });

  it('cycles response variants on regenerate', async () => {
    const service = new MockAIService();
    const a = await service.generateResponse(req('Explain large language models', { variant: 0 }), FAST);
    const b = await service.generateResponse(req('Explain large language models', { variant: 1 }), FAST);
    expect(a.content).not.toBe(b.content);
  });
});
