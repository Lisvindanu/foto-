import { Elysia } from 'elysia'
import { AuthService } from './service'
import { AuthModel } from './model'
import { createSuccessResponse, handleError } from '../../utils/errors'

export const authModule = new Elysia({ prefix: '/api/auth' })
  .model(AuthModel)

  // Create or get user session with PIN protection
  .post('/session', async ({ body, set }) => {
    try {
      const { deviceId, pin } = body

      console.log('Session request for device:', deviceId)

      // Get or create user with PIN validation
      const result = await AuthService.createOrGetUserWithPin(deviceId, pin)

      // If PIN setup is required
      if (result.requiresPinSetup) {
        return createSuccessResponse({
          requiresPinSetup: true,
          deviceId
        }, 'PIN setup required for this device')
      }

      // If PIN verification is required
      if (result.requiresPinVerification) {
        return createSuccessResponse({
          requiresPinVerification: true,
          deviceId
        }, 'PIN verification required')
      }

      // Success - create session
      console.log('User authenticated:', result.user.id)

      // Create new session
      const session = await AuthService.createSession(result.user.id)
      console.log('Session created:', session.id)

      set.status = 201
      return createSuccessResponse({
        user: AuthService.formatUserResponse(result.user),
        session: AuthService.formatSessionResponse(session)
      }, 'Session created successfully')

    } catch (error) {
      console.error('Session creation error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    body: 'sessionBody',
    response: {
      201: 'sessionResponse',
      400: 'errorResponse',
      500: 'errorResponse'
    }
  })

  // Set PIN for device
  .post('/set-pin', async ({ body, set }) => {
    try {
      const { deviceId, pin } = body

      console.log('Setting PIN for device:', deviceId)

      // Validate PIN (4-6 digits)
      if (!pin || !/^\d{4,6}$/.test(pin)) {
        set.status = 400
        return createSuccessResponse({
          success: false
        }, 'PIN must be 4-6 digits')
      }

      await AuthService.setPinForDevice(deviceId, pin)

      return createSuccessResponse({
        success: true
      }, 'PIN set successfully')

    } catch (error) {
      console.error('Set PIN error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    body: 'setPinBody'
  })

  // Validate session
  .get('/validate', async ({ headers, set }) => {
    try {
      const authHeader = headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'No token provided'
          },
          timestamp: new Date().toISOString()
        }
      }

      const sessionToken = authHeader.substring(7)
      const { user } = await AuthService.validateSession(sessionToken)

      return createSuccessResponse({
        user: AuthService.formatUserResponse(user)
      }, 'Session validated successfully')

    } catch (error) {
      console.error('Session validation error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      200: 'validateResponse',
      401: 'errorResponse',
      500: 'errorResponse'
    }
  })

  // Destroy session (logout)
  .delete('/session', async ({ headers, set }) => {
    try {
      const authHeader = headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'No token provided'
          },
          timestamp: new Date().toISOString()
        }
      }

      const sessionToken = authHeader.substring(7)
      await AuthService.destroySession(sessionToken)

      return createSuccessResponse(
        { message: 'Session destroyed' },
        'Logged out successfully'
      )

    } catch (error) {
      console.error('Session destruction error:', error)
      const { response, status } = handleError(error)
      set.status = status
      return response
    }
  }, {
    response: {
      200: 'simpleResponse',
      401: 'errorResponse',
      500: 'errorResponse'
    }
  })