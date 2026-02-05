import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WatermarkData {
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  userName?: string;
  timestamp?: Date;
  appName?: string;
}

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
  // Create watermark text lines (compact version)
  const watermarkLines: string[] = [];

  console.log('[WatermarkPreview] Received data:', {
    latitude: watermarkData.latitude,
    longitude: watermarkData.longitude,
    address: watermarkData.address,
    city: watermarkData.city,
    state: watermarkData.state,
    userName: watermarkData.userName,
  });

  // Line 1: Coordinates + Location in one line
  let line1 = '';
  if (watermarkData.latitude !== undefined && watermarkData.longitude !== undefined) {
    line1 = `${watermarkData.latitude.toFixed(5)}, ${watermarkData.longitude.toFixed(5)}`;
  }

  // Add city or address to same line if available
  if (watermarkData.city) {
    console.log('[WatermarkPreview] Adding city:', watermarkData.city);
    line1 += line1 ? ` • ${watermarkData.city}` : watermarkData.city;
  } else if (watermarkData.address) {
    console.log('[WatermarkPreview] Adding address:', watermarkData.address);
    const shortAddress = watermarkData.address.length > 20 ? watermarkData.address.substring(0, 20) + '...' : watermarkData.address;
    line1 += line1 ? ` • ${shortAddress}` : shortAddress;
  } else {
    console.log('[WatermarkPreview] ⚠️ No city or address available!');
  }

  if (line1) {
    console.log('[WatermarkPreview] Line 1:', line1);
    watermarkLines.push(line1);
  }

  // Line 2: Date, Time, User in one line
  const timestamp = watermarkData.timestamp || new Date();
  const dateStr = timestamp.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit', // Shortened year
  });
  const timeStr = timestamp.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  let line2 = `${dateStr} ${timeStr}`;
  if (watermarkData.userName) {
    const shortName = watermarkData.userName.length > 15 ? watermarkData.userName.substring(0, 15) + '...' : watermarkData.userName;
    line2 += ` • ${shortName}`;
  }
  watermarkLines.push(line2);

  // Line 3: Full address (street/area) if available
  if (watermarkData.address) {
    console.log('[WatermarkPreview] Adding full address line:', watermarkData.address);
    const fullAddress = watermarkData.address.length > 40 ? watermarkData.address.substring(0, 40) + '...' : watermarkData.address;
    watermarkLines.push(fullAddress);
  } else if (watermarkData.state && !watermarkData.city) {
    // If we have state but not city, show state on separate line
    console.log('[WatermarkPreview] Adding state line:', watermarkData.state);
    watermarkLines.push(watermarkData.state);
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onRetry}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Photo Preview</Text>
          <Text style={styles.headerSubtitle}>Review your photo with watermark</Text>
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
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
            <Ionicons name="checkmark-circle" size={24} color="#FFF" />
            <Text style={styles.acceptButtonText}>Accept</Text>
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
