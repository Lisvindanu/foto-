import { Elysia } from 'elysia'
import { FiltersService } from './service'
import { FiltersModel } from './model'
import { AuthService } from '../auth/service'
import { createSuccessResponse, handleError } from '../../utils/errors'

// Authentication plugin for filters module
const authPlugin = new Elysia({ name: 'filters.auth' })
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
      console.error('Filters auth plugin error:', error)
      set.status = 401
      throw new Error('Authentication failed')
    }
  })

export const filtersModule = new Elysia({ prefix: '/api/filters' })
  .model(FiltersModel)

  // Get all filters grouped by category (public endpoint)
  .get('/', async ({ set }) => {
    try {
      const categories = await FiltersService.getAllFilters()

      return createSuccessResponse({
        categories
      }, 'Filters retrieved successfully')

    } catch (error) {
      console.error('Get filters error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      200: 'filtersListResponse',
      500: 'errorResponse'
    }
  })

  // Get specific filter by ID (public endpoint)
  .get('/:id', async ({ params, set }) => {
    try {
      const filterId = parseInt(params.id)
      const filter = await FiltersService.getFilterById(filterId)

      return createSuccessResponse(
        FiltersService.formatFilterResponse(filter),
        'Filter retrieved successfully'
      )

    } catch (error) {
      console.error('Get filter error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      200: 'filterResponse',
      404: 'errorResponse',
      500: 'errorResponse'
    }
  })

  // Get popular filters (public endpoint)
  .get('/popular', async ({ query, set }) => {
    try {
      const limit = parseInt(query.limit as string) || 10
      const filters = await FiltersService.getPopularFilters(limit)

      return createSuccessResponse(filters, 'Popular filters retrieved successfully')

    } catch (error) {
      console.error('Get popular filters error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      200: 'popularFiltersResponse',
      500: 'errorResponse'
    }
  })

  // Apply filter to existing photo (requires authentication)
  .post('/apply', async ({ body, headers, set }) => {
    try {
      console.log('🔑 FILTER APPLY - Headers received:', Object.keys(headers))
      console.log('🔑 FILTER APPLY - Authorization:', headers.authorization)

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

      console.log('🔑 FILTER APPLY - Authenticated userId:', userId)

      const {
        photoId,
        filterId,
        intensity = 1.0,
        customParameters = {}
      } = body

      console.log('Filter apply request:', { photoId, filterId, intensity, userId })

      // Validate required fields
      if (!photoId || !filterId) {
        set.status = 400
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'photoId and filterId are required'
          },
          timestamp: new Date().toISOString()
        }
      }

      const result = await FiltersService.applyFilterToPhoto(
        photoId,
        filterId,
        userId,
        intensity,
        customParameters
      )

      set.status = 201
      return createSuccessResponse(result, 'Filter applied successfully')

    } catch (error) {
      console.error('Apply filter error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    body: 'applyFilterBody',
    response: {
      201: 'applyFilterResponse',
      400: 'errorResponse',
      404: 'errorResponse',
      500: 'errorResponse'
    }
  })