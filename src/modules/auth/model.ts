import { t } from 'elysia'

export const AuthModel = {
  sessionBody: t.Object({
    deviceId: t.String({ minLength: 1 }),
    pin: t.Optional(t.String())
  }),

  setPinBody: t.Object({
    deviceId: t.String({ minLength: 1 }),
    pin: t.String({ minLength: 4, maxLength: 6 })
  }),

  sessionResponse: t.Object({
    success: t.Boolean(),
    data: t.Union([
      t.Object({
        user: t.Object({
          id: t.Number(),
          deviceId: t.String(),
          isActive: t.Boolean(),
          createdAt: t.String(),
          updatedAt: t.String()
        }),
        session: t.Object({
          id: t.Number(),
          sessionToken: t.String(),
          expiresAt: t.String()
        })
      }),
      t.Object({
        requiresPinSetup: t.Boolean(),
        deviceId: t.String()
      }),
      t.Object({
        requiresPinVerification: t.Boolean(),
        deviceId: t.String()
      })
    ]),
    message: t.String(),
    timestamp: t.String()
  }),

  validateResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      user: t.Object({
        id: t.Number(),
        deviceId: t.String(),
        isActive: t.Boolean()
      })
    }),
    message: t.String(),
    timestamp: t.String()
  }),

  simpleResponse: t.Object({
    success: t.Boolean(),
    data: t.Object({
      message: t.String()
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