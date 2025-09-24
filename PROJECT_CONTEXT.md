# Classic Web Fotos - Project Context

## Project Overview
Web aplikasi untuk mengambil swafoto dengan efek polaroid/instant camera yang dapat dicetak dengan berbagai filter kertas. Aplikasi ini menggabungkan teknologi modern web dengan estetika retro instant camera untuk memberikan pengalaman unik dalam fotografi digital.

## Vision & Goals
- **User Experience**: Memberikan pengalaman mengambil foto yang menyenangkan dengan hasil seperti kamera polaroid
- **Performance**: Aplikasi yang ringan dengan I/O operation yang minimal dan fast loading
- **Quality**: Output foto berkualitas tinggi yang siap cetak
- **Accessibility**: Mudah digunakan di berbagai device (mobile-first approach)
- **Customization**: Berbagai pilihan filter dan paper effect untuk personalisasi

## Tech Stack Decision

### Backend: Elysia.js + Bun
**Alasan pemilihan:**
- Performance superior dibanding Node.js (3x lebih cepat)
- TypeScript native dengan excellent type inference
- Bundle size yang sangat kecil
- Hot reload yang instant
- Built-in validation dan serialization
- Ecosystem Bun yang growing rapidly

### Frontend: Alpine.js + TailwindCSS
**Alasan pemilihan:**
- Minimal JavaScript footprint (~15KB)
- Declarative syntax seperti Vue tapi lebih ringan
- Perfect untuk interaktivity tanpa complexity
- TailwindCSS untuk rapid UI development
- Tidak butuh build step yang kompleks

### Database: SQLite with Bun:sqlite
**Alasan pemilihan:**
- Zero configuration database
- File-based, cocok untuk small-medium scale
- ACID compliant
- Bun native driver yang sangat cepat
- Easy backup dan migration

### Image Processing
**Client-side:**
- Canvas API untuk live preview dan basic manipulation
- WebRTC untuk camera access
- CSS filters untuk real-time effects

**Server-side:**
- Sharp.js untuk high-quality image processing
- Custom filter algorithms untuk polaroid effects
- Image optimization untuk different output formats

## Core Features & User Journey

### 1. Camera Interface
- **Landing Page**: Clean interface dengan big camera button
- **Permission Handling**: Request camera access dengan clear explanation
- **Camera View**: Full-screen camera dengan controls overlay
- **Device Detection**: Auto-detect front/back camera pada mobile

### 2. Live Preview & Filters
- **Real-time Preview**: Apply effects secara real-time saat user take photo
- **Filter Carousel**: Horizontal scrollable filter options
- **Paper Types**:
  - Classic White (standard polaroid)
  - Vintage Cream (aged paper effect)
  - Black Border (artistic variant)
  - Matte Finish (soft paper texture)
  - Glossy Finish (shiny paper effect)
- **Color Grading**:
  - Original (no filter)
  - Warm (golden hour effect)
  - Cool (blue tint)
  - Sepia (classic vintage)
  - Black & White (timeless classic)
  - Faded (retro washed out)

### 3. Capture & Processing
- **Capture Animation**: Simulate camera flash dan shutter sound
- **Processing Indicator**: Show progress saat apply final filters
- **Quality Options**: Normal/High quality untuk different use cases
- **Metadata Capture**: Timestamp, geolocation (optional), device info

### 4. Result Management
- **Instant Preview**: Show result dengan polaroid frame
- **Action Buttons**: Save, Print, Share, Retake
- **Gallery Access**: View previous photos
- **Export Options**: Different resolutions untuk print/digital

### 5. Gallery & Management
- **Grid View**: Thumbnail gallery dengan infinite scroll
- **Detail View**: Full-size image dengan metadata
- **Batch Operations**: Delete multiple, export multiple
- **Search & Filter**: By date, filter type, favorites

## Technical Architecture

### Frontend Architecture
```
Alpine.js Components:
├── CameraController (main camera interface)
├── FilterSelector (filter carousel)
├── GalleryViewer (photo management)
├── SettingsPanel (app configuration)
└── PrintDialog (print preparation)

Utilities:
├── cameraUtils.js (WebRTC handling)
├── canvasUtils.js (image manipulation)
├── apiClient.js (server communication)
└── storageUtils.js (local storage management)
```

### Backend Architecture
```
Elysia Routes:
├── /api/photos (CRUD operations)
├── /api/upload (file upload handling)
├── /api/process (image processing)
├── /api/filters (filter management)
└── /api/export (download/print formats)

Services:
├── ImageProcessor (Sharp.js wrapper)
├── FilterEngine (custom filter algorithms)
├── StorageManager (file system operations)
└── MetadataExtractor (EXIF handling)
```

### Database Design Preview
```sql
-- Core tables yang akan dibutuhkan:
photos (id, filename, original_filename, metadata, created_at)
filters (id, name, type, parameters, preview_url)
user_sessions (id, session_token, created_at, last_active)
photo_filters (photo_id, filter_id, applied_at)
```

## Performance Considerations

### Client-side Optimization
- **Lazy Loading**: Load filters dan assets on-demand
- **Image Compression**: Compress preview images untuk fast loading
- **Caching Strategy**: Cache processed images di localStorage
- **Progressive Enhancement**: Basic functionality tanpa JavaScript

### Server-side Optimization
- **Streaming Upload**: Handle large files dengan streaming
- **Background Processing**: Queue system untuk heavy image processing
- **CDN Integration**: Serve static assets dari CDN
- **Database Indexing**: Optimize queries untuk gallery operations

### Network Optimization
- **WebP Support**: Modern image format untuk better compression
- **Progressive JPEG**: Load images progressively
- **API Pagination**: Limit data transfer untuk gallery
- **Compression**: Gzip/Brotli untuk text-based responses

## Development Phases

### Phase 1: MVP (Core Functionality)
- Basic camera interface
- 3 basic filters (original, sepia, B&W)
- Single photo capture dan save
- Simple gallery view

### Phase 2: Enhanced Experience
- Multiple filter options
- Paper texture effects
- Batch operations
- Settings panel

### Phase 3: Advanced Features
- Print optimization
- Share functionality
- Advanced filters
- Performance optimization

### Phase 4: Polish & Scale
- PWA capabilities
- Offline functionality
- Analytics integration
- User feedback system

## File Structure (Detailed)
```
classic-web-fotos/
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── .env.example
├──
├── docs/
│   ├── API.md
│   ├── DATABASE.md
│   ├── FRONTEND.md
│   └── DEPLOYMENT.md
│
├── src/
│   ├── index.ts (Elysia app entry)
│   ├── config/
│   │   ├── database.ts
│   │   ├── cors.ts
│   │   └── environment.ts
│   ├── routes/
│   │   ├── photos.ts
│   │   ├── upload.ts
│   │   ├── filters.ts
│   │   └── health.ts
│   ├── services/
│   │   ├── ImageProcessor.ts
│   │   ├── FilterEngine.ts
│   │   ├── StorageManager.ts
│   │   └── MetadataExtractor.ts
│   ├── types/
│   │   ├── Photo.ts
│   │   ├── Filter.ts
│   │   ├── ApiResponse.ts
│   │   └── Database.ts
│   ├── utils/
│   │   ├── validation.ts
│   │   ├── errors.ts
│   │   └── helpers.ts
│   └── database/
│       ├── schema.sql
│       ├── migrations/
│       └── seeds/
│
├── public/
│   ├── index.html
│   ├── manifest.json (PWA)
│   ├── service-worker.js
│   ├── css/
│   │   ├── app.css (compiled Tailwind)
│   │   └── components.css
│   ├── js/
│   │   ├── app.js (main Alpine.js app)
│   │   ├── components/
│   │   │   ├── camera.js
│   │   │   ├── gallery.js
│   │   │   ├── filters.js
│   │   │   └── settings.js
│   │   ├── utils/
│   │   │   ├── camera.js
│   │   │   ├── canvas.js
│   │   │   ├── api.js
│   │   │   └── storage.js
│   │   └── vendor/
│   │       ├── alpine.min.js
│   │       └── tailwind.min.css
│   ├── assets/
│   │   ├── images/
│   │   │   ├── icons/
│   │   │   ├── textures/
│   │   │   └── samples/
│   │   ├── sounds/
│   │   │   ├── shutter.mp3
│   │   │   └── success.mp3
│   │   └── fonts/
│   └── uploads/ (temporary storage)
│       ├── originals/
│       ├── processed/
│       └── thumbnails/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── deployment/
    ├── docker/
    ├── nginx/
    └── systemd/
```

## Security Considerations
- File upload validation (type, size, content)
- CSRF protection untuk forms
- Rate limiting untuk API endpoints
- Sanitization untuk user inputs
- Secure file storage dengan proper permissions
- HTTPS enforcement
- Content Security Policy headers