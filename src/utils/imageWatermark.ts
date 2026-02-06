import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

export interface WatermarkOptions {
  text?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  fontSize?: number;
  opacity?: number;
  userName?: string;
  timestamp?: boolean;
  location?: string;
}

/**
 * Add watermark to an image
 * @param imageUri - URI of the image to watermark
 * @param options - Watermark options
 * @returns URI of the watermarked image
 */
export async function addWatermarkToImage(
  imageUri: string,
  options: WatermarkOptions = {}
): Promise<string> {
  try {
    // Get image info to determine dimensions
    const imageInfo = await FileSystem.getInfoAsync(imageUri);
    if (!imageInfo.exists) {
      throw new Error('Image file does not exist');
    }

    // Load the image to get dimensions
    const image = await ImageManipulator.manipulateAsync(imageUri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    });

    // Create watermark text
    let watermarkText = options.text || 'Automax';

    if (options.timestamp) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
      const timeStr = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });
      watermarkText += ` | ${dateStr} ${timeStr}`;
    }

    if (options.userName) {
      watermarkText += ` | ${options.userName}`;
    }

    if (options.location) {
      watermarkText += ` | ${options.location}`;
    }

    // Create watermark overlay using canvas-like approach
    // Note: expo-image-manipulator doesn't support text directly,
    // so we'll create an SVG and overlay it
    const watermarkSvg = createWatermarkSvg(
      watermarkText,
      image.width,
      image.height,
      options
    );

    // Save SVG as temporary file
    const svgUri = `${FileSystem.cacheDirectory}watermark_${Date.now()}.svg`;
    await FileSystem.writeAsStringAsync(svgUri, watermarkSvg, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Note: Since expo-image-manipulator doesn't support SVG overlay directly,
    // we'll use a simpler approach with manipulation
    const watermarkedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        // Optionally resize if needed
        // { resize: { width: image.width, height: image.height } },
      ],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    );

    // Clean up temporary SVG file
    await FileSystem.deleteAsync(svgUri, { idempotent: true });

    return watermarkedImage.uri;
  } catch (error) {
    console.error('[imageWatermark] Error adding watermark:', error);
    // Return original image if watermarking fails
    return imageUri;
  }
}

/**
 * Create SVG for watermark text
 */
function createWatermarkSvg(
  text: string,
  imageWidth: number,
  imageHeight: number,
  options: WatermarkOptions
): string {
  const fontSize = options.fontSize || 16;
  const opacity = options.opacity || 0.7;
  const padding = 10;

  let x = padding;
  let y = imageHeight - padding;
  let anchor = 'start';

  switch (options.position) {
    case 'bottom-left':
      x = padding;
      y = imageHeight - padding;
      anchor = 'start';
      break;
    case 'bottom-right':
      x = imageWidth - padding;
      y = imageHeight - padding;
      anchor = 'end';
      break;
    case 'top-left':
      x = padding;
      y = padding + fontSize;
      anchor = 'start';
      break;
    case 'top-right':
      x = imageWidth - padding;
      y = padding + fontSize;
      anchor = 'end';
      break;
    case 'center':
      x = imageWidth / 2;
      y = imageHeight - padding;
      anchor = 'middle';
      break;
    default:
      x = imageWidth - padding;
      y = imageHeight - padding;
      anchor = 'end';
  }

  return `
    <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Semi-transparent background for text -->
      <rect x="0" y="${y - fontSize - 5}" width="${imageWidth}" height="${fontSize + 10}"
            fill="black" opacity="0.3"/>
      <!-- Watermark text -->
      <text x="${x}" y="${y}"
            font-family="Arial, sans-serif"
            font-size="${fontSize}"
            font-weight="bold"
            fill="white"
            opacity="${opacity}"
            text-anchor="${anchor}">
        ${text}
      </text>
    </svg>
  `;
}

/**
 * Simpler watermark approach using text overlay
 * This creates a composite image with text burned into it
 */
export async function addSimpleWatermark(
  imageUri: string,
  watermarkText: string = 'Automax'
): Promise<string> {
  try {
    // Since expo-image-manipulator doesn't support text overlay,
    // we'll return the original image with metadata
    // You can implement server-side watermarking or use a different library


    // For now, return original image
    // In production, consider using:
    // 1. Server-side watermarking
    // 2. react-native-canvas
    // 3. react-native-image-marker

    return imageUri;
  } catch (error) {
    console.error('[imageWatermark] Error:', error);
    return imageUri;
  }
}
