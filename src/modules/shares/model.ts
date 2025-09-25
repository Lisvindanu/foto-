import { t } from 'elysia'

export const SharesModel = {
  // Create public share
  createShareBody: t.Object({
    photoIds: t.Array(t.Number()),
    title: t.Optional(t.String()),
    description: t.Optional(t.String()),
    downloadType: t.Optional(t.Union([t.Literal('original'), t.Literal('processed'), t.Literal('thumbnail')])),
    expiresAt: t.Optional(t.String()) // ISO date string
  }),

  // Public share response
  publicShareResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      shareToken: t.String(),
      shareUrl: t.String(),
      title: t.Optional(t.String()),
      description: t.Optional(t.String()),
      photoCount: t.Number(),
      downloadType: t.String(),
      expiresAt: t.Optional(t.String()),
      createdAt: t.String()
    }),
    message: t.String(),
    timestamp: t.String()
  }),

  // Public share info response
  shareInfoResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      shareToken: t.String(),
      title: t.Optional(t.String()),
      description: t.Optional(t.String()),
      photoCount: t.Number(),
      downloadType: t.String(),
      viewCount: t.Number(),
      downloadCount: t.Number(),
      expiresAt: t.Optional(t.Union([t.String(), t.Null()])),
      createdAt: t.String(),
      isActive: t.Boolean(),
      previewPhotos: t.Array(t.Object({
        id: t.Number(),
        filename: t.String(),
        displayName: t.String(),
        thumbnailPath: t.String(),
        width: t.Number(),
        height: t.Number()
      }))
    }),
    message: t.String(),
    timestamp: t.String()
  }),

  // Error response
  errorResponse: t.Object({
    success: t.Boolean(),
    error: t.Object({
      code: t.String(),
      message: t.String()
    }),
    timestamp: t.String()
  })
}