import { db } from '../../database/supabase'
import { uploadImage, createThumbnail } from '../../utils/storage'
import sharp from 'sharp'

export abstract class PhotosService {
  static async processAndUploadPhoto(file: File, displayName: string, userId: number) {
    try {
      // Convert File to Buffer
      const fileBuffer = Buffer.from(await file.arrayBuffer())
      const originalFilename = file.name

      // Get image metadata using Sharp
      const metadata = await sharp(fileBuffer).metadata()

      // Generate unique filename
      const timestamp = Date.now()
      const fileExtension = originalFilename.split('.').pop() || 'jpg'
      const filename = `${timestamp}-${originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')}`

      console.log('Processing photo:', {
        originalFilename,
        filename,
        size: fileBuffer.length,
        dimensions: `${metadata.width}x${metadata.height}`
      })

      // Upload original image
      const originalUpload = await uploadImage(fileBuffer, filename, 'original')
      if (!originalUpload.success) {
        throw new Error('Failed to upload original image')
      }

      // Create and upload thumbnail
      const thumbnailResult = await createThumbnail(fileBuffer, filename)
      if (!thumbnailResult.success) {
        console.error('Thumbnail creation failed:', thumbnailResult.error)
      }

      // Insert into database
      const photo = await db.insert('photos', {
        user_id: userId,
        filename,
        original_filename: originalFilename,
        display_name: displayName || originalFilename,
        file_size: fileBuffer.length,
        mime_type: file.type || 'image/jpeg',
        width: metadata.width || 0,
        height: metadata.height || 0,
        original_path: originalUpload.url,
        thumbnail_path: thumbnailResult.success ? thumbnailResult.url : originalUpload.url,
        processing_status: 'completed'
      })

      return photo[0]
    } catch (error) {
      console.error('Photo processing error:', error)
      throw error
    }
  }

  static async getUserPhotos(userId: number, page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit

    // Get photos with pagination
    const { data: photos, error } = await db.client
      .from('photos')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Get total count
    const { count } = await db.client
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null)

    const totalPages = Math.ceil((count || 0) / limit)

    return {
      photos: photos || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    }
  }

  static async getPhotoById(photoId: number, userId: number) {
    const photos = await db.select('photos', '*', {
      id: photoId,
      user_id: userId,
          })

    if (!photos || photos.length === 0) {
      throw new Error('Photo not found')
    }

    // Increment view count
    const photo = photos[0] as any
    await db.update('photos',
      { view_count: photo.view_count + 1 },
      { id: photoId }
    )

    return { ...photo, view_count: photo.view_count + 1 }
  }

  static async updatePhoto(photoId: number, userId: number, updates: any) {
    const photos = await db.select('photos', '*', {
      id: photoId,
      user_id: userId,
          })

    if (!photos || photos.length === 0) {
      throw new Error('Photo not found')
    }

    await db.update('photos', updates, { id: photoId })

    const updatedPhotos = await db.select('photos', '*', { id: photoId })
    return updatedPhotos[0]
  }

  static async deletePhoto(photoId: number, userId: number) {
    const photos = await db.select('photos', '*', {
      id: photoId,
      user_id: userId,
          })

    if (!photos || photos.length === 0) {
      throw new Error('Photo not found')
    }

    // Soft delete
    await db.update('photos',
      { deleted_at: new Date().toISOString() },
      { id: photoId }
    )

    return true
  }

  static async toggleFavorite(photoId: number, userId: number) {
    const photo = await PhotosService.getPhotoById(photoId, userId)
    const newFavoriteStatus = !photo.is_favorite

    await db.update('photos',
      { is_favorite: newFavoriteStatus },
      { id: photoId }
    )

    return { ...photo, is_favorite: newFavoriteStatus }
  }

  static formatPhotoResponse(photo: any) {
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
      createdAt: photo.created_at
    }
  }
}