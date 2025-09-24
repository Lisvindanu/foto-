import { Elysia, t } from 'elysia';
import { db } from '../database/connection';
import { getAppSettings } from '../database/init';
import { ImageProcessor } from '../services/ImageProcessor';
import type {
  PhotoTable,
  FilterTable,
  PhotoFilterTable,
  GetPhotosRequest,
  UpdatePhotoRequest,
  PhotoWithFilters,
  PhotoResponse,
  PhotosResponse
} from '../types';
import {
  validateRequired,
  validatePagination,
  validateFileSize,
  validateMimeType,
  validateSortParams,
  combineValidationResults,
  sanitizeFilename,
  generateSessionToken
} from '../utils/validation';
import { Errors, createSuccessResponse, handleError } from '../utils/errors';
import { requireAuth } from './auth';

const imageProcessor = new ImageProcessor();

// Helper function for safe JSON parsing
function parseJSON(str: string, defaultValue: any = null) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

export const photosRoutes = new Elysia({ prefix: '/api/photos' })

  // Upload photo
  .post('/upload', async ({ body, headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth()({ headers, set });
      if ('success' in authResult && !authResult.success) {
        return authResult;
      }
      const { userId, user } = authResult as any;

      const settings = await getAppSettings();
      const { file, filterId, quality, metadata } = body as any;

      // Validation
      const validation = combineValidationResults(
        validateRequired(file, 'file'),
        validateFileSize(file.size, settings.max_file_size),
        validateMimeType(file.type, settings.allowed_mime_types)
      );

      if (!validation.isValid) {
        const error = validation.firstError!;
        throw new (Errors as any)[error.code](error.message);
      }

      // Check storage quota
      if (user.storageUsed + file.size > user.storageQuota) {
        throw Errors.QuotaExceeded();
      }

      // Check max photos limit
      const photoCountQuery = db.query('SELECT COUNT(*) as count FROM photos WHERE user_id = ? AND deleted_at IS NULL');
      const { count } = await photoCountQuery.get([userId]) as { count: number };

      if (count >= settings.max_photos_per_user) {
        throw Errors.MaxPhotosExceeded(settings.max_photos_per_user);
      }

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const randomId = generateSessionToken().split('-')[0];
      const ext = file.name.split('.').pop();
      const filename = `${timestamp}_${randomId}.${ext}`;

      // Process image
      const fileBuffer = await file.arrayBuffer();
      const processResult = await imageProcessor.processUpload(
        Buffer.from(fileBuffer),
        filename,
        { quality: quality === 'high' ? 95 : 85 }
      );

      // Parse metadata
      const cameraInfo = metadata?.cameraInfo || {};
      const captureSettings = metadata?.captureSettings || { quality: quality || 'normal' };
      const locationData = metadata?.location || {};

      // Insert photo record
      const insertPhotoQuery = db.query(`
        INSERT INTO photos (
          user_id, filename, original_filename, display_name, file_size, mime_type,
          width, height, original_path, thumbnail_path,
          camera_info, capture_settings, location_data, exif_data,
          processing_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const photoResult = await insertPhotoQuery.run([
        userId,
        filename,
        file.name,
        file.name, // display_name = original filename
        file.size,
        file.type,
        processResult.metadata.width || 0,
        processResult.metadata.height || 0,
        processResult.originalPath,
        processResult.thumbnailPath,
        JSON.stringify(cameraInfo),
        JSON.stringify(captureSettings),
        JSON.stringify(locationData),
        JSON.stringify({}), // EXIF data would be extracted here
        'completed'
      ]);

      const photoId = photoResult.lastInsertRowid;

      // Apply filter if specified
      let appliedFilter = null;
      let processedPath = null;

      if (filterId) {
        const filterQuery = db.query('SELECT * FROM filters WHERE id = ? AND is_active = 1');
        const filter = await filterQuery.get([filterId]) as FilterTable | null;

        if (filter) {
          try {
            const filterResult = await imageProcessor.applyFilter(
              processResult.originalPath,
              {
                id: filter.id,
                name: filter.name,
                displayName: filter.display_name,
                filterType: filter.filter_type as any,
                parameters: parseJSON(filter.parameters),
                processingComplexity: filter.processing_complexity as any,
                categoryId: filter.category_id,
                description: filter.description,
                cssClass: filter.css_class,
                previewImage: filter.preview_image,
                textureImage: filter.texture_image,
                lutFile: filter.lut_file,
                isPremium: Boolean(filter.is_premium),
                isActive: Boolean(filter.is_active),
                usageCount: filter.usage_count,
                sortOrder: filter.sort_order,
                createdAt: filter.created_at,
                updatedAt: filter.updated_at
              }
            );

            processedPath = filterResult.processedPath;

            // Record filter application
            const insertFilterQuery = db.query(`
              INSERT INTO photo_filters (
                photo_id, filter_id, processing_time_ms, result_file_path, file_size
              ) VALUES (?, ?, ?, ?, ?)
            `);

            await insertFilterQuery.run([
              photoId,
              filterId,
              filterResult.processingTimeMs,
              filterResult.processedPath,
              filterResult.fileSize
            ]);

            // Update filter usage count
            const updateFilterUsageQuery = db.query('UPDATE filters SET usage_count = usage_count + 1 WHERE id = ?');
            await updateFilterUsageQuery.run([filterId]);

            appliedFilter = {
              id: filter.id,
              name: filter.name,
              displayName: filter.display_name
            };

          } catch (filterError) {
            console.error('Filter application failed:', filterError);
            // Continue without filter
          }
        }
      }

      // Update photo with processed path if filter was applied
      if (processedPath) {
        const updatePhotoQuery = db.query('UPDATE photos SET processed_path = ? WHERE id = ?');
        await updatePhotoQuery.run([processedPath, photoId]);
      }

      // Update user storage
      const updateStorageQuery = db.query('UPDATE users SET storage_used = storage_used + ? WHERE id = ?');
      await updateStorageQuery.run([file.size, userId]);

      // Get complete photo record
      const getPhotoQuery = db.query('SELECT * FROM photos WHERE id = ?');
      const photo = await getPhotoQuery.get([photoId]) as PhotoTable;

      const photoResponse = {
        id: photo.id,
        userId: photo.user_id,
        filename: photo.filename || '',
        originalFilename: photo.original_filename || '',
        displayName: photo.display_name || photo.original_filename || '',
        originalPath: photo.original_path || '',
        thumbnailPath: photo.thumbnail_path || '',
        processedPath: photo.processed_path || null,
        fileSize: photo.file_size || 0,
        mimeType: photo.mime_type || '',
        width: photo.width || 0,
        height: photo.height || 0,
        cameraInfo: parseJSON(photo.camera_info, {}),
        captureSettings: parseJSON(photo.capture_settings, {}),
        locationData: parseJSON(photo.location_data, {}),
        exifData: parseJSON(photo.exif_data, {}),
        processingStatus: photo.processing_status || 'completed',
        isFavorite: Boolean(photo.is_favorite),
        viewCount: photo.view_count || 0,
        createdAt: photo.created_at,
        updatedAt: photo.updated_at,
        lastViewedAt: photo.last_viewed_at || null,
        deletedAt: photo.deleted_at || null,
        appliedFilters: []
      };

      set.status = 201;
      return createSuccessResponse<PhotoResponse>({
        photo: photoResponse,
        appliedFilter
      }, 'Photo uploaded successfully');

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  }, {
    body: t.Object({
      file: t.File(),
      filterId: t.Optional(t.Numeric()),
      quality: t.Optional(t.Union([t.Literal('normal'), t.Literal('high')])),
      metadata: t.Optional(t.Object({
        cameraInfo: t.Optional(t.Any()),
        captureSettings: t.Optional(t.Any()),
        location: t.Optional(t.Any())
      }))
    })
  })

  // Get user photos
  .get('/', async ({ query, headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth()({ headers, set });
      if ('success' in authResult && !authResult.success) {
        return authResult;
      }
      const { userId } = authResult as any;

      const {
        page = 1,
        limit = 20,
        filter,
        favorite,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = query as GetPhotosRequest;

      // Validation
      const validation = combineValidationResults(
        validatePagination(page, limit),
        validateSortParams(sortBy, sortOrder)
      );

      if (!validation.isValid) {
        const error = validation.firstError!;
        throw new (Errors as any)[error.code](error.message);
      }

      const offset = (page - 1) * limit;

      // Build query
      let whereClause = 'WHERE p.user_id = ? AND p.deleted_at IS NULL';
      const queryParams: any[] = [userId];

      if (favorite !== undefined) {
        whereClause += ' AND p.is_favorite = ?';
        queryParams.push(favorite ? 1 : 0);
      }

      if (search) {
        whereClause += ' AND (p.display_name LIKE ? OR p.original_filename LIKE ?)';
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      if (filter) {
        whereClause += ` AND EXISTS (
          SELECT 1 FROM photo_filters pf
          JOIN filters f ON pf.filter_id = f.id
          WHERE pf.photo_id = p.id AND f.name = ?
        )`;
        queryParams.push(filter);
      }

      // Get total count
      const countQuery = db.query(`SELECT COUNT(*) as total FROM photos p ${whereClause}`);
      const { total } = await countQuery.get(queryParams) as { total: number };

      // Use mysql2 query method instead of execute to avoid parameter binding issues
      const { DatabaseManager } = require('../database/connection');
      const pool = DatabaseManager.getInstance();

      const sql = `
        SELECT p.*
        FROM photos p
        ${whereClause}
        ORDER BY p.${sortBy} ${sortOrder.toUpperCase()}
        LIMIT ${limit} OFFSET ${offset}
      `;

      console.log('Photos query params for WHERE:', queryParams);
      console.log('SQL with inline LIMIT/OFFSET:', sql);

      const [photoRows] = await pool.query(sql, queryParams);
      const photos = photoRows as PhotoTable[];

      // Format response
      const photosResponse: PhotoWithFilters[] = photos.map(photo => ({
        id: photo.id,
        userId: photo.user_id,
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
        cameraInfo: parseJSON(photo.camera_info),
        captureSettings: parseJSON(photo.capture_settings),
        locationData: parseJSON(photo.location_data),
        exifData: parseJSON(photo.exif_data),
        processingStatus: photo.processing_status as any,
        processingError: photo.processing_error,
        isFavorite: Boolean(photo.is_favorite),
        viewCount: photo.view_count,
        lastViewedAt: photo.last_viewed_at,
        createdAt: photo.created_at,
        updatedAt: photo.updated_at,
        deletedAt: photo.deleted_at,
        appliedFilters: []
      }));

      return createSuccessResponse<PhotosResponse>({
        photos: photosResponse
      }, undefined, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Get single photo
  .get('/:id', async ({ params, headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth()({ headers, set });
      if ('success' in authResult && !authResult.success) {
        return authResult;
      }
      const { userId } = authResult as any;

      const photoId = parseInt(params.id);

      // Get photo with filters
      const photoQuery = db.query(`
        SELECT p.*,
          GROUP_CONCAT(
            json_object(
              'id', f.id,
              'name', f.name,
              'displayName', f.display_name,
              'filterType', f.filter_type,
              'appliedAt', pf.applied_at,
              'processingTimeMs', pf.processing_time_ms,
              'filterIntensity', pf.filter_intensity
            )
          ) as applied_filters
        FROM photos p
        LEFT JOIN photo_filters pf ON p.id = pf.photo_id
        LEFT JOIN filters f ON pf.filter_id = f.id AND f.is_active = 1
        WHERE p.id = ? AND p.user_id = ? AND p.deleted_at IS NULL
        GROUP BY p.id
      `);

      const result = await photoQuery.get([photoId, userId]) as (PhotoTable & { applied_filters: string }) | null;

      if (!result) {
        throw Errors.PhotoNotFound(photoId);
      }

      // Update view count
      const updateViewQuery = db.query('UPDATE photos SET view_count = view_count + 1, last_viewed_at = CURRENT_TIMESTAMP WHERE id = ?');
      await updateViewQuery.run([photoId]);

      // Format response
      const photo = {
        id: result.id,
        userId: result.user_id,
        filename: result.filename,
        originalFilename: result.original_filename,
        displayName: result.display_name,
        fileSize: result.file_size,
        mimeType: result.mime_type,
        width: result.width,
        height: result.height,
        originalPath: result.original_path,
        thumbnailPath: result.thumbnail_path,
        processedPath: result.processed_path,
        cameraInfo: parseJSON(result.camera_info),
        captureSettings: parseJSON(result.capture_settings),
        locationData: parseJSON(result.location_data),
        exifData: parseJSON(result.exif_data),
        processingStatus: result.processing_status as any,
        processingError: result.processing_error,
        isFavorite: Boolean(result.is_favorite),
        viewCount: result.view_count + 1, // Include the increment
        lastViewedAt: new Date().toISOString(),
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        deletedAt: result.deleted_at
      };

      const appliedFilters = result.applied_filters ?
        result.applied_filters.split(',').map(filterStr => parseJSON(filterStr)) : [];

      return createSuccessResponse<PhotoResponse>({
        photo,
        appliedFilters
      });

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Update photo
  .put('/:id', async ({ params, body, headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth()({ headers, set });
      if ('success' in authResult && !authResult.success) {
        return authResult;
      }
      const { userId } = authResult as any;

      const photoId = parseInt(params.id);
      const { displayName, isFavorite } = body as UpdatePhotoRequest;

      // Check if photo exists and belongs to user
      const checkQuery = db.query('SELECT id FROM photos WHERE id = ? AND user_id = ? AND deleted_at IS NULL');
      const photo = await checkQuery.get([photoId, userId]);

      if (!photo) {
        throw Errors.PhotoNotFound(photoId);
      }

      // Build update query
      const updates: string[] = [];
      const updateParams: any[] = [];

      if (displayName !== undefined) {
        updates.push('display_name = ?');
        updateParams.push(displayName);
      }

      if (isFavorite !== undefined) {
        updates.push('is_favorite = ?');
        updateParams.push(isFavorite ? 1 : 0);
      }

      if (updates.length === 0) {
        throw Errors.InvalidParameters('No valid fields to update');
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      updateParams.push(photoId);

      const updateQuery = db.query(`UPDATE photos SET ${updates.join(', ')} WHERE id = ?`);
      await updateQuery.run(updateParams);

      // Get updated photo
      const getUpdatedQuery = db.query('SELECT * FROM photos WHERE id = ?');
      const updatedPhoto = await getUpdatedQuery.get([photoId]) as PhotoTable;

      const photoResponse = {
        id: updatedPhoto.id,
        displayName: updatedPhoto.display_name,
        isFavorite: Boolean(updatedPhoto.is_favorite),
        updatedAt: updatedPhoto.updated_at
      };

      return createSuccessResponse({ photo: photoResponse }, 'Photo updated successfully');

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  }, {
    body: t.Object({
      displayName: t.Optional(t.String()),
      isFavorite: t.Optional(t.Boolean())
    })
  })

  // Delete photo
  .delete('/:id', async ({ params, headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth()({ headers, set });
      if ('success' in authResult && !authResult.success) {
        return authResult;
      }
      const { userId } = authResult as any;

      const photoId = parseInt(params.id);

      // Get photo info before deletion
      const photoQuery = db.query('SELECT * FROM photos WHERE id = ? AND user_id = ? AND deleted_at IS NULL');
      const photo = await photoQuery.get([photoId, userId]) as PhotoTable | null;

      if (!photo) {
        throw Errors.PhotoNotFound(photoId);
      }

      // Soft delete
      const deleteQuery = db.query('UPDATE photos SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?');
      await deleteQuery.run([photoId]);

      // Update user storage
      const updateStorageQuery = db.query('UPDATE users SET storage_used = storage_used - ? WHERE id = ?');
      await updateStorageQuery.run([photo.file_size, userId]);

      return createSuccessResponse(null, 'Photo deleted successfully');

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Toggle favorite
  .post('/:id/favorite', async ({ params, headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth()({ headers, set });
      if ('success' in authResult && !authResult.success) {
        return authResult;
      }
      const { userId } = authResult as any;

      const photoId = parseInt(params.id);

      // Check if photo exists
      const checkQuery = db.query('SELECT is_favorite FROM photos WHERE id = ? AND user_id = ? AND deleted_at IS NULL');
      const photo = await checkQuery.get([photoId, userId]) as { is_favorite: number } | null;

      if (!photo) {
        throw Errors.PhotoNotFound(photoId);
      }

      // Toggle favorite
      const newFavoriteStatus = photo.is_favorite ? 0 : 1;
      const updateQuery = db.query('UPDATE photos SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      await updateQuery.run([newFavoriteStatus, photoId]);

      return createSuccessResponse({
        isFavorite: Boolean(newFavoriteStatus)
      }, 'Favorite status updated');

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  });