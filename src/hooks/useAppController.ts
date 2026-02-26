import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { translations, type I18nKey, type Locale } from '../../i18n';
import {
  ACTIVE_ENDPOINT_KEY,
  ENDPOINTS_KEY,
  LOCALE_KEY,
  sessionStorageKey,
} from '../config/storage';
import {
  DEFAULT_GATEWAY_BASE,
  makeId,
  normalizeGatewayBaseUrl,
  buildApiUrl,
} from '../utils/chatApi';
import type {
  ConnectionState,
  Endpoint,
  Message,
  PermissionReply,
  PermissionRequest,
  QuestionRequest,
  StreamEventLog,
} from '../types/chat';
import { fetchWithTrace, truncateLogs } from './useAppController.helpers';
import type { AppController, SelectedImage } from './appController/types';
import { useAppControllerBootstrap } from './appController/useAppControllerBootstrap';
import { ensureServerSession, submitPromptAsync } from './appController/sessionNetworking';
import { waitForSessionIdle } from './appController/sessionStreaming';
import {
  rejectQuestionRequest as submitQuestionReject,
  replyPermissionRequest as submitPermissionReply,
  replyQuestionRequest as submitQuestionReply,
} from './appController/requestHandlers';

export function useAppController(): AppController {
  const [locale, setLocale] = useState<Locale>('en');
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [activeEndpointId, setActiveEndpointId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [activeDirectory, setActiveDirectory] = useState('');
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [eventLogs, setEventLogs] = useState<StreamEventLog[]>([]);
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

  useAppControllerBootstrap({
    setLocale,
    setEndpoints,
    setActiveEndpointId,
    setSessionId,
    setEndpointModalVisible,
  });

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const stringifyEventDetail = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const pushEventLog = (type: string, summary: string, detail: unknown) => {
    setEventLogs((prev) =>
      truncateLogs([
        ...prev,
        {
          id: makeId('event'),
          type,
          summary,
          detail: stringifyEventDetail(detail),
          timestamp: Date.now(),
        },
      ]),
    );
  };

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
        const activeSessionId = await ensureServerSession({
          abortRef,
          endpointId: activeEndpoint.id,
          baseUrl: activeEndpoint.baseUrl,
          directory: activeDirectory,
          sessionId,
          setSessionId,
        });
        if (!activeSessionId) {
          setConnection('error');
          updateAssistantContent(assistantId, t('sessionCreateFailed'));
          setIsStreaming(false);
          return;
        }

        const submitted = await submitPromptAsync({
          baseUrl: activeEndpoint.baseUrl,
          sessionId: activeSessionId,
          text,
          image,
          directory: activeDirectory,
          signal: controller.signal,
        });
        if (!submitted) {
          setConnection('error');
          updateAssistantContent(assistantId, t('promptSubmitFailed'));
          setIsStreaming(false);
          return;
        }

        setConnection('connected');

        await waitForSessionIdle({
          baseUrl: activeEndpoint.baseUrl,
          sessionId: activeSessionId,
          directory: activeDirectory,
          assistantId,
          signal: controller.signal,
          t,
          setMessages,
          setPendingPermissions,
          setPendingQuestions,
          pushEventLog,
        });

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

  const replyPermissionRequest = (requestId: string, reply: PermissionReply, message?: string) =>
    submitPermissionReply({
      gatewayBaseUrl,
      activeDirectory,
      requestId,
      reply,
      message,
      setPendingPermissions,
      t,
    });

  const replyQuestionRequest = (requestId: string, answers: string[][]) =>
    submitQuestionReply({
      gatewayBaseUrl,
      activeDirectory,
      requestId,
      answers,
      setPendingQuestions,
      t,
    });

  const rejectQuestionRequest = (requestId: string) =>
    submitQuestionReject({
      gatewayBaseUrl,
      activeDirectory,
      requestId,
      setPendingQuestions,
      t,
    });

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
    eventLogs,
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
    clearEventLogs: () => setEventLogs([]),
    replyPermissionRequest,
    replyQuestionRequest,
    rejectQuestionRequest,
    openAddEndpointModal,
    openEditEndpointModal,
    closeEndpointModal,
    saveEndpoint,
  };
}

export type { AppController, SelectedImage } from './appController/types';
