import { db } from '../../database/supabase'
import { uploadImage, createThumbnail } from '../../utils/storage'
import { ImageProcessor } from '../../services/ImageProcessor'

const imageProcessor = new ImageProcessor()

export abstract class FiltersService {
  static async getAllFilters() {
    // Get all active filter categories
    const categories = await db.select('filter_categories', '*', { is_active: true })

    // Get all active filters
    const filters = await db.select('filters', '*', { is_active: true })

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
        .map((filter: any) => FiltersService.formatFilterResponse(filter))
        .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
    }))

    return result
  }

  static async getFilterById(filterId: number) {
    const filters = await db.select('filters', '*', {
      id: filterId,
      is_active: true
    })

    if (!filters || filters.length === 0) {
      throw new Error('Filter not found')
    }

    return filters[0]
  }

  static async getPopularFilters(limit: number = 10) {
    // Get filters ordered by usage count
    const { data: filters, error } = await db.client
      .from('filters')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (filters || []).map((filter: any) => ({
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
    }))
  }

  static async applyFilterToPhoto(
    photoId: number,
    filterId: number,
    userId: number,
    intensity: number = 1.0,
    customParameters: Record<string, any> = {}
  ) {
    let tempFilePath: string | null = null

    try {
      // Check if photo exists and belongs to user
      const photos = await db.select('photos', '*', { id: photoId, user_id: userId })
      if (!photos || photos.length === 0) {
        throw new Error('Photo not found')
      }

      const photo = photos[0] as any

      // Check if filter exists
      const filters = await db.select('filters', '*', { id: filterId, is_active: true })
      if (!filters || filters.length === 0) {
        throw new Error('Filter not found')
      }

      const filter = filters[0] as any

      // Download the original image from Supabase to apply filter
      if (!photo.original_path) {
        throw new Error('Original photo path not found')
      }

      // Download the image from Supabase
      const response = await fetch(photo.original_path)
      if (!response.ok) {
        throw new Error('Failed to download original photo from storage')
      }

      // Save temporarily to local file system for ImageProcessor
      const imageBuffer = await response.arrayBuffer()
      const tempDir = '/tmp'
      const tempFileName = `temp-${Date.now()}-${photo.filename}`
      tempFilePath = `${tempDir}/${tempFileName}`

      // Write to temp file
      await Bun.write(tempFilePath, imageBuffer)

      // Apply filter using the ImageProcessor with local temp file
      const filterResult = await imageProcessor.applyFilter(
        tempFilePath,
        FiltersService.formatFilterForProcessor(filter),
        intensity,
        customParameters
      )

      // Generate filename for processed image
      const timestamp = Date.now()
      const processedFilename = `${timestamp}-${filter.name}-${photo.filename}`

      // Read the processed file and upload to Supabase processed/ folder
      const processedImageBuffer = await Bun.file(filterResult.processedPath).arrayBuffer()
      const uploadResult = await uploadImage(Buffer.from(processedImageBuffer), processedFilename, 'processed')

      if (!uploadResult.success) {
        throw new Error('Failed to upload processed image')
      }

      // Create thumbnail for the processed image
      const thumbnailResult = await createThumbnail(Buffer.from(processedImageBuffer), processedFilename)

      if (!thumbnailResult.success) {
        console.error('Processed thumbnail creation failed:', thumbnailResult.error)
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
        original_path: photo.original_path,
        thumbnail_path: thumbnailResult.url || uploadResult.url,
        processed_path: uploadResult.url,
        processing_status: 'completed',
        camera_info: photo.camera_info,
        capture_settings: photo.capture_settings,
        location_data: photo.location_data,
        exif_data: photo.exif_data
      })

      const newPhotoId = processedPhoto[0].id

      // Record filter application
      await db.insert('photo_filters', {
        photo_id: newPhotoId,
        filter_id: filterId,
        processing_time_ms: filterResult.processingTimeMs,
        filter_intensity: intensity,
        custom_parameters: customParameters
      })

      // Update filter usage count
      await db.update('filters',
        { usage_count: filter.usage_count + 1 },
        { id: filterId }
      )

      // Update user storage usage
      const users = await db.select('users', '*', { id: userId })
      const currentUser = users[0] as any
      await db.update('users',
        { storage_used: currentUser.storage_used + filterResult.fileSize },
        { id: userId }
      )

      // Cleanup temporary files
      try {
        await Bun.$`rm -f ${tempFilePath}`
        await Bun.$`rm -f ${filterResult.processedPath}`
      } catch (cleanupError) {
        console.warn('Failed to cleanup temporary files:', cleanupError)
      }

      // Get the complete processed photo record for response
      const completePhotos = await db.select('photos', '*', { id: newPhotoId })
      const completePhoto = completePhotos[0] as any

      return {
        processedPhoto: {
          ...FiltersService.formatProcessedPhotoResponse(completePhoto),
          originalPhotoId: photoId,
          processingTimeMs: filterResult.processingTimeMs,
          appliedFilter: {
            id: filter.id,
            name: filter.name,
            displayName: filter.display_name,
            filterType: filter.filter_type
          }
        }
      }

    } catch (error) {
      // Cleanup temporary files in case of error
      try {
        if (tempFilePath) {
          await Bun.$`rm -f ${tempFilePath}`
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup temporary files in error handler:', cleanupError)
      }

      throw error
    }
  }

  static formatFilterResponse(filter: any) {
    return {
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
      isPremium: Boolean(filter.is_premium),
      usageCount: filter.usage_count,
      sortOrder: filter.sort_order
    }
  }

  static formatFilterForProcessor(filter: any) {
    return {
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
    }
  }

  static formatProcessedPhotoResponse(photo: any) {
    return {
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
    }
  }
}