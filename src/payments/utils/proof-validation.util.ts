export const ALLOWED_PROOF_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const DISALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS/GCP/Azure instance metadata
  'metadata.google.internal',
];

/**
 * Validates storage URL to prevent SSRF, path traversal, and malicious protocols.
 */
export function validateProofUrl(fileUrl: string): { isValid: boolean; error?: string } {
  const url = fileUrl.trim();

  // 1. Path traversal / null byte check (including URL-encoded %2e%2e)
  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.includes('..') ||
    lowerUrl.includes('%2e%2e') ||
    lowerUrl.includes('\0') ||
    lowerUrl.includes('%00') ||
    lowerUrl.includes('\\')
  ) {
    return { isValid: false, error: 'Path traversal or control characters detected in file URL' };
  }


  // 2. Protocol check
  if (url.startsWith('/')) {
    // Relative storage path is valid (e.g. /storage/proofs/2026/slip_01.jpg)
    return { isValid: true };
  }

  if (!url.startsWith('https://')) {
    return {
      isValid: false,
      error: 'File URL must be a secure HTTPS URL or relative storage path',
    };
  }

  try {
    const parsed = new URL(url);

    // 3. Host validation: block SSRF targets
    const hostname = parsed.hostname.toLowerCase();
    for (const disallowed of DISALLOWED_HOSTS) {
      if (hostname === disallowed || hostname.endsWith(`.${disallowed}`)) {
        return { isValid: false, error: `Disallowed host for payment proof storage: ${hostname}` };
      }
    }

    // Check private RFC 1918 ranges
    if (
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return { isValid: false, error: 'Private IP addresses are forbidden for storage URLs' };
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Malformed file URL structure' };
  }
}

/**
 * Validates that the file extension matches the declared MIME type.
 */
export function validateMimeAndExtension(
  filenameOrUrl: string,
  fileType: string,
): { isValid: boolean; error?: string } {
  const clean = filenameOrUrl.split('?')[0].toLowerCase();
  const ext = clean.substring(clean.lastIndexOf('.'));

  const mimeMap: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
  };

  const allowedExts = mimeMap[fileType];
  if (!allowedExts) {
    return { isValid: false, error: `Unsupported MIME type: ${fileType}` };
  }

  if (!allowedExts.includes(ext)) {
    return {
      isValid: false,
      error: `File extension "${ext}" does not match declared MIME type "${fileType}"`,
    };
  }

  return { isValid: true };
}

/**
 * Validates binary buffer magic bytes (file signature) for uploaded proof files.
 */
export function validateFileMagicBytes(
  buffer: Buffer,
  fileType: string,
): { isValid: boolean; error?: string } {
  if (!buffer || buffer.length < 4) {
    return { isValid: false, error: 'Buffer is too small to determine file signature' };
  }

  switch (fileType) {
    case 'image/jpeg':
      // JPEG starts with FF D8 FF
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { isValid: true };
      }
      return { isValid: false, error: 'Invalid JPEG magic bytes' };

    case 'image/png':
      // PNG starts with 89 50 4E 47 (0x89 'P' 'N' 'G')
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        return { isValid: true };
      }
      return { isValid: false, error: 'Invalid PNG magic bytes' };

    case 'image/webp':
      // WEBP starts with RIFF (0x52 0x49 0x46 0x46) and bytes 8-11 are WEBP (0x57 0x45 0x42 0x50)
      if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer.length >= 12 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      ) {
        return { isValid: true };
      }
      return { isValid: false, error: 'Invalid WEBP magic bytes' };

    case 'application/pdf':
      // PDF starts with %PDF (0x25 0x50 0x44 0x46)
      if (
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
      ) {
        return { isValid: true };
      }
      return { isValid: false, error: 'Invalid PDF magic bytes' };

    default:
      return { isValid: false, error: `Unsupported MIME type for binary inspection: ${fileType}` };
  }
}
