import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { baseURL } from '@/src/api/client';
import * as SecureStore from 'expo-secure-store';
import { CustomAlert } from '@/src/components/CustomAlert';
import i18n from '@/src/i18n';


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
      CustomAlert.alert(i18n.t('common.error'), i18n.t('common.authRequired'));
      return;
    }

    // Show loading alert
    CustomAlert.alert(i18n.t('common.downloading'), i18n.t('common.pleaseWait'));

    // Download the file with authentication
    const downloadUrl = `${baseURL}/attachments/${attachmentId}`;
    const destination = new File(Paths.document, fileName);

    const downloadedFile = await File.downloadFileAsync(
      downloadUrl,
      destination,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      CustomAlert.alert(i18n.t('common.error'), i18n.t('common.sharingNotAvailable'));
      return;
    }

    // Share/open the file
    await Sharing.shareAsync(downloadedFile.uri, {
      mimeType: getMimeType(fileName),
      dialogTitle: 'Open with',
      UTI: getUTI(fileName),
    });

  } catch (error: any) {
    console.error('Error downloading attachment:', error);
    CustomAlert.alert(
      i18n.t('common.downloadError'),
      error.message || i18n.t('common.failedToDownload')
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
