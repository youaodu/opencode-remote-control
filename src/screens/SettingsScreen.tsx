import { StatusBar } from 'expo-status-bar';
import type { StackScreenProps } from '@react-navigation/stack';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppController } from '../hooks/useAppController';
import type { RootStackParamList } from '../navigation/types';

type Props = StackScreenProps<RootStackParamList, 'Settings'> & {
  controller: AppController;
};

export function SettingsScreen({ controller, navigation }: Props) {
  const { locale, switchLocale, t } = controller;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{t('cancel')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('settingsTitle')}</Text>
        <View style={styles.rightSpacer} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('languageLabel')}</Text>
        <View style={styles.localeRow}>
          <Pressable
            onPress={() => void switchLocale('en')}
            style={[styles.localeButton, locale === 'en' ? styles.localeButtonActive : undefined]}
          >
            <Text style={styles.localeButtonText}>EN</Text>
          </Pressable>
          <Pressable
            onPress={() => void switchLocale('zh')}
            style={[styles.localeButton, locale === 'zh' ? styles.localeButtonActive : undefined]}
          >
            <Text style={styles.localeButtonText}>ZH</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f3efe7',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e3dacd',
    backgroundColor: '#f7f2ea',
  },
  backButton: {
    minWidth: 56,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c8b49c',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff8ed',
  },
  backButtonText: {
    color: '#3f3225',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#31271d',
  },
  rightSpacer: {
    minWidth: 56,
  },
  card: {
    margin: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbcbb8',
    backgroundColor: '#fff9ef',
    gap: 10,
  },
  label: {
    color: '#6b5641',
    fontSize: 13,
  },
  localeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  localeButton: {
    minWidth: 52,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c8b49c',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff8ed',
  },
  localeButtonActive: {
    backgroundColor: '#d4bea2',
    borderColor: '#b08e67',
  },
  localeButtonText: {
    color: '#3f3225',
    fontWeight: '700',
    fontSize: 12,
  },
});
