import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export interface WatermarkData {
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

interface WatermarkProcessorProps {
  imageUri: string;
  data: WatermarkData;
  onComplete: (watermarkedUri: string) => void;
}

/**
 * Hidden component that renders an image with watermark and captures it
 * This component auto-captures once the image loads
 */
export const WatermarkProcessor: React.FC<WatermarkProcessorProps> = ({
  imageUri,
  data,
  onComplete,
}) => {
  const viewRef = useRef<View>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [renderReady, setRenderReady] = useState(false);
  const capturedRef = useRef(false);

  // Get image dimensions
  useEffect(() => {
    console.log('[WatermarkProcessor] 🎬 Starting watermark process for:', imageUri.substring(0, 50) + '...');

    // Add timeout for getting image size
    const timeout = setTimeout(() => {
      if (!imageSize) {
        console.error('[WatermarkProcessor] ⏱️ Timeout getting image size');
        onComplete(imageUri);
      }
    }, 5000);

    Image.getSize(
      imageUri,
      (width, height) => {
        clearTimeout(timeout);
        console.log('[WatermarkProcessor] ✅ Image size:', width, 'x', height);
        setImageSize({ width, height });
      },
      (error) => {
        clearTimeout(timeout);
        console.error('[WatermarkProcessor] ❌ Failed to get image size:', error);
        // Return original image on error
        onComplete(imageUri);
      }
    );

    return () => clearTimeout(timeout);
  }, [imageUri, onComplete]);

  // Set render ready after image size is available
  useEffect(() => {
    if (imageSize) {
      // Give it a moment for React to render
      const timer = setTimeout(() => {
        console.log('[WatermarkProcessor] ✓ Render ready');
        setRenderReady(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [imageSize]);

  // Add timeout for image loading
  useEffect(() => {
    if (renderReady && !imageLoaded) {
      const timeout = setTimeout(() => {
        if (!imageLoaded) {
          console.error('[WatermarkProcessor] ⏱️ Timeout waiting for image to load');
          onComplete(imageUri);
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [renderReady, imageLoaded, imageUri, onComplete]);

  // Capture once image is loaded and rendered
  useEffect(() => {
    if (imageLoaded && renderReady && viewRef.current && !capturedRef.current) {
      capturedRef.current = true;

      // Delay to ensure complete rendering
      setTimeout(async () => {
        try {
          if (!viewRef.current) {
            console.error('[WatermarkProcessor] ❌ View ref lost');
            onComplete(imageUri);
            return;
          }

          console.log('[WatermarkProcessor] 📸 Capturing watermarked image...');
          const uri = await captureRef(viewRef, {
            format: 'jpg',
            quality: 0.9,
            result: 'tmpfile',
          });

          if (uri) {
            console.log('[WatermarkProcessor] ✅ Watermark applied successfully!');
            console.log('[WatermarkProcessor] Output:', uri.substring(0, 50) + '...');
            onComplete(uri);
          } else {
            console.error('[WatermarkProcessor] ❌ Capture returned null/undefined');
            onComplete(imageUri);
          }
        } catch (error) {
          console.error('[WatermarkProcessor] ❌ Capture error:', error);
          console.error('[WatermarkProcessor] Error details:', JSON.stringify(error));
          onComplete(imageUri); // Return original on error
        }
      }, 500); // Increased delay to 500ms
    }
  }, [imageLoaded, renderReady, imageUri, onComplete]);

  if (!imageSize) {
    return null;
  }

  // Create watermark text lines (compact version)
  const watermarkLines: string[] = [];

  console.log('[WatermarkProcessor] Received data:', {
    latitude: data.latitude,
    longitude: data.longitude,
    address: data.address,
    city: data.city,
    state: data.state,
    userName: data.userName,
  });

  // Line 1: Coordinates + Location in one line
  let line1 = '';
  if (data.latitude !== undefined && data.longitude !== undefined) {
    line1 = `${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`;
  }

  // Add city or address to same line if available
  if (data.city) {
    console.log('[WatermarkProcessor] Adding city:', data.city);
    line1 += line1 ? ` • ${data.city}` : data.city;
  } else if (data.address) {
    console.log('[WatermarkProcessor] Adding address:', data.address);
    const shortAddress = data.address.length > 20 ? data.address.substring(0, 20) + '...' : data.address;
    line1 += line1 ? ` • ${shortAddress}` : shortAddress;
  } else {
    console.log('[WatermarkProcessor] ⚠️ No city or address available!');
  }

  if (line1) {
    console.log('[WatermarkProcessor] Line 1:', line1);
    watermarkLines.push(line1);
  }

  // Line 2: Date, Time, User in one line
  const timestamp = data.timestamp || new Date();
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
  if (data.userName) {
    const shortName = data.userName.length > 15 ? data.userName.substring(0, 15) + '...' : data.userName;
    line2 += ` • ${shortName}`;
  }
  watermarkLines.push(line2);

  // Line 3: Full address (street/area) if available
  if (data.address) {
    console.log('[WatermarkProcessor] Adding full address line:', data.address);
    const fullAddress = data.address.length > 40 ? data.address.substring(0, 40) + '...' : data.address;
    watermarkLines.push(fullAddress);
  } else if (data.state && !data.city) {
    // If we have state but not city, show state on separate line
    console.log('[WatermarkProcessor] Adding state line:', data.state);
    watermarkLines.push(data.state);
  }

  // Calculate dimensions - use reasonable size for capture
  // Reduce max size to avoid memory issues
  const maxWidth = 1280;
  const maxHeight = 1280;
  let displayWidth = imageSize.width;
  let displayHeight = imageSize.height;

  // Scale down if image is too large
  if (displayWidth > maxWidth || displayHeight > maxHeight) {
    const scale = Math.min(maxWidth / displayWidth, maxHeight / displayHeight);
    displayWidth = Math.round(displayWidth * scale);
    displayHeight = Math.round(displayHeight * scale);
  }

  // Ensure minimum size
  if (displayWidth < 100 || displayHeight < 100) {
    console.error('[WatermarkProcessor] Image too small:', displayWidth, 'x', displayHeight);
    onComplete(imageUri);
    return null;
  }

  console.log('[WatermarkProcessor] Rendering at:', displayWidth, 'x', displayHeight);

  return (
    <View style={styles.hiddenContainer} collapsable={false}>
      <View
        ref={viewRef}
        collapsable={false}
        style={[
          styles.container,
          {
            width: displayWidth,
            height: displayHeight,
          },
        ]}
      >
        <Image
          source={{ uri: imageUri }}
          style={[styles.image, { width: displayWidth, height: displayHeight }]}
          resizeMode="cover"
          onLoad={() => {
            console.log('[WatermarkProcessor] ✅ Image loaded successfully');
            setImageLoaded(true);
          }}
          onError={(error) => {
            console.error('[WatermarkProcessor] ❌ Image load error:', error.nativeEvent);
            onComplete(imageUri);
          }}
        />

        {/* Watermark at bottom-right - only show after image loads */}
        {imageLoaded && (
          <View style={styles.watermarkContainer}>
            <View style={styles.watermarkBox}>
              {watermarkLines.map((line, index) => (
                <Text key={index} style={styles.watermarkText}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    left: -10000, // Hide off-screen
    top: -10000,
    zIndex: -1,
  },
  container: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
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
});
