import { StatusBar } from 'expo-status-bar';
import type { StackScreenProps } from '@react-navigation/stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppController } from '../hooks/useAppController';
import type { RootStackParamList } from '../navigation/types';

type Props = StackScreenProps<RootStackParamList, 'Home'> & {
  controller: AppController;
};

export function HomeScreen({ controller, navigation }: Props) {
  const { endpoints, openAddEndpointModal, openEditEndpointModal, t } = controller;

  const handleOpenChat = (endpointId: string) => {
    const endpoint = endpoints.find((item) => item.id === endpointId);
    if (!endpoint) return;

    navigation.navigate('Projects', { endpointId: endpoint.id });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <View style={styles.topActions}>
        <View style={styles.spacer} />
        <Pressable style={styles.settingsButton} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settingsButtonText}>{t('settings')}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {endpoints.map((endpoint) => (
          <Pressable key={endpoint.id} style={styles.endpointCard} onPress={() => handleOpenChat(endpoint.id)}>
            <View style={styles.endpointRow}>
              <View style={styles.endpointInfo}>
                <Text style={styles.endpointTitle}>{endpoint.name}</Text>
                <Text style={styles.endpointAddress}>{endpoint.baseUrl}</Text>
              </View>
              <Pressable
                style={styles.endpointEditButton}
                onPress={(event) => {
                  event.stopPropagation();
                  openEditEndpointModal(endpoint);
                }}
              >
                <Text style={styles.endpointEditButtonText}>{t('editAction')}</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}

        {!endpoints.length && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('noEndpointTitle')}</Text>
            <Text style={styles.emptySub}>{t('noEndpointHint')}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={[styles.button, styles.buttonPrimary]} onPress={openAddEndpointModal}>
          <Text style={styles.buttonText}>{t('addEndpoint')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f3efe7',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  spacer: {
    minWidth: 56,
  },
  settingsButton: {
    minWidth: 56,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c8b49c',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff8ed',
  },
  settingsButtonText: {
    color: '#3f3225',
    fontWeight: '700',
    fontSize: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 14,
    gap: 10,
  },
  endpointCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbcbb8',
    backgroundColor: '#fff9ef',
    padding: 12,
  },
  endpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  endpointInfo: {
    flex: 1,
  },
  endpointTitle: {
    color: '#31271d',
    fontSize: 16,
    fontWeight: '700',
  },
  endpointAddress: {
    color: '#6b5641',
    fontSize: 12,
  },
  endpointEditButton: {
    marginLeft: 10,
    paddingVertical: 6,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endpointEditButtonText: {
    color: '#3f3225',
    fontWeight: '700',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbcbb8',
    backgroundColor: '#fff9ef',
    padding: 14,
  },
  emptyTitle: {
    fontSize: 15,
    color: '#31271d',
    fontWeight: '700',
  },
  emptySub: {
    marginTop: 6,
    color: '#6b5641',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  button: {
    flex: 1,
    borderRadius: 10,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#264c3d',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
