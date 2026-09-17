import { extname } from 'path';
import { randomUUID } from 'crypto';

export const PACKAGE_IMAGE_MAX_SIZE = 5 * 1024 * 1024;

export const PACKAGE_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function isPackageImageAllowed(mimetype: string): boolean {
  return PACKAGE_IMAGE_MIMES.includes(mimetype);
}

export function mimeToExtension(mimetype: string): string {
  return EXT_BY_MIME[mimetype];
}

export function packageImageFilename(file: Express.Multer.File): string {
  const extension =
    mimeToExtension(file.mimetype) ?? extname(file.originalname).toLowerCase();
  return `${randomUUID()}${extension}`;
}