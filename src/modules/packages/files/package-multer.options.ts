import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import {
  PACKAGE_IMAGE_MAX_SIZE,
  isPackageImageAllowed,
} from './package-file.helpers';

export const PACKAGE_IMAGES_DIR = 'package-images';

export function buildPackageMulterOptions() {
  return {
    limits: {
      fileSize: PACKAGE_IMAGE_MAX_SIZE,
      files: 1,
    },
    storage: memoryStorage(),
    fileFilter: (
      _req: Express.Request,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (!isPackageImageAllowed(file.mimetype)) {
        cb(
          new BadRequestException(
            `Unsupported image type "${file.mimetype}". Allowed: an image (jpeg/png/webp).`,
          ),
          false,
        );
        return;
      }
      cb(null, true);
    },
  };
}