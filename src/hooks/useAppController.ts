import AsyncStorage from '@react-native-async-storage/async-storage';
import EventSource from 'react-native-sse';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EventSourceListener } from 'react-native-sse';
import { detectLocale, type I18nKey, type Locale, translations } from '../../i18n';
import {
  ACTIVE_ENDPOINT_KEY,
  ENDPOINTS_KEY,
  LEGACY_GATEWAY_BASE_URL_KEY,
  LOCALE_KEY,
  sessionStorageKey,
} from '../config/storage';
import {
  buildApiUrl,
  DEFAULT_GATEWAY_BASE,
  makeId,
  normalizeGatewayBaseUrl,
  parseStoredEndpoints,
  pickAssistantTextsFromMessages,
  pickAssistantTextFromMessages,
  pickSessionIdFromResponse,
} from '../utils/chatApi';
import type {
  ConnectionState,
  Endpoint,
  Message,
  PermissionReply,
  PermissionRequest,
  QuestionPrompt,
  QuestionRequest,
} from '../types/chat';

export type SelectedImage = {
  uri: string;
  mime: string;
  filename: string;
  dataUrl: string;
};

export type AppController = {
  locale: Locale;
  t: (key: I18nKey) => string;
  endpoints: Endpoint[];
  activeEndpoint: Endpoint | null;
  sessionId: string;
  activeDirectory: string;
  input: string;
  selectedImage: SelectedImage | null;
  messages: Message[];
  pendingPermissions: PermissionRequest[];
  pendingQuestions: QuestionRequest[];
  isStreaming: boolean;
  statusText: string;
  canSend: boolean;
  endpointModalVisible: boolean;
  endpointEditId: string | null;
  endpointNameInput: string;
  gatewayInput: string;
  gatewayError: string;
  setInput: (text: string) => void;
  setSelectedImage: (image: SelectedImage | null) => void;
  setEndpointNameInput: (text: string) => void;
  setGatewayInput: (text: string) => void;
  setActiveDirectory: (directory: string) => void;
  switchLocale: (nextLocale: Locale) => Promise<void>;
  enterEndpoint: (endpoint: Endpoint, options?: { skipStoredSession?: boolean }) => Promise<void>;
  leaveEndpoint: () => void;
  sendMessage: () => void;
  stopStreaming: () => Promise<void>;
  replyPermissionRequest: (requestId: string, reply: PermissionReply, message?: string) => Promise<boolean>;
  replyQuestionRequest: (requestId: string, answers: string[][]) => Promise<boolean>;
  rejectQuestionRequest: (requestId: string) => Promise<boolean>;
  openAddEndpointModal: () => void;
  openEditEndpointModal: (endpoint: Endpoint) => void;
  closeEndpointModal: () => void;
  saveEndpoint: () => Promise<void>;
};

export function useAppController(): AppController {
  const [locale, setLocale] = useState<Locale>('en');
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [activeEndpointId, setActiveEndpointId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [activeDirectory, setActiveDirectory] = useState('');
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingPermissions, setPendingPermissions] = useState<PermissionRequest[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<QuestionRequest[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('idle');

  const [endpointModalVisible, setEndpointModalVisible] = useState(false);
  const [endpointEditId, setEndpointEditId] = useState<string | null>(null);
  const [endpointNameInput, setEndpointNameInput] = useState('');
  const [gatewayInput, setGatewayInput] = useState(DEFAULT_GATEWAY_BASE);
  const [gatewayError, setGatewayError] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);

  const t = (key: I18nKey) => translations[locale][key];
  const activeEndpoint = useMemo(
    () => endpoints.find((item) => item.id === activeEndpointId) ?? null,
    [activeEndpointId, endpoints],
  );
  const gatewayBaseUrl = activeEndpoint?.baseUrl ?? '';
  const canSend = useMemo(
    () => (input.trim().length > 0 || !!selectedImage) && !isStreaming && !!gatewayBaseUrl,
    [input, selectedImage, isStreaming, gatewayBaseUrl],
  );

  useEffect(() => {
    void (async () => {
      const storedLocale = await AsyncStorage.getItem(LOCALE_KEY);
      const rawEndpoints = await AsyncStorage.getItem(ENDPOINTS_KEY);
      const legacyGateway = await AsyncStorage.getItem(LEGACY_GATEWAY_BASE_URL_KEY);

      if (storedLocale === 'en' || storedLocale === 'zh') {
        setLocale(storedLocale);
      } else {
        const detected = detectLocale();
        setLocale(detected);
        await AsyncStorage.setItem(LOCALE_KEY, detected);
      }

      let parsedEndpoints = parseStoredEndpoints(rawEndpoints);
      if (!parsedEndpoints.length && legacyGateway) {
        const normalized = normalizeGatewayBaseUrl(legacyGateway);
        if (normalized) {
          parsedEndpoints = [
            {
              id: makeId('endpoint'),
              name: 'Default endpoint',
              baseUrl: normalized,
            },
          ];
          await AsyncStorage.setItem(ENDPOINTS_KEY, JSON.stringify(parsedEndpoints));
        }
      }

      setEndpoints(parsedEndpoints);

      const storedActive = await AsyncStorage.getItem(ACTIVE_ENDPOINT_KEY);
      if (storedActive && parsedEndpoints.some((item) => item.id === storedActive)) {
        setActiveEndpointId(storedActive);
        const storedSession = await AsyncStorage.getItem(sessionStorageKey(storedActive));
        if (storedSession) {
          setSessionId(storedSession);
        }
      }

      if (!parsedEndpoints.length) {
        setEndpointModalVisible(true);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const appendMessage = (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  };

  const updateAssistantContent = (assistantId: string, nextContent: string, streaming = false) => {
    setMessages((prev) =>
      prev.map((item) =>
        item.id === assistantId
          ? {
              ...item,
              content: nextContent,
              streaming,
            }
          : item,
      ),
    );
  };

type SessionRuntimeState = 'busy' | 'retry' | 'idle';
type SessionStreamEventType =
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

const isAbortError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const errorName = 'name' in error ? (error as { name?: unknown }).name : undefined;
  return errorName === 'AbortError';
};

const MOJIBAKE_PATTERN = /[ÃÂåæçéèêëìíîïðñòóôõöøùúûüýþÿ]/;

const decodePossiblyMojibakeText = (text: string): string => {
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

const pickStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && !!item);
};

const decodeMaybeText = (value: unknown): string => {
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

const toToolEventSnippet = (value: unknown, truncatedSuffix: string): string => {
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

const pickQuestionPrompts = (value: unknown): QuestionPrompt[] => {
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

const traceAssistantStream = (
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

  const normalizeRuntimeState = (value: unknown): SessionRuntimeState | null => {
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

  const pickSessionStateForId = (payload: unknown, targetSessionId: string): SessionRuntimeState | null => {
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

  const wait = async (milliseconds: number, signal: AbortSignal) => {
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

  const fetchWithTrace = async (
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

  const resetConversation = () => {
    setSessionId('');
    setInput('');
    setSelectedImage(null);
    setMessages([]);
    currentAssistantIdRef.current = null;
    setPendingPermissions([]);
    setPendingQuestions([]);
    setIsStreaming(false);
    setConnection('idle');
  };

  const enterEndpoint = async (endpoint: Endpoint, options?: { skipStoredSession?: boolean }) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveEndpointId(endpoint.id);
    resetConversation();

    if (!options?.skipStoredSession) {
      const storedSession = await AsyncStorage.getItem(sessionStorageKey(endpoint.id));
      if (storedSession) {
        setSessionId(storedSession);
      }
    }
    await AsyncStorage.setItem(ACTIVE_ENDPOINT_KEY, endpoint.id);
  };

  const leaveEndpoint = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveEndpointId(null);
    setSessionId('');
    setActiveDirectory('');
    setSelectedImage(null);
    currentAssistantIdRef.current = null;
    setPendingPermissions([]);
    setPendingQuestions([]);
    setIsStreaming(false);
    setConnection('idle');
    void AsyncStorage.removeItem(ACTIVE_ENDPOINT_KEY);
  };

  const ensureServerSession = async (
    endpointId: string,
    baseUrl: string,
    directory: string,
  ): Promise<string | null> => {
    if (!baseUrl) return null;
    if (sessionId) return sessionId;

    const controller = new AbortController();
    abortRef.current = controller;

    const sessionPath = '/session';
    const sessionAltPath = '/session/';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (directory) {
      headers['x-opencode-directory'] = directory;
    }

    const response = await fetchWithTrace(
      'create-session',
      buildApiUrl(baseUrl, sessionPath, { directory }),
      {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      },
      { parentSignal: controller.signal },
    );

    if (!response.ok) {
      const altResponse = await fetchWithTrace(
        'create-session-fallback',
        buildApiUrl(baseUrl, sessionAltPath, { directory }),
        {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        },
        { parentSignal: controller.signal },
      );
      if (!altResponse.ok) return null;
      const altData = (await altResponse.json()) as unknown;
      const altSessionId = pickSessionIdFromResponse(altData);
      if (!altSessionId) return null;
      await AsyncStorage.setItem(sessionStorageKey(endpointId), altSessionId);
      setSessionId(altSessionId);
      return altSessionId;
    }

    const data = (await response.json()) as unknown;
    const createdSessionId = pickSessionIdFromResponse(data);
    if (!createdSessionId) return null;

    await AsyncStorage.setItem(sessionStorageKey(endpointId), createdSessionId);
    setSessionId(createdSessionId);
    return createdSessionId;
  };

  const createPromptBody = (text: string, image: SelectedImage | null) => {
    const parts: Array<Record<string, string>> = [];
    if (text) {
      parts.push({
        type: 'text',
        text,
      });
    }
    if (image) {
      parts.push({
        type: 'file',
        mime: image.mime,
        filename: image.filename,
        url: image.dataUrl,
      });
    }

    return {
      agent: 'build',
      parts,
    };
  };

  const submitPromptAsync = async (
    baseUrl: string,
    activeSessionId: string,
    text: string,
    image: SelectedImage | null,
    directory: string,
    signal: AbortSignal,
  ): Promise<boolean> => {
    const payload = createPromptBody(text, image);

    const response = await fetchWithTrace(
      'prompt-async',
      buildApiUrl(baseUrl, `/session/${activeSessionId}/prompt_async`, { directory }),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      { parentSignal: signal },
    );

    return response.ok;
  };

  const fetchSessionStatus = async (
    baseUrl: string,
    activeSessionId: string,
    directory: string,
    signal: AbortSignal,
  ): Promise<SessionRuntimeState | null> => {
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
    return pickSessionStateForId(payload, activeSessionId);
  };

  const watchSessionStatusEvents = async (
    baseUrl: string,
    activeSessionId: string,
    directory: string,
    onState: (state: SessionRuntimeState) => void,
    onEvent: (payload: unknown) => void,
    signal: AbortSignal,
  ) => {
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
          const state = pickSessionStateForId(payload, activeSessionId);
          if (state) {
            onState(state);
          }
        } catch {
          // Ignore non-JSON and heartbeat event payloads.
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

      const handleMessagePartDelta: EventSourceListener<
        SessionStreamEventType,
        'message.part.delta'
      > = (event) => {
        applyPayload(event.data);
      };

      const handleMessagePartUpdated: EventSourceListener<
        SessionStreamEventType,
        'message.part.updated'
      > = (event) => {
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
  };

  const waitForSessionIdle = async (
    baseUrl: string,
    activeSessionId: string,
    directory: string,
    assistantId: string,
    signal: AbortSignal,
  ): Promise<boolean> => {
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
    const toolMessageIdByUpdateKey = new Map<string, string>();

    const applyEvent = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const event = payload as Record<string, unknown>;
      const eventType = typeof event.type === 'string' ? event.type : '';
      const properties =
        event.properties && typeof event.properties === 'object'
          ? (event.properties as Record<string, unknown>)
          : null;
      if (!properties) return;

      if (eventType === 'session.idle') {
        const sessionOfIdle = typeof properties.sessionID === 'string' ? properties.sessionID : '';
        if (sessionOfIdle === activeSessionId) {
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
        const role = typeof info.role === 'string' ? info.role : '';
        const sessionOfInfo = typeof info.sessionID === 'string' ? info.sessionID : '';
        const messageId = typeof info.id === 'string' ? info.id : '';
        if (role === 'assistant' && sessionOfInfo === activeSessionId && messageId) {
          activeAssistantMessageId = messageId;
        }
        return;
      }

      if (eventType === 'message.part.delta') {
        const sessionOfDelta = typeof properties.sessionID === 'string' ? properties.sessionID : '';
        const field = typeof properties.field === 'string' ? properties.field : '';
        const delta = typeof properties.delta === 'string' ? properties.delta : '';
        const messageId = typeof properties.messageID === 'string' ? properties.messageID : '';
        if (sessionOfDelta !== activeSessionId || field !== 'text' || !delta) return;
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
        traceAssistantStream(
          'message.part.delta',
          activeSessionId,
          messageId,
          decodedDelta,
          streamedAssistantText,
        );
        updateAssistantContent(assistantId, streamedAssistantText, true);
        return;
      }

      if (eventType === 'message.part.updated') {
        const part =
          properties.part && typeof properties.part === 'object'
            ? (properties.part as Record<string, unknown>)
            : null;
        if (!part) return;

        const partType = typeof part.type === 'string' ? part.type : '';
        const partId = typeof part.id === 'string' ? part.id : '';
        const callId = typeof part.callID === 'string' ? part.callID : '';
        const sessionOfPart = typeof part.sessionID === 'string' ? part.sessionID : '';
        const messageId = typeof part.messageID === 'string' ? part.messageID : '';
        if (sessionOfPart !== activeSessionId) return;

        if (partType === 'tool') {
          const toolName = typeof part.tool === 'string' ? part.tool : '';
          const state = part.state && typeof part.state === 'object' ? (part.state as Record<string, unknown>) : null;
          const status = state && typeof state.status === 'string' ? state.status : '';

          if (toolName === 'read') {
            const inputObj =
              state?.input && typeof state.input === 'object' ? (state.input as Record<string, unknown>) : null;
            const filePath = inputObj && typeof inputObj.filePath === 'string' ? inputObj.filePath : '';
            const readContent = filePath
              ? `${t('toolReadRunning')}\n\n${t('toolReadPathLabel')}: \`${filePath}\``
              : t('toolReadRunning');
            if (!streamedAssistantText) {
              updateAssistantContent(assistantId, readContent, true);
            } else if (filePath) {
              updateAssistantContent(assistantId, readContent, true);
            }
            return;
          }

          const inputSnippet = toToolEventSnippet(state?.input, t('toolEventTruncated'));
          const outputSnippet = toToolEventSnippet(state?.output, t('toolEventTruncated'));

          const lines = [`**${t('toolEventTitle')}**`];
          if (toolName) {
            lines.push(`${t('toolEventToolLabel')}: \`${toolName}\``);
          }
          if (status) {
            lines.push(`${t('toolEventStatusLabel')}: \`${status}\``);
          }
          if (inputSnippet) {
            lines.push(`${t('toolEventInputLabel')}:\n\n\`\`\`\n${inputSnippet.replace(/```/g, '` ` `')}\n\`\`\``);
          }

          const safeOutput = outputSnippet.replace(/```/g, '` ` `');
          lines.push(
            outputSnippet
              ? `${t('toolEventOutputLabel')}:\n\n\`\`\`\n${safeOutput}\n\`\`\``
              : `${t('toolEventOutputLabel')}: ${t('toolEventNoOutput')}`,
          );

          const content = lines.join('\n\n');
          const updateKey = partId || callId || `${messageId}:${toolName}`;
          const mappedMessageId = toolMessageIdByUpdateKey.get(updateKey);
          if (mappedMessageId) {
            setMessages((prev) =>
              prev.map((item) =>
                item.id === mappedMessageId
                  ? {
                      ...item,
                      content,
                    }
                  : item,
              ),
            );
          } else {
            const toolMessageId = partId || makeId('tool');
            appendMessage({
              id: toolMessageId,
              role: 'system',
              content,
            });
            toolMessageIdByUpdateKey.set(updateKey, toolMessageId);
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

        streamedAssistantText = decodePossiblyMojibakeText(text);
        traceAssistantStream(
          'message.part.updated',
          activeSessionId,
          messageId,
          streamedAssistantText,
          streamedAssistantText,
        );
        updateAssistantContent(assistantId, streamedAssistantText, true);
        return;
      }

      if (eventType === 'permission.asked') {
        const requestId = typeof properties.id === 'string' ? properties.id : '';
        const sessionOfPermission = typeof properties.sessionID === 'string' ? properties.sessionID : '';
        if (!requestId || sessionOfPermission !== activeSessionId) return;

        const metadata =
          properties.metadata && typeof properties.metadata === 'object'
            ? (properties.metadata as Record<string, unknown>)
            : null;
        const tool =
          properties.tool && typeof properties.tool === 'object'
            ? (properties.tool as Record<string, unknown>)
            : null;

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

        setPendingPermissions((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === requestId);
          if (existingIndex < 0) {
            return [...prev, permissionRequest];
          }

          return prev.map((item, index) => {
            if (index !== existingIndex) return item;
            return {
              ...item,
              ...permissionRequest,
              createdAt: item.createdAt,
            };
          });
        });
        return;
      }

      if (eventType === 'question.asked') {
        const requestId = typeof properties.id === 'string' ? properties.id : '';
        const sessionOfQuestion = typeof properties.sessionID === 'string' ? properties.sessionID : '';
        if (!requestId || sessionOfQuestion !== activeSessionId) return;

        const prompts = pickQuestionPrompts(properties.questions);
        if (!prompts.length) return;

        const request: QuestionRequest = {
          id: requestId,
          sessionId: sessionOfQuestion,
          questions: prompts,
          status: 'pending',
          error: '',
          createdAt: Date.now(),
        };

        setPendingQuestions((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === requestId);
          if (existingIndex < 0) {
            return [...prev, request];
          }

          return prev.map((item, index) => {
            if (index !== existingIndex) return item;
            return {
              ...item,
              ...request,
              createdAt: item.createdAt,
            };
          });
        });
      }
    };

    const eventController = new AbortController();
    const handleParentAbort = () => {
      eventController.abort();
    };
    signal.addEventListener('abort', handleParentAbort);

    const eventTask = watchSessionStatusEvents(
      baseUrl,
      activeSessionId,
      directory,
      applyState,
      applyEvent,
      eventController.signal,
    ).catch(() => {
      // Event stream may be interrupted; polling below remains source of truth.
    });

    try {
      while (!signal.aborted && !completed && Date.now() - startedAt < timeoutMs) {
        try {
          const currentState = await fetchSessionStatus(baseUrl, activeSessionId, directory, signal);
          if (currentState) {
            applyState(currentState);
          }
        } catch {
          // Keep polling on transient status errors.
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
  };

  const fetchAssistantReplyAfterCompletion = async (
    baseUrl: string,
    activeSessionId: string,
    directory: string,
    signal: AbortSignal,
    knownAssistantCount: number,
  ): Promise<string> => {
    const maxAttempts = 6;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetchWithTrace(
        'session-message',
        buildApiUrl(baseUrl, `/session/${activeSessionId}/message`, { directory }),
        {
          method: 'GET',
        },
        { parentSignal: signal },
      );
      if (response.ok) {
        const payload = (await response.json()) as unknown;
        const assistantTexts = pickAssistantTextsFromMessages(payload);
        if (assistantTexts.length > knownAssistantCount) {
          return pickAssistantTextFromMessages(payload);
        }
      }

      if (attempt < maxAttempts - 1) {
        await wait(500, signal);
      }
    }

    return '';
  };

  const replyPermissionRequest = async (
    requestId: string,
    reply: PermissionReply,
    message?: string,
  ): Promise<boolean> => {
    if (!gatewayBaseUrl) return false;

    setPendingPermissions((prev) =>
      prev.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: 'submitting',
              error: '',
            }
          : item,
      ),
    );

    const body: Record<string, string> = {
      reply,
    };
    const trimmedMessage = message?.trim() ?? '';
    if (reply === 'reject' && trimmedMessage) {
      body.message = trimmedMessage;
    }

    try {
      const response = await fetchWithTrace(
        'permission-reply',
        buildApiUrl(gatewayBaseUrl, `/permission/${requestId}/reply`, { directory: activeDirectory }),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        throw new Error('permission-reply-failed');
      }

      setPendingPermissions((prev) => prev.filter((item) => item.id !== requestId));
      return true;
    } catch {
      setPendingPermissions((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: 'error',
                error: t('permissionReplyFailed'),
              }
            : item,
        ),
      );
      return false;
    }
  };

  const replyQuestionRequest = async (requestId: string, answers: string[][]): Promise<boolean> => {
    if (!gatewayBaseUrl) return false;

    setPendingQuestions((prev) =>
      prev.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: 'submitting',
              error: '',
            }
          : item,
      ),
    );

    try {
      const response = await fetchWithTrace(
        'question-reply',
        buildApiUrl(gatewayBaseUrl, `/question/${requestId}/reply`, { directory: activeDirectory }),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ answers }),
        },
      );

      if (!response.ok) {
        throw new Error('question-reply-failed');
      }

      setPendingQuestions((prev) => prev.filter((item) => item.id !== requestId));
      return true;
    } catch {
      setPendingQuestions((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: 'error',
                error: t('questionReplyFailed'),
              }
            : item,
        ),
      );
      return false;
    }
  };

  const rejectQuestionRequest = async (requestId: string): Promise<boolean> => {
    if (!gatewayBaseUrl) return false;

    setPendingQuestions((prev) =>
      prev.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: 'submitting',
              error: '',
            }
          : item,
      ),
    );

    try {
      const response = await fetchWithTrace(
        'question-reject',
        buildApiUrl(gatewayBaseUrl, `/question/${requestId}/reject`, { directory: activeDirectory }),
        {
          method: 'POST',
        },
      );

      if (!response.ok) {
        throw new Error('question-reject-failed');
      }

      setPendingQuestions((prev) => prev.filter((item) => item.id !== requestId));
      return true;
    } catch {
      setPendingQuestions((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: 'error',
                error: t('questionRejectFailed'),
              }
            : item,
        ),
      );
      return false;
    }
  };

  const stopStreaming = async () => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (gatewayBaseUrl && sessionId) {
      try {
          await fetchWithTrace(
            'session-abort',
            buildApiUrl(gatewayBaseUrl, `/session/${sessionId}/abort`, { directory: activeDirectory }),
            {
              method: 'POST',
            },
          );
      } catch {
        // Ignore abort errors, local cancel is enough for UX.
      }
    }

    setIsStreaming(false);
    setConnection('idle');

    const assistantId = currentAssistantIdRef.current;
    if (assistantId) {
      updateAssistantContent(assistantId, t('requestCancelled'));
    }
  };

  const sendMessage = () => {
    void (async () => {
      const text = input.trim();
      const image = selectedImage;
      if ((!text && !image) || isStreaming || !activeEndpoint) return;
      const knownAssistantCount = messages.filter((item) => item.role === 'assistant').length;

      setInput('');
      setSelectedImage(null);
      appendMessage({
        id: makeId('user'),
        role: 'user',
        content: text || t('imageOnlyMessage'),
        imageUri: image?.uri,
      });

      const assistantId = makeId('assistant');
      currentAssistantIdRef.current = assistantId;
      appendMessage({ id: assistantId, role: 'assistant', content: t('thinking'), streaming: true });

      setIsStreaming(true);
      setConnection('connecting');

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const activeSessionId = await ensureServerSession(activeEndpoint.id, activeEndpoint.baseUrl, activeDirectory);
        if (!activeSessionId) {
          setConnection('error');
          updateAssistantContent(assistantId, t('sessionCreateFailed'));
          setIsStreaming(false);
          return;
        }

        const submitted = await submitPromptAsync(
          activeEndpoint.baseUrl,
          activeSessionId,
          text,
          image,
          activeDirectory,
          controller.signal,
        );
        if (!submitted) {
          setConnection('error');
          updateAssistantContent(assistantId, t('promptSubmitFailed'));
          setIsStreaming(false);
          return;
        }

        setConnection('connected');

        const completed = await waitForSessionIdle(
          activeEndpoint.baseUrl,
          activeSessionId,
          activeDirectory,
          assistantId,
          controller.signal,
        );

        const reply = completed
          ? await fetchAssistantReplyAfterCompletion(
              activeEndpoint.baseUrl,
              activeSessionId,
              activeDirectory,
              controller.signal,
              knownAssistantCount,
            )
          : '';

        if (reply) {
          updateAssistantContent(assistantId, reply);
        } else {
          setMessages((prev) =>
            prev.map((item) => {
              if (item.id !== assistantId) return item;
              const hasContent = item.content.trim().length > 0;
              return {
                ...item,
                content: hasContent ? item.content : t('replyPending'),
                streaming: false,
              };
            }),
          );
        }
        setIsStreaming(false);
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        setConnection('error');
        updateAssistantContent(assistantId, t('connectionFailed'));
        setIsStreaming(false);
      } finally {
        abortRef.current = null;
      }
    })();
  };

  const switchLocale = async (nextLocale: Locale) => {
    setLocale(nextLocale);
    await AsyncStorage.setItem(LOCALE_KEY, nextLocale);
  };

  const openAddEndpointModal = () => {
    setEndpointEditId(null);
    setEndpointNameInput('');
    setGatewayInput(DEFAULT_GATEWAY_BASE);
    setGatewayError('');
    setEndpointModalVisible(true);
  };

  const openEditEndpointModal = (endpoint: Endpoint) => {
    setEndpointEditId(endpoint.id);
    setEndpointNameInput(endpoint.name);
    setGatewayInput(endpoint.baseUrl);
    setGatewayError('');
    setEndpointModalVisible(true);
  };

  const closeEndpointModal = () => {
    if (!endpoints.length) return;
    setEndpointModalVisible(false);
    setGatewayError('');
  };

  const saveEndpoint = async () => {
    const name = endpointNameInput.trim();
    if (!name) {
      setGatewayError(t('endpointNameRequired'));
      return;
    }

    const normalized = normalizeGatewayBaseUrl(gatewayInput);
    if (!normalized) {
      setGatewayError(t('invalidGateway'));
      return;
    }

    try {
      const response = await fetchWithTrace(
        'gateway-health',
        buildApiUrl(normalized, '/global/health', { directory: activeDirectory }),
        {
          method: 'GET',
        },
      );
      if (!response.ok) {
        setGatewayError(t('gatewayHealthFailed'));
        return;
      }
    } catch {
      setGatewayError(t('gatewayHealthFailed'));
      return;
    }

    let nextEndpoints: Endpoint[];
    if (endpointEditId) {
      const previous = endpoints.find((item) => item.id === endpointEditId);
      nextEndpoints = endpoints.map((item) =>
        item.id === endpointEditId
          ? {
              ...item,
              name,
              baseUrl: normalized,
            }
          : item,
      );

      if (previous && previous.baseUrl !== normalized) {
        await AsyncStorage.removeItem(sessionStorageKey(endpointEditId));
        if (activeEndpointId === endpointEditId) {
          setSessionId('');
        }
      }
    } else {
      nextEndpoints = [
        ...endpoints,
        {
          id: makeId('endpoint'),
          name,
          baseUrl: normalized,
        },
      ];
    }

    setEndpoints(nextEndpoints);
    await AsyncStorage.setItem(ENDPOINTS_KEY, JSON.stringify(nextEndpoints));
    setGatewayError('');
    setEndpointModalVisible(false);
  };

  const statusText =
    connection === 'connected'
      ? t('statusConnected')
      : connection === 'connecting'
        ? t('statusConnecting')
        : connection === 'error'
          ? t('statusError')
          : t('statusIdle');

  const handleEndpointNameInput = (text: string) => {
    setEndpointNameInput(text);
    if (gatewayError) setGatewayError('');
  };

  const handleGatewayInput = (text: string) => {
    setGatewayInput(text);
    if (gatewayError) setGatewayError('');
  };

  return {
    locale,
    t,
    endpoints,
    activeEndpoint,
    sessionId,
    activeDirectory,
    input,
    selectedImage,
    messages,
    pendingPermissions,
    pendingQuestions,
    isStreaming,
    statusText,
    canSend,
    endpointModalVisible,
    endpointEditId,
    endpointNameInput,
    gatewayInput,
    gatewayError,
    setInput,
    setSelectedImage,
    setActiveDirectory,
    setEndpointNameInput: handleEndpointNameInput,
    setGatewayInput: handleGatewayInput,
    switchLocale,
    enterEndpoint,
    leaveEndpoint,
    sendMessage,
    stopStreaming,
    replyPermissionRequest,
    replyQuestionRequest,
    rejectQuestionRequest,
    openAddEndpointModal,
    openEditEndpointModal,
    closeEndpointModal,
    saveEndpoint,
  };
}
