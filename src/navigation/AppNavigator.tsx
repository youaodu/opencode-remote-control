import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { ChatScreen } from '../screens/ChatScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { AppController } from '../hooks/useAppController';
import type { RootStackParamList } from './types';

const Stack = createStackNavigator<RootStackParamList>();

type AppNavigatorProps = {
  controller: AppController;
};

export function AppNavigator({ controller }: AppNavigatorProps) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home">
        {(props) => <HomeScreen {...props} controller={controller} />}
      </Stack.Screen>
      <Stack.Screen name="Projects">
        {(props) => <ProjectsScreen {...props} controller={controller} />}
      </Stack.Screen>
      <Stack.Screen name="Chat">
        {(props) => <ChatScreen {...props} controller={controller} />}
      </Stack.Screen>
      <Stack.Screen name="Settings">
        {(props) => <SettingsScreen {...props} controller={controller} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
