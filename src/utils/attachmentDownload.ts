import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { baseURL } from '@/src/api/client';
import * as SecureStore from 'expo-secure-store';
import { CustomAlert } from '@/src/components/CustomAlert';
import i18n from '@/src/i18n';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'];

const isImageFile = (fileName: string, mimeType?: string): boolean => {
  if (mimeType) return mimeType.startsWith('image/');
  const extension = fileName.split('.').pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.includes(extension || '');
};

/**
 * Downloads an authenticated attachment. Images are saved straight to the
 * device's Photos app; every other file type is handed to the OS share
 * sheet, since there's no direct-save destination for arbitrary files.
 * @param attachmentId The ID of the attachment to download
 * @param fileName The name of the file
 * @param mimeType Optional known mime type, to avoid guessing from the file extension
 * @returns Promise that resolves when download completes
 */
export const downloadAndOpenAttachment = async (
  attachmentId: string,
  fileName: string,
  mimeType?: string
): Promise<void> => {
  try {
    // Get auth token
    const token = await SecureStore.getItemAsync('authToken');

    if (!token) {
      CustomAlert.alert(i18n.t('common.error'), i18n.t('common.authRequired'));
      return;
    }

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
        // Re-downloading the same attachment should overwrite the previous
        // copy rather than throwing "destination already exists".
        idempotent: true,
      }
    );

    if (isImageFile(fileName, mimeType)) {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(downloadedFile.uri);
        CustomAlert.alert(i18n.t('common.success'), i18n.t('common.savedToPhotos'));
        return;
      }
      // Permission denied — fall through to the share sheet so the user can
      // still get the file out some other way instead of hitting a dead end.
    }

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      CustomAlert.alert(i18n.t('common.error'), i18n.t('common.sharingNotAvailable'));
      return;
    }

    // Share/open the file
    await Sharing.shareAsync(downloadedFile.uri, {
      mimeType: mimeType || getMimeType(fileName),
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
