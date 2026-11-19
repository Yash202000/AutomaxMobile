import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { KFF_COLORS } from './kffTheme';

interface KffReasonModalProps {
  visible: boolean;
  title: string;
  submitLabel: string;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}

// Asks for a (required) reason before a reject transition runs.
const KffReasonModal = ({ visible, title, submitLabel, submitting, onCancel, onSubmit }: KffReasonModalProps) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  const canSubmit = reason.trim().length > 0 && !submitting;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : onCancel} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.label}>{t('kff.detail.rejectReason')}</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder={t('kff.detail.rejectReasonPlaceholder')}
            placeholderTextColor={KFF_COLORS.textMuted}
            multiline
            autoFocus
            textAlignVertical="top"
            maxLength={500}
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancel} onPress={onCancel} disabled={submitting}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submit, !canSubmit && styles.disabled]}
              onPress={() => onSubmit(reason.trim())}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator color={KFF_COLORS.white} />
              ) : (
                <Text style={styles.submitText}>{submitLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(17,24,39,0.45)',
  },
  sheet: {
    backgroundColor: KFF_COLORS.white,
    borderRadius: 22,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: KFF_COLORS.navy,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: KFF_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'left',
  },
  input: {
    minHeight: 100,
    borderWidth: 1.5,
    borderColor: '#E3E6EE',
    borderRadius: 14,
    backgroundColor: '#F7F8FB',
    padding: 12,
    fontSize: 15,
    color: KFF_COLORS.text,
    textAlign: 'left',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  cancel: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: KFF_COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: KFF_COLORS.textSecondary,
  },
  submit: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: KFF_COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: KFF_COLORS.white,
  },
});

export default KffReasonModal;
