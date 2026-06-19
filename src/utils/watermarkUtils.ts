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
  street?: string;
  district?: string;
  subregion?: string;
  street_number?: string;
  /** GIS-specific location data. When present and EXPO_PUBLIC_ENABLE_GIS is true, this takes priority. */
  gis?: {
    plan_no: string;
    street_fullname: string;
    district_name: string;
    municipality_name: string;
    isInsideBoundary?: boolean;
  };
}

/**
 * Generate precise 5-line watermark details from GIS data.
 * Used when EXPO_PUBLIC_ENABLE_GIS is enabled — GIS fields take priority.
 */
export function generateGisWatermarkLines(data: WatermarkData): string[] {
  const gis = data.gis;
  const lines: string[] = [];

  // 1. Municipality
  lines.push(`Municipality: ${gis?.municipality_name || 'N/A'}`);

  // 2. District
  lines.push(`District: ${gis?.district_name || 'N/A'}`);

  // 3. Street
  lines.push(`Street: ${gis?.street_fullname || 'N/A'}`);

  // 4. Plan No + Coordinates
  const planNo = gis?.plan_no || 'N/A';
  if (data.latitude !== undefined && data.longitude !== undefined) {
    lines.push(`Plan: ${planNo} (${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)})`);
  } else {
    lines.push(`Plan No: ${planNo}`);
  }

  // 5. Full Date
  const timestamp = data.timestamp || new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayName = days[timestamp.getDay()];
  const monthName = months[timestamp.getMonth()];
  const dateNum = timestamp.getDate();
  const year = timestamp.getFullYear();
  const hours = timestamp.getHours();
  const minutes = String(timestamp.getMinutes()).padStart(2, '0');
  const seconds = String(timestamp.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = String(hours % 12 || 12).padStart(2, '0');
  lines.push(`Date: ${dayName}, ${monthName} ${dateNum}, ${year} ${displayHours}:${minutes}:${seconds} ${ampm}`);

  return lines;
}

/**
 * Generate precise 5-line watermark details
 */
export function generateWatermarkLines(data: WatermarkData): string[] {
  // When GIS is enabled and GIS data is present, delegate to GIS watermark
  if (process.env.EXPO_PUBLIC_ENABLE_GIS === 'true' && data.gis) {
    return generateGisWatermarkLines(data);
  }
  const lines: string[] = [];

  // 1. Municipality
  const municipality = data.subregion || data.city || 'N/A';
  lines.push(`Municipality: ${municipality}`);

  // 2. Street Name
  const streetName = data.street || 'N/A';
  lines.push(`Street Name: ${streetName}`);

  // 3. Neighborhood
  const neighborhood = data.district || 'N/A';
  lines.push(`Neighborhood: ${neighborhood}`);

  // 4. Street Name Latitude/Longitude
  if (data.latitude !== undefined && data.longitude !== undefined) {
    lines.push(`${streetName}: ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`);
  } else {
    lines.push(`${streetName}: N/A`);
  }

  // 5. Full Date
  const timestamp = data.timestamp || new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayName = days[timestamp.getDay()];
  const monthName = months[timestamp.getMonth()];
  const dateNum = timestamp.getDate();
  const year = timestamp.getFullYear();

  const hours = timestamp.getHours();
  const minutes = String(timestamp.getMinutes()).padStart(2, '0');
  const seconds = String(timestamp.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = String(hours % 12 || 12).padStart(2, '0');

  const fullDate = `${dayName}, ${monthName} ${dateNum}, ${year} ${displayHours}:${minutes}:${seconds} ${ampm}`;
  lines.push(`Date: ${fullDate}`);

  return lines;
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
  const dateStr = timestamp.toLocaleDateString('en-GB');
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
