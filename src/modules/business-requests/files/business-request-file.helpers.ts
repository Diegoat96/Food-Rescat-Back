import { extname } from 'path';
import { randomUUID } from 'crypto';

export const BUSINESS_REQUEST_MAX_SIZE = 5 * 1024 * 1024;

export const BUSINESS_LICENSE_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

export const BUSINESS_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function isLicenseAllowed(mimetype: string): boolean {
  return BUSINESS_LICENSE_MIMES.includes(mimetype);
}

export function isPhotoAllowed(mimetype: string): boolean {
  return BUSINESS_PHOTO_MIMES.includes(mimetype);
}

export function mimeToExtension(mimetype: string): string {
  return EXT_BY_MIME[mimetype];
}

export function businessRequestFilename(
  file: Express.Multer.File,
): string {
  const extension =
    mimeToExtension(file.mimetype) ?? extname(file.originalname).toLowerCase();
  return `${randomUUID()}${extension}`;
}