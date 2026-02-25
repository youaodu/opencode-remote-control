import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AppController } from '../hooks/useAppController';

type EndpointModalProps = {
  controller: AppController;
};

export function EndpointModal({ controller }: EndpointModalProps) {
  const {
    endpointModalVisible,
    endpointEditId,
    endpointNameInput,
    gatewayInput,
    gatewayError,
    endpoints,
    setEndpointNameInput,
    setGatewayInput,
    closeEndpointModal,
    saveEndpoint,
    t,
  } = controller;

  return (
    <Modal transparent animationType="fade" visible={endpointModalVisible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{endpointEditId ? t('editEndpoint') : t('addEndpoint')}</Text>
          <Text style={styles.modalHint}>{t('setGatewayHint')}</Text>

          <Text style={styles.modalLabel}>{t('endpointNameLabel')}</Text>
          <TextInput
            value={endpointNameInput}
            onChangeText={setEndpointNameInput}
            autoCapitalize="words"
            placeholder={t('endpointNamePlaceholder')}
            placeholderTextColor="#7b7266"
            style={styles.modalInput}
          />

          <Text style={styles.modalLabel}>{t('endpointAddressLabel')}</Text>
          <TextInput
            value={gatewayInput}
            onChangeText={setGatewayInput}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('gatewayPlaceholder')}
            placeholderTextColor="#7b7266"
            style={styles.modalInput}
          />

          {!!gatewayError && <Text style={styles.modalError}>{gatewayError}</Text>}

          <View style={styles.modalActions}>
            {!!endpoints.length && (
              <Pressable style={[styles.button, styles.buttonDisabled]} onPress={closeEndpointModal}>
                <Text style={styles.buttonText}>{t('cancel')}</Text>
              </Pressable>
            )}
            <Pressable style={[styles.button, styles.buttonPrimary]} onPress={() => void saveEndpoint()}>
              <Text style={styles.buttonText}>{t('save')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  modalHint: {
    marginTop: 6,
    color: '#6b5641',
    fontSize: 12,
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
  modalError: {
    marginTop: 8,
    color: '#9a312d',
    fontSize: 12,
  },
  modalActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
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
  buttonDisabled: {
    backgroundColor: '#b9b8b4',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
