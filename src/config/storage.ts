export const LOCALE_KEY = 'opencode.locale';
export const ENDPOINTS_KEY = 'opencode.gateway.endpoints';
export const ACTIVE_ENDPOINT_KEY = 'opencode.gateway.active.endpoint';
export const SESSION_KEY_PREFIX = 'opencode.session.id.';
export const LEGACY_GATEWAY_BASE_URL_KEY = 'opencode.gateway.base.url';

export function sessionStorageKey(endpointId: string): string {
  return `${SESSION_KEY_PREFIX}${endpointId}`;
}
