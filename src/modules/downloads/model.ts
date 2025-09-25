import { t } from 'elysia'

export const DownloadsModel = {
  photoInfoResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      id: t.Number(),
      filename: t.String(),
      originalFilename: t.String(),
      displayName: t.String(),
      fileSize: t.Number(),
      mimeType: t.String(),
      width: t.Number(),
      height: t.Number(),
      createdAt: t.String(),
      availableVersions: t.Object({
        original: t.Boolean(),
        processed: t.Boolean(),
        thumbnail: t.Boolean()
      }),
      urls: t.Object({
        original: t.Optional(t.String()),
        processed: t.Optional(t.String()),
        thumbnail: t.Optional(t.String())
      })
    }),
    message: t.String(),
    timestamp: t.String()
  }),

  batchDownloadBody: t.Object({
    photoIds: t.Array(t.Number()),
    type: t.Optional(t.Union([
      t.Literal('original'),
      t.Literal('processed'),
      t.Literal('thumbnail')
    ])),
    format: t.Optional(t.Literal('zip'))
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