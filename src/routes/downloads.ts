import { Elysia, t } from 'elysia';
import { join } from 'path';
import { existsSync } from 'fs';
import { db } from '../database/connection';
import type { PhotoTable } from '../types';
import { Errors, handleError } from '../utils/errors';
import { requireAuth } from './auth';

export const downloadsRoutes = new Elysia({ prefix: '/api/downloads' })

  // Download specific photo variant
  .get('/photo/:id/:type', async ({ params, query, headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth()({ headers, set });
      if ('success' in authResult && !authResult.success) {
        return authResult;
      }
      const { userId } = authResult as any;

      const photoId = parseInt(params.id);
      const type = params.type as 'original' | 'processed' | 'thumbnail' | 'print';
      const { format } = query as { quality?: 'web' | 'print'; format?: 'jpeg' | 'png' | 'webp' };

      // Validate type
      if (!['original', 'processed', 'thumbnail', 'print'].includes(type)) {
        throw Errors.InvalidParameters('Invalid photo type. Must be: original, processed, thumbnail, or print');
      }

      // Get photo info
      const photoQuery = db.query('SELECT * FROM photos WHERE id = ? AND user_id = ? AND deleted_at IS NULL');
      const photo = await photoQuery.get([photoId, userId]) as PhotoTable | null;

      if (!photo) {
        throw Errors.PhotoNotFound(photoId);
      }

      // Determine file path based on type
      let filePath: string;
      let filename: string;

      switch (type) {
        case 'original':
          filePath = join(process.cwd(), photo.original_path);
          filename = photo.original_filename || photo.filename;
          break;
        case 'processed':
          if (!photo.processed_path) {
            throw Errors.InvalidParameters('Processed version not available');
          }
          filePath = join(process.cwd(), photo.processed_path);
          filename = `processed_${photo.original_filename || photo.filename}`;
          break;
        case 'thumbnail':
          if (!photo.thumbnail_path) {
            throw Errors.InvalidParameters('Thumbnail not available');
          }
          filePath = join(process.cwd(), photo.thumbnail_path);
          filename = `thumb_${photo.original_filename || photo.filename}`;
          break;
        case 'print':
          // For print, use processed if available, otherwise original
          filePath = join(process.cwd(), photo.processed_path || photo.original_path);
          filename = `print_${photo.original_filename || photo.filename}`;
          break;
        default:
          throw Errors.InvalidParameters('Invalid photo type');
      }

      // Check if file exists
      if (!existsSync(filePath)) {
        throw Errors.InvalidParameters('File not found on disk');
      }

      // Get file stats
      const file = Bun.file(filePath);
      const fileSize = file.size;

      // Set appropriate headers
      const mimeType = format ? `image/${format}` : photo.mime_type;

      set.headers = {
        'Content-Type': mimeType,
        'Content-Length': fileSize.toString(),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000', // 1 year cache
        'ETag': `"${photo.id}-${type}-${photo.updated_at}"`,
        'Last-Modified': new Date(photo.updated_at || '').toUTCString()
      };

      // Handle range requests for resume downloads
      const rangeHeader = headers.range;
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0] || '0', 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        set.status = 206; // Partial Content
        set.headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
        set.headers['Content-Length'] = chunkSize.toString();

        return file.slice(start, end + 1);
      }

      // Return full file
      return file;

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Batch download (ZIP)
  .post('/batch', async ({ body, headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth()({ headers, set });
      if ('success' in authResult && !authResult.success) {
        return authResult;
      }
      const { userId } = authResult as any;

      const { photoIds, format = 'zip', options = {} } = body as {
        photoIds: number[];
        format: 'zip' | 'pdf';
        options: {
          quality?: 'high' | 'print';
          includeOriginals?: boolean;
          paperSize?: '4x6' | '5x7' | '8x10';
          layout?: 'single' | 'grid';
        };
      };

      if (!photoIds || photoIds.length === 0) {
        throw Errors.InvalidParameters('photoIds array is required');
      }

      if (photoIds.length > 50) {
        throw Errors.InvalidParameters('Maximum 50 photos per batch download');
      }

      // Get photos
      const placeholders = photoIds.map(() => '?').join(',');
      const photosQuery = db.query(`
        SELECT * FROM photos
        WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL
      `);

      const photos = await photosQuery.all([...photoIds, userId]) as PhotoTable[];

      if (photos.length === 0) {
        throw Errors.InvalidParameters('No photos found');
      }

      if (photos.length !== photoIds.length) {
        throw Errors.InvalidParameters('Some photos not found or access denied');
      }

      // Generate unique export ID
      const exportId = `export_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const exportPath = join(process.cwd(), 'uploads', 'exports');

      // Ensure exports directory exists
      if (!existsSync(exportPath)) {
        await Bun.spawn(['mkdir', '-p', exportPath]).exited;
      }

      if (format === 'zip') {
        // Create ZIP file
        const zipFilename = `${exportId}.zip`;
        const zipPath = join(exportPath, zipFilename);

        // Use system zip command for simplicity
        const filesToZip: string[] = [];

        for (const photo of photos) {
          const sourcePath = options.includeOriginals ? photo.original_path :
                           (photo.processed_path || photo.original_path);
          const fullPath = join(process.cwd(), sourcePath);

          if (existsSync(fullPath)) {
            filesToZip.push(fullPath);
          }
        }

        if (filesToZip.length === 0) {
          throw Errors.ProcessingFailed('No files available for download');
        }

        // Create zip using system command
        const zipProcess = Bun.spawn([
          'zip', '-j', zipPath, ...filesToZip
        ]);

        await zipProcess.exited;

        const zipFile = Bun.file(zipPath);
        const zipSize = zipFile.size;

        // Set download headers
        set.headers = {
          'Content-Type': 'application/zip',
          'Content-Length': zipSize.toString(),
          'Content-Disposition': `attachment; filename="${zipFilename}"`,
          'Cache-Control': 'no-cache'
        };

        // Clean up the zip file after a delay (30 minutes)
        setTimeout(async () => {
          try {
            if (existsSync(zipPath)) {
              await Bun.$`rm ${zipPath}`;
            }
          } catch (error) {
            console.error('Failed to clean up zip file:', error);
          }
        }, 30 * 60 * 1000);

        return zipFile;

      } else if (format === 'pdf') {
        // For PDF generation, you would typically use a library like Puppeteer or similar
        // This is a simplified implementation
        throw Errors.InvalidParameters('PDF export not yet implemented');
      }

      throw Errors.InvalidParameters('Invalid export format');

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  }, {
    body: t.Object({
      photoIds: t.Array(t.Number()),
      format: t.Optional(t.Union([t.Literal('zip'), t.Literal('pdf')])),
      options: t.Optional(t.Object({
        quality: t.Optional(t.Union([t.Literal('high'), t.Literal('print')])),
        includeOriginals: t.Optional(t.Boolean()),
        paperSize: t.Optional(t.Union([t.Literal('4x6'), t.Literal('5x7'), t.Literal('8x10')])),
        layout: t.Optional(t.Union([t.Literal('single'), t.Literal('grid')]))
      }))
    })
  })

  // Download export file
  .get('/export/:exportId', async ({ params, set }) => {
    try {
      const { exportId } = params;

      // Validate export ID format
      if (!/^export_\d+_[a-z0-9]+$/.test(exportId)) {
        throw Errors.InvalidParameters('Invalid export ID format');
      }

      const exportPath = join(process.cwd(), 'uploads', 'exports');
      const filePath = join(exportPath, `${exportId}.zip`);

      if (!existsSync(filePath)) {
        set.status = 410; // Gone - file expired or not found
        return {
          success: false,
          error: {
            code: 'FILE_EXPIRED',
            message: 'Export file has expired or does not exist'
          }
        };
      }

      const file = Bun.file(filePath);
      const fileSize = file.size;

      set.headers = {
        'Content-Type': 'application/zip',
        'Content-Length': fileSize.toString(),
        'Content-Disposition': `attachment; filename="${exportId}.zip"`,
        'Cache-Control': 'no-cache'
      };

      return file;

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  });