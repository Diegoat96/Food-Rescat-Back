import {
  Controller,
  Get,
  Next,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NextFunction, Response } from 'express';
import { basename, resolve } from 'path';
import {
  getUploadsRoot,
  BUSINESS_LICENSES_DIR,
  BUSINESS_PHOTOS_DIR,
} from '../business-requests/files/business-request-multer.options';

const ALLOWED_DIRS = new Set([BUSINESS_LICENSES_DIR, BUSINESS_PHOTOS_DIR]);

@ApiTags('Static')
@Controller('static')
export class UploadsController {
  @Get(':dir/:filename')
  @ApiOperation({
    summary: 'Serve an uploaded file (business license or photo)',
  })
  serveFile(
    @Param('dir') dir: string,
    @Param('filename') filename: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): void {
    if (!ALLOWED_DIRS.has(dir) || basename(filename) !== filename) {
      next(new NotFoundException('File not found'));
      return;
    }

    const uploadsRoot = resolve(getUploadsRoot());
    const filePath = resolve(uploadsRoot, dir, filename);
    if (!filePath.startsWith(uploadsRoot)) {
      next(new NotFoundException('File not found'));
      return;
    }

    res.sendFile(filePath, (err) => {
      if (err) {
        next(new NotFoundException('File not found'));
      }
    });
  }
}