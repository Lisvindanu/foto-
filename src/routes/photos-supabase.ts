import { Elysia, t } from 'elysia';
import { db } from '../database/supabase';
import { uploadImage, createThumbnail } from '../utils/storage';
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

  const session = sessions[0];

  // Get user info
  const users = await db.select('users', '*', { id: session.user_id });
  const user = users[0];

  if (!user || !user.is_active) {
    return { success: false, error: 'User not found or inactive', status: 401 };
  }

  return { success: true, user, session };
}

export const photosRoutes = new Elysia({ prefix: '/api/photos' })

  // Get user photos
  .get('/', async ({ headers, query, set }) => {
    try {
      const authResult = await requireAuth(headers);
      if (!authResult.success) {
        set.status = authResult.status;
        return authResult;
      }

      const { user } = authResult;
      const limit = parseInt(query.limit as string) || 20;
      const offset = parseInt(query.offset as string) || 0;

      // Get photos using Supabase client for better query control
      const { data: photos, error } = await db.client
        .from('photos')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const result = photos.map(photo => ({
        id: photo.id,
        filename: photo.filename,
        originalFilename: photo.original_filename,
        displayName: photo.display_name,
        fileSize: photo.file_size,
        mimeType: photo.mime_type,
        width: photo.width,
        height: photo.height,
        originalPath: photo.original_path,
        thumbnailPath: photo.thumbnail_path,
        processedPath: photo.processed_path,
        isFavorite: photo.is_favorite,
        viewCount: photo.view_count,
        processingStatus: photo.processing_status,
        createdAt: photo.created_at,
        updatedAt: photo.updated_at
      }));

      return createSuccessResponse({
        photos: result,
        pagination: {
          limit,
          offset,
          total: result.length
        }
      });

    } catch (error) {
      console.error('Get photos error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Upload photo with processing
  .post('/upload', async ({ body, headers, set }) => {
    try {
      const authResult = await requireAuth(headers);
      if (!authResult.success) {
        set.status = authResult.status;
        return authResult;
      }

      const { user } = authResult;

      // Parse multipart form data
      if (!body || typeof body !== 'object') {
        set.status = 400;
        return { success: false, error: 'No file data provided' };
      }

      const file = (body as any).file;
      if (!file) {
        set.status = 400;
        return { success: false, error: 'No file field found' };
      }

      console.log('Processing photo upload:', {
        userId: user.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      // Upload to Supabase Storage with proper folder structure
      const fileData = Buffer.from(await file.arrayBuffer());
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name}`;

      // Upload original to originals/ folder
      const originalUpload = await uploadImage(fileData, fileName, 'original');

      if (!originalUpload.success) {
        set.status = 500;
        return originalUpload;
      }

      // Create and upload thumbnail to thumbnails/ folder
      const thumbnailUpload = await createThumbnail(fileData, fileName);

      if (!thumbnailUpload.success) {
        console.error('Thumbnail upload failed:', thumbnailUpload.error);
        // Continue anyway, we can use original as fallback
      }

      // Save photo record to database
      const photoData = {
        user_id: user.id,
        filename: fileName,
        original_filename: file.name,
        display_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        width: 800, // Default, should be extracted from image
        height: 600, // Default, should be extracted from image
        original_path: originalUpload.url,
        thumbnail_path: thumbnailUpload.url || originalUpload.url, // Fallback to original if thumbnail fails
        processed_path: null, // Will be set when filters are applied
        processing_status: 'completed',
        is_favorite: false,
        view_count: 0
      };

      const createdPhotos = await db.insert('photos', photoData);
      const photo = createdPhotos[0];

      return createSuccessResponse({
        photo: {
          id: photo.id,
          filename: photo.filename,
          originalFilename: photo.original_filename,
          displayName: photo.display_name,
          fileSize: photo.file_size,
          width: photo.width,
          height: photo.height,
          originalPath: photo.original_path,
          thumbnailPath: photo.thumbnail_path,
          processedPath: photo.processed_path,
          isFavorite: photo.is_favorite,
          processingStatus: photo.processing_status,
          createdAt: photo.created_at
        },
        uploadUrl: originalUpload.url
      }, 'Photo uploaded successfully');

    } catch (error) {
      console.error('Upload photo error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Get photo by ID
  .get('/:id', async ({ params, headers, set }) => {
    try {
      const authResult = await requireAuth(headers);
      if (!authResult.success) {
        set.status = authResult.status;
        return authResult;
      }

      const { user } = authResult;
      const photoId = parseInt(params.id);

      const photos = await db.select('photos', '*', {
        id: photoId,
        user_id: user.id
      });

      if (!photos || photos.length === 0) {
        set.status = 404;
        return { success: false, error: 'Photo not found' };
      }

      const photo = photos[0];

      return createSuccessResponse({
        id: photo.id,
        filename: photo.filename,
        originalFilename: photo.original_filename,
        displayName: photo.display_name,
        fileSize: photo.file_size,
        width: photo.width,
        height: photo.height,
        originalPath: photo.original_path,
        thumbnailPath: photo.thumbnail_path,
        processedPath: photo.processed_path,
        isFavorite: photo.is_favorite,
        viewCount: photo.view_count,
        processingStatus: photo.processing_status,
        createdAt: photo.created_at
      });

    } catch (error) {
      console.error('Get photo error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  });