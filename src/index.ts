import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { staticPlugin } from '@elysiajs/static'
import { join } from 'path'
import { existsSync } from 'fs'
import { initializeDatabase, getAppSettings } from './database/supabase'
import index from '../public/index.html'

// Import all modules following Elysia best practices
import { authModule } from './modules/auth'
import { photosModule } from './modules/photos'
import { filtersModule } from './modules/filters'
import { downloadsModule } from './modules/downloads'
import { statsModule } from './modules/stats'
import { sharesModule, publicSharesModule } from './modules/shares'
import { uploadImage } from './utils/storage'
import shareHtml from '../public/share.html'

// Database already initialized via Supabase dashboard
console.log('✅ Using Supabase database (schema applied manually)')

const app = new Elysia()
  .use(cors({
    origin: true,
    credentials: true
  }))
  .use(staticPlugin({
    assets: 'public',
    prefix: '/'
  }))

  // Global error handler
  .onError(({ code, error, set }) => {
    console.error('Global error handler:', { code, error: error.message });

    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.message
        },
        timestamp: new Date().toISOString()
      };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        },
        timestamp: new Date().toISOString()
      };
    }

    // Default error response
    set.status = 500;
    return {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      },
      timestamp: new Date().toISOString()
    };
  })

  // Health check
  .get('/api/health', () => ({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      version: '1.0.0'
    }
  }))

  // Get app settings
  .get('/api/system/settings', async () => ({
    success: true,
    data: await getAppSettings()
  }))

  // Simple upload endpoint to Supabase
  .post('/api/upload', async ({ body, set }) => {
    try {
      console.log('Upload request - body type:', typeof body, 'keys:', Object.keys(body || {}))

      if (!body || typeof body !== 'object') {
        set.status = 400
        return { success: false, error: 'No file data provided' }
      }

      // In Elysia, multipart/form-data gets parsed into body object
      const file = (body as any).file
      if (!file) {
        set.status = 400
        return { success: false, error: 'No file field found' }
      }

      console.log('File info:', {
        name: file.name,
        size: file.size,
        type: file.type
      })

      const fileData = Buffer.from(await file.arrayBuffer())
      const fileName = file.name || `photo-${Date.now()}.jpg`

      console.log('Processing file:', { fileName, bufferSize: fileData.length })

      const result = await uploadImage(fileData, fileName)

      if (!result.success) {
        set.status = 500
        return result
      }

      return {
        success: true,
        data: {
          url: result.url,
          filename: fileName
        }
      }
    } catch (error) {
      console.error('Upload error:', error)
      set.status = 500
      return { success: false, error: 'Upload failed' }
    }
  })

  // Serve static uploads files
  .get('/uploads/*', async ({ params, set }) => {
    try {
      const filePath = `uploads/${params['*']}`;
      const fullPath = join(process.cwd(), filePath);

      console.log('Upload request:', {
        requestPath: params['*'],
        filePath,
        fullPath,
        exists: existsSync(fullPath)
      });

      if (!existsSync(fullPath)) {
        set.status = 404;
        return { error: 'File not found' };
      }

      const file = Bun.file(fullPath);

      // Set appropriate MIME type based on file extension
      const ext = filePath.split('.').pop()?.toLowerCase();
      let mimeType = 'application/octet-stream';

      switch (ext) {
        case 'jpg':
        case 'jpeg':
          mimeType = 'image/jpeg';
          break;
        case 'png':
          mimeType = 'image/png';
          break;
        case 'webp':
          mimeType = 'image/webp';
          break;
        case 'gif':
          mimeType = 'image/gif';
          break;
      }

      set.headers = {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000'
      };

      return file;
    } catch (error) {
      console.error('Upload route error:', error);
      set.status = 500;
      return { error: 'Internal server error' };
    }
  })

  // API Documentation endpoint
  .get('/api/docs', () => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Classic Web Fotos - API Documentation</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .endpoint { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .method { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; font-size: 12px; }
        .get { background: #28a745; }
        .post { background: #007bff; }
        .put { background: #ffc107; color: #000; }
        .delete { background: #dc3545; }
        .path { font-family: monospace; font-weight: bold; }
        .description { margin: 8px 0; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📸 Classic Web Fotos API</h1>
        <p>Complete API documentation for the polaroid web application</p>
      </div>

      <h2>Authentication</h2>
      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/auth/session</span>
        <div class="description">Create or retrieve user session</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/auth/session</span>
        <div class="description">Get current session info</div>
      </div>
      <div class="endpoint">
        <span class="method delete">DELETE</span>
        <span class="path">/api/auth/session</span>
        <div class="description">Destroy current session</div>
      </div>

      <h2>Photo Management</h2>
      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/photos/upload</span>
        <div class="description">Upload and process photo with optional filter</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/photos</span>
        <div class="description">Get user photos with pagination and filtering</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/photos/:id</span>
        <div class="description">Get detailed photo information</div>
      </div>
      <div class="endpoint">
        <span class="method put">PUT</span>
        <span class="path">/api/photos/:id</span>
        <div class="description">Update photo metadata</div>
      </div>
      <div class="endpoint">
        <span class="method delete">DELETE</span>
        <span class="path">/api/photos/:id</span>
        <div class="description">Delete photo (soft delete)</div>
      </div>
      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/photos/:id/favorite</span>
        <div class="description">Toggle photo favorite status</div>
      </div>

      <h2>Filter Management</h2>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/filters</span>
        <div class="description">Get available filters grouped by category</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/filters/:id</span>
        <div class="description">Get specific filter details</div>
      </div>
      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/filters/apply</span>
        <div class="description">Apply filter to existing photo</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/filters/popular</span>
        <div class="description">Get popular filters (most used)</div>
      </div>

      <h2>Statistics</h2>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/stats/user</span>
        <div class="description">Get user usage statistics</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/stats/filters</span>
        <div class="description">Get filter usage statistics</div>
      </div>

      <h2>Downloads</h2>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/downloads/photo/:id/:type</span>
        <div class="description">Download specific photo variant (original, processed, thumbnail, print)</div>
      </div>
      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/downloads/batch</span>
        <div class="description">Batch download multiple photos as ZIP</div>
      </div>
      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/downloads/print-layout</span>
        <div class="description">Generate and download print layout PDF</div>
      </div>

      <h2>Public Shares</h2>
      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/shares/create</span>
        <div class="description">Create public share link for photos (requires auth)</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/shares</span>
        <div class="description">Get user's public shares (requires auth)</div>
      </div>
      <div class="endpoint">
        <span class="method delete">DELETE</span>
        <span class="path">/api/shares/:token</span>
        <div class="description">Delete public share (requires auth)</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/share/:token</span>
        <div class="description">View public share info (no auth required)</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/share/:token/download</span>
        <div class="description">Download public share (no auth required)</div>
      </div>

      <h2>System</h2>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/health</span>
        <div class="description">Health check endpoint</div>
      </div>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/system/settings</span>
        <div class="description">Get public app settings</div>
      </div>
    </body>
    </html>
  `)

  // Register all modules following feature-based structure
  .use(authModule)
  .use(photosModule)
  .use(filtersModule)
  .use(downloadsModule)
  .use(statsModule)
  .use(sharesModule)
  .use(publicSharesModule)

  // Share page route
  .get('/share/:shareToken', shareHtml)

  // Serve React app
  .get('/', index)

  .listen(3000)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
console.log(`📸 Classic Web Fotos API ready with all endpoints!`)
console.log(`📚 API Documentation: http://localhost:3000/api/docs`)
console.log(`🔍 Available endpoints (modular structure):`)
console.log(`   • POST /api/auth/session - Authentication`)
console.log(`   • POST /api/photos/upload - Photo upload`)
console.log(`   • GET  /api/photos - Photo management`)
console.log(`   • GET  /api/filters - Filter management`)
console.log(`   • POST /api/filters/apply - Apply filters`)
console.log(`   • GET  /api/stats/user - User statistics`)
console.log(`   • POST /api/downloads/batch - Batch ZIP downloads`)

// Export the app type for Eden Treaty
export type App = typeof app