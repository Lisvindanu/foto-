# API Documentation - Classic Web Fotos

## API Overview

RESTful API built dengan Elysia.js yang handle semua backend operations untuk aplikasi polaroid web. API ini didesain untuk optimal performance dengan minimal I/O operations.

### Base Configuration
```
Base URL: http://localhost:3000/api
Content-Type: application/json
Authentication: Session-based (cookie)
Rate Limiting: 100 requests/minute per IP
```

### Response Format
```typescript
// Success Response
{
  success: true,
  data: any,
  message?: string,
  pagination?: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}

// Error Response
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  },
  timestamp: string
}
```

## Authentication & Session Management

### POST /api/auth/session
Create atau retrieve user session.

**Request:**
```json
{
  "deviceId"?: string,
  "userAgent"?: string,
  "preferences"?: {
    "theme": "light" | "dark",
    "language": "en" | "id",
    "autoSave": boolean,
    "quality": "normal" | "high"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionToken": "uuid-v4-string",
    "user": {
      "id": 1,
      "deviceId": "device-uuid",
      "preferences": {...},
      "storageQuota": 52428800,
      "storageUsed": 1048576,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  }
}
```

**Status Codes:**
- `200` - Session retrieved/created successfully
- `400` - Invalid request data
- `429` - Rate limit exceeded

---

### GET /api/auth/session
Get current session info.

**Headers:**
```
Authorization: Bearer {sessionToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "session": {
      "expiresAt": "2025-01-31T00:00:00Z",
      "lastActivity": "2025-01-15T10:30:00Z"
    }
  }
}
```

---

### DELETE /api/auth/session
Destroy current session.

**Response:**
```json
{
  "success": true,
  "message": "Session destroyed successfully"
}
```

## Photo Management

### POST /api/photos/upload
Upload dan process photo dengan filter.

**Content-Type:** `multipart/form-data`

**Form Data:**
```
file: File (required) - Image file (JPEG/PNG/WebP, max 10MB)
filterId: number (optional) - Filter to apply
quality: "normal" | "high" (default: "normal")
metadata: JSON string (optional) - Camera/capture metadata
```

**Metadata Format:**
```json
{
  "cameraInfo": {
    "deviceType": "mobile" | "desktop",
    "cameraType": "front" | "back" | "external",
    "resolution": "1920x1080"
  },
  "captureSettings": {
    "quality": "normal" | "high",
    "format": "jpeg" | "png" | "webp"
  },
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "photo": {
      "id": 123,
      "filename": "20250115_103045_abc123.jpg",
      "displayName": "My Polaroid Photo",
      "originalPath": "/uploads/originals/20250115_103045_abc123.jpg",
      "thumbnailPath": "/uploads/thumbnails/20250115_103045_abc123_thumb.jpg",
      "processedPath": "/uploads/processed/20250115_103045_abc123_filtered.jpg",
      "fileSize": 2048576,
      "mimeType": "image/jpeg",
      "width": 1920,
      "height": 1080,
      "processingStatus": "completed",
      "createdAt": "2025-01-15T10:30:45Z"
    },
    "appliedFilter": {
      "id": 1,
      "name": "classic_white",
      "displayName": "Classic White"
    }
  }
}
```

**Status Codes:**
- `201` - Photo uploaded successfully
- `400` - Invalid file or parameters
- `413` - File too large
- `415` - Unsupported media type
- `507` - Storage quota exceeded

---

### GET /api/photos
Get user's photos dengan pagination dan filtering.

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 20, max: 50)
filter: string (optional) - Filter by applied filter name
favorite: boolean (optional) - Filter favorites only
search: string (optional) - Search in display names
sortBy: "created_at" | "updated_at" | "file_size" (default: "created_at")
sortOrder: "asc" | "desc" (default: "desc")
```

**Response:**
```json
{
  "success": true,
  "data": {
    "photos": [
      {
        "id": 123,
        "filename": "20250115_103045_abc123.jpg",
        "displayName": "My Polaroid Photo",
        "thumbnailPath": "/uploads/thumbnails/20250115_103045_abc123_thumb.jpg",
        "fileSize": 2048576,
        "width": 1920,
        "height": 1080,
        "isFavorite": false,
        "viewCount": 5,
        "createdAt": "2025-01-15T10:30:45Z",
        "appliedFilters": [
          {
            "id": 1,
            "name": "classic_white",
            "displayName": "Classic White"
          }
        ]
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

### GET /api/photos/:id
Get detailed photo information.

**Response:**
```json
{
  "success": true,
  "data": {
    "photo": {
      "id": 123,
      "filename": "20250115_103045_abc123.jpg",
      "displayName": "My Polaroid Photo",
      "originalPath": "/uploads/originals/20250115_103045_abc123.jpg",
      "thumbnailPath": "/uploads/thumbnails/20250115_103045_abc123_thumb.jpg",
      "processedPath": "/uploads/processed/20250115_103045_abc123_filtered.jpg",
      "fileSize": 2048576,
      "mimeType": "image/jpeg",
      "width": 1920,
      "height": 1080,
      "isFavorite": false,
      "viewCount": 5,
      "lastViewedAt": "2025-01-15T15:20:00Z",
      "cameraInfo": {...},
      "captureSettings": {...},
      "locationData": {...},
      "exifData": {...},
      "createdAt": "2025-01-15T10:30:45Z",
      "updatedAt": "2025-01-15T10:30:45Z"
    },
    "appliedFilters": [...]
  }
}
```

**Status Codes:**
- `200` - Photo found
- `404` - Photo not found
- `403` - Access denied (not user's photo)

---

### PUT /api/photos/:id
Update photo metadata.

**Request:**
```json
{
  "displayName"?: string,
  "isFavorite"?: boolean
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "photo": {...} // Updated photo object
  }
}
```

---

### DELETE /api/photos/:id
Delete photo (soft delete).

**Response:**
```json
{
  "success": true,
  "message": "Photo deleted successfully"
}
```

---

### POST /api/photos/:id/favorite
Toggle photo favorite status.

**Response:**
```json
{
  "success": true,
  "data": {
    "isFavorite": true
  }
}
```

## Filter Management

### GET /api/filters
Get available filters dengan categories.

**Query Parameters:**
```
category: string (optional) - Filter by category name
active: boolean (default: true) - Only active filters
```

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": 1,
        "name": "paper",
        "displayName": "Paper Types",
        "description": "Different paper textures and borders",
        "icon": "paper-icon",
        "filters": [
          {
            "id": 1,
            "name": "classic_white",
            "displayName": "Classic White",
            "description": "Classic polaroid white border",
            "filterType": "paper",
            "previewImage": "/assets/previews/classic_white.jpg",
            "cssClass": "filter-classic-white",
            "processingComplexity": "low",
            "isPremium": false,
            "usageCount": 1250
          }
        ]
      }
    ]
  }
}
```

---

### GET /api/filters/:id
Get specific filter details.

**Response:**
```json
{
  "success": true,
  "data": {
    "filter": {
      "id": 1,
      "name": "classic_white",
      "displayName": "Classic White",
      "description": "Classic polaroid white border effect",
      "filterType": "paper",
      "parameters": {
        "borderWidth": 0.1,
        "borderColor": "#ffffff",
        "shadow": true
      },
      "previewImage": "/assets/previews/classic_white.jpg",
      "textureImage": "/assets/textures/white_paper.png",
      "cssClass": "filter-classic-white",
      "processingComplexity": "low",
      "category": {
        "id": 1,
        "name": "paper",
        "displayName": "Paper Types"
      }
    }
  }
}
```

## Image Processing

### POST /api/process/apply-filter
Apply filter to existing photo.

**Request:**
```json
{
  "photoId": 123,
  "filterId": 2,
  "intensity": 0.8, // 0.0 to 1.0
  "customParameters"?: {
    "borderWidth": 0.15,
    "saturation": 1.2
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processedPhoto": {
      "id": 124, // New processed photo ID
      "originalPhotoId": 123,
      "processedPath": "/uploads/processed/20250115_103045_abc123_sepia.jpg",
      "processingTimeMs": 850,
      "appliedFilter": {...},
      "fileSize": 2150000
    }
  }
}
```

---

### POST /api/process/batch-export
Export multiple photos dengan format tertentu.

**Request:**
```json
{
  "photoIds": [123, 124, 125],
  "format": "zip" | "pdf",
  "options": {
    "quality": "high" | "print",
    "includeOriginals": boolean,
    "paperSize": "4x6" | "5x7" | "8x10", // For PDF
    "layout": "single" | "grid" // For PDF
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exportId": "export_abc123",
    "downloadUrl": "/api/downloads/export_abc123.zip",
    "expiresAt": "2025-01-15T23:59:59Z",
    "fileSize": 15728640,
    "photoCount": 3
  }
}
```

## Downloads & Export

### GET /api/downloads/:filename
Download processed files.

**Headers:**
```
Range: bytes=0-1023 (optional, for resume downloads)
```

**Response:**
- `200` - File content (binary)
- `206` - Partial content (if Range header)
- `404` - File not found
- `410` - File expired

---

### GET /api/downloads/photo/:id/:type
Download specific photo variant.

**Path Parameters:**
```
id: number - Photo ID
type: "original" | "processed" | "thumbnail" | "print"
```

**Query Parameters:**
```
quality: "web" | "print" (optional)
format: "jpeg" | "png" | "webp" (optional)
```

## Statistics & Analytics

### GET /api/stats/user
Get user usage statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "photoCount": 45,
    "storageUsed": 94371840,
    "storageQuota": 104857600,
    "favoriteCount": 12,
    "totalViews": 156,
    "mostUsedFilter": {
      "id": 1,
      "name": "classic_white",
      "usageCount": 23
    },
    "uploadStats": {
      "thisWeek": 5,
      "thisMonth": 18,
      "allTime": 45
    }
  }
}
```

---

### GET /api/stats/filters
Get filter usage statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "popularFilters": [
      {
        "filter": {...},
        "usageCount": 1250,
        "userCount": 89
      }
    ],
    "categoryStats": [
      {
        "category": "paper",
        "totalUsage": 3450,
        "filterCount": 4
      }
    ]
  }
}
```

## System & Health

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-01-15T10:30:00Z",
    "uptime": 86400,
    "database": "connected",
    "storage": {
      "available": true,
      "freeSpace": "15GB"
    },
    "version": "1.0.0"
  }
}
```

---

### GET /api/system/settings
Get public app settings.

**Response:**
```json
{
  "success": true,
  "data": {
    "maxFileSize": 10485760,
    "allowedMimeTypes": ["image/jpeg", "image/png", "image/webp"],
    "maxPhotosPerUser": 100,
    "imageQuality": 85,
    "thumbnailSize": 300,
    "enableGeolocation": false,
    "enableAnalytics": false
  }
}
```

## Error Codes

### Client Errors (4xx)
```typescript
{
  "INVALID_SESSION": "Session token is invalid or expired",
  "MISSING_REQUIRED_FIELD": "Required field is missing: {fieldName}",
  "INVALID_FILE_TYPE": "File type not supported: {mimeType}",
  "FILE_TOO_LARGE": "File size exceeds limit: {maxSize}MB",
  "QUOTA_EXCEEDED": "Storage quota exceeded",
  "PHOTO_NOT_FOUND": "Photo not found or access denied",
  "FILTER_NOT_FOUND": "Filter not found: {filterId}",
  "RATE_LIMIT_EXCEEDED": "Too many requests, try again later"
}
```

### Server Errors (5xx)
```typescript
{
  "PROCESSING_FAILED": "Image processing failed: {reason}",
  "STORAGE_ERROR": "File storage operation failed",
  "DATABASE_ERROR": "Database operation failed",
  "EXTERNAL_SERVICE_ERROR": "External service unavailable",
  "INTERNAL_SERVER_ERROR": "An unexpected error occurred"
}
```

## Rate Limiting

### Limits per Endpoint
```
/api/auth/session: 10 requests/minute
/api/photos/upload: 5 requests/minute
/api/photos/*: 60 requests/minute
/api/filters/*: 100 requests/minute
/api/process/*: 10 requests/minute
/api/downloads/*: 30 requests/minute
Default: 100 requests/minute
```

### Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642291200
```

## Webhook Support (Future)

### POST /api/webhooks/processing-complete
Notify client when background processing completes.

**Payload:**
```json
{
  "event": "processing.completed",
  "photoId": 123,
  "userId": 456,
  "processingTime": 1500,
  "result": {
    "processedPath": "/uploads/processed/...",
    "fileSize": 2048576
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## SDK Examples

### JavaScript/TypeScript Client
```typescript
class ClassicWebFotosAPI {
  constructor(private baseUrl: string, private sessionToken?: string) {}

  async uploadPhoto(file: File, filterId?: number): Promise<Photo> {
    const formData = new FormData();
    formData.append('file', file);
    if (filterId) formData.append('filterId', filterId.toString());

    const response = await fetch(`${this.baseUrl}/api/photos/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.sessionToken}`
      },
      body: formData
    });

    return this.handleResponse(response);
  }

  async getPhotos(params?: GetPhotosParams): Promise<PhotosResponse> {
    const url = new URL(`${this.baseUrl}/api/photos`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.set(key, value.toString());
      });
    }

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${this.sessionToken}` }
    });

    return this.handleResponse(response);
  }
}
```

### Usage Example
```typescript
const api = new ClassicWebFotosAPI('http://localhost:3000', sessionToken);

// Upload photo dengan filter
const photo = await api.uploadPhoto(cameraFile, 1);

// Get user photos
const photos = await api.getPhotos({
  page: 1,
  limit: 20,
  favorite: true
});

// Apply filter to existing photo
const processed = await api.applyFilter(photo.id, 2, { intensity: 0.8 });
```