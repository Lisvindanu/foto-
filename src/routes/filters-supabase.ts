import { Elysia, t } from 'elysia';
import { db } from '../database/supabase';
import { createSuccessResponse, handleError } from '../utils/errors';
import { uploadImage, createThumbnail } from '../utils/storage';
import { ImageProcessor } from '../services/ImageProcessor';
import type { ApplyFilterRequest } from '../types/api';

const imageProcessor = new ImageProcessor();

// Authentication helper
async function requireAuth(headers: Record<string, string | undefined>) {
  const authHeader = headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const sessionToken = authHeader.substring(7);

  // Find active session
  const sessions = await db.select('user_sessions', '*', {
    session_token: sessionToken,
    is_active: true
  });

  if (!sessions || sessions.length === 0) {
    throw new Error('Invalid session');
  }

  const session = sessions[0] as any;

  // Check if session is expired
  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    throw new Error('Session expired');
  }

  // Get user info
  const users = await db.select('users', '*', { id: session.user_id });
  const user = users[0] as any;

  if (!user || !user.is_active) {
    throw new Error('User not found or inactive');
  }

  return { userId: user.id };
}

export const filtersRoutes = new Elysia({ prefix: '/api/filters' })

  // Get all filters grouped by category
  .get('/', async ({ set }) => {
    try {
      // Get all active filter categories
      const categories = await db.select('filter_categories', '*', { is_active: true });

      // Get all active filters
      const filters = await db.select('filters', '*', { is_active: true });

      // Group filters by category
      const result = (categories || []).map((category: any) => ({
        id: category.id,
        name: category.name,
        displayName: category.display_name,
        description: category.description,
        icon: category.icon,
        sortOrder: category.sort_order,
        filters: (filters || [])
          .filter((filter: any) => filter.category_id === category.id)
          .map((filter: any) => ({
            id: filter.id,
            name: filter.name,
            displayName: filter.display_name,
            description: filter.description,
            filterType: filter.filter_type,
            parameters: filter.parameters,
            cssClass: filter.css_class,
            previewImage: filter.preview_image,
            textureImage: filter.texture_image,
            lutFile: filter.lut_file,
            processingComplexity: filter.processing_complexity,
            isPremium: filter.is_premium,
            usageCount: filter.usage_count,
            sortOrder: filter.sort_order
          }))
          .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
      }));

      return createSuccessResponse({
        categories: result
      }, 'Filters retrieved successfully');

    } catch (error) {
      console.error('Get filters error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Get specific filter by ID
  .get('/:id', async ({ params, set }) => {
    try {
      const filterId = parseInt(params.id);

      const filters = await db.select('filters', '*', {
        id: filterId,
        is_active: true
      });

      if (!filters || filters.length === 0) {
        set.status = 404;
        return { success: false, error: 'Filter not found' };
      }

      const filter = filters[0] as any;

      return createSuccessResponse({
        id: filter.id,
        name: filter.name,
        displayName: filter.display_name,
        description: filter.description,
        filterType: filter.filter_type,
        parameters: filter.parameters,
        cssClass: filter.css_class,
        previewImage: filter.preview_image,
        textureImage: filter.texture_image,
        lutFile: filter.lut_file,
        processingComplexity: filter.processing_complexity,
        isPremium: filter.is_premium,
        usageCount: filter.usage_count,
        categoryId: filter.category_id
      }, 'Filter retrieved successfully');

    } catch (error) {
      console.error('Get filter error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Get popular filters (most used)
  .get('/popular', async ({ query, set }) => {
    try {
      const limit = parseInt(query.limit as string) || 10;

      // Get filters ordered by usage count
      const { data: filters, error } = await db.client
        .from('filters')
        .select('*')
        .eq('is_active', true)
        .order('usage_count', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const result = (filters || []).map((filter: any) => ({
        id: filter.id,
        name: filter.name,
        displayName: filter.display_name,
        description: filter.description,
        filterType: filter.filter_type,
        parameters: filter.parameters,
        cssClass: filter.css_class,
        previewImage: filter.preview_image,
        usageCount: filter.usage_count,
        categoryId: filter.category_id
      }));

      return createSuccessResponse(result, 'Popular filters retrieved successfully');

    } catch (error) {
      console.error('Get popular filters error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Apply filter to existing photo
  .post('/apply', async ({ body, headers, set }) => {
    let tempFilePath: string | null = null;

    try {
      // Authentication
      const { userId } = await requireAuth(headers);

      const {
        photoId,
        filterId,
        intensity = 1.0,
        customParameters = {}
      } = body as ApplyFilterRequest;

      // Validate required fields
      if (!photoId || !filterId) {
        set.status = 400;
        return {
          success: false,
          error: 'photoId and filterId are required'
        };
      }

      // Check if photo exists and belongs to user
      const photos = await db.select('photos', '*', { id: photoId, user_id: userId });
      if (!photos || photos.length === 0) {
        set.status = 404;
        return {
          success: false,
          error: 'Photo not found'
        };
      }

      const photo = photos[0] as any;

      // Check if filter exists
      const filters = await db.select('filters', '*', { id: filterId, is_active: true });
      if (!filters || filters.length === 0) {
        set.status = 404;
        return {
          success: false,
          error: 'Filter not found'
        };
      }

      const filter = filters[0] as any;

      // Download the original image from Supabase to apply filter
      if (!photo.original_path) {
        set.status = 400;
        return {
          success: false,
          error: 'Original photo path not found'
        };
      }

      // Download the image from Supabase
      const response = await fetch(photo.original_path);
      if (!response.ok) {
        set.status = 400;
        return {
          success: false,
          error: 'Failed to download original photo from storage'
        };
      }

      // Save temporarily to local file system for ImageProcessor
      const imageBuffer = await response.arrayBuffer();
      const tempDir = '/tmp';
      const tempFileName = `temp-${Date.now()}-${photo.filename}`;
      tempFilePath = `${tempDir}/${tempFileName}`;

      // Write to temp file
      await Bun.write(tempFilePath, imageBuffer);

      // Apply filter using the ImageProcessor with local temp file
      const filterResult = await imageProcessor.applyFilter(
        tempFilePath,
        {
          id: filter.id,
          categoryId: filter.category_id,
          name: filter.name,
          displayName: filter.display_name,
          description: filter.description,
          filterType: filter.filter_type as any,
          parameters: filter.parameters || {},
          cssClass: filter.css_class,
          previewImage: filter.preview_image,
          textureImage: filter.texture_image,
          lutFile: filter.lut_file,
          processingComplexity: filter.processing_complexity as any,
          isPremium: Boolean(filter.is_premium),
          isActive: Boolean(filter.is_active),
          usageCount: filter.usage_count,
          sortOrder: filter.sort_order,
          createdAt: filter.created_at,
          updatedAt: filter.updated_at
        },
        intensity,
        customParameters
      );

      // Generate filename for processed image
      const timestamp = Date.now();
      const processedFilename = `${timestamp}-${filter.name}-${photo.filename}`;

      // Read the processed file and upload to Supabase processed/ folder
      const processedImageBuffer = await Bun.file(filterResult.processedPath).arrayBuffer();
      const uploadResult = await uploadImage(Buffer.from(processedImageBuffer), processedFilename, 'processed');

      if (!uploadResult.success) {
        set.status = 500;
        return {
          success: false,
          error: 'Failed to upload processed image'
        };
      }

      // Create thumbnail for the processed image
      const thumbnailResult = await createThumbnail(Buffer.from(processedImageBuffer), processedFilename);

      if (!thumbnailResult.success) {
        console.error('Processed thumbnail creation failed:', thumbnailResult.error);
      }

      // Create new processed photo record
      const processedPhoto = await db.insert('photos', {
        user_id: userId,
        filename: processedFilename,
        original_filename: photo.original_filename,
        display_name: `${photo.display_name || photo.original_filename} (${filter.display_name})`,
        file_size: filterResult.fileSize,
        mime_type: photo.mime_type,
        width: photo.width,
        height: photo.height,
        original_path: photo.original_path, // Keep reference to original
        thumbnail_path: thumbnailResult.url || uploadResult.url, // Use processed thumbnail or processed image
        processed_path: uploadResult.url, // This is the processed image
        processing_status: 'completed',
        camera_info: photo.camera_info,
        capture_settings: photo.capture_settings,
        location_data: photo.location_data,
        exif_data: photo.exif_data
      });

      const newPhotoId = processedPhoto[0].id;

      // Record filter application
      await db.insert('photo_filters', {
        photo_id: newPhotoId,
        filter_id: filterId,
        processing_time_ms: filterResult.processingTimeMs,
        filter_intensity: intensity,
        custom_parameters: customParameters
      });

      // Update filter usage count
      await db.update('filters',
        { usage_count: filter.usage_count + 1 },
        { id: filterId }
      );

      // Update user storage usage
      const users = await db.select('users', '*', { id: userId });
      const currentUser = users[0] as any;
      await db.update('users',
        { storage_used: currentUser.storage_used + filterResult.fileSize },
        { id: userId }
      );

      // Cleanup temporary files
      try {
        await Bun.$`rm -f ${tempFilePath}`;
        await Bun.$`rm -f ${filterResult.processedPath}`;
      } catch (cleanupError) {
        console.warn('Failed to cleanup temporary files:', cleanupError);
      }

      // Get the complete processed photo record for frontend
      const completePhotos = await db.select('photos', '*', { id: newPhotoId });
      const completePhoto = completePhotos[0] as any;

      set.status = 201;
      return createSuccessResponse({
        processedPhoto: {
          id: completePhoto.id,
          filename: completePhoto.filename,
          originalFilename: completePhoto.original_filename,
          displayName: completePhoto.display_name,
          fileSize: completePhoto.file_size,
          mimeType: completePhoto.mime_type,
          width: completePhoto.width,
          height: completePhoto.height,
          originalPath: completePhoto.original_path,
          thumbnailPath: completePhoto.thumbnail_path,
          processedPath: completePhoto.processed_path,
          isFavorite: completePhoto.is_favorite,
          viewCount: completePhoto.view_count,
          processingStatus: completePhoto.processing_status,
          createdAt: completePhoto.created_at,
          updatedAt: completePhoto.updated_at,
          // Additional metadata for processed photo
          originalPhotoId: photoId,
          processingTimeMs: filterResult.processingTimeMs,
          appliedFilter: {
            id: filter.id,
            name: filter.name,
            displayName: filter.display_name,
            filterType: filter.filter_type
          }
        }
      }, 'Filter applied successfully');

    } catch (error) {
      console.error('Apply filter error:', error);

      // Cleanup temporary files in case of error
      try {
        if (tempFilePath) {
          await Bun.$`rm -f ${tempFilePath}`;
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup temporary files in error handler:', cleanupError);
      }

      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  }, {
    body: t.Object({
      photoId: t.Number(),
      filterId: t.Number(),
      intensity: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
      customParameters: t.Optional(t.Record(t.String(), t.Any()))
    })
  });