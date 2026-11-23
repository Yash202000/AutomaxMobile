import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { KFF_COLORS } from './kffTheme';

interface KffCommentModalProps {
  visible: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (comment: string) => void;
}

// Comment box for the KFF incident detail screen's "Add Comments" button.
const KffCommentModal = ({ visible, submitting, onCancel, onSubmit }: KffCommentModalProps) => {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (visible) setComment('');
  }, [visible]);

  const canSubmit = comment.trim().length > 0 && !submitting;
  const close = submitting ? undefined : onCancel;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('kff.detail.addComments')}</Text>
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder={t('kff.detail.commentPlaceholder')}
            placeholderTextColor={KFF_COLORS.textMuted}
            multiline
            autoFocus
            textAlignVertical="top"
            maxLength={1000}
            editable={!submitting}
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancel} onPress={onCancel} disabled={submitting}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submit, !canSubmit && styles.disabled]}
              onPress={() => onSubmit(comment.trim())}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator color={KFF_COLORS.white} />
              ) : (
                <Text style={styles.submitText}>{t('kff.detail.postComment')}</Text>
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
    marginBottom: 16,
  },
  input: {
    minHeight: 110,
    maxHeight: 220,
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
    backgroundColor: KFF_COLORS.primary,
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

export default KffCommentModal;
