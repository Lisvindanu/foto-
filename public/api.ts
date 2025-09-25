import { treaty } from '@elysiajs/eden'
import type { App } from '../src/index'

// Create the Eden Treaty client
export const api = treaty<App>('localhost:3000')

// Helper function to get auth headers
export function getAuthHeaders() {
  const token = localStorage.getItem('authToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Type-safe API client with authentication
export const authApi = {
  // Auth endpoints
  auth: {
    session: {
      async create(deviceId: string) {
        return api.api.auth.session.post({ deviceId })
      },
      async validate() {
        return api.api.auth.validate.get({
          headers: getAuthHeaders()
        })
      },
      async destroy() {
        return api.api.auth.session.delete({
          headers: getAuthHeaders()
        })
      }
    }
  },

  // Photo endpoints
  photos: {
    async list() {
      return api.api.photos.get({
        headers: getAuthHeaders()
      })
    },
    async upload(formData: FormData) {
      const authHeaders = getAuthHeaders()
      // Don't set Content-Type for FormData - let browser set it automatically
      return api.api.photos.upload.post(formData, {
        headers: authHeaders
      })
    },
    async toggleFavorite(id: number) {
      return api.api.photos({ id }).favorite.post({}, {
        headers: getAuthHeaders()
      })
    },
    async delete(id: number) {
      return api.api.photos({ id }).delete({
        headers: getAuthHeaders()
      })
    }
  },

  // Filter endpoints
  filters: {
    async list() {
      return api.api.filters.get()
    },
    async apply(photoId: number, filterId: number, intensity?: number, customParameters?: Record<string, any>) {
      return api.api.filters.apply.post({
        photoId,
        filterId,
        intensity,
        customParameters
      }, {
        headers: getAuthHeaders()
      })
    }
  },

  // Download endpoints
  downloads: {
    async photo(id: number, type: 'original' | 'processed' | 'thumbnail') {
      return api.api.downloads.photo({ id, type }).get({
        headers: getAuthHeaders()
      })
    },
    async batch(photoIds: number[], type: 'original' | 'processed' | 'thumbnail' = 'original') {
      return api.api.downloads.batch.post({
        photoIds,
        type,
        format: 'zip'
      }, {
        headers: getAuthHeaders()
      })
    }
  },

  // Stats endpoints
  stats: {
    async user() {
      return api.api.stats.user.get({
        headers: getAuthHeaders()
      })
    }
  }
}