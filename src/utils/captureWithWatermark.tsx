import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export interface WatermarkOverlayData {
  latitude?: number;
  longitude?: number;
  userName?: string;
  timestamp?: Date;
  appName?: string;
}

/**
 * Render component with watermark overlay for capture
 * Note: This requires react-native-view-shot to be installed
 * Run: npx expo install react-native-view-shot
 */
export const WatermarkOverlay: React.FC<{
  imageUri: string;
  data: WatermarkOverlayData;
}> = ({ imageUri, data }) => {
  const { width: screenWidth } = Dimensions.get('window');
  const imageHeight = screenWidth * 1.33; // 4:3 aspect ratio

  // Create watermark text
  const watermarkLines: string[] = [];

  // Line 1: Lat/Long (Primary info)
  if (data.latitude !== undefined && data.longitude !== undefined) {
    watermarkLines.push(`📍 ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`);
  }

  // Line 2: Date and Time
  const timestamp = data.timestamp || new Date();
  const dateStr = timestamp.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = timestamp.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  watermarkLines.push(`🕐 ${dateStr} ${timeStr}`);

  // Line 3: User name
  if (data.userName) {
    watermarkLines.push(`👤 ${data.userName}`);
  }

  // Line 4: App name
  const appName = data.appName || 'Automax';
  watermarkLines.push(appName);

  return (
    <View style={[styles.container, { width: screenWidth, height: imageHeight }]}>
      <Image
        source={{ uri: imageUri }}
        style={styles.image}
        resizeMode="cover"
      />

      {/* Watermark at bottom-right */}
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
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  watermarkContainer: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    maxWidth: '90%',
  },
  watermarkBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  watermarkText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

/**
 * Capture the watermarked image
 * Requires: react-native-view-shot
 */
export async function captureWatermarkedImage(
  viewRef: any,
  originalUri: string
): Promise<string> {
  try {
    // Check if view-shot is available
    let captureRef: any;
    try {
      captureRef = require('react-native-view-shot');
    } catch (e) {
      console.warn('[Watermark] react-native-view-shot not installed');
      console.warn('[Watermark] Run: npx expo install react-native-view-shot');
      console.warn('[Watermark] Returning original image without visual watermark');
      return originalUri;
    }

    if (!viewRef || !viewRef.current) {
      console.warn('[Watermark] View ref not available');
      return originalUri;
    }

    // Capture the view as image
    const uri = await captureRef.captureRef(viewRef, {
      format: 'jpg',
      quality: 0.9,
      result: 'tmpfile',
    });

    console.log('[Watermark] Visual watermark applied successfully');
    return uri;
  } catch (error) {
    console.error('[Watermark] Error capturing watermarked image:', error);
    return originalUri;
  }
}

/**
 * Simple text-based watermark (fallback if view-shot not available)
 */
export function createSimpleWatermark(data: WatermarkOverlayData): string {
  const parts: string[] = [];

  if (data.latitude !== undefined && data.longitude !== undefined) {
    parts.push(`📍 ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`);
  }

  const timestamp = data.timestamp || new Date();
  parts.push(timestamp.toLocaleString('en-GB'));

  if (data.userName) {
    parts.push(`👤 ${data.userName}`);
  }

  parts.push(data.appName || 'Automax');

  return parts.join(' | ');
}
