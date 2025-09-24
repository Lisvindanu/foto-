import { Elysia, t } from 'elysia';
import { db } from '../database/supabase';
import { createSuccessResponse, handleError } from '../utils/errors';

// Simple auth middleware
async function requireAuth(headers: any) {
  const authHeader = headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { success: false, error: 'No token provided', status: 401 };
  }

  const sessionToken = authHeader.substring(7);

  // Find active session
  const sessions = await db.select('user_sessions', '*', {
    session_token: sessionToken,
    is_active: true
  });

  if (!sessions || sessions.length === 0) {
    return { success: false, error: 'Invalid session', status: 401 };
  }

  const session = sessions[0] as any;

  // Get user info
  const users = await db.select('users', '*', { id: session.user_id });
  const user = users[0] as any;

  if (!user || !user.is_active) {
    return { success: false, error: 'User not found or inactive', status: 401 };
  }

  return { success: true, user, session };
}

export const downloadsRoutes = new Elysia({ prefix: '/api/downloads' })

  // Download specific photo variant
  .get('/photo/:id/:type', async ({ params, headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth(headers);
      if (!authResult.success) {
        set.status = authResult.status;
        return authResult;
      }

      const { user } = authResult;
      const photoId = parseInt(params.id);
      const type = params.type as 'original' | 'processed' | 'thumbnail';

      // Validate type
      if (!['original', 'processed', 'thumbnail'].includes(type)) {
        set.status = 400;
        return {
          success: false,
          error: 'Invalid photo type. Must be: original, processed, or thumbnail'
        };
      }

      // Get photo info
      const photos = await db.select('photos', '*', {
        id: photoId,
        user_id: user.id
      });

      if (!photos || photos.length === 0) {
        set.status = 404;
        return {
          success: false,
          error: 'Photo not found'
        };
      }

      const photo = photos[0] as any;

      // Get the appropriate URL based on type
      let downloadUrl: string;
      switch (type) {
        case 'original':
          downloadUrl = photo.original_path;
          break;
        case 'processed':
          downloadUrl = photo.processed_path || photo.original_path;
          break;
        case 'thumbnail':
          downloadUrl = photo.thumbnail_path || photo.original_path;
          break;
        default:
          downloadUrl = photo.original_path;
      }

      if (!downloadUrl) {
        set.status = 404;
        return {
          success: false,
          error: `${type} version not available`
        };
      }

      // Fetch the file from Supabase and return as blob
      const imageResponse = await fetch(downloadUrl);
      if (!imageResponse.ok) {
        set.status = 404;
        return {
          success: false,
          error: 'File not found in storage'
        };
      }

      const imageBuffer = await imageResponse.arrayBuffer();

      // Set appropriate headers
      set.headers = {
        'Content-Type': photo.mime_type || 'image/jpeg',
        'Content-Disposition': `attachment; filename="${photo.filename}"`,
        'Content-Length': imageBuffer.byteLength.toString()
      };

      return new Response(imageBuffer);

    } catch (error) {
      console.error('Download error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Get photo info (metadata)
  .get('/photo/:id/info', async ({ params, headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth(headers);
      if (!authResult.success) {
        set.status = authResult.status;
        return authResult;
      }

      const { user } = authResult;
      const photoId = parseInt(params.id);

      // Get photo info
      const photos = await db.select('photos', '*', {
        id: photoId,
        user_id: user.id
      });

      if (!photos || photos.length === 0) {
        set.status = 404;
        return {
          success: false,
          error: 'Photo not found'
        };
      }

      const photo = photos[0] as any;

      return createSuccessResponse({
        id: photo.id,
        filename: photo.filename,
        originalFilename: photo.original_filename,
        displayName: photo.display_name,
        fileSize: photo.file_size,
        mimeType: photo.mime_type,
        width: photo.width,
        height: photo.height,
        createdAt: photo.created_at,
        availableVersions: {
          original: !!photo.original_path,
          processed: !!photo.processed_path,
          thumbnail: !!photo.thumbnail_path
        },
        urls: {
          original: photo.original_path,
          processed: photo.processed_path,
          thumbnail: photo.thumbnail_path
        }
      }, 'Photo info retrieved successfully');

    } catch (error) {
      console.error('Get photo info error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Batch download multiple photos as ZIP
  .post('/batch', async ({ body, headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth(headers);
      if (!authResult.success) {
        set.status = authResult.status;
        return authResult;
      }

      const { user } = authResult;
      const { photoIds, type = 'original', format = 'zip' } = body as {
        photoIds: number[];
        type?: 'original' | 'processed' | 'thumbnail';
        format?: 'zip';
      };

      if (!photoIds || photoIds.length === 0) {
        set.status = 400;
        return {
          success: false,
          error: 'No photos specified'
        };
      }

      // Get all requested photos
      const photos = await Promise.all(
        photoIds.map(async (id) => {
          const result = await db.select('photos', '*', {
            id,
            user_id: user.id
          });
          return result?.[0];
        })
      );

      const validPhotos = photos.filter(photo => photo) as any[];

      if (validPhotos.length === 0) {
        set.status = 404;
        return {
          success: false,
          error: 'No valid photos found'
        };
      }

      // For now, let's return a simple response indicating batch download is not implemented
      // In a full implementation, you would use a library like JSZip to create the ZIP file
      set.status = 501;
      return {
        success: false,
        error: 'Batch download not implemented yet. Please download photos individually.'
      };

    } catch (error) {
      console.error('Batch download error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  });