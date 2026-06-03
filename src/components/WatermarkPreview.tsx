import { Ionicons } from '@expo/vector-icons';
import { t } from 'i18next';
import React from 'react';
import { Dimensions, Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WatermarkData, generateWatermarkLines } from '@/src/utils/watermarkUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface WatermarkPreviewProps {
  visible: boolean;
  imageUri: string;
  watermarkData: WatermarkData;
  onAccept: () => void;
  onRetry: () => void;
}

export const WatermarkPreview: React.FC<WatermarkPreviewProps> = ({
  visible,
  imageUri,
  watermarkData,
  onAccept,
  onRetry,
}) => {
  // Create watermark text lines
  const watermarkLines = generateWatermarkLines(watermarkData);
  const insets = useSafeAreaInsets()
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onRetry}
    >
      <View style={[styles.container, { marginBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('common.photoPreview')}</Text>
          <Text style={styles.headerSubtitle}>{t('common.photoPreviewDesc')}</Text>
        </View>

        {/* Image with watermark overlay */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
          />

          {/* Watermark overlay at bottom-right */}
          <View style={styles.watermarkContainer}>
            <View style={styles.watermarkBox}>
              {watermarkLines.map((line, index) => (
                <Text key={index} style={styles.watermarkText}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Ionicons name="refresh" size={24} color="#E74C3C" />
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
            <Ionicons name="checkmark-circle" size={24} color="#FFF" />
            <Text style={styles.acceptButtonText}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#1a1a1a',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#AAA',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: screenWidth,
    height: screenHeight - 200,
  },
  watermarkContainer: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    maxWidth: '90%',
  },
  watermarkBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // More transparent
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#3B82F6',
  },
  watermarkText: {
    color: '#FFFFFF',
    fontSize: 13, // Increased font size
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 19, // Increased line height
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4, // Stronger shadow for readability
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: '#1a1a1a',
  },
  retryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#E74C3C',
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#27AE60',
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
