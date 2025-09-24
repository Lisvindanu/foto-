import { supabase, STORAGE_BUCKET } from '../config/supabase';
import { randomUUID } from 'crypto';

export interface UploadResult {
  publicUrl: string;
  filePath: string;
  fileName: string;
}

export class StorageService {
  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(
    file: Buffer,
    originalFilename: string,
    folder: 'originals' | 'processed' | 'thumbnails' = 'originals'
  ): Promise<UploadResult> {
    try {
      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const randomId = Math.random().toString(36).substring(2, 8);
      const fileExt = originalFilename.split('.').pop() || 'jpg';
      const fileName = `${timestamp}_${randomId}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      console.log(`Uploading to Supabase Storage: ${filePath}`);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          contentType: this.getMimeType(fileExt),
          cacheControl: '3600'
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: publicData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      if (!publicData.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      console.log(`Upload successful: ${publicData.publicUrl}`);

      return {
        publicUrl: publicData.publicUrl,
        filePath: filePath,
        fileName: fileName
      };

    } catch (error) {
      console.error('Storage upload error:', error);
      throw new Error(`Storage upload failed: ${error}`);
    }
  }

  /**
   * Delete file from Supabase Storage
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([filePath]);

      if (error) {
        console.error('Supabase delete error:', error);
        throw new Error(`Delete failed: ${error.message}`);
      }

      console.log(`File deleted: ${filePath}`);
    } catch (error) {
      console.error('Storage delete error:', error);
      // Don't throw error for delete failures - just log
    }
  }

  /**
   * Get public URL for existing file
   */
  getPublicUrl(filePath: string): string {
    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif'
    };

    return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
  }

  /**
   * Extract file path from public URL
   */
  extractFilePathFromUrl(publicUrl: string): string {
    try {
      const url = new URL(publicUrl);
      const pathParts = url.pathname.split('/');
      // Remove /storage/v1/object/public/images/ from path
      const bucketIndex = pathParts.indexOf(STORAGE_BUCKET);
      if (bucketIndex >= 0 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join('/');
      }
      return '';
    } catch (error) {
      console.error('Error extracting file path:', error);
      return '';
    }
  }
}

export const storageService = new StorageService();