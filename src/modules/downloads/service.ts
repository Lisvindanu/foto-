import { db } from '../../database/supabase'

export abstract class DownloadsService {
  static async getPhotoForDownload(photoId: number, userId: number, type: 'original' | 'processed' | 'thumbnail') {
    // Get photo info
    const photos = await db.select('photos', '*', {
      id: photoId,
      user_id: userId
    })

    if (!photos || photos.length === 0) {
      throw new Error('Photo not found')
    }

    const photo = photos[0] as any

    // Get the appropriate URL based on type
    let downloadUrl: string
    switch (type) {
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
      throw new Error(`${type} version not available`)
    }

    return { photo, downloadUrl }
  }

  static async getPhotosForBatchDownload(photoIds: number[], userId: number) {
    const photos = await Promise.all(
      photoIds.map(async (id) => {
        const result = await db.select('photos', '*', {
          id,
          user_id: userId
        })
        return result?.[0]
      })
    )

    return photos.filter(photo => photo) as any[]
  }

  static async downloadPhotoFromStorage(url: string) {
    const imageResponse = await fetch(url)
    if (!imageResponse.ok) {
      throw new Error('File not found in storage')
    }

    return imageResponse.arrayBuffer()
  }

  static async createZipFromPhotos(
    photos: any[],
    type: 'original' | 'processed' | 'thumbnail' = 'original'
  ) {
    // Import JSZip dynamically
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    // Download and add each photo to ZIP
    for (const photo of photos) {
      try {
        // Get the appropriate URL based on type
        let downloadUrl: string
        switch (type) {
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
          console.warn(`Skipping photo ${photo.filename}: ${type} version not available`)
          continue
        }

        // Fetch the image from Supabase
        const imageBuffer = await DownloadsService.downloadPhotoFromStorage(downloadUrl)

        // Add to ZIP with original filename
        zip.file(photo.filename, imageBuffer)

      } catch (photoError) {
        console.warn(`Error processing photo ${photo.filename}:`, photoError)
        continue
      }
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    })

    return zipBuffer
  }

  static getZipFilename() {
    const timestamp = new Date().toISOString().slice(0, 10)
    return `classic-web-fotos-${timestamp}.zip`
  }

  static formatPhotoInfoResponse(photo: any) {
    return {
      id: photo.id,
      filename: photo.filename,
      originalFilename: photo.original_filename,
      displayName: photo.display_name,
      fileSize: photo.file_size,
      mimeType: photo.mime_type,
      width: photo.width,
      height: photo.height,
      createdAt: photo.created_at,
      availableVersions: {
        original: !!photo.original_path,
        processed: !!photo.processed_path,
        thumbnail: !!photo.thumbnail_path
      },
      urls: {
        original: photo.original_path,
        processed: photo.processed_path,
        thumbnail: photo.thumbnail_path
      }
    }
  }

  static async createPrintLayoutPDF(
    photos: any[],
    options: {
      layoutType: string
      paperSize: string
      photoType: 'original' | 'processed'
    }
  ) {
    console.log(`🖨️ Starting PDF creation for ${photos.length} photos with ${options.layoutType} layout`)
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

    // Create new PDF document
    const pdfDoc = await PDFDocument.create()

    // Define paper sizes (in points, 72 points = 1 inch)
    const paperSizes = {
      'A4': { width: 595, height: 842 },
      'letter': { width: 612, height: 792 },
      '4x6': { width: 288, height: 432 },
      '5x7': { width: 360, height: 504 }
    }

    const pageSize = paperSizes[options.paperSize] || paperSizes['A4']
    const margin = 36 // 0.5 inch margin

    // Define grid layouts
    const gridLayouts = {
      'single': { cols: 1, rows: 1 },
      'grid_2x2': { cols: 2, rows: 2 },
      'grid_3x3': { cols: 3, rows: 3 },
      'contact_sheet': { cols: 4, rows: 6 }
    }

    const layout = gridLayouts[options.layoutType] || gridLayouts['grid_2x2']
    const photosPerPage = layout.cols * layout.rows

    // Calculate photo dimensions
    const availableWidth = pageSize.width - (2 * margin)
    const availableHeight = pageSize.height - (2 * margin)
    const photoWidth = availableWidth / layout.cols - 10 // 10pt spacing between photos
    const photoHeight = availableHeight / layout.rows - 10 // 10pt spacing between photos

    // Process photos in batches (pages)
    for (let i = 0; i < photos.length; i += photosPerPage) {
      const pagePhotos = photos.slice(i, i + photosPerPage)
      const page = pdfDoc.addPage([pageSize.width, pageSize.height])

      // No title for clean print layout

      // Add photos to page
      console.log(`📄 Processing page ${Math.floor(i / photosPerPage) + 1}, photos ${i + 1}-${Math.min(i + photosPerPage, photos.length)}`)

      // Process photos in parallel for faster loading
      const photoProcessingPromises = pagePhotos.map(async (photo, j) => {
        const row = Math.floor(j / layout.cols)
        const col = j % layout.cols

        try {
          // Get the appropriate photo URL
          let photoUrl: string
          switch (options.photoType) {
            case 'processed':
              photoUrl = photo.processed_path || photo.original_path
              break
            case 'original':
            default:
              photoUrl = photo.original_path
          }

          if (!photoUrl) {
            console.warn(`No URL available for photo ${photo.filename}`)
            return {
              isPlaceholder: true,
              x: margin + (col * (photoWidth + 10)),
              y: pageSize.height - margin - ((row + 1) * (photoHeight + 10)),
              width: photoWidth,
              height: photoHeight
            }
          }

          // Fetch the image
          const imageBuffer = await DownloadsService.downloadPhotoFromStorage(photoUrl)

          // Embed the image in PDF
          let image
          try {
            // Try as JPEG first
            image = await pdfDoc.embedJpg(imageBuffer)
          } catch {
            try {
              // Try as PNG
              image = await pdfDoc.embedPng(imageBuffer)
            } catch {
              console.warn(`Could not embed image ${photo.filename}`)
              return {
                isPlaceholder: true,
                x: margin + (col * (photoWidth + 10)),
                y: pageSize.height - margin - ((row + 1) * (photoHeight + 10)),
                width: photoWidth,
                height: photoHeight
              }
            }
          }

          // Calculate position (no space for title)
          const x = margin + (col * (photoWidth + 10))
          const y = pageSize.height - margin - ((row + 1) * (photoHeight + 10))

          // Scale image to fit while maintaining aspect ratio
          const imageAspectRatio = image.width / image.height
          const targetAspectRatio = photoWidth / photoHeight

          let finalWidth = photoWidth
          let finalHeight = photoHeight

          if (imageAspectRatio > targetAspectRatio) {
            // Image is wider, fit to width
            finalHeight = photoWidth / imageAspectRatio
          } else {
            // Image is taller, fit to height
            finalWidth = photoHeight * imageAspectRatio
          }

          // Center the image in its allocated space
          const imageX = x + (photoWidth - finalWidth) / 2
          const imageY = y + (photoHeight - finalHeight) / 2

          // Draw the image
          page.drawImage(image, {
            x: imageX,
            y: imageY,
            width: finalWidth,
            height: finalHeight
          })

          // No filename text for clean print layout

          return { image, x: imageX, y: imageY, width: finalWidth, height: finalHeight }

        } catch (photoError) {
          console.warn(`Error processing photo ${photo.filename} for PDF:`, photoError)

          // Return placeholder info
          const x = margin + (col * (photoWidth + 10))
          const y = pageSize.height - margin - ((row + 1) * (photoHeight + 10))

          return {
            isPlaceholder: true,
            x,
            y,
            width: photoWidth,
            height: photoHeight
          }
        }
      })

      // Wait for all photos to be processed
      const processedPhotos = await Promise.all(photoProcessingPromises)

      // Draw all photos on page
      processedPhotos.forEach((photoData) => {
        if (photoData.isPlaceholder) {
          // Draw placeholder rectangle
          page.drawRectangle({
            x: photoData.x,
            y: photoData.y,
            width: photoData.width,
            height: photoData.height,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 1
          })
        } else if (photoData.image) {
          // Draw the actual image
          page.drawImage(photoData.image, {
            x: photoData.x,
            y: photoData.y,
            width: photoData.width,
            height: photoData.height
          })
        }
      })
    }

    // Serialize the PDF
    console.log('📄 Finalizing PDF document...')
    const pdfBytes = await pdfDoc.save()
    console.log(`✅ PDF created successfully! Size: ${Math.round(pdfBytes.length / 1024)} KB`)
    return pdfBytes
  }
}