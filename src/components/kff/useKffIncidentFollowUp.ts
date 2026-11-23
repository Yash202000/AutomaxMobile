import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { addKffComment, KffUploadFile, uploadKffAttachment } from '@/src/api/kffIncidents';
import { CustomAlert } from '@/src/components/CustomAlert';
import { useAuth } from '@/src/context/AuthContext';
import { compressImage } from '@/src/utils/imageCompression';
import { getLocationDetails } from '@/src/utils/location';
import { generateWatermarkedFilename, WatermarkData } from '@/src/utils/watermarkUtils';

export type KffAttachmentSource = 'camera' | 'gallery' | 'document';

type LocationDetails = Awaited<ReturnType<typeof getLocationDetails>>;

/** Camera photo waiting for the user's OK in the watermark preview. */
export interface KffPhotoPreview {
  imageUri: string;
  data: WatermarkData;
  fileName: string;
}

/**
 * "Add Attachments" / "Add Comments" on the KFF incident detail screen.
 * Camera photos get the same watermark as the Automax update-status flow
 * (address, lat/long, date-time): preview → WatermarkProcessor → compress →
 * upload. The screen renders WatermarkPreview / WatermarkProcessor from
 * `photoPreview` / `photoToWatermark`. `onChanged` reloads the incident.
 */
export const useKffIncidentFollowUp = (
  incidentId: string | undefined,
  version: number | undefined,
  onChanged: () => void,
) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<KffPhotoPreview | null>(null);
  const [photoToWatermark, setPhotoToWatermark] = useState<KffPhotoPreview | null>(null);

  // GPS + address for the watermark, fetched up front so the preview opens
  // right after the photo is taken.
  const locationRef = useRef<LocationDetails | null>(null);
  useEffect(() => {
    getLocationDetails()
      .then((details) => {
        locationRef.current = details;
      })
      .catch(() => {});
  }, []);

  const userName = user
    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username
    : undefined;

  const alertPermission = (message: string) =>
    CustomAlert.alert(t('common.permissionRequired', 'Permission Required'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.openSettings', 'Open Settings'), onPress: () => Linking.openSettings() },
    ]);

  const uploadFiles = async (files: KffUploadFile[]) => {
    if (!incidentId || files.length === 0) return;
    setUploading(true);
    const failed: string[] = [];
    for (const file of files) {
      const result = await uploadKffAttachment(incidentId, file, version);
      if (!result.success) failed.push(`${file.name}: ${result.error}`);
    }
    setUploading(false);
    onChanged();

    if (failed.length > 0) {
      CustomAlert.alert(t('kff.detail.attachmentUploadFailed'), failed.join('\n'));
    } else {
      CustomAlert.alert(t('common.success'), t('kff.detail.attachmentsUploaded', { count: files.length }));
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      alertPermission(t('common.cameraPermissionNeeded', 'Camera permission is required to take photos.'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, exif: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    const location = locationRef.current ?? (await getLocationDetails().catch(() => null));
    if (location) locationRef.current = location;
    const timestamp = new Date();
    setPhotoPreview({
      imageUri: asset.uri,
      data: {
        latitude: location?.latitude,
        longitude: location?.longitude,
        city: location?.city ?? undefined,
        state: location?.state ?? undefined,
        country: location?.country ?? undefined,
        street: location?.street ?? undefined,
        district: location?.district ?? undefined,
        street_number: location?.street_number ?? undefined,
        ...(process.env.EXPO_PUBLIC_ENABLE_GIS === 'true' && location?.gis ? { gis: location.gis } : {}),
        userName,
        timestamp,
        appName: 'Automax',
      },
      fileName: generateWatermarkedFilename(asset.fileName || `photo_${Date.now()}.jpg`, {
        appName: 'Automax',
        userName,
        timestamp,
      }),
    });
  };

  const pickFiles = async (source: 'gallery' | 'document'): Promise<KffUploadFile[]> => {
    if (source === 'document') {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return [];
      return result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      }));
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alertPermission(t('common.galleryPermissionNeeded', 'Gallery permission is required to select photos.'));
      return [];
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (result.canceled) return [];
    return result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `photo_${Date.now()}_${index}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    }));
  };

  const addAttachments = async (source: KffAttachmentSource) => {
    if (!incidentId || uploading) return;
    try {
      if (source === 'camera') await takePhoto();
      else await uploadFiles(await pickFiles(source));
    } catch {
      CustomAlert.alert(t('common.error'), t('kff.detail.attachmentPickFailed'));
    }
  };

  /** Preview "Accept": burn the watermark in (WatermarkProcessor), then upload. */
  const acceptPhoto = () => {
    setPhotoToWatermark(photoPreview);
    setPhotoPreview(null);
  };

  /** Preview "Retry": discard and open the camera again. */
  const retakePhoto = () => {
    setPhotoPreview(null);
    setTimeout(() => addAttachments('camera'), 300);
  };

  /** WatermarkProcessor finished (falls back to the original photo on error). */
  const onPhotoWatermarked = async (watermarkedUri: string) => {
    const photo = photoToWatermark;
    setPhotoToWatermark(null);
    if (!photo) return;
    const compressed = await compressImage(watermarkedUri, {
      quality: 0.75,
      format: 'jpeg',
      skipSmallFiles: true,
    });
    await uploadFiles([
      {
        uri: compressed.success && compressed.compressedUri ? compressed.compressedUri : watermarkedUri,
        name: photo.fileName,
        type: 'image/jpeg',
      },
    ]);
  };

  /** Resolves true when posted (the caller closes the comment box). */
  const addComment = async (content: string): Promise<boolean> => {
    if (!incidentId || commenting || !content.trim()) return false;
    setCommenting(true);
    const result = await addKffComment(incidentId, content);
    setCommenting(false);
    if (!result.success) {
      CustomAlert.alert(t('common.error'), result.error || t('kff.detail.commentFailed'));
      return false;
    }
    onChanged();
    return true;
  };

  return {
    addAttachments,
    uploading: uploading || !!photoToWatermark,
    photoPreview,
    photoToWatermark,
    acceptPhoto,
    retakePhoto,
    onPhotoWatermarked,
    addComment,
    commenting,
  };
};
