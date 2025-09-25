import { Elysia } from 'elysia'
import { PhotosService } from './service'
import { PhotosModel } from './model'
import { AuthService } from '../auth/service'
import { createSuccessResponse, handleError } from '../../utils/errors'
import { db } from '../../database/supabase'

// Authentication plugin for photos module
const authPlugin = new Elysia({ name: 'photos.auth' })
  .derive(async ({ headers, set }) => {
    console.log('🔑 PHOTOS AUTH PLUGIN CALLED!')
    try {
      console.log('Photos auth plugin - all headers:', Object.keys(headers))
      console.log('Photos auth plugin - authorization header:', headers.authorization)

      const authHeader = headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        console.log('Photos auth plugin - No valid authorization header, received:', authHeader)
        set.status = 401
        throw new Error('No token provided')
      }

      const sessionToken = authHeader.substring(7)
      console.log('Photos auth plugin - sessionToken:', sessionToken)

      const { user } = await AuthService.validateSession(sessionToken)
      console.log('Photos auth plugin - validated user:', JSON.stringify(user, null, 2))

      const result = { userId: user.id }
      console.log('Photos auth plugin - returning:', JSON.stringify(result, null, 2))
      return result
    } catch (error) {
      console.error('Photos auth plugin error:', error)
      set.status = 401
      throw new Error('Authentication failed')
    }
  })

export const photosModule = new Elysia({ prefix: '/api/photos' })
  .model(PhotosModel)

  // Upload photo
  .post('/upload', async ({ body, headers, set }) => {
    try {
      console.log('🔑 UPLOAD - Headers received:', Object.keys(headers))
      console.log('🔑 UPLOAD - Authorization:', headers.authorization)

      // Manual authentication
      const authHeader = headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No token provided' },
          timestamp: new Date().toISOString()
        }
      }

      const sessionToken = authHeader.substring(7)
      const { user } = await AuthService.validateSession(sessionToken)
      const userId = user.id

      console.log('🔑 UPLOAD - Authenticated userId:', userId)
      console.log('Upload request - body type:', typeof body, 'keys:', Object.keys(body || {}))

      if (!body || typeof body !== 'object') {
        set.status = 400
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No file data provided'
          },
          timestamp: new Date().toISOString()
        }
      }

      const file = (body as any).file
      const displayName = (body as any).displayName || ''

      if (!file) {
        set.status = 400
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No file field found'
          },
          timestamp: new Date().toISOString()
        }
      }

      console.log('Processing upload for user:', userId, 'file:', file.name)

      const photo = await PhotosService.processAndUploadPhoto(file, displayName, userId)

      // Update user storage usage
      const users = await db.select('users', '*', { id: userId })
      const currentUser = users[0] as any
      await db.update('users',
        { storage_used: currentUser.storage_used + photo.file_size },
        { id: userId }
      )

      set.status = 201
      return createSuccessResponse({
        photo: PhotosService.formatPhotoResponse(photo)
      }, 'Photo uploaded successfully')

    } catch (error) {
      console.error('Upload error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      201: 'uploadResponse',
      400: 'errorResponse',
      500: 'errorResponse'
    }
  })

  // Get user photos
  .get('/', async ({ query, headers, set }) => {
    try {
      console.log('🔑 GET PHOTOS - Headers received:', Object.keys(headers))
      console.log('🔑 GET PHOTOS - Authorization:', headers.authorization)

      // Manual authentication
      const authHeader = headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No token provided' },
          timestamp: new Date().toISOString()
        }
      }

      const sessionToken = authHeader.substring(7)
      const { user } = await AuthService.validateSession(sessionToken)
      const userId = user.id

      console.log('🔑 GET PHOTOS - Authenticated userId:', userId)

      const page = parseInt(query.page as string) || 1
      const limit = parseInt(query.limit as string) || 50

      const result = await PhotosService.getUserPhotos(userId, page, limit)

      return createSuccessResponse({
        photos: result.photos.map(PhotosService.formatPhotoResponse),
        pagination: result.pagination
      }, 'Photos retrieved successfully')

    } catch (error) {
      console.error('Get photos error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      200: 'photosListResponse',
      500: 'errorResponse'
    }
  })

  // Get specific photo
  .get('/:id', async ({ params, userId, set }) => {
    try {
      const photoId = parseInt(params.id)
      const photo = await PhotosService.getPhotoById(photoId, userId)

      return createSuccessResponse({
        photo: PhotosService.formatPhotoResponse(photo)
      }, 'Photo retrieved successfully')

    } catch (error) {
      console.error('Get photo error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      200: 'photoResponse',
      404: 'errorResponse',
      500: 'errorResponse'
    }
  })

  // Update photo
  .put('/:id', async ({ params, body, userId, set }) => {
    try {
      const photoId = parseInt(params.id)
      const updates: any = {}

      if (body.displayName !== undefined) updates.display_name = body.displayName
      if (body.isFavorite !== undefined) updates.is_favorite = body.isFavorite

      const photo = await PhotosService.updatePhoto(photoId, userId, updates)

      return createSuccessResponse({
        photo: PhotosService.formatPhotoResponse(photo)
      }, 'Photo updated successfully')

    } catch (error) {
      console.error('Update photo error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    body: 'updatePhotoBody',
    response: {
      200: 'photoResponse',
      404: 'errorResponse',
      500: 'errorResponse'
    }
  })

  // Delete photo
  .delete('/:id', async ({ params, headers, set }) => {
    try {
      console.log('🔑 DELETE PHOTO - Headers received:', Object.keys(headers))
      console.log('🔑 DELETE PHOTO - Authorization:', headers.authorization)

      // Manual authentication
      const authHeader = headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No token provided' },
          timestamp: new Date().toISOString()
        }
      }

      const sessionToken = authHeader.substring(7)
      const { user } = await AuthService.validateSession(sessionToken)
      const userId = user.id

      console.log('🔑 DELETE PHOTO - Authenticated userId:', userId)
      console.log('🔑 DELETE PHOTO - PhotoId from params:', params.id)

      const photoId = parseInt(params.id)
      console.log('🔑 DELETE PHOTO - Parsed photoId:', photoId)

      if (isNaN(photoId)) {
        set.status = 400
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid photo ID' },
          timestamp: new Date().toISOString()
        }
      }

      await PhotosService.deletePhoto(photoId, userId)

      return createSuccessResponse(
        { message: 'Photo deleted successfully' },
        'Photo deleted successfully'
      )

    } catch (error) {
      console.error('Delete photo error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  })

  // Toggle favorite
  .patch('/:id/favorite', async ({ params, headers, set }) => {
    try {
      console.log('🔑 TOGGLE FAVORITE - Headers received:', Object.keys(headers))
      console.log('🔑 TOGGLE FAVORITE - Authorization:', headers.authorization)

      // Manual authentication
      const authHeader = headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No token provided' },
          timestamp: new Date().toISOString()
        }
      }

      const sessionToken = authHeader.substring(7)
      const { user } = await AuthService.validateSession(sessionToken)
      const userId = user.id

      console.log('🔑 TOGGLE FAVORITE - Authenticated userId:', userId)

      const photoId = parseInt(params.id)
      const photo = await PhotosService.toggleFavorite(photoId, userId)

      return createSuccessResponse({
        photo: PhotosService.formatPhotoResponse(photo)
      }, `Photo ${photo.is_favorite ? 'added to' : 'removed from'} favorites`)

    } catch (error) {
      console.error('Toggle favorite error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      200: 'photoResponse',
      404: 'errorResponse',
      500: 'errorResponse'
    }
  })

  // Batch delete photos
  .post('/batch-delete', async ({ body, headers, set }) => {
    try {
      console.log('🔑 BATCH DELETE - Headers received:', Object.keys(headers))
      console.log('🔑 BATCH DELETE - Authorization:', headers.authorization)

      // Manual authentication
      const authHeader = headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'No token provided' },
          timestamp: new Date().toISOString()
        }
      }

      const sessionToken = authHeader.substring(7)
      const { user } = await AuthService.validateSession(sessionToken)
      const userId = user.id

      console.log('🔑 BATCH DELETE - Authenticated userId:', userId)

      const { photoIds } = body as { photoIds: number[] }

      if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
        set.status = 400
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'photoIds array is required' },
          timestamp: new Date().toISOString()
        }
      }

      console.log(`🔑 BATCH DELETE - Deleting ${photoIds.length} photos:`, photoIds)

      // Verify all photos belong to the user and delete them
      let deletedCount = 0
      for (const photoId of photoIds) {
        try {
          await PhotosService.deletePhoto(photoId, userId)
          deletedCount++
        } catch (error) {
          console.error(`Failed to delete photo ${photoId}:`, error)
          // Continue with other photos
        }
      }

      console.log(`🔑 BATCH DELETE - Successfully deleted ${deletedCount}/${photoIds.length} photos`)

      return createSuccessResponse({
        deletedCount,
        requestedCount: photoIds.length,
        photoIds: photoIds.slice(0, deletedCount) // Only return successfully deleted IDs
      }, `Successfully deleted ${deletedCount} photo${deletedCount > 1 ? 's' : ''}`)

    } catch (error) {
      console.error('Batch delete photos error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  })