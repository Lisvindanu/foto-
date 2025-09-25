import { db } from '../../database/supabase'

export abstract class StatsService {
  static async getUserStats(userId: number) {
    // Get basic user info
    const users = await db.select('users', '*', { id: userId })
    const user = users[0] as any

    // Count total photos
    const { count: totalPhotos } = await db.client
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null)

    // Count processed photos (photos with processed_path)
    const { count: totalProcessedPhotos } = await db.client
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .not('processed_path', 'is', null)

    // Count favorites
    const { count: totalFavorites } = await db.client
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .eq('is_favorite', true)

    // Count filters used (from photo_filters table)
    // First get user photo IDs
    const { data: userPhotos } = await db.client
      .from('photos')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)

    const photoIds = (userPhotos || []).map((photo: any) => photo.id)

    let filtersUsed = 0
    if (photoIds.length > 0) {
      const { count } = await db.client
        .from('photo_filters')
        .select('*', { count: 'exact', head: true })
        .in('photo_id', photoIds)
      filtersUsed = count || 0
    }

    // Get recent activity (last 10 photos)
    const { data: recentPhotos } = await db.client
      .from('photos')
      .select('display_name, created_at, processed_path')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)

    const recentActivity = (recentPhotos || []).map((photo: any) => ({
      type: photo.processed_path ? 'filter_applied' : 'photo_uploaded',
      description: photo.processed_path
        ? `Applied filter to "${photo.display_name}"`
        : `Uploaded "${photo.display_name}"`,
      timestamp: photo.created_at
    }))

    // Calculate upload stats for different time periods
    let uploadsThisWeek = 0
    let uploadsThisMonth = 0

    try {
      const now = new Date()
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const weekResult = await db.client
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('created_at', oneWeekAgo.toISOString())

      const monthResult = await db.client
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('created_at', oneMonthAgo.toISOString())

      uploadsThisWeek = weekResult.count || 0
      uploadsThisMonth = monthResult.count || 0
    } catch (error) {
      console.error('Upload stats calculation error:', error)
      // Continue with default values
    }

    return {
      totalPhotos: totalPhotos || 0,
      totalProcessedPhotos: totalProcessedPhotos || 0,
      totalFavorites: totalFavorites || 0,
      storageUsed: user?.storage_used || 0,
      storageUsedFormatted: StatsService.formatFileSize(user?.storage_used || 0),
      filtersUsed: filtersUsed || 0,
      joinedDate: user?.created_at || new Date().toISOString(),
      lastActiveDate: user?.updated_at || user?.created_at || new Date().toISOString(),
      recentActivity,
      uploadStats: {
        thisWeek: uploadsThisWeek,
        thisMonth: uploadsThisMonth,
        allTime: totalPhotos || 0
      }
    }
  }

  static async getFilterStats() {
    // Get top filters by usage
    const { data: topFilters } = await db.client
      .from('filters')
      .select(`
        id,
        name,
        display_name,
        usage_count,
        filter_categories(name)
      `)
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .limit(10)

    // Get filter category stats
    const { data: categoryStats } = await db.client
      .from('filter_categories')
      .select(`
        id,
        name,
        filters(usage_count)
      `)
      .eq('is_active', true)

    const filterCategoryStats = (categoryStats || []).map((category: any) => ({
      categoryId: category.id,
      categoryName: category.name,
      usageCount: category.filters.reduce((sum: number, filter: any) => sum + filter.usage_count, 0)
    }))

    // Calculate total filters used across all users
    const totalFiltersUsed = (topFilters || []).reduce((sum, filter: any) => sum + filter.usage_count, 0)

    return {
      topFilters: (topFilters || []).map((filter: any) => ({
        id: filter.id,
        name: filter.name,
        displayName: filter.display_name,
        usageCount: filter.usage_count,
        categoryName: filter.filter_categories?.name || 'Unknown'
      })),
      totalFiltersUsed,
      filterCategoryStats
    }
  }

  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

    if (bytes === 0) return '0 Bytes'

    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const size = Math.round((bytes / Math.pow(1024, i)) * 100) / 100

    return `${size} ${sizes[i]}`
  }
}