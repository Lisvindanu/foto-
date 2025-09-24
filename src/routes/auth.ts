import { Elysia, t } from 'elysia';
import { db } from '../database/supabase';
import { randomUUID } from 'crypto';
import type {
  CreateSessionRequest,
  SessionResponse,
  UserTable,
  UserSessionTable
} from '../types';
import {
  generateSessionToken,
  validateRequired,
  combineValidationResults
} from '../utils/validation';
import { Errors, createSuccessResponse, handleError } from '../utils/errors';

// Helper function for safe JSON parsing
function parseJSON(str: string, defaultValue: any = null) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

export const authRoutes = new Elysia({ prefix: '/api/auth' })

  // Login endpoint (alias for session creation)
  .post('/login', async ({ body, headers, set }) => {
    try {
      console.log('Login request body:', body);
      const { deviceId } = body as { deviceId: string };

      if (!deviceId) {
        throw Errors.InvalidParameters('Device ID is required');
      }

      console.log('Processing login for deviceId:', deviceId);

      // Get IP address and user agent
      const ipAddress = headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown';
      const userAgent = headers['user-agent'];
      const deviceInfo = JSON.stringify({
        userAgent,
        platform: 'web',
        deviceId
      });

      // Find or create user
      const userQuery = db.query('SELECT * FROM users WHERE device_id = ?');
      let user = await userQuery.get([deviceId]) as UserTable | null;

      if (!user) {
        // Create new user
        const insertUserQuery = db.query(`
          INSERT INTO users (device_id, is_active, storage_quota, storage_used, created_at, updated_at)
          VALUES (?, TRUE, ?, 0, NOW(), NOW())
        `);
        const result = await insertUserQuery.run([deviceId, 1024 * 1024 * 1024]); // 1GB default

        // Get the created user
        user = await userQuery.get([deviceId]) as UserTable;
      }

      // Generate session token
      const sessionToken = randomUUID();

      // Check for existing active session
      const existingSessionQuery = db.query('SELECT * FROM user_sessions WHERE user_id = ? AND is_active = TRUE');
      const existingSession = await existingSessionQuery.get([user.id]) as UserSessionTable | null;

      if (existingSession) {
        // Update existing session
        const updateSessionQuery = db.query(`
          UPDATE user_sessions
          SET session_token = ?, last_activity_at = NOW(), ip_address = ?
          WHERE user_id = ? AND is_active = TRUE
        `);
        await updateSessionQuery.run([sessionToken, ipAddress, user.id]);
      } else {
        // Create new session
        const insertSessionQuery = db.query(`
          INSERT INTO user_sessions (user_id, session_token, device_info, ip_address, user_agent, expires_at)
          VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))
        `);
        await insertSessionQuery.run([user.id, sessionToken, deviceInfo, ipAddress, userAgent || null]);
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
      const { deviceId, userAgent, preferences } = body as CreateSessionRequest;
      const ipAddress = headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown';

      // Validate required fields (none for anonymous sessions)
      const validation = combineValidationResults(
        // No strict validation for anonymous sessions
      );

      if (!validation.isValid) {
        const error = validation.firstError!;
        throw new (Errors as any)[error.code](error.message);
      }

      let user: UserTable | null = null;
      let isNewUser = false;

      // Try to find existing user by device ID
      if (deviceId) {
        const existingUserQuery = db.query('SELECT * FROM users WHERE device_id = ? AND is_active = TRUE');
        const existingUser = await existingUserQuery.get([deviceId]) as UserTable | null;

        if (existingUser) {
          user = existingUser;

          // Update last active time
          const updateQuery = db.query('UPDATE users SET last_active_at = NOW() WHERE id = ?');
          await updateQuery.run([existingUser.id]);
        } else {
          isNewUser = true;
        }
      } else {
        isNewUser = true;
      }

      // Create new user if needed
      if (isNewUser) {
        const sessionToken = generateSessionToken();
        const userPreferences = JSON.stringify(preferences || {});

        const insertUserQuery = db.query(`
          INSERT INTO users (session_token, device_id, user_agent, ip_address, preferences)
          VALUES (?, ?, ?, ?, ?)
        `);

        const result = await insertUserQuery.run([
          sessionToken,
          deviceId || null,
          userAgent || null,
          ipAddress,
          userPreferences
        ]);

        const newUserQuery = db.query('SELECT * FROM users WHERE id = ?');
        user = await newUserQuery.get([result.lastInsertRowid]) as UserTable;
      }

      // Ensure user is assigned
      if (!user) {
        throw new Error('Failed to create or retrieve user');
      }

      // Create or update session
      const sessionToken = generateSessionToken();
      const deviceInfo = JSON.stringify({
        userAgent: userAgent || headers['user-agent'],
        platform: 'web'
      });

      // Check if session exists for this user
      const existingSessionQuery = db.query('SELECT * FROM user_sessions WHERE user_id = ? AND is_active = TRUE');
      const existingSession = await existingSessionQuery.get([user.id]) as UserSessionTable | null;

      if (existingSession) {
        // Update existing session
        const updateSessionQuery = db.query(`
          UPDATE user_sessions
          SET session_token = ?, last_activity_at = NOW(), ip_address = ?
          WHERE user_id = ? AND is_active = TRUE
        `);
        await updateSessionQuery.run([sessionToken, ipAddress, user.id]);
      } else {
        // Create new session
        const insertSessionQuery = db.query(`
          INSERT INTO user_sessions (user_id, session_token, device_info, ip_address, user_agent, expires_at)
          VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))
        `);
        await insertSessionQuery.run([user.id, sessionToken, deviceInfo, ipAddress, userAgent || null]);
      }

      // Update user's session token
      const updateUserTokenQuery = db.query('UPDATE users SET session_token = ? WHERE id = ?');
      await updateUserTokenQuery.run([sessionToken, user.id]);

      // Parse JSON fields for response
      const userResponse = {
        id: user.id,
        sessionToken,
        deviceId: user.device_id,
        userAgent: user.user_agent,
        preferences: parseJSON(user.preferences),
        storageQuota: user.storage_quota,
        storageUsed: user.storage_used,
        createdAt: user.created_at,
        lastActiveAt: user.last_active_at,
        isActive: Boolean(user.is_active)
      };

      set.status = isNewUser ? 201 : 200;
      return createSuccessResponse<SessionResponse>({
        sessionToken,
        user: userResponse
      }, isNewUser ? 'User created successfully' : 'Session updated successfully');

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  }, {
    body: t.Object({
      deviceId: t.Optional(t.String()),
      userAgent: t.Optional(t.String()),
      preferences: t.Optional(t.Object({
        theme: t.Optional(t.Union([t.Literal('light'), t.Literal('dark')])),
        language: t.Optional(t.Union([t.Literal('en'), t.Literal('id')])),
        autoSave: t.Optional(t.Boolean()),
        quality: t.Optional(t.Union([t.Literal('normal'), t.Literal('high')]))
      }))
    })
  })

  // Get current session info
  .get('/session', async ({ headers, set }) => {
    try {
      const authHeader = headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');

      if (!sessionToken) {
        throw Errors.InvalidSession('Authorization header missing');
      }

      // Get user by session token
      const userQuery = db.query(`
        SELECT u.*, s.expires_at, s.last_activity_at
        FROM users u
        JOIN user_sessions s ON u.id = s.user_id
        WHERE s.session_token = ? AND u.is_active = TRUE AND s.is_active = TRUE
      `);

      const result = await userQuery.get([sessionToken]) as (UserTable & { expires_at: string; last_activity_at: string }) | null;

      if (!result) {
        throw Errors.InvalidSession();
      }

      // Check if session is expired
      if (result.expires_at && new Date(result.expires_at) < new Date()) {
        throw Errors.SessionExpired();
      }

      // Update last activity
      const updateActivityQuery = db.query('UPDATE user_sessions SET last_activity_at = NOW() WHERE session_token = ?');
      await updateActivityQuery.run([sessionToken]);

      const userResponse = {
        id: result.id,
        sessionToken: result.session_token,
        deviceId: result.device_id,
        userAgent: result.user_agent,
        preferences: parseJSON(result.preferences),
        storageQuota: result.storage_quota,
        storageUsed: result.storage_used,
        createdAt: result.created_at,
        lastActiveAt: result.last_active_at,
        isActive: Boolean(result.is_active)
      };

      return createSuccessResponse({
        user: userResponse,
        session: {
          expiresAt: result.expires_at,
          lastActivity: result.last_activity_at
        }
      });

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Validate token endpoint
  .get('/validate', async ({ headers, set }) => {
    try {
      const authHeader = headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');

      if (!sessionToken) {
        throw Errors.InvalidSession();
      }

      // Get user info from session token
      const userQuery = db.query(`
        SELECT u.*, s.expires_at
        FROM users u
        JOIN user_sessions s ON u.id = s.user_id
        WHERE s.session_token = ? AND s.is_active = TRUE AND u.is_active = TRUE
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
      `);

      const user = await userQuery.get([sessionToken]) as (UserTable & { expires_at: string }) | null;

      if (!user) {
        throw Errors.InvalidSession();
      }

      return createSuccessResponse({
        user: {
          id: user.id,
          deviceId: user.device_id,
          storageQuota: user.storage_quota,
          storageUsed: user.storage_used,
          isActive: user.is_active,
          createdAt: user.created_at
        }
      }, 'Token is valid');

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Destroy session
  .delete('/session', async ({ headers, set }) => {
    try {
      const authHeader = headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');

      if (!sessionToken) {
        throw Errors.InvalidSession('Authorization header missing');
      }

      // Deactivate session
      const deactivateSessionQuery = db.query('UPDATE user_sessions SET is_active = FALSE WHERE session_token = ?');
      const result = await deactivateSessionQuery.run([sessionToken]);

      if (result.changes === 0) {
        throw Errors.InvalidSession('Session not found');
      }

      return createSuccessResponse(null, 'Session destroyed successfully');

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Extend session (refresh)
  .put('/session/extend', async ({ headers, set }) => {
    try {
      const authHeader = headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');

      if (!sessionToken) {
        throw Errors.InvalidSession('Authorization header missing');
      }

      // Check if session exists and is active
      const sessionQuery = db.query('SELECT * FROM user_sessions WHERE session_token = ? AND is_active = TRUE');
      const session = await sessionQuery.get([sessionToken]) as UserSessionTable | null;

      if (!session) {
        throw Errors.InvalidSession();
      }

      // Extend session by 30 days
      const extendQuery = db.query(`
        UPDATE user_sessions
        SET expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY), last_activity_at = NOW()
        WHERE session_token = ?
      `);
      await extendQuery.run([sessionToken]);

      return createSuccessResponse(null, 'Session extended successfully');

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  });

// Middleware to authenticate requests
export function requireAuth() {
  return async ({ headers, set }: any) => {
    try {
      const authHeader = headers.authorization;
      const sessionToken = authHeader?.replace('Bearer ', '');

      if (!sessionToken) {
        throw Errors.InvalidSession('Authorization header missing');
      }

      // Get user by session token
      const userQuery = db.query(`
        SELECT u.*, s.expires_at
        FROM users u
        JOIN user_sessions s ON u.id = s.user_id
        WHERE s.session_token = ? AND u.is_active = TRUE AND s.is_active = TRUE
      `);

      const user = await userQuery.get([sessionToken]) as (UserTable & { expires_at: string }) | null;

      if (!user) {
        throw Errors.InvalidSession();
      }

      // Check if session is expired
      if (user.expires_at && new Date(user.expires_at) < new Date()) {
        throw Errors.SessionExpired();
      }

      return {
        userId: user.id,
        sessionToken: user.session_token,
        user: {
          id: user.id,
          deviceId: user.device_id,
          preferences: parseJSON(user.preferences),
          storageQuota: user.storage_quota,
          storageUsed: user.storage_used
        }
      };

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  };
}