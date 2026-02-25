import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EndpointModal } from './src/components/EndpointModal';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAppController } from './src/hooks/useAppController';

export default function App() {
  const controller = useAppController();

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator controller={controller} />
        <EndpointModal controller={controller} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
