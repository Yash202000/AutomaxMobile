import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Default compression configuration
 * Target: ~50% file size reduction with minimal quality loss
 */
export const COMPRESSION_DEFAULTS = {
  QUALITY: 0.75,                    // Achieves 40-60% size reduction
  MIN_SIZE_THRESHOLD: 100 * 1024,   // Skip files < 100KB
  FORMAT: 'jpeg' as const,
  ENABLED: true,
} as const;

interface CompressionOptions {
  quality?: number;
  format?: 'jpeg' | 'png';
  skipSmallFiles?: boolean;
  minSizeThreshold?: number;
}

interface CompressionResult {
  success: boolean;
  compressedUri?: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Compress watermarked image before upload
 * @param imageUri - URI of watermarked image
 * @param options - Compression options
 * @returns Compression result with new URI or original on failure
 */
export async function compressImage(
  imageUri: string,
  options?: CompressionOptions
): Promise<CompressionResult> {
  const opts = {
    quality: options?.quality ?? COMPRESSION_DEFAULTS.QUALITY,
    format: options?.format ?? COMPRESSION_DEFAULTS.FORMAT,
    skipSmallFiles: options?.skipSmallFiles ?? true,
    minSizeThreshold: options?.minSizeThreshold ?? COMPRESSION_DEFAULTS.MIN_SIZE_THRESHOLD,
  };

  try {
    // Check if file exists and get size
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
      return {
        success: false,
        error: 'File does not exist',
        compressedUri: imageUri
      };
    }

    const originalSize = fileInfo.size;

    // Skip compression for small files
    if (opts.skipSmallFiles && originalSize < opts.minSizeThreshold) {
      return {
        success: true,
        compressedUri: imageUri,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0,
        skipped: true,
        skipReason: 'File already small',
      };
    }

    // Compress image
    const compressed = await ImageManipulator.manipulateAsync(
      imageUri,
      [], // No transformations, just compress
      {
        compress: opts.quality,
        format: ImageManipulator.SaveFormat[opts.format.toUpperCase() as 'JPEG' | 'PNG'],
      }
    );

    // Get compressed file size
    const compressedInfo = await FileSystem.getInfoAsync(compressed.uri);
    const compressedSize = compressedInfo.size;
    const compressionRatio = compressedSize / originalSize;

    // If compressed is larger, use original (rare but possible)
    if (compressedSize >= originalSize) {
      return {
        success: true,
        compressedUri: imageUri,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0,
        skipped: true,
        skipReason: 'Compression increased size',
      };
    }

    return {
      success: true,
      compressedUri: compressed.uri,
      originalSize,
      compressedSize,
      compressionRatio,
    };

  } catch (error: any) {
    console.error('[Compression] Failed:', error);

    // Always fallback to original on error
    return {
      success: false,
      error: error.message || 'Compression failed',
      compressedUri: imageUri,
    };
  }
}
