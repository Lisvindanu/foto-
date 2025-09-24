import { Elysia } from 'elysia';
import { db } from '../database/connection';
import type { UserStatsResponse } from '../types';
import { createSuccessResponse, handleError } from '../utils/errors';
import { requireAuth } from './auth';

export const statsRoutes = new Elysia({ prefix: '/api/stats' })

  // Get user statistics
  .get('/user', async ({ headers, set }) => {
    try {
      // Authentication
      const authResult = await requireAuth()({ headers, set });
      if ('success' in authResult && !authResult.success) {
        return authResult;
      }
      const { userId } = authResult as any;

      // Get basic photo stats
      const photoStatsQuery = db.query(`
        SELECT
          COUNT(*) as photo_count,
          SUM(file_size) as storage_used,
          SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as favorite_count,
          SUM(view_count) as total_views
        FROM photos
        WHERE user_id = ? AND deleted_at IS NULL
      `);

      const photoStats = await photoStatsQuery.get([userId]) as {
        photo_count: number;
        storage_used: number;
        favorite_count: number;
        total_views: number;
      };

      // Get storage quota
      const userQuery = db.query('SELECT storage_quota FROM users WHERE id = ?');
      const { storage_quota } = await userQuery.get([userId]) as { storage_quota: number };

      // Get most used filter
      const mostUsedFilterQuery = db.query(`
        SELECT
          f.id,
          f.name,
          f.display_name,
          COUNT(pf.id) as usage_count
        FROM photo_filters pf
        JOIN filters f ON pf.filter_id = f.id
        JOIN photos p ON pf.photo_id = p.id
        WHERE p.user_id = ? AND p.deleted_at IS NULL
        GROUP BY f.id
        ORDER BY usage_count DESC
        LIMIT 1
      `);

      const mostUsedFilter = await mostUsedFilterQuery.get([userId]) as {
        id: number;
        name: string;
        display_name: string;
        usage_count: number;
      } | null;

      // Get upload statistics
      const thisWeekQuery = db.query(`
        SELECT COUNT(*) as count
        FROM photos
        WHERE user_id = ? AND deleted_at IS NULL
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `);

      const thisMonthQuery = db.query(`
        SELECT COUNT(*) as count
        FROM photos
        WHERE user_id = ? AND deleted_at IS NULL
        AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);

      const thisWeek = await thisWeekQuery.get([userId]) as { count: number };
      const thisMonth = await thisMonthQuery.get([userId]) as { count: number };

      const stats: UserStatsResponse = {
        photoCount: photoStats.photo_count || 0,
        storageUsed: photoStats.storage_used || 0,
        storageQuota: storage_quota,
        favoriteCount: photoStats.favorite_count || 0,
        totalViews: photoStats.total_views || 0,
        mostUsedFilter: mostUsedFilter ? {
          id: mostUsedFilter.id,
          name: mostUsedFilter.name,
          usageCount: mostUsedFilter.usage_count
        } : undefined,
        uploadStats: {
          thisWeek: thisWeek.count || 0,
          thisMonth: thisMonth.count || 0,
          allTime: photoStats.photo_count || 0
        }
      };

      return createSuccessResponse(stats);

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Get global filter statistics
  .get('/filters', async ({ set }) => {
    try {
      const popularFiltersQuery = db.query(`
        SELECT
          f.id,
          f.name,
          f.display_name,
          f.filter_type,
          f.usage_count,
          COUNT(DISTINCT p.user_id) as user_count
        FROM filters f
        LEFT JOIN photo_filters pf ON f.id = pf.filter_id
        LEFT JOIN photos p ON pf.photo_id = p.id AND p.deleted_at IS NULL
        WHERE f.is_active = 1
        GROUP BY f.id
        ORDER BY f.usage_count DESC
        LIMIT 10
      `);

      const popularFilters = await popularFiltersQuery.all() as any[];

      const categoryStatsQuery = db.query(`
        SELECT
          fc.name as category,
          fc.display_name as category_display_name,
          SUM(f.usage_count) as total_usage,
          COUNT(f.id) as filter_count
        FROM filter_categories fc
        LEFT JOIN filters f ON fc.id = f.category_id AND f.is_active = 1
        WHERE fc.is_active = 1
        GROUP BY fc.id
        ORDER BY total_usage DESC
      `);

      const categoryStats = await categoryStatsQuery.all() as any[];

      return createSuccessResponse({
        popularFilters: popularFilters.map(filter => ({
          filter: {
            id: filter.id,
            name: filter.name,
            displayName: filter.display_name,
            filterType: filter.filter_type,
            usageCount: filter.usage_count,
            categoryId: 0,
            description: '',
            parameters: {},
            processingComplexity: 'low' as const,
            isPremium: false,
            isActive: true,
            sortOrder: 0,
            createdAt: '',
            updatedAt: ''
          },
          usageCount: filter.usage_count || 0,
          userCount: filter.user_count || 0
        })),
        categoryStats: categoryStats.map(cat => ({
          category: cat.category,
          totalUsage: cat.total_usage || 0,
          filterCount: cat.filter_count || 0
        }))
      });

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  })

  // Get system statistics (admin-level)
  .get('/system', async ({ set }) => {
    try {
      // Total users
      const userCountQuery = db.query('SELECT COUNT(*) as count FROM users WHERE is_active = TRUE');
      const { count: totalUsers } = await userCountQuery.get() as { count: number };

      // Total photos
      const photoCountQuery = db.query('SELECT COUNT(*) as count FROM photos WHERE deleted_at IS NULL');
      const { count: totalPhotos } = await photoCountQuery.get() as { count: number };

      // Total storage used
      const storageQuery = db.query('SELECT SUM(file_size) as total FROM photos WHERE deleted_at IS NULL');
      const { total: totalStorage } = await storageQuery.get() as { total: number };

      // Photos uploaded today
      const todayPhotosQuery = db.query(`
        SELECT COUNT(*) as count
        FROM photos
        WHERE deleted_at IS NULL
        AND created_at >= CURDATE()
      `);
      const { count: photosToday } = await todayPhotosQuery.get() as { count: number };

      // Active sessions
      const activeSessionsQuery = db.query(`
        SELECT COUNT(*) as count
        FROM user_sessions
        WHERE is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
      `);
      const { count: activeSessions } = await activeSessionsQuery.get() as { count: number };

      // Most active users
      const activeUsersQuery = db.query(`
        SELECT
          u.id,
          u.device_id,
          COUNT(p.id) as photo_count,
          SUM(p.file_size) as storage_used
        FROM users u
        LEFT JOIN photos p ON u.id = p.user_id AND p.deleted_at IS NULL
        WHERE u.is_active = TRUE
        GROUP BY u.id
        ORDER BY photo_count DESC
        LIMIT 5
      `);

      const activeUsers = await activeUsersQuery.all() as any[];

      return createSuccessResponse({
        totalUsers,
        totalPhotos,
        totalStorage: totalStorage || 0,
        photosToday,
        activeSessions,
        activeUsers: activeUsers.map(user => ({
          id: user.id,
          deviceId: user.device_id,
          photoCount: user.photo_count || 0,
          storageUsed: user.storage_used || 0
        }))
      });

    } catch (error) {
      const { response, status } = handleError(error);
      set.status = status;
      return response;
    }
  });