import { StatusBar } from 'expo-status-bar';
import type { StackScreenProps } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef } from 'react';
import Markdown from 'react-native-markdown-display';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppController } from '../hooks/useAppController';
import type { RootStackParamList } from '../navigation/types';

type Props = StackScreenProps<RootStackParamList, 'Chat'> & {
  controller: AppController;
};

const markdownStyles = StyleSheet.create({
  body: {
    color: '#2f2a23',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 0,
    marginBottom: 0,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  heading1: {
    color: '#2f2a23',
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 10,
  },
  heading2: {
    color: '#2f2a23',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 10,
  },
  heading3: {
    color: '#2f2a23',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 8,
  },
  bullet_list: {
    marginTop: 0,
    marginBottom: 8,
  },
  ordered_list: {
    marginTop: 0,
    marginBottom: 8,
  },
  list_item: {
    color: '#2f2a23',
  },
  strong: {
    fontWeight: '700',
  },
  em: {
    fontStyle: 'italic',
  },
  code_inline: {
    backgroundColor: '#efe4cf',
    color: '#3f3121',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  code_block: {
    backgroundColor: '#f1e7d5',
    color: '#3f3121',
    borderRadius: 8,
    padding: 10,
    marginTop: 2,
    marginBottom: 10,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  fence: {
    backgroundColor: '#f1e7d5',
    color: '#3f3121',
    borderRadius: 8,
    padding: 10,
    marginTop: 2,
    marginBottom: 10,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  blockquote: {
    borderLeftColor: '#c8a77c',
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginLeft: 0,
    color: '#4a3c2e',
  },
  link: {
    color: '#264c3d',
    textDecorationLine: 'underline',
  },
});

export function ChatScreen({ controller, navigation }: Props) {
  const {
    activeEndpoint,
    input,
    setInput,
    selectedImage,
    setSelectedImage,
    messages,
    canSend,
    isStreaming,
    sendMessage,
    stopStreaming,
    t,
  } = controller;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('imagePermissionDenied'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.9,
      base64: true,
    });
    if (result.canceled) return;

    const image = result.assets[0];
    if (!image?.uri) return;

    const mime = image.mimeType ?? 'image/jpeg';
    if (!image.base64) {
      Alert.alert(t('imageReadFailed'));
      return;
    }
    const fallbackExt = mime.includes('/') ? mime.split('/')[1] : 'jpg';
    const filename = image.fileName ?? `image_${Date.now()}.${fallbackExt}`;
    setSelectedImage({
      uri: image.uri,
      mime,
      filename,
      dataUrl: `data:${mime};base64,${image.base64}`,
    });
  };

  if (!activeEndpoint) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{t('noEndpointTitle')}</Text>
          <Pressable style={[styles.button, styles.buttonPrimary]} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.buttonText}>{t('switchEndpoint')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listContent}>
          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubble,
                m.role === 'user'
                  ? styles.userBubble
                  : m.role === 'assistant'
                    ? styles.assistantBubble
                    : styles.systemBubble,
              ]}
            >
              <Text style={styles.role}>{m.role.toUpperCase()}</Text>
              {m.imageUri ? <Image source={{ uri: m.imageUri }} style={styles.messageImage} resizeMode="cover" /> : null}
              <Markdown style={markdownStyles}>{m.content || (m.streaming ? '...' : '')}</Markdown>
            </View>
          ))}
        </ScrollView>

        {selectedImage ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="cover" />
            <Pressable onPress={() => setSelectedImage(null)} style={styles.previewRemoveBtn}>
              <Text style={styles.previewRemoveText}>x</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('placeholder')}
            placeholderTextColor="#6f6f73"
            multiline
            style={styles.input}
          />
          <Pressable onPress={() => void handlePickImage()} style={styles.addImageButton}>
            <Text style={styles.addImageButtonText}>+</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={sendMessage}
            disabled={!canSend}
            style={[styles.button, !canSend ? styles.buttonDisabled : styles.buttonPrimary]}
          >
            <Text style={styles.buttonText}>{t('send')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void stopStreaming()}
            disabled={!isStreaming}
            style={[styles.button, !isStreaming ? styles.buttonDisabled : styles.buttonSecondary]}
          >
            <Text style={styles.buttonText}>{t('stop')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f3efe7',
  },
  wrap: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 14,
    gap: 10,
  },
  bubble: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: '#e9f6f0',
    borderColor: '#cce8db',
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  assistantBubble: {
    backgroundColor: '#fffaf1',
    borderColor: '#eddcb8',
    alignSelf: 'flex-start',
    maxWidth: '95%',
  },
  systemBubble: {
    backgroundColor: '#f6f6f7',
    borderColor: '#e2e2e4',
    alignSelf: 'center',
    maxWidth: '100%',
  },
  role: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#7f6f5c',
    marginBottom: 4,
    fontWeight: '700',
  },
  messageImage: {
    width: 176,
    height: 176,
    borderRadius: 10,
    marginBottom: 8,
  },
  previewWrap: {
    alignSelf: 'flex-start',
    marginTop: 6,
    marginLeft: 12,
    width: 74,
    height: 74,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d4c5af',
    backgroundColor: '#fffdf8',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRemoveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4c5af',
    backgroundColor: '#fffdf8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#30251a',
    fontSize: 15,
  },
  addImageButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4c5af',
    backgroundColor: '#fffdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButtonText: {
    color: '#3a2d21',
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '700',
    marginTop: -2,
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
  buttonSecondary: {
    backgroundColor: '#8a5b40',
  },
  buttonDisabled: {
    backgroundColor: '#b9b8b4',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyTitle: {
    color: '#31271d',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
