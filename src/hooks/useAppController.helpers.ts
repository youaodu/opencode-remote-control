import type { QuestionPrompt, StreamEventLog } from '../types/chat';

export type SessionRuntimeState = 'busy' | 'retry' | 'idle';
export type SessionStreamEventType =
  | 'session.idle'
  | 'message.updated'
  | 'message.part.delta'
  | 'message.part.updated'
  | 'permission.asked'
  | 'question.asked'
  | 'done';

type ApiTraceTag =
  | 'create-session'
  | 'create-session-fallback'
  | 'prompt-async'
  | 'session-status'
  | 'event-stream'
  | 'permission-reply'
  | 'question-reply'
  | 'question-reject'
  | 'session-message'
  | 'session-abort'
  | 'gateway-health';

const API_TIMEOUT_MS: Record<ApiTraceTag, number> = {
  'create-session': 15000,
  'create-session-fallback': 15000,
  'prompt-async': 15000,
  'session-status': 8000,
  'event-stream': 12000,
  'permission-reply': 12000,
  'question-reply': 12000,
  'question-reject': 12000,
  'session-message': 12000,
  'session-abort': 8000,
  'gateway-health': 8000,
};

export const EVENT_LOG_LIMIT = 200;

const MOJIBAKE_PATTERN = /[ÃÂåæçéèêëìíîïðñòóôõöøùúûüýþÿ]/;

export const isAbortError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const errorName = 'name' in error ? (error as { name?: unknown }).name : undefined;
  return errorName === 'AbortError';
};

export const decodePossiblyMojibakeText = (text: string): string => {
  if (!text || !MOJIBAKE_PATTERN.test(text)) return text;

  try {
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) {
      bytes[index] = text.charCodeAt(index) & 0xff;
    }

    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (!decoded || decoded.includes('\uFFFD')) return text;
    return decoded;
  } catch {
    return text;
  }
};

export const pickStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && !!item);
};

export const decodeMaybeText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return decodePossiblyMojibakeText(value);
};

const stringifyForToolEvent = (value: unknown): string => {
  if (typeof value === 'string') return decodePossiblyMojibakeText(value).trim();
  if (value === null || value === undefined) return '';

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const toToolEventSnippet = (value: unknown, truncatedSuffix: string): string => {
  const maxLength = 1200;
  const maxLines = 24;
  const text = stringifyForToolEvent(value);
  if (!text) return '';

  const lines = text.split('\n');
  const clippedByLines = lines.length > maxLines ? lines.slice(0, maxLines).join('\n') : text;
  const clipped =
    clippedByLines.length > maxLength ? clippedByLines.slice(0, maxLength).trimEnd() : clippedByLines;

  if (clipped !== text) {
    return `${clipped}\n${truncatedSuffix}`;
  }

  return clipped;
};

export const pickQuestionPrompts = (value: unknown): QuestionPrompt[] => {
  if (!Array.isArray(value)) return [];

  const prompts: QuestionPrompt[] = [];
  value.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const obj = item as Record<string, unknown>;
    const optionsRaw = Array.isArray(obj.options) ? obj.options : [];
    const options = optionsRaw
      .map((option) => {
        if (!option || typeof option !== 'object') return null;
        const optionObj = option as Record<string, unknown>;
        const label = decodeMaybeText(optionObj.label);
        if (!label) return null;
        return {
          label,
          description: decodeMaybeText(optionObj.description),
        };
      })
      .filter((option): option is { label: string; description: string } => !!option);

    const question = decodeMaybeText(obj.question);
    if (!question) return;

    prompts.push({
      header: decodeMaybeText(obj.header),
      question,
      multiple: obj.multiple === true,
      customEnabled: obj.custom !== false,
      options,
    });
  });

  return prompts;
};

export const traceAssistantStream = (
  source: 'message.part.delta' | 'message.part.updated',
  sessionId: string,
  messageId: string,
  latestPiece: string,
  accumulatedText: string,
) => {
  console.log(
    `[api][stream] source=${source} session=${sessionId} message=${messageId || 'unknown'} piece=${JSON.stringify(latestPiece)} accumulated=${JSON.stringify(accumulatedText)}`,
  );
};

export const truncateLogs = (logs: StreamEventLog[]): StreamEventLog[] => {
  if (logs.length <= EVENT_LOG_LIMIT) return logs;
  return logs.slice(logs.length - EVENT_LOG_LIMIT);
};

export const normalizeRuntimeState = (value: unknown): SessionRuntimeState | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase();
  if (normalized === 'busy' || normalized === 'retry' || normalized === 'idle') {
    return normalized;
  }
  return null;
};

const getObjectSessionId = (obj: Record<string, unknown>): string | null => {
  const sessionIdCandidate = obj.sessionID ?? obj.sessionId ?? obj.id;
  return typeof sessionIdCandidate === 'string' && sessionIdCandidate ? sessionIdCandidate : null;
};

export const pickSessionStateForId = (
  payload: unknown,
  targetSessionId: string,
): SessionRuntimeState | null => {
  const queue: unknown[] = [payload];
  const visited = new Set<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    if (Array.isArray(current)) {
      current.forEach((item) => {
        queue.push(item);
      });
      continue;
    }

    if (typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const obj = current as Record<string, unknown>;
    const sessionIdValue = getObjectSessionId(obj);
    const stateValue = normalizeRuntimeState(obj.status ?? obj.state);
    if (sessionIdValue === targetSessionId && stateValue) {
      return stateValue;
    }

    Object.values(obj).forEach((value) => {
      queue.push(value);
    });
  }

  return null;
};

export const wait = async (milliseconds: number, signal: AbortSignal) => {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve();
    };
    signal.addEventListener('abort', onAbort);
  });
};

export const fetchWithTrace = async (
  tag: ApiTraceTag,
  url: string,
  init: RequestInit,
  options?: {
    timeoutMs?: number;
    parentSignal?: AbortSignal;
  },
): Promise<Response> => {
  const startedAt = Date.now();
  const timeoutMs = options?.timeoutMs ?? API_TIMEOUT_MS[tag];
  const parentSignal = options?.parentSignal;

  const timeoutController = new AbortController();
  let didTimeout = false;

  const onParentAbort = () => {
    timeoutController.abort();
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      timeoutController.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort);
    }
  }

  const timer = setTimeout(() => {
    didTimeout = true;
    timeoutController.abort();
  }, timeoutMs);

  console.log(`[api][start] ${tag} ${url}`);
  try {
    const response = await fetch(url, {
      ...init,
      signal: timeoutController.signal,
    });
    const elapsed = Date.now() - startedAt;
    console.log(`[api][ok] ${tag} status=${response.status} cost=${elapsed}ms`);
    return response;
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    if (didTimeout) {
      console.warn(`[api][timeout] ${tag} cost=${elapsed}ms`);
    } else if (isAbortError(error) && parentSignal?.aborted) {
      console.log(`[api][abort] ${tag} cost=${elapsed}ms`);
    } else {
      console.warn(`[api][fail] ${tag} cost=${elapsed}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
};
