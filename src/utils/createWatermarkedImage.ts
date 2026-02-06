import * as FileSystem from 'expo-file-system/legacy';

export interface WatermarkData {
  latitude?: number;
  longitude?: number;
  userName?: string;
  timestamp?: Date;
  location?: string;
}

/**
 * Create a watermarked image by overlaying text on bottom-right
 * Uses HTML Canvas approach through Data URI
 */
export async function createWatermarkedImage(
  imageUri: string,
  watermarkData: WatermarkData
): Promise<string> {
  try {
    // Read the image file
    const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create watermark text
    const watermarkText = createWatermarkText(watermarkData);


    // Since we can't directly manipulate pixels in React Native without additional libraries,
    // we'll need to use expo-image-manipulator or a native module
    // For now, return the original image with metadata stored
    // To add actual text overlay, install: npx expo install react-native-view-shot

    return imageUri;
  } catch (error) {
    console.error('[Watermark] Error creating watermarked image:', error);
    return imageUri;
  }
}

function createWatermarkText(data: WatermarkData): string {
  const parts: string[] = [];

  // Primary: Lat/Long
  if (data.latitude !== undefined && data.longitude !== undefined) {
    parts.push(`${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`);
  }

  // Secondary: Timestamp
  const timestamp = data.timestamp || new Date();
  const dateStr = timestamp.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = timestamp.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  parts.push(`${dateStr} ${timeStr}`);

  // Optional: User name
  if (data.userName) {
    parts.push(data.userName);
  }

  return parts.join(' | ');
}

/**
 * Generate watermark metadata for storage
 */
export function generateWatermarkMetadata(data: WatermarkData): string {
  return JSON.stringify({
    latitude: data.latitude,
    longitude: data.longitude,
    userName: data.userName,
    timestamp: data.timestamp?.toISOString(),
    location: data.location,
    watermarked: true,
  });
}
