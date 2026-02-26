import EventSource from 'react-native-sse';
import type { EventSourceListener } from 'react-native-sse';
import type { Dispatch, SetStateAction } from 'react';
import type { I18nKey } from '../../../i18n';
import type {
  Message,
  PermissionRequest,
  QuestionRequest,
} from '../../types/chat';
import {
  decodeMaybeText,
  decodePossiblyMojibakeText,
  fetchWithTrace,
  pickQuestionPrompts,
  pickSessionStateForId,
  pickStringArray,
  toToolEventSnippet,
  traceAssistantStream,
  wait,
  type SessionRuntimeState,
  type SessionStreamEventType,
} from '../useAppController.helpers';
import { buildApiUrl } from '../../utils/chatApi';

type SessionStatusParams = {
  baseUrl: string;
  sessionId: string;
  directory: string;
  signal: AbortSignal;
};

export async function fetchSessionStatus({
  baseUrl,
  sessionId,
  directory,
  signal,
}: SessionStatusParams): Promise<SessionRuntimeState | null> {
  const response = await fetchWithTrace(
    'session-status',
    buildApiUrl(baseUrl, '/session/status', { directory }),
    {
      method: 'GET',
    },
    { parentSignal: signal },
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as unknown;
  return pickSessionStateForId(payload, sessionId);
}

type WatchSessionStatusParams = {
  baseUrl: string;
  sessionId: string;
  directory: string;
  onState: (state: SessionRuntimeState) => void;
  onEvent: (payload: unknown) => void;
  signal: AbortSignal;
};

export async function watchSessionStatusEvents({
  baseUrl,
  sessionId,
  directory,
  onState,
  onEvent,
  signal,
}: WatchSessionStatusParams) {
  if (signal.aborted) return;

  await new Promise<void>((resolve) => {
    const url = buildApiUrl(baseUrl, '/event', { directory });
    console.log(`[api][start] event-stream ${url}`);

    const eventSource = new EventSource<SessionStreamEventType>(url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
      },
      timeout: 0,
      pollingInterval: 0,
    });

    let settled = false;
    const settle = (reason: 'done' | 'close' | 'abort') => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', handleAbort);
      eventSource.removeAllEventListeners();
      eventSource.close();
      console.log(`[api][end] event-stream reason=${reason}`);
      resolve();
    };

    const applyPayload = (raw: string | null) => {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (!text) return;

      try {
        const payload = JSON.parse(text) as unknown;
        onEvent(payload);
        const state = pickSessionStateForId(payload, sessionId);
        if (state) {
          onState(state);
        }
      } catch {
        // Ignore non-JSON payloads.
      }
    };

    const handleAbort = () => {
      settle('abort');
    };

    const handleOpen = () => {
      console.log('[api][ok] event-stream open');
    };

    const handleMessage: EventSourceListener<SessionStreamEventType, 'message'> = (event) => {
      applyPayload(event.data);
    };

    const handleSessionIdle: EventSourceListener<SessionStreamEventType, 'session.idle'> = (event) => {
      applyPayload(event.data);
    };

    const handleMessageUpdated: EventSourceListener<SessionStreamEventType, 'message.updated'> = (event) => {
      applyPayload(event.data);
    };

    const handleMessagePartDelta: EventSourceListener<SessionStreamEventType, 'message.part.delta'> = (event) => {
      applyPayload(event.data);
    };

    const handleMessagePartUpdated: EventSourceListener<SessionStreamEventType, 'message.part.updated'> = (event) => {
      applyPayload(event.data);
    };

    const handlePermissionAsked: EventSourceListener<SessionStreamEventType, 'permission.asked'> = (event) => {
      applyPayload(event.data);
    };

    const handleQuestionAsked: EventSourceListener<SessionStreamEventType, 'question.asked'> = (event) => {
      applyPayload(event.data);
    };

    const handleError: EventSourceListener<SessionStreamEventType, 'error'> = (event) => {
      if (signal.aborted) return;
      const message = 'message' in event && event.message ? ` message=${event.message}` : '';
      console.warn(`[api][fail] event-stream${message}`);
    };

    const handleDone: EventSourceListener<SessionStreamEventType, 'done'> = () => {
      settle('done');
    };

    eventSource.addEventListener('open', handleOpen);
    eventSource.addEventListener('message', handleMessage);
    eventSource.addEventListener('session.idle', handleSessionIdle);
    eventSource.addEventListener('message.updated', handleMessageUpdated);
    eventSource.addEventListener('message.part.delta', handleMessagePartDelta);
    eventSource.addEventListener('message.part.updated', handleMessagePartUpdated);
    eventSource.addEventListener('permission.asked', handlePermissionAsked);
    eventSource.addEventListener('question.asked', handleQuestionAsked);
    eventSource.addEventListener('error', handleError);
    eventSource.addEventListener('done', handleDone);
    eventSource.addEventListener('close', () => {
      settle('close');
    });

    signal.addEventListener('abort', handleAbort);
  });
}

type WaitForIdleOptions = {
  baseUrl: string;
  sessionId: string;
  directory: string;
  assistantId: string;
  signal: AbortSignal;
  t: (key: I18nKey) => string;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setPendingPermissions: Dispatch<SetStateAction<PermissionRequest[]>>;
  setPendingQuestions: Dispatch<SetStateAction<QuestionRequest[]>>;
  pushEventLog: (type: string, summary: string, detail: unknown) => void;
};

export async function waitForSessionIdle({
  baseUrl,
  sessionId,
  directory,
  assistantId,
  signal,
  t,
  setMessages,
  setPendingPermissions,
  setPendingQuestions,
  pushEventLog,
}: WaitForIdleOptions): Promise<boolean> {
  let sawBusy = false;
  let idleWithoutBusyCount = 0;
  let completed = false;
  const startedAt = Date.now();
  const timeoutMs = 90000;

  const applyState = (state: SessionRuntimeState) => {
    if (state === 'busy' || state === 'retry') {
      sawBusy = true;
      idleWithoutBusyCount = 0;
      return;
    }

    if (state === 'idle') {
      if (sawBusy) {
        completed = true;
      } else {
        idleWithoutBusyCount += 1;
        if (idleWithoutBusyCount >= 3) {
          completed = true;
        }
      }
    }
  };

  let activeAssistantMessageId: string | null = null;
  let streamedAssistantText = '';
  const consumedReasoningPartIds = new Set<string>();

  const applyEvent = (payload: unknown) => {
    if (!payload || typeof payload !== 'object') return;
    const event = payload as Record<string, unknown>;
    const eventType = typeof event.type === 'string' ? event.type : '';
    const properties =
      event.properties && typeof event.properties === 'object'
        ? (event.properties as Record<string, unknown>)
        : null;
    if (!properties) return;

    const logEventDetail = (detail: unknown) => {
      const typeLabel = eventType || 'event';
      const summaryTokens: string[] = [typeLabel];
      if (detail && typeof detail === 'object') {
        const info = detail as Record<string, unknown>;
        const role = typeof info.role === 'string' ? info.role : '';
        const partType = typeof info.type === 'string' ? info.type : '';
        const messageId =
          typeof info.messageID === 'string'
            ? info.messageID
            : typeof info.id === 'string'
              ? info.id
              : typeof info.messageId === 'string'
                ? info.messageId
                : '';
        if (role) summaryTokens.push(role);
        if (partType && eventType === 'message.part.updated') {
          summaryTokens.push(partType);
        }
        if (messageId) {
          summaryTokens.push(`#${messageId.slice(-6)}`);
        }
      }

      const combinedSummary = summaryTokens.join(' ') || typeLabel;
      const nextDetail = detail ?? event;
      pushEventLog(typeLabel, combinedSummary, nextDetail);
    };

    if (eventType === 'session.idle') {
      logEventDetail(properties);
      const sessionOfIdle = typeof properties.sessionID === 'string' ? properties.sessionID : '';
      if (sessionOfIdle === sessionId) {
        applyState('idle');
        completed = true;
        eventController.abort();
      }
      return;
    }

    if (eventType === 'message.updated') {
      const info =
        properties.info && typeof properties.info === 'object'
          ? (properties.info as Record<string, unknown>)
          : null;
      if (!info) return;
      logEventDetail(info);
      const role = typeof info.role === 'string' ? info.role : '';
      const sessionOfInfo = typeof info.sessionID === 'string' ? info.sessionID : '';
      const messageId = typeof info.id === 'string' ? info.id : '';
      if (role === 'assistant' && sessionOfInfo === sessionId && messageId) {
        activeAssistantMessageId = messageId;
      }
      return;
    }

    if (eventType === 'message.part.delta') {
      const sessionOfDelta = typeof properties.sessionID === 'string' ? properties.sessionID : '';
      const field = typeof properties.field === 'string' ? properties.field : '';
      const delta = typeof properties.delta === 'string' ? properties.delta : '';
      const messageId = typeof properties.messageID === 'string' ? properties.messageID : '';
      if (sessionOfDelta !== sessionId || field !== 'text' || !delta) return;
      console.log(
        `[api][stream][event] type=message.part.delta session=${sessionOfDelta} message=${messageId || 'unknown'} deltaLen=${delta.length}`,
      );
      if (!activeAssistantMessageId && messageId) {
        activeAssistantMessageId = messageId;
      }
      if (activeAssistantMessageId && messageId && messageId !== activeAssistantMessageId) {
        return;
      }

      const decodedDelta = decodePossiblyMojibakeText(delta);
      streamedAssistantText += decodedDelta;
      traceAssistantStream('message.part.delta', sessionId, messageId, decodedDelta, streamedAssistantText);
      setMessages((prev) =>
        prev.map((item) => {
          if (item.id !== assistantId) return item;
          const current = item.content === t('thinking') ? '' : item.content;
          return {
            ...item,
            content: `${current}${decodedDelta}`,
            streaming: true,
          };
        }),
      );
      return;
    }

    if (eventType === 'message.part.updated') {
      const part =
        properties.part && typeof properties.part === 'object'
          ? (properties.part as Record<string, unknown>)
          : null;
      if (!part) return;
      logEventDetail(part);

      const partType = typeof part.type === 'string' ? part.type : '';
      const partId = typeof part.id === 'string' ? part.id : '';
      const callId = typeof part.callID === 'string' ? part.callID : '';
      const sessionOfPart = typeof part.sessionID === 'string' ? part.sessionID : '';
      const messageId = typeof part.messageID === 'string' ? part.messageID : '';
      if (sessionOfPart !== sessionId) return;

      const appendAssistantChunk = (chunk: string) => {
        if (!chunk) return;
        setMessages((prev) =>
          prev.map((item) => {
            if (item.id !== assistantId) return item;
            const current = item.content === t('thinking') ? '' : item.content;
            const nextContent = `${current}${chunk}`;
            return {
              ...item,
              content: nextContent,
              streaming: true,
            };
          }),
        );
      };

      const appendLineWithTrailingNewline = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        appendAssistantChunk(`${trimmed}\n`);
      };

      const appendReasoningWithDivider = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        setMessages((prev) =>
          prev.map((item) => {
            if (item.id !== assistantId) return item;
            const current = item.content === t('thinking') ? '' : item.content;
            const dividerPrefix = current ? '\n\n' : '';
            const appended = `${dividerPrefix}---\n\n${trimmed}\n`;
            const nextContent = `${current}${appended}`;
            return {
              ...item,
              content: nextContent,
              streaming: true,
            };
          }),
        );
      };

      if (partType === 'tool') {
        const toolName = typeof part.tool === 'string' ? part.tool : '';
        const state = part.state && typeof part.state === 'object' ? (part.state as Record<string, unknown>) : null;
        const status = state && typeof state.status === 'string' ? state.status : '';

        if (toolName === 'read') {
          const inputObj =
            state?.input && typeof state.input === 'object'
              ? (state.input as Record<string, unknown>)
              : null;
          const filePath = inputObj && typeof inputObj.filePath === 'string' ? inputObj.filePath : '';
          const readContent = filePath
            ? `${t('toolReadRunning')}\n\n${t('toolReadPathLabel')}: \`${filePath}\``
            : t('toolReadRunning');
          if (!streamedAssistantText || filePath) {
            appendLineWithTrailingNewline(readContent);
          }
          return;
        }

        if (toolName || status || partId || callId) {
          const inputSnippet = toToolEventSnippet(state?.input, t('toolEventTruncated'));
          const outputSnippet = toToolEventSnippet(state?.output, t('toolEventTruncated'));
          console.log(
            `[api][tool] tool=${toolName || 'unknown'} status=${status || 'unknown'} input=${JSON.stringify(inputSnippet)} output=${JSON.stringify(outputSnippet)}`,
          );
        }
        return;
      }

      if (partType === 'reasoning') {
        if (partId && consumedReasoningPartIds.has(partId)) {
          return;
        }
        const reasoningText = decodeMaybeText(part.text);
        appendReasoningWithDivider(reasoningText);
        if (partId) {
          consumedReasoningPartIds.add(partId);
        }
        return;
      }

      const text = typeof part.text === 'string' ? part.text : '';
      if (partType !== 'text' || !text) return;

      if (!activeAssistantMessageId && messageId) {
        activeAssistantMessageId = messageId;
      }
      if (activeAssistantMessageId && messageId && messageId !== activeAssistantMessageId) {
        return;
      }

      const nextText = decodePossiblyMojibakeText(text);
      if (!nextText) return;

      if (!streamedAssistantText) {
        appendAssistantChunk(nextText);
      } else if (nextText === streamedAssistantText) {
        // Duplicate snapshot.
      } else if (nextText.startsWith(streamedAssistantText)) {
        appendAssistantChunk(nextText.slice(streamedAssistantText.length));
      } else {
        appendAssistantChunk(`\n\n---\n${nextText}`);
      }

      streamedAssistantText = nextText;
      traceAssistantStream('message.part.updated', sessionId, messageId, streamedAssistantText, streamedAssistantText);
      return;
    }

    if (eventType === 'permission.asked') {
      logEventDetail(properties);
      const requestId = typeof properties.id === 'string' ? properties.id : '';
      const sessionOfPermission = typeof properties.sessionID === 'string' ? properties.sessionID : '';
      if (!requestId || sessionOfPermission !== sessionId) return;

      const metadata =
        properties.metadata && typeof properties.metadata === 'object'
          ? (properties.metadata as Record<string, unknown>)
          : null;
      const tool =
        properties.tool && typeof properties.tool === 'object'
          ? (properties.tool as Record<string, unknown>)
          : null;

      setPendingPermissions((prev) => {
        const permissionRequest: PermissionRequest = {
          id: requestId,
          sessionId: sessionOfPermission,
          permission: typeof properties.permission === 'string' ? properties.permission : '',
          patterns: pickStringArray(properties.patterns),
          always: pickStringArray(properties.always),
          filepath: metadata && typeof metadata.filepath === 'string' ? metadata.filepath : '',
          parentDir: metadata && typeof metadata.parentDir === 'string' ? metadata.parentDir : '',
          messageId: tool && typeof tool.messageID === 'string' ? tool.messageID : '',
          callId: tool && typeof tool.callID === 'string' ? tool.callID : '',
          status: 'pending',
          error: '',
          createdAt: Date.now(),
        };

        const existingIndex = prev.findIndex((item) => item.id === requestId);
        if (existingIndex < 0) {
          return [...prev, permissionRequest];
        }

        return prev.map((item, index) => (index === existingIndex ? { ...item, ...permissionRequest, createdAt: item.createdAt } : item));
      });
      return;
    }

    if (eventType === 'question.asked') {
      logEventDetail(properties);
      const requestId = typeof properties.id === 'string' ? properties.id : '';
      const sessionOfQuestion = typeof properties.sessionID === 'string' ? properties.sessionID : '';
      if (!requestId || sessionOfQuestion !== sessionId) return;

      const prompts = pickQuestionPrompts(properties.questions);
      if (!prompts.length) return;

      setPendingQuestions((prev) => {
        const request: QuestionRequest = {
          id: requestId,
          sessionId: sessionOfQuestion,
          questions: prompts,
          status: 'pending',
          error: '',
          createdAt: Date.now(),
        };

        const existingIndex = prev.findIndex((item) => item.id === requestId);
        if (existingIndex < 0) {
          return [...prev, request];
        }

        return prev.map((item, index) => (index === existingIndex ? { ...item, ...request, createdAt: item.createdAt } : item));
      });
    }
  };

  const eventController = new AbortController();
  const handleParentAbort = () => {
    eventController.abort();
  };
  signal.addEventListener('abort', handleParentAbort);

  const eventTask = watchSessionStatusEvents({
    baseUrl,
    sessionId,
    directory,
    onState: applyState,
    onEvent: applyEvent,
    signal: eventController.signal,
  }).catch(() => {
    // Event stream interruptions are tolerated.
  });

  try {
    while (!signal.aborted && !completed && Date.now() - startedAt < timeoutMs) {
      try {
        const currentState = await fetchSessionStatus({ baseUrl, sessionId, directory, signal });
        if (currentState) {
          applyState(currentState);
        }
      } catch {
        // Continue polling on transient issues.
      }

      if (completed) break;
      await wait(900, signal);
    }
  } finally {
    eventController.abort();
    signal.removeEventListener('abort', handleParentAbort);
    await eventTask;
  }

  return completed;
}
