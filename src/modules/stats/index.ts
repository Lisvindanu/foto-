import { Elysia } from 'elysia'
import { StatsService } from './service'
import { StatsModel } from './model'
import { AuthService } from '../auth/service'
import { createSuccessResponse, handleError } from '../../utils/errors'

// Authentication plugin for stats module
const authPlugin = new Elysia({ name: 'stats.auth' })
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
      console.error('Stats auth plugin error:', error)
      set.status = 401
      throw new Error('Authentication failed')
    }
  })

export const statsModule = new Elysia({ prefix: '/api/stats' })
  .model(StatsModel)
  .use(authPlugin)

  // Get user statistics
  .get('/user', async ({ headers, set }) => {
    try {
      console.log('🔑 STATS - Headers received:', Object.keys(headers))
      console.log('🔑 STATS - Authorization:', headers.authorization)

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

      console.log('🔑 STATS - Authenticated userId:', userId)

      const stats = await StatsService.getUserStats(userId)

      return createSuccessResponse(stats, 'User statistics retrieved successfully')

    } catch (error) {
      console.error('Get user stats error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      200: 'userStatsResponse',
      500: 'errorResponse'
    }
  })

  // Get filter statistics (global stats)
  .get('/filters', async ({ set }) => {
    try {
      const stats = await StatsService.getFilterStats()

      return createSuccessResponse(stats, 'Filter statistics retrieved successfully')

    } catch (error) {
      console.error('Get filter stats error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      200: 'filterStatsResponse',
      500: 'errorResponse'
    }
  })