import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';

interface WatermarkOverlayProps {
  imageUri: string;
  userName?: string;
  timestamp?: string;
  location?: string;
  appName?: string;
}

/**
 * Component that renders an image with watermark overlay
 * Use with react-native-view-shot to capture as a new image
 */
export const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({
  imageUri,
  userName,
  timestamp,
  location,
  appName = 'Automax',
}) => {
  const now = timestamp || new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />

      {/* Watermark overlay at bottom */}
      <View style={styles.watermarkContainer}>
        <View style={styles.watermarkBackground}>
          <Text style={styles.watermarkText}>
            {appName} {userName ? `| ${userName}` : ''} | {now}
          </Text>
          {location && (
            <Text style={styles.watermarkSubText}>
              📍 {location}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  watermarkContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
  },
  watermarkBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  watermarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  watermarkSubText: {
    color: '#FFFFFF',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'left',
  },
});
