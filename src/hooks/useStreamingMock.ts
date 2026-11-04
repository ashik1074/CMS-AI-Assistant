import { useCallback, useEffect, useRef } from 'react';
import type { AIService, GenerationEvent, GenerationOptions, GenerationRequest } from '../types/chat';

/**
 * Runs streaming generations, at most one per key (conversation).
 * All active work is aborted when the owning component unmounts.
 */
export function useStreamingMock(service: AIService) {
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const map = controllers.current;
    return () => {
      map.forEach((c) => c.abort());
      map.clear();
    };
  }, []);

  const isRunning = useCallback((key: string) => controllers.current.has(key), []);

  /**
   * Starts a generation. Returns null (without starting) if one is already running for `key`;
   * otherwise a promise that resolves once a terminal event has been delivered.
   */
  const start = useCallback(
    (key: string, request: GenerationRequest, options: GenerationOptions, onEvent: (event: GenerationEvent) => void): Promise<void> | null => {
      if (controllers.current.has(key)) return null;
      const controller = new AbortController();
      // Registered synchronously so a rapid second submission is rejected.
      controllers.current.set(key, controller);

      return (async () => {
        try {
          for await (const event of service.streamResponse(request, { ...options, signal: controller.signal })) {
            onEvent(event);
          }
        } catch (e) {
          if (import.meta.env.DEV) console.error('[useStreamingMock] stream failed', e);
          onEvent({
            type: 'error',
            requestId: request.requestId,
            status: 'Failed',
            timestamp: Date.now(),
            durationMs: 0,
            error: { code: 'mock_failure', message: 'Something went wrong while generating the response.', retryable: true },
          });
        } finally {
          if (controllers.current.get(key) === controller) controllers.current.delete(key);
        }
      })();
    },
    [service],
  );

  const stop = useCallback((key: string) => {
    const controller = controllers.current.get(key);
    if (!controller) return false;
    controller.abort();
    return true;
  }, []);

  const stopAll = useCallback(() => {
    controllers.current.forEach((c) => c.abort());
  }, []);

  return { start, stop, stopAll, isRunning };
}
