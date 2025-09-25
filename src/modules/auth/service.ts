import { db } from '../../database/supabase'
import { createSuccessResponse } from '../../utils/errors'
import bcrypt from 'bcryptjs'

export abstract class AuthService {
  static async createOrGetUser(deviceId: string) {
    // Check if user already exists
    const existingUsers = await db.select('users', '*', { device_id: deviceId })

    if (existingUsers && existingUsers.length > 0) {
      const user = existingUsers[0] as any

      // Update last updated timestamp
      await db.update('users',
        { updated_at: new Date().toISOString() },
        { id: user.id }
      )

      return user
    }

    // Create new user
    const newUser = await db.insert('users', {
      device_id: deviceId,
      is_active: true,
      updated_at: new Date().toISOString()
    })

    return newUser[0]
  }

  static async createSession(userId: number) {
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    // Deactivate old sessions
    await db.update('user_sessions',
      { is_active: false },
      { user_id: userId, is_active: true }
    )

    // Create new session
    const newSession = await db.insert('user_sessions', {
      user_id: userId,
      session_token: sessionToken,
      is_active: true,
      expires_at: expiresAt.toISOString()
    })

    return newSession[0]
  }

  static async validateSession(sessionToken: string) {
    console.log('Validating session token:', sessionToken)

    const sessions = await db.select('user_sessions', '*', {
      session_token: sessionToken,
      is_active: true
    })

    console.log('Found sessions:', sessions?.length || 0)

    if (!sessions || sessions.length === 0) {
      // Let's check if the session exists but is inactive
      const allSessions = await db.select('user_sessions', '*', {
        session_token: sessionToken
      })
      console.log('All sessions with this token (including inactive):', allSessions?.length || 0, allSessions)
      throw new Error('Invalid session')
    }

    const session = sessions[0] as any

    // Check if session is expired
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      throw new Error('Session expired')
    }

    // Get user info
    const users = await db.select('users', '*', { id: session.user_id })
    const user = users[0] as any

    if (!user || !user.is_active) {
      throw new Error('User not found or inactive')
    }

    return { user, session }
  }

  static async destroySession(sessionToken: string) {
    await db.update('user_sessions',
      { is_active: false },
      { session_token: sessionToken }
    )
  }

  static formatUserResponse(user: any) {
    return {
      id: user.id,
      deviceId: user.device_id,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }
  }

  static formatSessionResponse(session: any) {
    return {
      id: session.id,
      sessionToken: session.session_token,
      expiresAt: session.expires_at
    }
  }

  // PIN Management Methods
  static async hashPin(pin: string): Promise<string> {
    const salt = await bcrypt.genSalt(10)
    return await bcrypt.hash(pin, salt)
  }

  static async verifyPin(pin: string, hashedPin: string): Promise<boolean> {
    return await bcrypt.compare(pin, hashedPin)
  }

  static async setPinForDevice(deviceId: string, pin: string) {
    const hashedPin = await this.hashPin(pin)

    await db.update('users', {
      device_pin: hashedPin,
      pin_set_at: new Date().toISOString(),
      is_pin_required: true
    }, { device_id: deviceId })

    return { success: true }
  }

  static async checkDevicePinStatus(deviceId: string) {
    const users = await db.select('users', '*', { device_id: deviceId })

    if (!users || users.length === 0) {
      return {
        exists: false,
        hasPinSet: false,
        requiresPin: false
      }
    }

    const user = users[0] as any
    return {
      exists: true,
      hasPinSet: !!user.device_pin,
      requiresPin: user.is_pin_required || false,
      userId: user.id
    }
  }

  static async verifyDevicePin(deviceId: string, pin: string) {
    const users = await db.select('users', '*', { device_id: deviceId })

    if (!users || users.length === 0) {
      throw new Error('Device not found')
    }

    const user = users[0] as any

    if (!user.device_pin) {
      throw new Error('PIN not set for this device')
    }

    const isValidPin = await this.verifyPin(pin, user.device_pin)

    if (!isValidPin) {
      throw new Error('Invalid PIN')
    }

    return { user, success: true }
  }

  static async createOrGetUserWithPin(deviceId: string, pin?: string) {
    const pinStatus = await this.checkDevicePinStatus(deviceId)

    // If device doesn't exist, create it but require PIN setup
    if (!pinStatus.exists) {
      const newUser = await db.insert('users', {
        device_id: deviceId,
        is_active: true,
        is_pin_required: true,
        updated_at: new Date().toISOString()
      })

      return {
        user: newUser[0],
        requiresPinSetup: true,
        requiresPinVerification: false
      }
    }

    // If device exists but no PIN set, require PIN setup
    if (!pinStatus.hasPinSet) {
      const user = await db.select('users', '*', { device_id: deviceId })
      return {
        user: user[0],
        requiresPinSetup: true,
        requiresPinVerification: false
      }
    }

    // If device has PIN, require verification
    if (pinStatus.requiresPin && !pin) {
      const user = await db.select('users', '*', { device_id: deviceId })
      return {
        user: user[0],
        requiresPinSetup: false,
        requiresPinVerification: true
      }
    }

    // Verify PIN if provided
    if (pin) {
      const { user } = await this.verifyDevicePin(deviceId, pin)

      // Update last updated timestamp
      await db.update('users',
        { updated_at: new Date().toISOString() },
        { id: user.id }
      )

      return {
        user,
        requiresPinSetup: false,
        requiresPinVerification: false
      }
    }

    throw new Error('PIN verification required')
  }
}