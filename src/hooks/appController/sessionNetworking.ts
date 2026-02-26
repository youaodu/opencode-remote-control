import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MutableRefObject } from 'react';
import { sessionStorageKey } from '../../config/storage';
import { buildApiUrl, pickSessionIdFromResponse } from '../../utils/chatApi';
import type { SelectedImage } from './types';
import { fetchWithTrace } from '../useAppController.helpers';

type EnsureServerSessionParams = {
  abortRef: MutableRefObject<AbortController | null>;
  endpointId: string;
  baseUrl: string;
  directory: string;
  sessionId: string;
  setSessionId: (id: string) => void;
};

export async function ensureServerSession({
  abortRef,
  endpointId,
  baseUrl,
  directory,
  sessionId,
  setSessionId,
}: EnsureServerSessionParams): Promise<string | null> {
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
}

type PromptPayload = {
  agent: string;
  parts: Array<Record<string, string>>;
};

export function createPromptBody(text: string, image: SelectedImage | null): PromptPayload {
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
}

type SubmitPromptParams = {
  baseUrl: string;
  sessionId: string;
  text: string;
  image: SelectedImage | null;
  directory: string;
  signal: AbortSignal;
};

export async function submitPromptAsync({
  baseUrl,
  sessionId,
  text,
  image,
  directory,
  signal,
}: SubmitPromptParams): Promise<boolean> {
  const payload = createPromptBody(text, image);

  const response = await fetchWithTrace(
    'prompt-async',
    buildApiUrl(baseUrl, `/session/${sessionId}/prompt_async`, { directory }),
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
}
