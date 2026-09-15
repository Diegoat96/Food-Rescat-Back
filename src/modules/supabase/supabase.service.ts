import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor() {
    const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(
      /\/rest\/v1\/?$/,
      '',
    );
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.bucket = process.env.SUPABASE_BUCKET ?? '';
    this.client = createClient(supabaseUrl, serviceRoleKey);
  }

  async uploadFile(
    folder: string,
    filename: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const path = `${folder}/${filename}`;

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to upload file to Supabase: ${error.message}`,
      );
    }

    return this.client.storage.from(this.bucket).getPublicUrl(path).data
      .publicUrl;
  }
}