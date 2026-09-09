import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { join } from 'path';
import { mkdirSync } from 'fs';
import {
  BUSINESS_REQUEST_MAX_SIZE,
  businessRequestFilename,
  isLicenseAllowed,
  isPhotoAllowed,
} from './business-request-file.helpers';

export const BUSINESS_LICENSES_DIR = 'business-licenses';
export const BUSINESS_PHOTOS_DIR = 'business-photos';

export function getUploadsRoot(): string {
  return process.env.UPLOADS_ROOT ?? join(process.cwd(), 'uploads');
}

export function fileSubdirForField(fieldname: string): string {
  return fieldname === 'businessLicense' ? BUSINESS_LICENSES_DIR : BUSINESS_PHOTOS_DIR;
}

export function buildBusinessRequestMulterOptions() {
  return {
    limits: {
      fileSize: BUSINESS_REQUEST_MAX_SIZE,
      files: 2,
    },
    storage: diskStorage({
      destination: (_req, file, cb) => {
        const dir = join(getUploadsRoot(), fileSubdirForField(file.fieldname));
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        cb(null, businessRequestFilename(file));
      },
    }),
    fileFilter: (
      _req: Express.Request,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (file.fieldname === 'businessLicense' && !isLicenseAllowed(file.mimetype)) {
        cb(
          new BadRequestException(
            `Unsupported businessLicense type "${file.mimetype}". Allowed: PDF or an image (jpeg/png).`,
          ),
          false,
        );
        return;
      }
      if (file.fieldname === 'photo' && !isPhotoAllowed(file.mimetype)) {
        cb(
          new BadRequestException(
            `Unsupported photo type "${file.mimetype}". Allowed: an image (jpeg/png/webp).`,
          ),
          false,
        );
        return;
      }
      cb(null, true);
    },
  };
}