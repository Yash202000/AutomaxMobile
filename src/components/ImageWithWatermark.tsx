import React, { useRef } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface ImageWithWatermarkProps {
  imageUri: string;
  watermarkText: string;
  onCapture?: (uri: string) => void;
}

/**
 * Component that renders an image with watermark text overlay
 * This can be captured using react-native-view-shot
 */
export const ImageWithWatermark = React.forwardRef<View, ImageWithWatermarkProps>(
  ({ imageUri, watermarkText }, ref) => {
    return (
      <View ref={ref} style={styles.container} collapsable={false}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
        <View style={styles.watermarkContainer}>
          <View style={styles.watermarkBox}>
            <Text style={styles.watermarkText}>{watermarkText}</Text>
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  watermarkContainer: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  watermarkBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  watermarkText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
});
