import { describe, expect, it } from 'vitest';
import {
  getMaxUploadSizeBytes,
  sanitizeFilename,
  validateMagicBytes,
} from '../lib/uploadValidation';
import { GET as getAttachmentHandler } from '../app/api/attachments/[id]/route';

describe('Storage & Upload Validation Tests', () => {
  it('1. Rejects a text file renamed to .png (magic bytes check fails)', () => {
    // Plain text buffer "Hello World string in fake png file"
    const textBuffer = new Uint8Array(Buffer.from('Hello World string in fake png file'));
    const result = validateMagicBytes(textBuffer, 'image/png');
    expect(result).toBeNull();
  });

  it('2. Rejects a PNG file sent with image/jpeg declared content type', () => {
    // Valid PNG magic bytes header: 89 50 4E 47 0D 0A 1A 0A
    const pngMagicHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
    ]);
    const result = validateMagicBytes(pngMagicHeader, 'image/jpeg');
    expect(result).toBeNull();
  });

  it('3. Successfully validates a true PNG file with image/png content type', () => {
    const pngMagicHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
    ]);
    const result = validateMagicBytes(pngMagicHeader, 'image/png');
    expect(result).toBe('image/png');
  });

  it('4. Correctly computes default max upload size of 5 MB (5,242,880 bytes)', () => {
    const maxSize = getMaxUploadSizeBytes();
    expect(maxSize).toBe(5 * 1024 * 1024);
  });

  it('5. Sanitizes filenames containing path traversal ../ and dangerous characters', () => {
    const malicious1 = sanitizeFilename('../../etc/passwd.png');
    expect(malicious1).not.toContain('..');
    expect(malicious1).toBe('passwd.png');

    const malicious2 = sanitizeFilename('C:\\Windows\\System32\\cmd.exe');
    expect(malicious2).toBe('cmd.exe');
  });

  it('6. Returns 401 Unauthorized for anonymous GET /api/attachments/:id', async () => {
    const req = new Request('http://localhost:3000/api/attachments/12345678-1234-1234-1234-123456789012', {
      method: 'GET',
    });
    const response = await getAttachmentHandler(req, {
      params: Promise.resolve({ id: '12345678-1234-1234-1234-123456789012' }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });
});
