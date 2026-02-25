import { StatusBar } from 'expo-status-bar';
import type { StackScreenProps } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
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
    pendingPermissions,
    pendingQuestions,
    canSend,
    isStreaming,
    sendMessage,
    stopStreaming,
    replyPermissionRequest,
    replyQuestionRequest,
    rejectQuestionRequest,
    t,
  } = controller;
  const scrollRef = useRef<ScrollView>(null);
  const [rejectingPermissionId, setRejectingPermissionId] = useState<string | null>(null);
  const [rejectMessage, setRejectMessage] = useState('');
  const [questionSelections, setQuestionSelections] = useState<Record<string, string[][]>>({});
  const [questionCustomValues, setQuestionCustomValues] = useState<Record<string, Record<number, string>>>({});

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    if (!rejectingPermissionId) return;
    if (pendingPermissions.some((item) => item.id === rejectingPermissionId)) return;
    setRejectingPermissionId(null);
    setRejectMessage('');
  }, [pendingPermissions, rejectingPermissionId]);

  useEffect(() => {
    const activeIds = new Set(pendingQuestions.map((item) => item.id));

    setQuestionSelections((prev) => {
      const next: Record<string, string[][]> = {};
      Object.entries(prev).forEach(([requestId, answers]) => {
        if (activeIds.has(requestId)) {
          next[requestId] = answers;
        }
      });
      return next;
    });

    setQuestionCustomValues((prev) => {
      const next: Record<string, Record<number, string>> = {};
      Object.entries(prev).forEach(([requestId, values]) => {
        if (activeIds.has(requestId)) {
          next[requestId] = values;
        }
      });
      return next;
    });
  }, [pendingQuestions]);

  const visiblePermissions = [...pendingPermissions].sort((a, b) => a.createdAt - b.createdAt);
  const visibleQuestions = [...pendingQuestions].sort((a, b) => a.createdAt - b.createdAt);

  const handlePermissionReply = async (requestId: string, reply: 'once' | 'always' | 'reject') => {
    const ok = await replyPermissionRequest(requestId, reply, reply === 'reject' ? rejectMessage : undefined);
    if (!ok) return;

    if (rejectingPermissionId === requestId) {
      setRejectingPermissionId(null);
      setRejectMessage('');
    }
  };

  const updateQuestionChoice = (
    requestId: string,
    questionIndex: number,
    label: string,
    multiple: boolean,
  ) => {
    setQuestionSelections((prev) => {
      const nextAnswers = [...(prev[requestId] ?? [])];
      const current = nextAnswers[questionIndex] ?? [];

      if (multiple) {
        nextAnswers[questionIndex] = current.includes(label)
          ? current.filter((item) => item !== label)
          : [...current, label];
      } else {
        nextAnswers[questionIndex] = [label];
      }

      return {
        ...prev,
        [requestId]: nextAnswers,
      };
    });

    setQuestionCustomValues((prev) => {
      const currentByQuestion = prev[requestId] ?? {};
      if (!currentByQuestion[questionIndex]) return prev;

      return {
        ...prev,
        [requestId]: {
          ...currentByQuestion,
          [questionIndex]: '',
        },
      };
    });
  };

  const updateQuestionCustom = (requestId: string, questionIndex: number, value: string) => {
    setQuestionCustomValues((prev) => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] ?? {}),
        [questionIndex]: value,
      },
    }));
  };

  const submitQuestionAnswers = async (requestId: string) => {
    const request = visibleQuestions.find((item) => item.id === requestId);
    if (!request) return;

    const selected = questionSelections[requestId] ?? [];
    const customValues = questionCustomValues[requestId] ?? {};

    const answers: string[][] = request.questions.map((question, index) => {
      const custom = customValues[index]?.trim() ?? '';
      if (question.customEnabled && custom) {
        return [custom];
      }

      const picked = selected[index] ?? [];
      return picked.filter((item) => !!item);
    });

    const hasEmptyAnswer = answers.some((item) => item.length === 0);
    if (hasEmptyAnswer) {
      Alert.alert(t('questionAnswerRequired'));
      return;
    }

    const ok = await replyQuestionRequest(requestId, answers);
    if (!ok) return;

    setQuestionSelections((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
    setQuestionCustomValues((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
  };

  const rejectQuestion = async (requestId: string) => {
    await rejectQuestionRequest(requestId);
  };

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

        {visibleQuestions.length ? (
          <View style={styles.questionSection}>
            {visibleQuestions.map((request) => {
              const isSubmitting = request.status === 'submitting';

              return (
                <View key={request.id} style={styles.questionCard}>
                  <Text style={styles.questionTitle}>{t('questionTitle')}</Text>

                  {request.questions.map((question, questionIndex) => {
                    const selected = questionSelections[request.id]?.[questionIndex] ?? [];
                    const customValue = questionCustomValues[request.id]?.[questionIndex] ?? '';

                    return (
                      <View key={`${request.id}_${questionIndex}`} style={styles.questionBlock}>
                        {question.header ? <Text style={styles.questionHeader}>{question.header}</Text> : null}
                        <Text style={styles.questionText}>{question.question}</Text>

                        {question.options.map((option) => {
                          const isSelected = selected.includes(option.label);
                          return (
                            <Pressable
                              key={option.label}
                              disabled={isSubmitting}
                              onPress={() =>
                                updateQuestionChoice(request.id, questionIndex, option.label, question.multiple)
                              }
                              style={[
                                styles.questionOption,
                                isSelected ? styles.questionOptionSelected : styles.questionOptionDefault,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.questionOptionLabel,
                                  isSelected ? styles.questionOptionLabelSelected : null,
                                ]}
                              >
                                {option.label}
                              </Text>
                              {option.description ? (
                                <Text style={styles.questionOptionDescription}>{option.description}</Text>
                              ) : null}
                            </Pressable>
                          );
                        })}

                        {question.customEnabled ? (
                          <TextInput
                            value={customValue}
                            onChangeText={(value) => updateQuestionCustom(request.id, questionIndex, value)}
                            placeholder={t('questionCustomPlaceholder')}
                            placeholderTextColor="#7d7060"
                            multiline
                            editable={!isSubmitting}
                            style={styles.questionCustomInput}
                          />
                        ) : null}
                      </View>
                    );
                  })}

                  {request.error ? <Text style={styles.questionError}>{request.error}</Text> : null}

                  <View style={styles.questionActionsRow}>
                    <Pressable
                      onPress={() => void submitQuestionAnswers(request.id)}
                      disabled={isSubmitting}
                      style={[styles.questionActionButton, styles.questionActionSubmit]}
                    >
                      <Text style={styles.questionActionButtonText}>{t('questionSubmit')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void rejectQuestion(request.id)}
                      disabled={isSubmitting}
                      style={[styles.questionActionButton, styles.questionActionReject]}
                    >
                      <Text style={styles.questionActionButtonText}>{t('questionReject')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {visiblePermissions.length ? (
          <View style={styles.permissionSection}>
            {visiblePermissions.map((request) => {
              const isSubmitting = request.status === 'submitting';
              const isRejecting = rejectingPermissionId === request.id;
              const path = request.filepath || request.parentDir || '-';
              const patterns = request.patterns.length ? request.patterns.join(', ') : '-';

              return (
                <View key={request.id} style={styles.permissionCard}>
                  <Text style={styles.permissionTitle}>{t('permissionTitle')}</Text>
                  <Text style={styles.permissionHint}>{t('permissionHint')}</Text>

                  <Text style={styles.permissionMeta}>
                    {t('permissionTypeLabel')}: {request.permission || '-'}
                  </Text>
                  <Text style={styles.permissionMeta}>
                    {t('permissionPathLabel')}: {path}
                  </Text>
                  <Text style={styles.permissionMeta}>
                    {t('permissionPatternLabel')}: {patterns}
                  </Text>

                  {request.error ? <Text style={styles.permissionError}>{request.error}</Text> : null}

                  {isRejecting ? (
                    <View style={styles.permissionRejectWrap}>
                      <TextInput
                        value={rejectMessage}
                        onChangeText={setRejectMessage}
                        placeholder={t('permissionRejectReasonPlaceholder')}
                        placeholderTextColor="#7d7060"
                        multiline
                        style={styles.permissionRejectInput}
                        editable={!isSubmitting}
                      />
                      <View style={styles.permissionActionsRow}>
                        <Pressable
                          onPress={() => {
                            setRejectingPermissionId(null);
                            setRejectMessage('');
                          }}
                          disabled={isSubmitting}
                          style={[styles.permissionButton, styles.permissionButtonMuted]}
                        >
                          <Text style={styles.permissionButtonText}>{t('permissionCancelReject')}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void handlePermissionReply(request.id, 'reject')}
                          disabled={isSubmitting}
                          style={[styles.permissionButton, styles.permissionButtonDanger]}
                        >
                          <Text style={styles.permissionButtonText}>{t('permissionConfirmReject')}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.permissionActionsRow}>
                      <Pressable
                        onPress={() => void handlePermissionReply(request.id, 'once')}
                        disabled={isSubmitting}
                        style={[styles.permissionButton, styles.permissionButtonPrimary]}
                      >
                        <Text style={styles.permissionButtonText}>{t('permissionAllowOnce')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void handlePermissionReply(request.id, 'always')}
                        disabled={isSubmitting}
                        style={[styles.permissionButton, styles.permissionButtonSecondary]}
                      >
                        <Text style={styles.permissionButtonText}>{t('permissionAllowAlways')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setRejectingPermissionId(request.id);
                          setRejectMessage('');
                        }}
                        disabled={isSubmitting}
                        style={[styles.permissionButton, styles.permissionButtonDanger]}
                      >
                        <Text style={styles.permissionButtonText}>{t('permissionReject')}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

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
  questionSection: {
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  questionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cdbca0',
    backgroundColor: '#fff9ef',
    padding: 10,
    gap: 8,
  },
  questionTitle: {
    color: '#392b1f',
    fontSize: 14,
    fontWeight: '700',
  },
  questionBlock: {
    gap: 6,
  },
  questionHeader: {
    color: '#6b5641',
    fontSize: 12,
    fontWeight: '700',
  },
  questionText: {
    color: '#352a20',
    fontSize: 13,
    lineHeight: 18,
  },
  questionOption: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  questionOptionDefault: {
    borderColor: '#d7c8b3',
    backgroundColor: '#fffefb',
  },
  questionOptionSelected: {
    borderColor: '#2b614c',
    backgroundColor: '#e8f3ee',
  },
  questionOptionLabel: {
    color: '#3a2d22',
    fontSize: 12,
    fontWeight: '700',
  },
  questionOptionLabelSelected: {
    color: '#1f4a3a',
  },
  questionOptionDescription: {
    color: '#6b5641',
    fontSize: 11,
    lineHeight: 15,
  },
  questionCustomInput: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4c5af',
    backgroundColor: '#fffdf8',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#30251a',
    fontSize: 13,
  },
  questionError: {
    color: '#9b2f2f',
    fontSize: 12,
    fontWeight: '600',
  },
  questionActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  questionActionButton: {
    flex: 1,
    borderRadius: 8,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  questionActionSubmit: {
    backgroundColor: '#2b614c',
  },
  questionActionReject: {
    backgroundColor: '#8d5144',
  },
  questionActionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  permissionSection: {
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  permissionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9c5a7',
    backgroundColor: '#fff6e7',
    padding: 10,
    gap: 4,
  },
  permissionTitle: {
    color: '#392b1f',
    fontSize: 14,
    fontWeight: '700',
  },
  permissionHint: {
    color: '#6b5641',
    fontSize: 12,
    marginBottom: 4,
  },
  permissionMeta: {
    color: '#4a3a2b',
    fontSize: 12,
  },
  permissionError: {
    marginTop: 4,
    color: '#9b2f2f',
    fontSize: 12,
    fontWeight: '600',
  },
  permissionRejectWrap: {
    marginTop: 6,
    gap: 8,
  },
  permissionRejectInput: {
    minHeight: 44,
    maxHeight: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4c5af',
    backgroundColor: '#fffdf8',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#30251a',
    fontSize: 13,
  },
  permissionActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  permissionButton: {
    flex: 1,
    borderRadius: 8,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  permissionButtonPrimary: {
    backgroundColor: '#2b614c',
  },
  permissionButtonSecondary: {
    backgroundColor: '#7c6a4f',
  },
  permissionButtonDanger: {
    backgroundColor: '#9a4a3d',
  },
  permissionButtonMuted: {
    backgroundColor: '#9f9c96',
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
