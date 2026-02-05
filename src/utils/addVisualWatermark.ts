import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export interface VisualWatermarkOptions {
  latitude?: number;
  longitude?: number;
  userName?: string;
  timestamp?: string;
  location?: string;
}

/**
 * Add visual watermark overlay to image
 * Since expo-image-manipulator doesn't support text overlay,
 * we'll use a Canvas-based approach through expo-gl or return metadata
 */
export async function addVisualWatermarkToImage(
  imageUri: string,
  options: VisualWatermarkOptions
): Promise<string> {
  try {
    console.log('[Visual Watermark] Processing image:', imageUri);
    console.log('[Visual Watermark] Options:', options);

    // For now, we'll return the original image
    // Visual text overlay requires additional native module
    // Options:
    // 1. Use react-native-view-shot (capture view with text)
    // 2. Server-side watermarking
    // 3. Use react-native-canvas or expo-gl

    // Compress and optimize the image
    const manipulatedImage = await manipulateAsync(
      imageUri,
      [
        // Keep original size
      ],
      {
        compress: 0.9,
        format: SaveFormat.JPEG,
      }
    );

    console.log('[Visual Watermark] Image processed:', manipulatedImage.uri);

    // Return the processed image
    // Note: Visual text overlay would require additional implementation
    return manipulatedImage.uri;
  } catch (error) {
    console.error('[Visual Watermark] Error:', error);
    return imageUri;
  }
}

/**
 * Create watermark text for display
 */
export function createVisualWatermarkText(options: VisualWatermarkOptions): string {
  const parts: string[] = [];

  if (options.latitude && options.longitude) {
    parts.push(`${options.latitude.toFixed(6)}, ${options.longitude.toFixed(6)}`);
  }

  if (options.userName) {
    parts.push(options.userName);
  }

  const timestamp = options.timestamp || new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  parts.push(timestamp);

  if (options.location) {
    parts.push(options.location);
  }

  return parts.join(' | ');
}
