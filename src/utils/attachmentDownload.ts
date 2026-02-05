import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { baseURL } from '@/src/api/client';
import * as SecureStore from 'expo-secure-store';

/**
 * Downloads an authenticated attachment and opens/shares it
 * @param attachmentId The ID of the attachment to download
 * @param fileName The name of the file
 * @returns Promise that resolves when download completes
 */
export const downloadAndOpenAttachment = async (
  attachmentId: string,
  fileName: string
): Promise<void> => {
  try {
    // Get auth token
    const token = await SecureStore.getItemAsync('authToken');

    if (!token) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    // Show loading alert
    Alert.alert('Downloading', 'Please wait...');

    // Download the file with authentication
    const downloadUrl = `${baseURL}/attachments/${attachmentId}`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    const downloadResult = await FileSystem.downloadAsync(
      downloadUrl,
      fileUri,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      Alert.alert('Error', 'Sharing is not available on this device');
      return;
    }

    // Share/open the file
    await Sharing.shareAsync(downloadResult.uri, {
      mimeType: getMimeType(fileName),
      dialogTitle: 'Open with',
      UTI: getUTI(fileName),
    });

  } catch (error: any) {
    console.error('Error downloading attachment:', error);
    Alert.alert(
      'Download Error',
      error.message || 'Failed to download attachment'
    );
  }
};

/**
 * Get MIME type from file extension
 */
const getMimeType = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    json: 'application/json',
    xml: 'application/xml',
  };

  return mimeTypes[extension || ''] || 'application/octet-stream';
};

/**
 * Get UTI (Uniform Type Identifier) for iOS
 */
const getUTI = (fileName: string): string => {
  if (Platform.OS !== 'ios') return '';

  const extension = fileName.split('.').pop()?.toLowerCase();

  const utiTypes: Record<string, string> = {
    pdf: 'com.adobe.pdf',
    doc: 'com.microsoft.word.doc',
    docx: 'org.openxmlformats.wordprocessingml.document',
    xls: 'com.microsoft.excel.xls',
    xlsx: 'org.openxmlformats.spreadsheetml.sheet',
    ppt: 'com.microsoft.powerpoint.ppt',
    pptx: 'org.openxmlformats.presentationml.presentation',
    txt: 'public.plain-text',
    zip: 'public.zip-archive',
  };

  return utiTypes[extension || ''] || 'public.data';
};
