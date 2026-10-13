import { BadRequestException } from '@nestjs/common';

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
  /onload\s*=/gi,
  /onerror\s*=/gi,
  /onclick\s*=/gi,
  /<iframe/gi,
];

/**
 * Validates and sanitizes text/JSON content to prevent XSS injection.
 */
export function sanitizeContentValue(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(value)) {
        throw new BadRequestException('Content contains potentially malicious script or HTML tags');
      }
    }
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeContentValue(item));
  }

  if (typeof value === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitizedObj[key] = sanitizeContentValue(val);
    }
    return sanitizedObj;
  }

  return value;
}

export const sanitizeContent = sanitizeContentValue;

export function sanitizeText(text: string): string {
  return sanitizeContentValue(text);
}
