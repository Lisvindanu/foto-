import { db } from '../../database/supabase'
import { DownloadsService } from '../downloads/service'

export abstract class SharesService {

  static generateShareToken(): string {
    // Generate a secure random token
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  static async createPublicShare(
    photoIds: number[],
    userId: number,
    options: {
      title?: string
      description?: string
      downloadType?: 'original' | 'processed' | 'thumbnail'
      expiresAt?: string
    } = {}
  ) {
    // Verify all photos belong to the user
    const photos = await Promise.all(
      photoIds.map(async (id) => {
        const result = await db.select('photos', '*', {
          id,
          user_id: userId
        })
        return result?.[0]
      })
    )

    const validPhotos = photos.filter(photo => photo) as any[]

    if (validPhotos.length === 0) {
      throw new Error('No valid photos found')
    }

    if (validPhotos.length !== photoIds.length) {
      throw new Error('Some photos were not found or do not belong to you')
    }

    // Generate unique share token
    let shareToken = this.generateShareToken()

    // Ensure token is unique
    let existing = await db.select('public_shares', '*', { share_token: shareToken })
    while (existing && existing.length > 0) {
      shareToken = this.generateShareToken()
      existing = await db.select('public_shares', '*', { share_token: shareToken })
    }

    const shareType = validPhotos.length === 1 ? 'single' : 'batch'
    const expiresAt = options.expiresAt ? new Date(options.expiresAt) : null

    // Insert public share record
    const shareData = {
      share_token: shareToken,
      user_id: userId,
      share_type: shareType,
      photo_ids: photoIds,
      title: options.title || `Shared ${validPhotos.length} photo${validPhotos.length > 1 ? 's' : ''}`,
      description: options.description,
      download_type: options.downloadType || 'original',
      expires_at: expiresAt,
      is_active: true
    }

    const result = await db.insert('public_shares', shareData)
    const share = Array.isArray(result) ? result[0] : result

    return {
      id: share.id,
      shareToken,
      shareUrl: `/share/${shareToken}`,
      title: shareData.title,
      description: shareData.description,
      photoCount: validPhotos.length,
      downloadType: shareData.download_type,
      expiresAt: expiresAt?.toISOString(),
      createdAt: new Date().toISOString(),
      photos: validPhotos
    }
  }

  static async getPublicShareInfo(shareToken: string) {
    const shares = await db.select('public_shares', '*', { share_token: shareToken })

    if (!shares || shares.length === 0) {
      throw new Error('Share not found')
    }

    const share = shares[0] as any

    // Check if share is active and not expired
    if (!share.is_active) {
      throw new Error('Share is no longer active')
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      throw new Error('Share has expired')
    }

    // Increment view count
    await db.update('public_shares',
      { view_count: share.view_count + 1 },
      { share_token: shareToken }
    )

    // Get photos for preview (limit to first 6 for performance)
    const previewPhotoIds = share.photo_ids.slice(0, 6)
    const previewPhotos = await Promise.all(
      previewPhotoIds.map(async (id: number) => {
        const result = await db.select('photos', '*', { id })
        const photo = result?.[0] as any
        if (photo) {
          return {
            id: photo.id,
            filename: photo.filename,
            displayName: photo.display_name,
            thumbnailPath: photo.thumbnail_path,
            width: photo.width,
            height: photo.height
          }
        }
        return null
      })
    )

    const validPreviewPhotos = previewPhotos.filter(photo => photo)

    return {
      shareToken: share.share_token,
      title: share.title,
      description: share.description,
      photoCount: share.photo_ids.length,
      downloadType: share.download_type,
      viewCount: share.view_count + 1,
      downloadCount: share.download_count,
      expiresAt: share.expires_at,
      createdAt: share.created_at,
      isActive: share.is_active,
      photoIds: share.photo_ids,
      previewPhotos: validPreviewPhotos
    }
  }

  static async downloadPublicShare(shareToken: string) {
    const shareInfo = await this.getPublicShareInfo(shareToken)

    // Get photos that are included in the share
    const photos = await Promise.all(
      shareInfo.photoIds.map(async (id: number) => {
        const result = await db.select('photos', '*', { id })
        return result?.[0]
      })
    )

    const validPhotos = photos.filter(photo => photo) as any[]

    if (validPhotos.length === 0) {
      throw new Error('No photos found for this share')
    }

    // Increment download count
    await db.update('public_shares',
      { download_count: shareInfo.downloadCount + 1 },
      { share_token: shareToken }
    )

    if (validPhotos.length === 1) {
      // Single photo download
      const photo = validPhotos[0]
      let downloadUrl: string

      switch (shareInfo.downloadType) {
        case 'original':
          downloadUrl = photo.original_path
          break
        case 'processed':
          downloadUrl = photo.processed_path || photo.original_path
          break
        case 'thumbnail':
          downloadUrl = photo.thumbnail_path || photo.original_path
          break
        default:
          downloadUrl = photo.original_path
      }

      if (!downloadUrl) {
        throw new Error(`${shareInfo.downloadType} version not available`)
      }

      const imageBuffer = await DownloadsService.downloadPhotoFromStorage(downloadUrl)

      return {
        type: 'single',
        filename: photo.filename,
        mimeType: photo.mime_type || 'image/jpeg',
        buffer: imageBuffer
      }
    } else {
      // Multiple photos - create ZIP
      const zipBuffer = await DownloadsService.createZipFromPhotos(validPhotos, shareInfo.downloadType as any)
      const zipFilename = `${shareInfo.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'shared_photos'}-${Date.now()}.zip`

      return {
        type: 'zip',
        filename: zipFilename,
        mimeType: 'application/zip',
        buffer: zipBuffer
      }
    }
  }

  static async getUserShares(userId: number, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit

    // Get total count
    const countResult = await db.select('public_shares', 'COUNT(*) as total', { user_id: userId })
    const total = parseInt(countResult[0]?.total || '0')

    // Get paginated shares
    const shares = await db.query(`
      SELECT * FROM public_shares
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset])

    return {
      shares: shares.map((share: any) => ({
        id: share.id,
        shareToken: share.share_token,
        shareUrl: `/share/${share.share_token}`,
        title: share.title,
        description: share.description,
        photoCount: share.photo_ids.length,
        downloadType: share.download_type,
        viewCount: share.view_count,
        downloadCount: share.download_count,
        isActive: share.is_active,
        expiresAt: share.expires_at,
        createdAt: share.created_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  static async deleteShare(shareToken: string, userId: number) {
    const shares = await db.select('public_shares', '*', {
      share_token: shareToken,
      user_id: userId
    })

    if (!shares || shares.length === 0) {
      throw new Error('Share not found or does not belong to you')
    }

    await db.delete('public_shares', {
      share_token: shareToken,
      user_id: userId
    })

    return { success: true }
  }

  static async toggleShareStatus(shareToken: string, userId: number) {
    const shares = await db.select('public_shares', '*', {
      share_token: shareToken,
      user_id: userId
    })

    if (!shares || shares.length === 0) {
      throw new Error('Share not found or does not belong to you')
    }

    const share = shares[0] as any
    const newStatus = !share.is_active

    await db.update('public_shares',
      { is_active: newStatus },
      {
        share_token: shareToken,
        user_id: userId
      }
    )

    return {
      shareToken,
      isActive: newStatus,
      message: `Share ${newStatus ? 'activated' : 'deactivated'} successfully`
    }
  }
}