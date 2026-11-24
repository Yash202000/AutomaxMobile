import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KFF_COLORS } from './kffTheme';
import type { KffAttachmentSource } from './useKffIncidentFollowUp';

const OPTIONS: { source: KffAttachmentSource; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { source: 'camera', icon: 'camera-outline' },
  { source: 'gallery', icon: 'images-outline' },
  // "Choose File" is off for now — add it back to re-enable document uploads:
  // { source: 'document', icon: 'document-attach-outline' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (source: KffAttachmentSource) => void;
}

// Bottom sheet for "Add Attachments": camera, photo library or a file.
const KffAttachmentSourceSheet = ({ visible, onClose, onSelect }: Props) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('kff.detail.addAttachments')}</Text>
          {OPTIONS.map(({ source, icon }) => (
            <TouchableOpacity
              key={source}
              style={styles.option}
              activeOpacity={0.85}
              onPress={() => onSelect(source)}
            >
              <View style={styles.optionIcon}>
                <Ionicons name={icon} size={22} color={KFF_COLORS.primary} />
              </View>
              <Text style={styles.optionText}>{t(`kff.detail.attachFrom.${source}`)}</Text>
              <Ionicons name="chevron-forward" size={18} color={KFF_COLORS.textMuted} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17,24,39,0.45)',
  },
  sheet: {
    backgroundColor: KFF_COLORS.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: KFF_COLORS.divider,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: KFF_COLORS.navy,
    textAlign: 'center',
    marginBottom: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#F7F8FB',
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: KFF_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: KFF_COLORS.text,
    textAlign: 'left',
  },
  cancel: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: KFF_COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: KFF_COLORS.textSecondary,
  },
});

export default KffAttachmentSourceSheet;
