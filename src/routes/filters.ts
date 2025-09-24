import { Elysia, t } from 'elysia';
import { db } from '../database/connection';
import { ImageProcessor } from '../services/ImageProcessor';
import type {
  FilterTable,
  FilterCategoryTable,
  PhotoTable,
  FilterWithCategory,
  FiltersResponse,
  FilterCategoryWithFilters,
  ApplyFilterRequest,
  ProcessedPhotoResponse
} from '../types';
import {
  validateRequired,
  validateIntensity,
  combineValidationResults
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

export const filtersRoutes = new Elysia({ prefix: '/api/filters' })

  // Get all filters grouped by category
  .get('/', async ({ query, set }) => {
    try {
      const { category, active = true } = query as { category?: string; active?: boolean };

      let whereClause = 'WHERE f.is_active = ?';
      const queryParams: any[] = [active ? 1 : 0];

      if (category) {
        whereClause += ' AND fc.name = ?';
        queryParams.push(category);
      }

      const filtersQuery = db.query(`
        SELECT
          fc.id as category_id,
          fc.name as category_name,
          fc.display_name as category_display_name,
          fc.description as category_description,
          fc.icon as category_icon,
          fc.sort_order as category_sort_order,
          fc.is_active as category_is_active,
          fc.created_at as category_created_at,
          f.id as filter_id,
          f.name as filter_name,
          f.display_name as filter_display_name,
          f.description as filter_description,
          f.filter_type,
          f.parameters,
          f.css_class,
          f.preview_image,
          f.texture_image,
          f.lut_file,
          f.processing_complexity,
          f.is_premium,
          f.usage_count,
          f.sort_order as filter_sort_order,
          f.created_at as filter_created_at,
          f.updated_at as filter_updated_at
        FROM filter_categories fc
        LEFT JOIN filters f ON fc.id = f.category_id AND f.is_active = ?
        ${whereClause}
        AND fc.is_active = 1
        ORDER BY fc.sort_order ASC, f.sort_order ASC
      `);

      queryParams.unshift(active ? 1 : 0); // Add for the JOIN condition
      const results = await filtersQuery.all(queryParams) as any[];

      // Group filters by category
      const categoriesMap = new Map<number, FilterCategoryWithFilters>();

      results.forEach(row => {
        if (!categoriesMap.has(row.category_id)) {
          categoriesMap.set(row.category_id, {
            id: row.category_id,
            name: row.category_name,
            displayName: row.category_display_name,
            description: row.category_description,
            icon: row.category_icon,
            sortOrder: row.category_sort_order,
            isActive: Boolean(row.category_is_active),
            createdAt: row.category_created_at,
            filters: []
          });
        }

        // Add filter if it exists (LEFT JOIN might have null filters)
        if (row.filter_id) {
          const category = categoriesMap.get(row.category_id)!;
          category.filters.push({
            id: row.filter_id,
            categoryId: row.category_id,
            name: row.filter_name,
            displayName: row.filter_display_name,
            description: row.filter_description,
            filterType: row.filter_type,
            parameters: row.parameters || {},
            cssClass: row.css_class,
            previewImage: row.preview_image,
            textureImage: row.texture_image,
            lutFile: row.lut_file,
            processingComplexity: row.processing_complexity,
            isPremium: Boolean(row.is_premium),
            isActive: true, // We filtered for active filters
            usageCount: row.usage_count,
            sortOrder: row.filter_sort_order,
            createdAt: row.filter_created_at,
            updatedAt: row.filter_updated_at
          });
        }
      });

      const categories = Array.from(categoriesMap.values());

      return createSuccessResponse<FiltersResponse>({ categories });

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Get specific filter details
  .get('/:id', async ({ params, set }) => {
    try {
      const filterId = parseInt(params.id);

      const filterQuery = db.query(`
        SELECT
          f.*,
          fc.name as category_name,
          fc.display_name as category_display_name
        FROM filters f
        JOIN filter_categories fc ON f.category_id = fc.id
        WHERE f.id = ? AND f.is_active = 1
      `);

      const result = await filterQuery.get([filterId]) as (FilterTable & {
        category_name: string;
        category_display_name: string;
      }) | null;

      if (!result) {
        throw Errors.FilterNotFound(filterId);
      }

      const filter: FilterWithCategory = {
        id: result.id,
        categoryId: result.category_id,
        name: result.name,
        displayName: result.display_name,
        description: result.description,
        filterType: result.filter_type as any,
        parameters: result.parameters || {},
        cssClass: result.css_class,
        previewImage: result.preview_image,
        textureImage: result.texture_image,
        lutFile: result.lut_file,
        processingComplexity: result.processing_complexity as any,
        isPremium: Boolean(result.is_premium),
        isActive: Boolean(result.is_active),
        usageCount: result.usage_count,
        sortOrder: result.sort_order,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        category: {
          id: result.category_id,
          name: result.category_name,
          displayName: result.category_display_name,
          sortOrder: 0,
          isActive: true,
          createdAt: result.created_at
        }
      };

      return createSuccessResponse({ filter });

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Apply filter to existing photo
  .post('/apply', async ({ body, headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth()({ headers, set });
      if ('success' in authResult && !authResult.success) {
        return authResult;
      }
      const { userId } = authResult as any;

      const {
        photoId,
        filterId,
        intensity = 1.0,
        customParameters = {}
      } = body as ApplyFilterRequest;

      // Validation
      const validation = combineValidationResults(
        validateRequired(photoId, 'photoId'),
        validateRequired(filterId, 'filterId'),
        validateIntensity(intensity)
      );

      if (!validation.isValid) {
        const error = validation.firstError!;
        throw new (Errors as any)[error.code](error.message);
      }

      // Check if photo exists and belongs to user
      const photoQuery = db.query('SELECT * FROM photos WHERE id = ? AND user_id = ? AND deleted_at IS NULL');
      const photo = await photoQuery.get([photoId, userId]) as PhotoTable | null;

      if (!photo) {
        throw Errors.PhotoNotFound(photoId);
      }

      // Check if filter exists
      const filterQuery = db.query('SELECT * FROM filters WHERE id = ? AND is_active = 1');
      const filter = await filterQuery.get([filterId]) as FilterTable | null;

      if (!filter) {
        throw Errors.FilterNotFound(filterId);
      }

      // Check if this filter is already applied to this photo
      const existingFilterQuery = db.query('SELECT id FROM photo_filters WHERE photo_id = ? AND filter_id = ?');
      const existingFilter = await existingFilterQuery.get([photoId, filterId]);

      if (existingFilter) {
        throw Errors.InvalidParameters('Filter already applied to this photo');
      }

      try {
        // Use filter parameters directly (already parsed by MySQL driver)
        const filterParameters = filter.parameters || {};
        console.log('Filter parameters from DB:', filter.parameters);
        console.log('Using filter parameters:', filterParameters);

        // Apply filter
        const filterResult = await imageProcessor.applyFilter(
          photo.original_path,
          {
            id: filter.id,
            name: filter.name,
            displayName: filter.display_name,
            filterType: filter.filter_type as any,
            parameters: filterParameters,
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
          },
          intensity,
          customParameters
        );

        // Create thumbnail from processed image
        const processedThumbnailPath = filterResult.processedPath.replace(/\/([^\/]+)\.([^\.]+)$/, '/$1_thumb.$2').replace('/processed/', '/thumbnails/');
        await imageProcessor.createThumbnail(
          filterResult.processedPath,
          processedThumbnailPath
        );

        // Create new processed photo record
        const insertProcessedQuery = db.query(`
          INSERT INTO photos (
            user_id, filename, original_filename, display_name,
            file_size, mime_type, width, height,
            original_path, thumbnail_path, processed_path,
            camera_info, capture_settings, location_data, exif_data,
            processing_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const randomId = Math.random().toString(36).substring(2, 8);
        const processedFilename = `filtered_${timestamp}_${randomId}_${photo.filename}`;
        const processedResult = await insertProcessedQuery.run([
          userId,
          processedFilename,
          photo.original_filename,
          `${photo.display_name || photo.original_filename} (${filter.display_name})`,
          filterResult.fileSize,
          photo.mime_type,
          photo.width,
          photo.height,
          photo.original_path,
          processedThumbnailPath,
          filterResult.processedPath,
          photo.camera_info,
          photo.capture_settings,
          photo.location_data,
          photo.exif_data,
          'completed'
        ]);

        const processedPhotoId = processedResult.lastInsertRowid;

        // Record filter application
        const insertFilterQuery = db.query(`
          INSERT INTO photo_filters (
            photo_id, filter_id, processing_time_ms, filter_intensity,
            custom_parameters, result_file_path, file_size
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        await insertFilterQuery.run([
          processedPhotoId,
          filterId,
          filterResult.processingTimeMs,
          intensity,
          JSON.stringify(customParameters),
          filterResult.processedPath,
          filterResult.fileSize
        ]);

        // Update filter usage count
        const updateUsageQuery = db.query('UPDATE filters SET usage_count = usage_count + 1 WHERE id = ?');
        await updateUsageQuery.run([filterId]);

        // Update user storage usage
        const updateStorageQuery = db.query('UPDATE users SET storage_used = storage_used + ? WHERE id = ?');
        await updateStorageQuery.run([filterResult.fileSize, userId]);

        // Get the complete processed photo record
        const getProcessedPhotoQuery = db.query('SELECT * FROM photos WHERE id = ?');
        const processedPhotoRecord = await getProcessedPhotoQuery.get([processedPhotoId]) as PhotoTable;

        const processedPhoto = {
          id: processedPhotoRecord.id,
          userId: processedPhotoRecord.user_id,
          filename: processedPhotoRecord.filename || '',
          originalFilename: processedPhotoRecord.original_filename || '',
          displayName: processedPhotoRecord.display_name || processedPhotoRecord.original_filename || '',
          originalPath: processedPhotoRecord.original_path || '',
          thumbnailPath: processedPhotoRecord.thumbnail_path || '',
          processedPath: processedPhotoRecord.processed_path || null,
          fileSize: processedPhotoRecord.file_size || 0,
          mimeType: processedPhotoRecord.mime_type || '',
          width: processedPhotoRecord.width || 0,
          height: processedPhotoRecord.height || 0,
          cameraInfo: parseJSON(processedPhotoRecord.camera_info, {}),
          captureSettings: parseJSON(processedPhotoRecord.capture_settings, {}),
          locationData: parseJSON(processedPhotoRecord.location_data, {}),
          exifData: parseJSON(processedPhotoRecord.exif_data, {}),
          processingStatus: processedPhotoRecord.processing_status || 'completed',
          isFavorite: Boolean(processedPhotoRecord.is_favorite),
          viewCount: processedPhotoRecord.view_count || 0,
          createdAt: processedPhotoRecord.created_at,
          updatedAt: processedPhotoRecord.updated_at,
          lastViewedAt: processedPhotoRecord.last_viewed_at || null,
          deletedAt: processedPhotoRecord.deleted_at || null,
          appliedFilters: [{
            id: filter.id,
            categoryId: filter.category_id,
            name: filter.name,
            displayName: filter.display_name,
            filterType: filter.filter_type,
            parameters: filter.parameters || {},
            processingComplexity: filter.processing_complexity as any,
            isPremium: Boolean(filter.is_premium),
            isActive: Boolean(filter.is_active),
            sortOrder: filter.sort_order,
            createdAt: filter.created_at,
            updatedAt: filter.updated_at
          }]
        };

        set.status = 201;
        return createSuccessResponse<ProcessedPhotoResponse>({
          processedPhoto
        }, 'Filter applied successfully');

      } catch (processingError) {
        console.error('Filter processing failed:', processingError);
        throw Errors.ProcessingFailed(processingError instanceof Error ? processingError.message : 'Unknown error');
      }

    } catch (error) {
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
  })

  // Get filter usage statistics
  .get('/stats/usage', async ({ set }) => {
    try {
      const statsQuery = db.query(`
        SELECT
          f.id,
          f.name,
          f.display_name,
          f.filter_type,
          f.usage_count,
          COUNT(DISTINCT pf.photo_id) as unique_applications,
          COUNT(DISTINCT p.user_id) as unique_users
        FROM filters f
        LEFT JOIN photo_filters pf ON f.id = pf.filter_id
        LEFT JOIN photos p ON pf.photo_id = p.id AND p.deleted_at IS NULL
        WHERE f.is_active = 1
        GROUP BY f.id
        ORDER BY f.usage_count DESC
        LIMIT 20
      `);

      const popularFilters = await statsQuery.all() as any[];

      const categoryStatsQuery = db.query(`
        SELECT
          fc.name as category,
          fc.display_name as category_display_name,
          SUM(f.usage_count) as total_usage,
          COUNT(f.id) as filter_count
        FROM filter_categories fc
        LEFT JOIN filters f ON fc.id = f.category_id AND f.is_active = 1
        WHERE fc.is_active = 1
        GROUP BY fc.id
        ORDER BY total_usage DESC
      `);

      const categoryStats = await categoryStatsQuery.all() as any[];

      return createSuccessResponse({
        popularFilters: popularFilters.map(filter => ({
          filter: {
            id: filter.id,
            name: filter.name,
            displayName: filter.display_name,
            filterType: filter.filter_type,
            usageCount: filter.usage_count
          },
          usageCount: filter.usage_count,
          userCount: filter.unique_users || 0
        })),
        categoryStats: categoryStats.map(cat => ({
          category: cat.category,
          displayName: cat.category_display_name,
          totalUsage: cat.total_usage || 0,
          filterCount: cat.filter_count || 0
        }))
      });

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Get popular filters (most used)
  .get('/popular', async ({ query, set }) => {
    try {
      const { limit = 10 } = query as { limit?: number };

      const popularQuery = db.query(`
        SELECT
          f.*,
          fc.name as category_name,
          fc.display_name as category_display_name
        FROM filters f
        JOIN filter_categories fc ON f.category_id = fc.id
        WHERE f.is_active = 1 AND fc.is_active = 1
        ORDER BY f.usage_count DESC, f.created_at DESC
        LIMIT ?
      `);

      const filters = await popularQuery.all([limit]) as (FilterTable & {
        category_name: string;
        category_display_name: string;
      })[];

      const filtersResponse = filters.map(filter => ({
        id: filter.id,
        categoryId: filter.category_id,
        name: filter.name,
        displayName: filter.display_name,
        description: filter.description,
        filterType: filter.filter_type,
        parameters: filter.parameters || {},
        cssClass: filter.css_class,
        previewImage: filter.preview_image,
        processingComplexity: filter.processing_complexity,
        isPremium: Boolean(filter.is_premium),
        usageCount: filter.usage_count,
        sortOrder: filter.sort_order,
        category: {
          id: filter.category_id,
          name: filter.category_name,
          displayName: filter.category_display_name,
          sortOrder: 0,
          isActive: true,
          createdAt: filter.created_at
        }
      }));

      return createSuccessResponse({ filters: filtersResponse });

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  });