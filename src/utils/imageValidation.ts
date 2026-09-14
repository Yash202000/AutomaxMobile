import { validateImage } from "@/src/api/images";

/**
 * When true, every image attachment must pass server-side validation
 * (POST /images/validate) before it's added to an attachments list.
 */
export const IMAGE_VALIDATION_REQUIRED =
  process.env.EXPO_PUBLIC_IMAGE_VALIDATION_REQUIRED === "true";

/**
 * Validates the image files in a freshly-picked batch against the server
 * (non-image files, e.g. documents, are passed through untouched). Meant to
 * run at selection/capture time so an invalid image never reaches the
 * attachments list, rather than being caught later at submit time.
 */
export async function filterInvalidImages<
  T extends { uri: string; name?: string; type?: string },
>(files: T[]): Promise<{ filesToKeep: T[]; invalidFiles: string[] }> {
  if (!IMAGE_VALIDATION_REQUIRED || files.length === 0) {
    return { filesToKeep: files, invalidFiles: [] };
  }

  const results = await Promise.all(
    files.map(async (file) => {
      if (!file.type?.startsWith("image/")) {
        return { file, valid: true, message: undefined as string | undefined };
      }
      const result = await validateImage(file as any);
      return { file, valid: result.valid, message: result.message };
    }),
  );

  const filesToKeep: T[] = [];
  const invalidFiles: string[] = [];
  results.forEach(({ file, valid, message }) => {
    if (valid) {
      filesToKeep.push(file);
    } else {
      invalidFiles.push(message ? `${file.name}: ${message}` : `${file.name}`);
    }
  });

  return { filesToKeep, invalidFiles };
}
