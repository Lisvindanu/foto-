import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

export type ImageType = 'original' | 'thumbnail' | 'processed' | 'export';

export async function uploadImage(
  file: File | Buffer,
  fileName?: string,
  type: ImageType = 'original'
): Promise<UploadResult> {
  try {
    const timestamp = Date.now()
    const finalFileName = fileName || `photo-${timestamp}.jpg`

    // Create folder structure like local: originals/, thumbnails/, processed/, exports/
    const folderPath = type === 'processed' ? `processed/${finalFileName}` : `${type}s/${finalFileName}`

    console.log('Uploading to Supabase:', {
      fileName: finalFileName,
      folderPath,
      fileSize: Buffer.isBuffer(file) ? file.length : file.size,
      fileType: file instanceof File ? file.type : 'Buffer'
    })

    const { data, error } = await supabase.storage
      .from('images')
      .upload(folderPath, file, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (error) {
      console.error('Supabase upload error:', error)
      return { success: false, error: error.message }
    }

    console.log('Upload success:', data)

    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(folderPath)

    console.log('Public URL:', publicUrl)

    return { success: true, url: publicUrl }
  } catch (error) {
    console.error('Upload error:', error)
    return { success: false, error: 'Failed to upload image' }
  }
}

export async function deleteImage(fileName: string, type?: ImageType): Promise<boolean> {
  try {
    const filePath = type ? (type === 'processed' ? `processed/${fileName}` : `${type}s/${fileName}`) : fileName

    const { error } = await supabase.storage
      .from('images')
      .remove([filePath])

    return !error
  } catch (error) {
    console.error('Delete error:', error)
    return false
  }
}

// Delete all variants of a photo (original, thumbnail, processed)
export async function deleteAllImageVariants(fileName: string): Promise<boolean> {
  const types: ImageType[] = ['original', 'thumbnail', 'processed']
  const results = await Promise.all(
    types.map(type => deleteImage(fileName, type))
  )

  // Return true if at least one deletion succeeded
  return results.some(result => result)
}

export async function listImages(folder?: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage
      .from('images')
      .list(folder)

    if (error) return []

    return data.map(file => file.name)
  } catch (error) {
    return []
  }
}

// Helper function to create thumbnail from original
export async function createThumbnail(originalBuffer: Buffer, fileName: string): Promise<UploadResult> {
  // For now, we'll upload the same image as thumbnail
  // In a full implementation, you'd resize the image here using sharp or similar
  return uploadImage(originalBuffer, fileName, 'thumbnail')
}

// Helper function to get the correct file path structure
export function getImagePath(fileName: string, type: ImageType): string {
  return type === 'processed' ? `processed/${fileName}` : `${type}s/${fileName}`
}