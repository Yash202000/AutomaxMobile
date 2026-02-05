/**
 * Simple watermarking utility for mobile images
 * Adds watermark info to filename and optionally to image metadata
 */

export interface WatermarkInfo {
  userName?: string;
  userId?: string;
  timestamp?: Date;
  location?: string;
  appName?: string;
}

/**
 * Generate a watermarked filename with metadata
 */
export function generateWatermarkedFilename(
  originalFilename: string,
  info: WatermarkInfo
): string {
  const timestamp = info.timestamp || new Date();
  const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const ext = originalFilename.split('.').pop() || 'jpg';
  const appName = info.appName || 'Automax';

  // Format: Automax_UserName_YYYY-MM-DDTHH-MM-SS.jpg
  let filename = `${appName}`;

  if (info.userName) {
    const sanitizedName = info.userName.replace(/[^a-zA-Z0-9]/g, '_');
    filename += `_${sanitizedName}`;
  }

  filename += `_${dateStr}.${ext}`;

  return filename;
}

/**
 * Create watermark text for display
 */
export function createWatermarkText(info: WatermarkInfo): string {
  const parts: string[] = [];

  parts.push(info.appName || 'Automax');

  if (info.userName) {
    parts.push(info.userName);
  }

  const timestamp = info.timestamp || new Date();
  const dateStr = timestamp.toLocaleDateString('en-GB'); // DD/MM/YYYY
  const timeStr = timestamp.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  parts.push(`${dateStr} ${timeStr}`);

  if (info.location) {
    parts.push(info.location);
  }

  return parts.join(' | ');
}

/**
 * Extract watermark info from filename
 */
export function extractWatermarkFromFilename(filename: string): WatermarkInfo | null {
  try {
    // Format: Automax_UserName_YYYY-MM-DDTHH-MM-SS.jpg
    const parts = filename.split('_');

    if (parts.length < 3) {
      return null;
    }

    const appName = parts[0];
    const userName = parts[1];
    const timestampStr = parts.slice(2).join('_').split('.')[0];

    // Convert timestamp back to Date
    const timestamp = new Date(timestampStr.replace(/-/g, ':').replace('T', ' '));

    return {
      appName,
      userName: userName !== 'Unknown' ? userName : undefined,
      timestamp: isNaN(timestamp.getTime()) ? undefined : timestamp,
    };
  } catch (error) {
    console.error('[watermarkUtils] Error extracting watermark:', error);
    return null;
  }
}
