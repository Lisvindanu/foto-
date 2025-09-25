import { t } from 'elysia'

export const PhotosModel = {
  uploadResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      photo: t.Object({
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
        processedPath: t.Optional(t.Nullable(t.String())),
        isFavorite: t.Boolean(),
        viewCount: t.Number(),
        processingStatus: t.String(),
        createdAt: t.String()
      })
    }),
    message: t.String(),
    timestamp: t.String()
  }),

  photosListResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      photos: t.Array(t.Object({
        id: t.Number(),
        filename: t.String(),
        displayName: t.String(),
        thumbnailPath: t.String(),
        originalPath: t.String(),
        processedPath: t.Optional(t.Nullable(t.String())),
        width: t.Number(),
        height: t.Number(),
        fileSize: t.Number(),
        isFavorite: t.Boolean(),
        viewCount: t.Number(),
        createdAt: t.String()
      })),
      pagination: t.Object({
        page: t.Number(),
        limit: t.Number(),
        total: t.Number(),
        totalPages: t.Number()
      })
    }),
    message: t.String(),
    timestamp: t.String()
  }),

  updatePhotoBody: t.Object({
    displayName: t.Optional(t.String()),
    isFavorite: t.Optional(t.Boolean())
  }),

  photoResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      photo: t.Object({
        id: t.Number(),
        filename: t.String(),
        displayName: t.String(),
        thumbnailPath: t.String(),
        originalPath: t.String(),
        processedPath: t.Optional(t.Nullable(t.String())),
        fileSize: t.Number(),
        mimeType: t.String(),
        width: t.Number(),
        height: t.Number(),
        isFavorite: t.Boolean(),
        viewCount: t.Number(),
        createdAt: t.String()
      })
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