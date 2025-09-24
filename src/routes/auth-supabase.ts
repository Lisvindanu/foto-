import { Elysia, t } from 'elysia';
import { db } from '../database/supabase';
import { randomUUID } from 'crypto';
import { createSuccessResponse, handleError } from '../utils/errors';

export const authRoutes = new Elysia({ prefix: '/api/auth' })

  // Login endpoint (alias for session creation)
  .post('/login', async ({ body, headers, set }) => {
    try {
      console.log('Login request body:', body);
      const { deviceId } = body as { deviceId: string };

      if (!deviceId) {
        set.status = 400;
        return { success: false, error: 'Device ID is required' };
      }

      console.log('Processing login for deviceId:', deviceId);

      // Get IP address and user agent
      const ipAddress = headers['x-forwarded-for'] || headers['x-real-ip'] || '127.0.0.1';
      const userAgent = headers['user-agent'] || '';
      const deviceInfo = {
        userAgent,
        platform: 'web',
        deviceId
      };

      // Find or create user
      let users = await db.select('users', '*', { device_id: deviceId });
      let user = users?.[0];

      if (!user) {
        // Create new user
        const newUser = {
          device_id: deviceId,
          is_active: true,
          storage_quota: 1073741824, // 1GB default
          storage_used: 0,
          preferences: {}
        };

        const createdUsers = await db.insert('users', newUser);
        user = createdUsers[0];
        console.log('Created new user:', user);
      }

      // Generate session token
      const sessionToken = randomUUID();

      // Check for existing active session
      const existingSessions = await db.select('user_sessions', '*', {
        user_id: user.id,
        is_active: true
      });

      if (existingSessions && existingSessions.length > 0) {
        // Update existing session
        await db.update('user_sessions', {
          session_token: sessionToken,
          last_activity_at: new Date().toISOString(),
          ip_address: ipAddress
        }, { user_id: user.id, is_active: true });
      } else {
        // Create new session
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

        await db.insert('user_sessions', {
          user_id: user.id,
          session_token: sessionToken,
          device_info: deviceInfo,
          ip_address: ipAddress,
          user_agent: userAgent,
          expires_at: expiresAt.toISOString(),
          is_active: true
        });
      }

      set.status = 200;
      return createSuccessResponse({
        user: {
          id: user.id,
          deviceId: user.device_id,
          storageQuota: user.storage_quota,
          storageUsed: user.storage_used,
          isActive: user.is_active,
          createdAt: user.created_at
        },
        token: sessionToken
      }, 'Login successful');

    } catch (error) {
      console.error('Login error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  }, {
    body: t.Object({
      deviceId: t.String()
    })
  })

  // Create or retrieve session
  .post('/session', async ({ body, headers, set }) => {
    try {
      console.log('Login request body:', body);
      const { deviceId } = body as { deviceId: string };

      if (!deviceId) {
        set.status = 400;
        return { success: false, error: 'Device ID is required' };
      }

      console.log('Processing login for deviceId:', deviceId);

      // Get IP address and user agent
      const ipAddress = headers['x-forwarded-for'] || headers['x-real-ip'] || '127.0.0.1';
      const userAgent = headers['user-agent'] || '';
      const deviceInfo = {
        userAgent,
        platform: 'web',
        deviceId
      };

      // Find or create user
      let users = await db.select('users', '*', { device_id: deviceId });
      let user = users?.[0];

      if (!user) {
        // Create new user
        const newUser = {
          device_id: deviceId,
          is_active: true,
          storage_quota: 1073741824, // 1GB default
          storage_used: 0,
          preferences: {}
        };

        const createdUsers = await db.insert('users', newUser);
        user = createdUsers[0];
        console.log('Created new user:', user);
      }

      // Generate session token
      const sessionToken = randomUUID();

      // Check for existing active session
      const existingSessions = await db.select('user_sessions', '*', {
        user_id: user.id,
        is_active: true
      });

      if (existingSessions && existingSessions.length > 0) {
        // Update existing session
        await db.update('user_sessions', {
          session_token: sessionToken,
          last_activity_at: new Date().toISOString(),
          ip_address: ipAddress
        }, { user_id: user.id, is_active: true });
      } else {
        // Create new session
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

        await db.insert('user_sessions', {
          user_id: user.id,
          session_token: sessionToken,
          device_info: deviceInfo,
          ip_address: ipAddress,
          user_agent: userAgent,
          expires_at: expiresAt.toISOString(),
          is_active: true
        });
      }

      set.status = 200;
      return createSuccessResponse({
        user: {
          id: user.id,
          deviceId: user.device_id,
          storageQuota: user.storage_quota,
          storageUsed: user.storage_used,
          isActive: user.is_active,
          createdAt: user.created_at
        },
        token: sessionToken
      }, 'Login successful');

    } catch (error) {
      console.error('Login error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  }, {
    body: t.Object({
      deviceId: t.String()
    })
  })

  // Get session info
  .get('/session', async ({ headers, set }) => {
    try {
      const authHeader = headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401;
        return { success: false, error: 'No token provided' };
      }

      const sessionToken = authHeader.substring(7);

      // Find active session
      const sessions = await db.select('user_sessions', '*', {
        session_token: sessionToken,
        is_active: true
      });

      if (!sessions || sessions.length === 0) {
        set.status = 401;
        return { success: false, error: 'Invalid session' };
      }

      const session = sessions[0];

      // Check if session is expired
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        set.status = 401;
        return { success: false, error: 'Session expired' };
      }

      // Get user info
      const users = await db.select('users', '*', { id: session.user_id });
      const user = users[0];

      if (!user || !user.is_active) {
        set.status = 401;
        return { success: false, error: 'User not found or inactive' };
      }

      return createSuccessResponse({
        user: {
          id: user.id,
          deviceId: user.device_id,
          storageQuota: user.storage_quota,
          storageUsed: user.storage_used,
          isActive: user.is_active,
          createdAt: user.created_at
        },
        session: {
          token: session.session_token,
          createdAt: session.created_at,
          lastActivity: session.last_activity_at,
          expiresAt: session.expires_at
        }
      });

    } catch (error) {
      console.error('Get session error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Delete session (logout)
  .delete('/session', async ({ headers, set }) => {
    try {
      const authHeader = headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        set.status = 401;
        return { success: false, error: 'No token provided' };
      }

      const sessionToken = authHeader.substring(7);

      // Deactivate session
      await db.update('user_sessions', {
        is_active: false
      }, { session_token: sessionToken });

      return createSuccessResponse(null, 'Logout successful');

    } catch (error) {
      console.error('Logout error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  });