import { Elysia } from 'elysia'
import { SharesService } from './service'
import { SharesModel } from './model'
import { AuthService } from '../auth/service'
import { createSuccessResponse, handleError } from '../../utils/errors'

export const sharesModule = new Elysia({ prefix: '/api/shares' })
  .model(SharesModel)

  // Create public share (requires auth)
  .post('/create', async ({ body, headers, set }) => {
    try {
      console.log('🔗 CREATE SHARE - Headers received:', Object.keys(headers))

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

      console.log('🔗 CREATE SHARE - Authenticated userId:', userId)

      const { photoIds, title, description, downloadType = 'original', expiresAt } = body

      if (!photoIds || photoIds.length === 0) {
        set.status = 400
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No photos specified'
          },
          timestamp: new Date().toISOString()
        }
      }

      const shareData = await SharesService.createPublicShare(photoIds, userId, {
        title,
        description,
        downloadType,
        expiresAt
      })

      // Get full share URL
      const shareUrl = `${process.env.APP_URL || 'http://localhost:3000'}/share/${shareData.shareToken}`

      return createSuccessResponse({
        shareToken: shareData.shareToken,
        shareUrl,
        title: shareData.title,
        description: shareData.description,
        photoCount: shareData.photoCount,
        downloadType: shareData.downloadType,
        expiresAt: shareData.expiresAt,
        createdAt: shareData.createdAt
      }, 'Public share created successfully')

    } catch (error) {
      console.error('Create share error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    body: 'createShareBody',
    response: {
      200: 'publicShareResponse',
      400: 'errorResponse',
      401: 'errorResponse',
      500: 'errorResponse'
    }
  })

  // Get user's shares (requires auth)
  .get('/', async ({ query, headers, set }) => {
    try {
      console.log('🔗 GET USER SHARES - Headers received:', Object.keys(headers))

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

      const page = parseInt(query.page as string) || 1
      const limit = parseInt(query.limit as string) || 20

      const result = await SharesService.getUserShares(userId, page, limit)

      return createSuccessResponse({
        shares: result.shares,
        pagination: result.pagination
      }, 'Shares retrieved successfully')

    } catch (error) {
      console.error('Get user shares error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  })

  // Toggle share status (requires auth)
  .patch('/:shareToken/toggle', async ({ params, headers, set }) => {
    try {
      console.log('🔗 TOGGLE SHARE - Headers received:', Object.keys(headers))

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

      const { shareToken } = params

      const result = await SharesService.toggleShareStatus(shareToken, userId)

      return createSuccessResponse(result, result.message)

    } catch (error) {
      console.error('Toggle share error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  })

  // Delete share (requires auth)
  .delete('/:shareToken', async ({ params, headers, set }) => {
    try {
      console.log('🔗 DELETE SHARE - Headers received:', Object.keys(headers))

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

      const { shareToken } = params

      await SharesService.deleteShare(shareToken, userId)

      return createSuccessResponse(
        { message: 'Share deleted successfully' },
        'Share deleted successfully'
      )

    } catch (error) {
      console.error('Delete share error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  })

// Public share endpoints (no auth required)
export const publicSharesModule = new Elysia({ prefix: '/api/share' })
  .model(SharesModel)

  // Get public share info (no auth)
  .get('/:shareToken', async ({ params, set }) => {
    try {
      console.log('🌐 PUBLIC SHARE INFO - shareToken:', params.shareToken)

      const { shareToken } = params
      const shareInfo = await SharesService.getPublicShareInfo(shareToken)

      return createSuccessResponse({
        shareToken: shareInfo.shareToken,
        title: shareInfo.title,
        description: shareInfo.description,
        photoCount: shareInfo.photoCount,
        downloadType: shareInfo.downloadType,
        viewCount: shareInfo.viewCount,
        downloadCount: shareInfo.downloadCount,
        expiresAt: shareInfo.expiresAt,
        createdAt: shareInfo.createdAt,
        isActive: shareInfo.isActive,
        previewPhotos: shareInfo.previewPhotos
      }, 'Share info retrieved successfully')

    } catch (error) {
      console.error('Get public share info error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      200: 'shareInfoResponse',
      404: 'errorResponse',
      410: 'errorResponse', // Gone (expired)
      500: 'errorResponse'
    }
  })

  // Download public share (no auth)
  .get('/:shareToken/download', async ({ params, set }) => {
    try {
      console.log('🌐 PUBLIC SHARE DOWNLOAD - shareToken:', params.shareToken)

      const { shareToken } = params
      const downloadResult = await SharesService.downloadPublicShare(shareToken)

      // Set appropriate headers
      set.headers = {
        'Content-Type': downloadResult.mimeType,
        'Content-Disposition': `attachment; filename="${downloadResult.filename}"`,
        'Content-Length': downloadResult.buffer.byteLength.toString()
      }

      return new Response(downloadResult.buffer)

    } catch (error) {
      console.error('Download public share error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  })