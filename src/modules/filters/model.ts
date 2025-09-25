import { t } from 'elysia'

export const FiltersModel = {
  filtersListResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      categories: t.Array(t.Object({
        id: t.Number(),
        name: t.String(),
        displayName: t.String(),
        description: t.Optional(t.String()),
        icon: t.Optional(t.Nullable(t.String())),
        sortOrder: t.Number(),
        filters: t.Array(t.Object({
          id: t.Number(),
          name: t.String(),
          displayName: t.String(),
          description: t.Optional(t.String()),
          filterType: t.String(),
          parameters: t.Optional(t.Record(t.String(), t.Any())),
          cssClass: t.Optional(t.String()),
          previewImage: t.Optional(t.Nullable(t.String())),
          textureImage: t.Optional(t.Nullable(t.String())),
          lutFile: t.Optional(t.Nullable(t.String())),
          processingComplexity: t.String(),
          isPremium: t.Boolean(),
          usageCount: t.Number(),
          sortOrder: t.Number()
        }))
      }))
    }),
    message: t.String(),
    timestamp: t.String()
  }),

  filterResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      id: t.Number(),
      name: t.String(),
      displayName: t.String(),
      description: t.Optional(t.String()),
      filterType: t.String(),
      parameters: t.Optional(t.Record(t.String(), t.Any())),
      cssClass: t.Optional(t.String()),
      previewImage: t.Optional(t.String()),
      textureImage: t.Optional(t.String()),
      lutFile: t.Optional(t.String()),
      processingComplexity: t.String(),
      isPremium: t.Boolean(),
      usageCount: t.Number(),
      categoryId: t.Number()
    }),
    message: t.String(),
    timestamp: t.String()
  }),

  applyFilterBody: t.Object({
    photoId: t.Number(),
    filterId: t.Number(),
    intensity: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
    customParameters: t.Optional(t.Record(t.String(), t.Any()))
  }),

  applyFilterResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      processedPhoto: t.Object({
        id: t.Number(),
        filename: t.String(),
        originalFilename: t.String(),
        displayName: t.String(),
        fileSize: t.Number(),
        mimeType: t.String(),
        width: t.Number(),
        height: t.Number(),
        originalPath: t.String(),
        thumbnailPath: t.String(),
        processedPath: t.String(),
        isFavorite: t.Boolean(),
        viewCount: t.Number(),
        processingStatus: t.String(),
        createdAt: t.String(),
        updatedAt: t.String(),
        originalPhotoId: t.Number(),
        processingTimeMs: t.Number(),
        appliedFilter: t.Object({
          id: t.Number(),
          name: t.String(),
          displayName: t.String(),
          filterType: t.String()
        })
      })
    }),
    message: t.String(),
    timestamp: t.String()
  }),

  popularFiltersResponse: t.Object({
    success: t.Boolean(),
    data: t.Array(t.Object({
      id: t.Number(),
      name: t.String(),
      displayName: t.String(),
      description: t.Optional(t.String()),
      filterType: t.String(),
      parameters: t.Optional(t.Record(t.String(), t.Any())),
      cssClass: t.Optional(t.String()),
      previewImage: t.Optional(t.String()),
      usageCount: t.Number(),
      categoryId: t.Number()
    })),
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