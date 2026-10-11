export const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export function getMaxUploadSizeBytes(): number {
  const mbEnv = process.env.MAX_UPLOAD_MB;
  const mb = mbEnv ? parseInt(mbEnv, 10) : 5;
  const validMb = isNaN(mb) || mb <= 0 ? 5 : mb;
  return validMb * 1024 * 1024;
}

/**
 * Validates declared Content-Type and verifies magic bytes signature of Buffer / Uint8Array.
 * Returns the detected MIME type if valid, or null if invalid/mismatched.
 */
export function validateMagicBytes(buffer: Uint8Array, declaredType: string): AllowedContentType | null {
  if (buffer.length < 12) {
    return null;
  }

  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 && // 'RIFF'
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50; // 'WEBP'

  let detectedType: AllowedContentType | null = null;
  if (isPng) detectedType = 'image/png';
  else if (isJpeg) detectedType = 'image/jpeg';
  else if (isWebp) detectedType = 'image/webp';

  if (!detectedType) {
    return null;
  }

  // Normalize JPEG variants (image/jpg -> image/jpeg)
  const normalizedDeclared = declaredType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : declaredType.toLowerCase();

  if (detectedType !== normalizedDeclared) {
    return null;
  }

  return detectedType;
}

/**
 * Sanitizes original filename for safe display in header and logs:
 * Strips path traversal characters (../, ..\), slashes, control chars (\x00-\x1F),
 * and limits length to max 100 characters.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed_file';
  // Strip paths (basename only)
  let clean = filename.replace(/^.*[\\/]/, '');
  // Remove control characters and non-printable characters
  clean = clean.replace(/[\x00-\x1F\x7F]/g, '');
  // Replace potentially dangerous path characters
  clean = clean.replace(/\.\.+/g, '.');
  // Trim spaces and limit length
  clean = clean.trim().slice(0, 100);
  return clean || 'unnamed_file';
}
