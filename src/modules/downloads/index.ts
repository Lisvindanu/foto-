import { Elysia } from 'elysia'
import { DownloadsService } from './service'
import { DownloadsModel } from './model'
import { AuthService } from '../auth/service'
import { createSuccessResponse, handleError } from '../../utils/errors'

// Authentication plugin for downloads module
const authPlugin = new Elysia({ name: 'downloads.auth' })
  .derive(async ({ headers, set }) => {
    try {
      const authHeader = headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401
        throw new Error('No token provided')
      }

      const sessionToken = authHeader.substring(7)
      const { user } = await AuthService.validateSession(sessionToken)

      return { userId: user.id }
    } catch (error) {
      console.error('Downloads auth plugin error:', error)
      set.status = 401
      throw new Error('Authentication failed')
    }
  })

export const downloadsModule = new Elysia({ prefix: '/api/downloads' })
  .model(DownloadsModel)

  // Download specific photo variant
  .get('/photo/:id/:type', async ({ params, headers, set }) => {
    try {
      console.log('🔑 DOWNLOAD PHOTO - Headers received:', Object.keys(headers))
      console.log('🔑 DOWNLOAD PHOTO - Authorization:', headers.authorization)

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

      console.log('🔑 DOWNLOAD PHOTO - Authenticated userId:', userId)

      const photoId = parseInt(params.id)
      const type = params.type as 'original' | 'processed' | 'thumbnail'

      // Validate type
      if (!['original', 'processed', 'thumbnail'].includes(type)) {
        set.status = 400
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid photo type. Must be: original, processed, or thumbnail'
          },
          timestamp: new Date().toISOString()
        }
      }

      const { photo, downloadUrl } = await DownloadsService.getPhotoForDownload(photoId, userId, type)

      // Download the file from storage
      const imageBuffer = await DownloadsService.downloadPhotoFromStorage(downloadUrl)

      // Set appropriate headers
      set.headers = {
        'Content-Type': photo.mime_type || 'image/jpeg',
        'Content-Disposition': `attachment; filename="${photo.filename}"`,
        'Content-Length': imageBuffer.byteLength.toString()
      }

      return new Response(imageBuffer)

    } catch (error) {
      console.error('Download error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  })

  // Get photo info (metadata)
  .get('/photo/:id/info', async ({ params, headers, set }) => {
    try {
      console.log('🔑 PHOTO INFO - Headers received:', Object.keys(headers))
      console.log('🔑 PHOTO INFO - Authorization:', headers.authorization)

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

      console.log('🔑 PHOTO INFO - Authenticated userId:', userId)

      const photoId = parseInt(params.id)

      const { photo } = await DownloadsService.getPhotoForDownload(photoId, userId, 'original')

      return createSuccessResponse(
        DownloadsService.formatPhotoInfoResponse(photo),
        'Photo info retrieved successfully'
      )

    } catch (error) {
      console.error('Get photo info error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      200: 'photoInfoResponse',
      404: 'errorResponse',
      500: 'errorResponse'
    }
  })

  // Batch download multiple photos as ZIP
  .post('/batch', async ({ body, headers, set }) => {
    console.log('🚀 BATCH DOWNLOAD ENDPOINT CALLED!')
    try {
      console.log('🔑 BATCH DOWNLOAD - Headers received:', Object.keys(headers))
      console.log('🔑 BATCH DOWNLOAD - Authorization:', headers.authorization)

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

      console.log('🔑 BATCH DOWNLOAD - Authenticated userId:', userId)

      const { photoIds, type = 'original', format = 'zip' } = body

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

      // Get all requested photos
      const validPhotos = await DownloadsService.getPhotosForBatchDownload(photoIds, userId)

      if (validPhotos.length === 0) {
        set.status = 404
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No valid photos found'
          },
          timestamp: new Date().toISOString()
        }
      }

      // Create ZIP file
      const zipBuffer = await DownloadsService.createZipFromPhotos(validPhotos, type)

      // Set appropriate headers for ZIP download
      const zipFilename = DownloadsService.getZipFilename()

      set.headers = {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': zipBuffer.byteLength.toString()
      }

      return new Response(zipBuffer)

    } catch (error) {
      console.error('Batch download error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    body: 'batchDownloadBody',
    response: {
      400: 'errorResponse',
      404: 'errorResponse',
      500: 'errorResponse'
    }
  })

  // Create print layout PDF
  .post('/print-layout', async ({ body, headers, set }) => {
    console.log('🚀 PRINT LAYOUT ENDPOINT CALLED!')
    try {
      console.log('🔑 PRINT LAYOUT - Headers received:', Object.keys(headers))
      console.log('🔑 PRINT LAYOUT - Authorization:', headers.authorization)

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

      console.log('🔑 PRINT LAYOUT - Authenticated userId:', userId)

      const { photoIds, layoutType = 'grid_2x2', paperSize = 'A4', photoType = 'processed' } = body

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

      console.log('Print layout request:', { photoIds, layoutType, paperSize, photoType, userId })

      // Get all requested photos
      const validPhotos = await DownloadsService.getPhotosForBatchDownload(photoIds, userId)

      if (validPhotos.length === 0) {
        set.status = 404
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No valid photos found'
          },
          timestamp: new Date().toISOString()
        }
      }

      // Create print layout PDF
      const pdfBuffer = await DownloadsService.createPrintLayoutPDF(validPhotos, {
        layoutType,
        paperSize,
        photoType
      })

      // Set appropriate headers for PDF download
      const pdfFilename = `instax_print_layout_${Date.now()}.pdf`

      set.headers = {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename}"`,
        'Content-Length': pdfBuffer.byteLength.toString()
      }

      return new Response(pdfBuffer)

    } catch (error) {
      console.error('Print layout error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      400: 'errorResponse',
      404: 'errorResponse',
      500: 'errorResponse'
    }
  })