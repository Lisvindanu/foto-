import { t } from 'elysia'

export const StatsModel = {
  userStatsResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      totalPhotos: t.Number(),
      totalProcessedPhotos: t.Number(),
      totalFavorites: t.Number(),
      storageUsed: t.Number(),
      storageUsedFormatted: t.String(),
      filtersUsed: t.Number(),
      joinedDate: t.String(),
      lastActiveDate: t.String(),
      recentActivity: t.Array(t.Object({
        type: t.String(),
        description: t.String(),
        timestamp: t.String()
      })),
      uploadStats: t.Object({
        thisWeek: t.Number(),
        thisMonth: t.Number(),
        allTime: t.Number()
      })
    }),
    message: t.String(),
    timestamp: t.String()
  }),

  filterStatsResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      topFilters: t.Array(t.Object({
        id: t.Number(),
        name: t.String(),
        displayName: t.String(),
        usageCount: t.Number(),
        categoryName: t.String()
      })),
      totalFiltersUsed: t.Number(),
      filterCategoryStats: t.Array(t.Object({
        categoryId: t.Number(),
        categoryName: t.String(),
        usageCount: t.Number()
      }))
    }),
    message: t.String(),
    timestamp: t.String()
  }),

  errorResponse: t.Object({
    success: t.Boolean(),
    error: t.Object({
      code: t.String(),
      message: t.String(),
      details: t.Optional(t.String())
    }),
    timestamp: t.String()
  })
}