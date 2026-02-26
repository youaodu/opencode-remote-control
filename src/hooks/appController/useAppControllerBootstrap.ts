import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { detectLocale, type Locale } from '../../../i18n';
import { ACTIVE_ENDPOINT_KEY, ENDPOINTS_KEY, LEGACY_GATEWAY_BASE_URL_KEY, LOCALE_KEY, sessionStorageKey } from '../../config/storage';
import { makeId, normalizeGatewayBaseUrl, parseStoredEndpoints } from '../../utils/chatApi';
import type { Endpoint } from '../../types/chat';

type BootstrapOptions = {
  setLocale: (locale: Locale) => void;
  setEndpoints: (endpoints: Endpoint[]) => void;
  setActiveEndpointId: (id: string | null) => void;
  setSessionId: (id: string) => void;
  setEndpointModalVisible: (visible: boolean) => void;
};

export function useAppControllerBootstrap({
  setLocale,
  setEndpoints,
  setActiveEndpointId,
  setSessionId,
  setEndpointModalVisible,
}: BootstrapOptions) {
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
      if (storedActive && parsedEndpoints.some((item: Endpoint) => item.id === storedActive)) {
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
  }, [setActiveEndpointId, setEndpoints, setEndpointModalVisible, setLocale, setSessionId]);
}
