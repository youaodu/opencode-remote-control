import type { Endpoint } from '../types/chat';

export const DEFAULT_GATEWAY_BASE = 'http://127.0.0.1:4096';

type ApiQueryValue = string | number | boolean | null | undefined;

export function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeGatewayBaseUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  try {
    const url = new URL(value.includes('://') ? value : `http://${value}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function buildApiUrl(baseUrl: string, path: string, query?: Record<string, ApiQueryValue>): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const rawUrl = `${cleanBase}${path}`;
  if (!query) return rawUrl;

  const url = new URL(rawUrl);
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export function parseStoredEndpoints(raw: string | null): Endpoint[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    const result: Endpoint[] = [];

    parsed.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const obj = item as Record<string, unknown>;
      if (typeof obj.id !== 'string' || !obj.id) return;
      if (seen.has(obj.id)) return;
      if (typeof obj.name !== 'string' || !obj.name.trim()) return;
      if (typeof obj.baseUrl !== 'string') return;
      const normalized = normalizeGatewayBaseUrl(obj.baseUrl);
      if (!normalized) return;

      seen.add(obj.id);
      result.push({
        id: obj.id,
        name: obj.name.trim(),
        baseUrl: normalized,
      });
    });

    return result;
  } catch {
    return [];
  }
}

export function pickSessionIdFromResponse(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const direct = obj.sessionID ?? obj.sessionId ?? obj.id;
  if (typeof direct === 'string' && direct) return direct;

  const nestedCandidates = [obj.data, obj.session, obj.result];
  for (const candidate of nestedCandidates) {
    if (candidate && typeof candidate === 'object') {
      const nested = candidate as Record<string, unknown>;
      const nestedId = nested.sessionID ?? nested.sessionId ?? nested.id;
      if (typeof nestedId === 'string' && nestedId) return nestedId;
    }
  }

  return null;
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join('');
  if (!value || typeof value !== 'object') return '';

  const obj = value as Record<string, unknown>;
  const direct = obj.content ?? obj.text ?? obj.value ?? obj.message;
  const directText = extractText(direct);
  if (directText) return directText;

  const partsText = extractText(obj.parts ?? obj.part ?? obj.delta);
  if (partsText) return partsText;

  return '';
}

export function pickAssistantTextFromMessages(payload: unknown): string {
  const texts = pickAssistantTextsFromMessages(payload);
  const lastIndex = texts.length - 1;
  return lastIndex >= 0 ? (texts[lastIndex] ?? '') : '';
}

export function pickAssistantTextsFromMessages(payload: unknown): string[] {
  const unwrap = (val: unknown): unknown[] => {
    if (Array.isArray(val)) return val;
    if (!val || typeof val !== 'object') return [];
    const obj = val as Record<string, unknown>;
    if (Array.isArray(obj.messages)) return obj.messages;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.data)) return obj.data;
    return [];
  };

  const messages = unwrap(payload);
  const assistantTexts: string[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const item = messages[i];
    if (!item || typeof item !== 'object') continue;
    const msg = item as Record<string, unknown>;
    const info = msg.info && typeof msg.info === 'object' ? (msg.info as Record<string, unknown>) : null;
    const role = String(info?.role ?? msg.role ?? msg.type ?? '').toLowerCase();
    if (role !== 'assistant') continue;

    const parts = Array.isArray(msg.parts) ? msg.parts : [];
    const textParts = parts
      .filter((part) => part && typeof part === 'object' && (part as Record<string, unknown>).type === 'text')
      .map((part) => extractText(part));
    const joinedTextParts = textParts.join('').trim();
    if (joinedTextParts) {
      assistantTexts.push(joinedTextParts);
      continue;
    }

    const fallbackText = extractText(msg.parts ?? msg);
    if (fallbackText) {
      assistantTexts.push(fallbackText);
    }
  }

  return assistantTexts;
}
