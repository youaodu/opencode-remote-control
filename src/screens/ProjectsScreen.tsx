import { StatusBar } from 'expo-status-bar';
import type { StackScreenProps } from '@react-navigation/stack';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppController } from '../hooks/useAppController';
import type { RootStackParamList } from '../navigation/types';
import { buildApiUrl } from '../utils/chatApi';

type Props = StackScreenProps<RootStackParamList, 'Projects'> & {
  controller: AppController;
};

type ProjectItem = {
  id: string;
  worktree: string;
  name: string;
};

type ProjectPage = {
  items: ProjectItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

function parseProjects(payload: unknown): ProjectItem[] {
  if (!Array.isArray(payload)) return [];

  const result: ProjectItem[] = [];
  payload.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const obj = item as Record<string, unknown>;
    const worktree = typeof obj.worktree === 'string' ? obj.worktree.trim() : '';
    if (!worktree) return;

    const id = typeof obj.id === 'string' && obj.id ? obj.id : `project_${index}`;
    const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : worktree;
    result.push({ id, worktree, name });
  });

  return result;
}

function parseProjectPage(payload: unknown): ProjectPage {
  if (Array.isArray(payload)) {
    return {
      items: parseProjects(payload),
      hasMore: false,
      nextCursor: null,
    };
  }

  if (!payload || typeof payload !== 'object') {
    return {
      items: [],
      hasMore: false,
      nextCursor: null,
    };
  }

  const obj = payload as Record<string, unknown>;
  const listLike =
    obj.items ?? obj.projects ?? obj.data ?? obj.list ?? obj.rows ?? obj.records ?? obj.results ?? [];
  const items = parseProjects(listLike);

  const nextCursor = typeof obj.nextCursor === 'string' && obj.nextCursor ? obj.nextCursor : null;
  const hasMoreFromFlag = typeof obj.hasMore === 'boolean' ? obj.hasMore : null;
  const hasNextFromFlag = typeof obj.hasNext === 'boolean' ? obj.hasNext : null;
  const page = typeof obj.page === 'number' ? obj.page : null;
  const totalPages = typeof obj.totalPages === 'number' ? obj.totalPages : null;

  const hasMore =
    hasMoreFromFlag ??
    hasNextFromFlag ??
    (nextCursor !== null ? true : null) ??
    (page !== null && totalPages !== null ? page < totalPages : null) ??
    false;

  return {
    items,
    hasMore,
    nextCursor,
  };
}

function mergeProjects(existing: ProjectItem[], incoming: ProjectItem[]): ProjectItem[] {
  if (!incoming.length) return existing;
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  incoming.forEach((item) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  });
  return merged;
}

export function ProjectsScreen({ controller, navigation, route }: Props) {
  const { endpoints, enterEndpoint, setActiveDirectory, t } = controller;
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextPage, setNextPage] = useState(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [newProjectModalVisible, setNewProjectModalVisible] = useState(false);
  const [newProjectDirInput, setNewProjectDirInput] = useState('');

  const endpoint = endpoints.find((item) => item.id === route.params.endpointId) ?? null;

  useEffect(() => {
    if (!endpoint) {
      setProjects([]);
      setLoadError(true);
      setLoading(false);
      return;
    }

    const abortController = new AbortController();
    const loadProjects = async () => {
      setLoading(true);
      setLoadError(false);
      setNextPage(1);
      setNextCursor(null);

      try {
        const response = await fetch(
          buildApiUrl(endpoint.baseUrl, '/project', {
            directory: '',
            page: 1,
            pageSize: 20,
            limit: 20,
          }),
          {
            method: 'GET',
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          setProjects([]);
          setHasMore(false);
          setLoadError(true);
          setLoading(false);
          return;
        }

        const payload = (await response.json()) as unknown;
        const pageData = parseProjectPage(payload);

        setProjects(pageData.items);
        setHasMore(pageData.hasMore);
        setNextCursor(pageData.nextCursor);
        setNextPage(2);
        setLoading(false);
      } catch {
        if (abortController.signal.aborted) {
          return;
        }
        setProjects([]);
        setHasMore(false);
        setLoadError(true);
        setLoading(false);
      }
    };

    void loadProjects();

    return () => {
      abortController.abort();
    };
  }, [endpoint]);

  const handleLoadMore = async () => {
    if (!endpoint || loading || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const response = await fetch(
        buildApiUrl(endpoint.baseUrl, '/project', {
          directory: '',
          page: nextPage,
          pageSize: 20,
          limit: 20,
          cursor: nextCursor ?? undefined,
        }),
        {
          method: 'GET',
        },
      );

      if (!response.ok) {
        setLoadingMore(false);
        return;
      }

      const payload = (await response.json()) as unknown;
      const pageData = parseProjectPage(payload);

      setProjects((prev) => mergeProjects(prev, pageData.items));
      setHasMore(pageData.hasMore);
      setNextCursor(pageData.nextCursor);
      setNextPage((prev) => prev + 1);
      setLoadingMore(false);
    } catch {
      setLoadingMore(false);
    }
  };

  const handleSubmitNewProject = () => {
    const normalizedPath = newProjectDirInput.trim();
    if (!normalizedPath) return;

    setNewProjectModalVisible(false);
    setNewProjectDirInput('');
  };

  const handleOpenChat = async (projectDirectory: string) => {
    if (!endpoint) return;
    setActiveDirectory(projectDirectory);
    await enterEndpoint(endpoint, { skipStoredSession: true });
    navigation.navigate('Chat');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{t('cancel')}</Text>
        </Pressable>
        <Text style={styles.title}>{endpoint?.name ?? t('projectListTitle')}</Text>
        <View style={styles.rightSpacer} />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {loading ? <Text style={styles.tip}>{t('projectDirsLoading')}</Text> : null}
        {!loading && loadError ? <Text style={styles.tip}>{t('projectDirsError')}</Text> : null}
        {!loading && !loadError && !projects.length ? <Text style={styles.tip}>{t('projectDirsEmpty')}</Text> : null}
        {!loading && !loadError
          ? projects.map((project) => (
              <Pressable
                key={project.id}
                onPress={() => void handleOpenChat(project.worktree)}
                style={({ pressed }) => [styles.projectCard, pressed ? styles.projectCardPressed : null]}
              >
                <Text style={styles.projectName}>{project.name}</Text>
                <Text style={styles.projectPath}>{project.worktree}</Text>
              </Pressable>
            ))
          : null}
        {!loading && !loadError && hasMore ? (
          <Pressable
            onPress={() => void handleLoadMore()}
            disabled={loadingMore}
            style={({ pressed }) => [
              styles.loadMoreButton,
              loadingMore ? styles.loadMoreButtonDisabled : null,
              pressed && !loadingMore ? styles.projectCardPressed : null,
            ]}
          >
            <Text style={styles.loadMoreButtonText}>{loadingMore ? t('projectLoadingMore') : t('projectLoadMore')}</Text>
          </Pressable>
        ) : null}
        {!loading && !loadError && projects.length > 0 && !hasMore ? <Text style={styles.tip}>{t('projectNoMore')}</Text> : null}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={[styles.button, styles.buttonPrimary]} onPress={() => setNewProjectModalVisible(true)}>
          <Text style={styles.buttonText}>{t('openChat')}</Text>
        </Pressable>
      </View>

      <Modal transparent animationType="fade" visible={newProjectModalVisible}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('newProjectTitle')}</Text>
            <Text style={styles.modalLabel}>{t('projectDirLabel')}</Text>
            <TextInput
              value={newProjectDirInput}
              onChangeText={setNewProjectDirInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t('projectDirPlaceholder')}
              placeholderTextColor="#7b7266"
              style={styles.modalInput}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setNewProjectModalVisible(false);
                }}
              >
                <Text style={styles.modalCancelButtonText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  newProjectDirInput.trim() ? styles.modalSaveButton : styles.modalSaveButtonDisabled,
                ]}
                disabled={!newProjectDirInput.trim()}
                onPress={handleSubmitNewProject}
              >
                <Text style={styles.modalSaveButtonText}>{t('save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: 0,
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  tip: {
    color: '#6b5641',
    fontSize: 12,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  projectCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbcbb8',
    backgroundColor: '#fff9ef',
    padding: 12,
  },
  projectCardPressed: {
    opacity: 0.75,
  },
  projectName: {
    color: '#31271d',
    fontSize: 14,
    fontWeight: '700',
  },
  projectPath: {
    marginTop: 4,
    color: '#6b5641',
    fontSize: 12,
  },
  loadMoreButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c8b49c',
    backgroundColor: '#fff8ed',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loadMoreButtonDisabled: {
    opacity: 0.7,
  },
  loadMoreButtonText: {
    color: '#3f3225',
    fontSize: 14,
    fontWeight: '700',
  },
  actions: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  button: {
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(35, 28, 21, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbcbb8',
    backgroundColor: '#fff9ef',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#31271d',
  },
  modalLabel: {
    marginTop: 10,
    color: '#6b5641',
    fontSize: 12,
  },
  modalInput: {
    marginTop: 6,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4c5af',
    backgroundColor: '#fffdf8',
    paddingHorizontal: 12,
    color: '#30251a',
    fontSize: 14,
  },
  modalActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalCancelButton: {
    borderColor: '#c8b49c',
    backgroundColor: '#fff8ed',
  },
  modalSaveButton: {
    borderColor: '#264c3d',
    backgroundColor: '#264c3d',
  },
  modalSaveButtonDisabled: {
    borderColor: '#b9b8b4',
    backgroundColor: '#b9b8b4',
  },
  modalCancelButtonText: {
    color: '#3f3225',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSaveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
