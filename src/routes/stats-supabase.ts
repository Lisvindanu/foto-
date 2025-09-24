import { Elysia } from 'elysia';
import { db } from '../database/supabase';
import { createSuccessResponse, handleError } from '../utils/errors';

// Simple auth middleware
async function requireAuth(headers: any) {
  const authHeader = headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { success: false, error: 'No token provided', status: 401 };
  }

  const sessionToken = authHeader.substring(7);

  // Find active session
  const sessions = await db.select('user_sessions', '*', {
    session_token: sessionToken,
    is_active: true
  });

  if (!sessions || sessions.length === 0) {
    return { success: false, error: 'Invalid session', status: 401 };
  }

  const session = sessions[0];

  // Get user info
  const users = await db.select('users', '*', { id: session.user_id });
  const user = users[0];

  if (!user || !user.is_active) {
    return { success: false, error: 'User not found or inactive', status: 401 };
  }

  return { success: true, user, session };
}

export const statsRoutes = new Elysia({ prefix: '/api/stats' })

  // Get user statistics
  .get('/user', async ({ headers, set }) => {
    try {
      const authResult = await requireAuth(headers);
      if (!authResult.success) {
        set.status = authResult.status;
        return authResult;
      }

      const { user } = authResult;

      // Get photo count
      const { data: photos, error: photosError } = await db.client
        .from('photos')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (photosError) throw photosError;

      // Get total storage used (sum of file sizes)
      const { data: storageData, error: storageError } = await db.client
        .from('photos')
        .select('file_size')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (storageError) throw storageError;

      const totalStorageUsed = storageData?.reduce((sum, photo) => sum + (photo.file_size || 0), 0) || 0;

      // Get favorite photos count
      const { data: favoritePhotos, error: favError } = await db.client
        .from('photos')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_favorite', true)
        .is('deleted_at', null);

      if (favError) throw favError;

      // Get recent photo upload (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentPhotos, error: recentError } = await db.client
        .from('photos')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .is('deleted_at', null);

      if (recentError) throw recentError;

      const stats = {
        user: {
          id: user.id,
          deviceId: user.device_id,
          storageQuota: user.storage_quota,
          storageUsed: totalStorageUsed,
          storageUsedFormatted: formatBytes(totalStorageUsed),
          storageQuotaFormatted: formatBytes(user.storage_quota),
          storagePercentage: Math.round((totalStorageUsed / user.storage_quota) * 100),
          memberSince: user.created_at
        },
        photos: {
          total: photos?.length || 0,
          favorites: favoritePhotos?.length || 0,
          recentUploads: recentPhotos?.length || 0
        },
        activity: {
          lastLogin: new Date().toISOString(),
          totalSessions: 1 // Simplified
        }
      };

      return createSuccessResponse(stats, 'User statistics retrieved successfully');

    } catch (error) {
      console.error('Get user stats error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Get filter usage statistics
  .get('/filters', async ({ headers, set }) => {
    try {
      const authResult = await requireAuth(headers);
      if (!authResult.success) {
        set.status = authResult.status;
        return authResult;
      }

      // Get most used filters
      const { data: filterStats, error } = await db.client
        .from('filters')
        .select('id, name, display_name, usage_count')
        .order('usage_count', { ascending: false })
        .limit(10);

      if (error) throw error;

      return createSuccessResponse({
        popularFilters: filterStats?.map(filter => ({
          id: filter.id,
          name: filter.name,
          displayName: filter.display_name,
          usageCount: filter.usage_count
        })) || []
      }, 'Filter statistics retrieved successfully');

    } catch (error) {
      console.error('Get filter stats error:', error);
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  });

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}