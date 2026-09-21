import apiClient from './client';

export interface AttachmentFile {
  uri: string;
  name: string;
  type: string;
}

export interface ImageValidationResult {
  /** false on a network/unexpected error too — callers shouldn't distinguish. */
  valid: boolean;
  /** Machine-readable reason code from the AI check (e.g. "mostly_black"), when available. */
  reason?: string;
  /** User-facing explanation — present on both the valid and invalid paths. */
  message?: string;
}

export const validateImage = async (file: AttachmentFile): Promise<ImageValidationResult> => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const response = await apiClient.post('/images/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const body = response.data;
    return {
      valid: !!(body?.success && body?.data?.valid),
      reason: body?.data?.reason,
      message: body?.data?.message || body?.message,
    };
  } catch (error: any) {
    // Both the "not a supported image" (400) and the AI-quality rejection
    // (422) responses land here since axios throws on non-2xx status.
    const body = error.response?.data;
    return {
      valid: false,
      reason: body?.data?.reason,
      message: body?.data?.message || body?.error || body?.message || error.message,
    };
  }
};
