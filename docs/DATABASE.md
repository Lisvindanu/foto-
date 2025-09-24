# Database Design - Classic Web Fotos

## Database Choice: SQLite with Bun:sqlite

### Rationale
- **Zero Configuration**: No server setup required
- **ACID Compliance**: Reliable transactions
- **File-based**: Easy backup and deployment
- **Performance**: Excellent for read-heavy workloads
- **Bun Integration**: Native driver dengan type safety

## Database Schema

### 1. Tables Overview
```sql
-- Core entities
users (user management)
photos (photo storage dan metadata)
filters (available filter definitions)
filter_categories (filter organization)

-- Relationship tables
photo_filters (many-to-many: photos <-> filters)
user_sessions (session management)
user_favorites (user photo favorites)

-- System tables
app_settings (application configuration)
upload_queue (background processing queue)
```

### 2. Detailed Schema

#### users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT UNIQUE NOT NULL,
  device_id TEXT UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  preferences JSON DEFAULT '{}',
  storage_quota INTEGER DEFAULT 52428800, -- 50MB in bytes
  storage_used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1
);

-- Indexes
CREATE INDEX idx_users_session_token ON users(session_token);
CREATE INDEX idx_users_device_id ON users(device_id);
CREATE INDEX idx_users_last_active ON users(last_active_at);
```

#### photos
```sql
CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  filename TEXT UNIQUE NOT NULL,
  original_filename TEXT,
  display_name TEXT,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,

  -- File paths
  original_path TEXT NOT NULL,
  thumbnail_path TEXT,
  processed_path TEXT,

  -- Metadata
  camera_info JSON DEFAULT '{}', -- device, camera type, etc
  capture_settings JSON DEFAULT '{}', -- resolution, quality, etc
  location_data JSON DEFAULT '{}', -- geolocation if permitted
  exif_data JSON DEFAULT '{}', -- EXIF information

  -- Processing status
  processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  processing_error TEXT,

  -- User interaction
  is_favorite BOOLEAN DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  last_viewed_at DATETIME,

  -- System fields
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL, -- Soft delete

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_photos_user_id ON photos(user_id);
CREATE INDEX idx_photos_created_at ON photos(created_at);
CREATE INDEX idx_photos_filename ON photos(filename);
CREATE INDEX idx_photos_processing_status ON photos(processing_status);
CREATE INDEX idx_photos_is_favorite ON photos(is_favorite);
CREATE INDEX idx_photos_deleted_at ON photos(deleted_at);

-- Composite indexes
CREATE INDEX idx_photos_user_created ON photos(user_id, created_at DESC);
CREATE INDEX idx_photos_user_favorite ON photos(user_id, is_favorite, created_at DESC);
```

#### filter_categories
```sql
CREATE TABLE filter_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- CSS class or icon name
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default categories
INSERT INTO filter_categories (name, display_name, description, sort_order) VALUES
('paper', 'Paper Types', 'Different paper textures and borders', 1),
('color', 'Color Effects', 'Color grading and vintage effects', 2),
('artistic', 'Artistic', 'Creative and artistic filters', 3),
('vintage', 'Vintage', 'Retro and classic film effects', 4);
```

#### filters
```sql
CREATE TABLE filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,

  -- Filter configuration
  filter_type TEXT NOT NULL, -- 'paper', 'color', 'composite'
  parameters JSON NOT NULL, -- Filter-specific parameters
  css_class TEXT, -- For client-side preview

  -- Assets
  preview_image TEXT, -- Thumbnail for filter selection
  texture_image TEXT, -- Texture overlay if applicable
  lut_file TEXT, -- Look-up table for color grading

  -- Metadata
  processing_complexity TEXT DEFAULT 'low', -- low, medium, high
  is_premium BOOLEAN DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (category_id) REFERENCES filter_categories(id)
);

-- Indexes
CREATE INDEX idx_filters_category_id ON filters(category_id);
CREATE INDEX idx_filters_filter_type ON filters(filter_type);
CREATE INDEX idx_filters_is_active ON filters(is_active);
CREATE INDEX idx_filters_sort_order ON filters(sort_order);

-- Default filters
INSERT INTO filters (category_id, name, display_name, filter_type, parameters) VALUES
(1, 'classic_white', 'Classic White', 'paper', '{"border_width": 0.1, "border_color": "#ffffff", "shadow": true}'),
(1, 'vintage_cream', 'Vintage Cream', 'paper', '{"border_width": 0.1, "border_color": "#f5f1e8", "texture": "vintage_paper.png"}'),
(1, 'black_border', 'Black Border', 'paper', '{"border_width": 0.05, "border_color": "#000000", "shadow": false}'),
(2, 'original', 'Original', 'color', '{"saturation": 1.0, "brightness": 1.0, "contrast": 1.0}'),
(2, 'warm', 'Warm', 'color', '{"temperature": 200, "saturation": 1.1, "highlights": 0.1}'),
(2, 'cool', 'Cool', 'color', '{"temperature": -150, "saturation": 0.9, "shadows": -0.1}'),
(2, 'sepia', 'Sepia', 'color', '{"sepia": 0.8, "saturation": 0.3, "brightness": 1.1}'),
(2, 'bw', 'Black & White', 'color', '{"saturation": 0, "contrast": 1.2, "brightness": 1.05}');
```

#### photo_filters (Many-to-many relationship)
```sql
CREATE TABLE photo_filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  photo_id INTEGER NOT NULL,
  filter_id INTEGER NOT NULL,

  -- Application details
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processing_time_ms INTEGER, -- Performance tracking
  filter_intensity REAL DEFAULT 1.0, -- 0.0 to 1.0
  custom_parameters JSON DEFAULT '{}', -- User customizations

  -- Result tracking
  result_file_path TEXT, -- Path to processed image
  file_size INTEGER,

  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (filter_id) REFERENCES filters(id),

  UNIQUE(photo_id, filter_id) -- One filter per photo for now
);

-- Indexes
CREATE INDEX idx_photo_filters_photo_id ON photo_filters(photo_id);
CREATE INDEX idx_photo_filters_filter_id ON photo_filters(filter_id);
CREATE INDEX idx_photo_filters_applied_at ON photo_filters(applied_at);
```

#### user_sessions
```sql
CREATE TABLE user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  device_info JSON DEFAULT '{}', -- Browser, OS, device type
  ip_address TEXT,
  user_agent TEXT,

  -- Session management
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  is_active BOOLEAN DEFAULT 1,

  -- Security tracking
  login_method TEXT DEFAULT 'anonymous', -- anonymous, device_id
  security_flags JSON DEFAULT '{}',

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity_at);
```

#### user_favorites
```sql
CREATE TABLE user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  photo_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,

  UNIQUE(user_id, photo_id)
);

-- Indexes
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_photo_id ON user_favorites(photo_id);
```

#### app_settings
```sql
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  data_type TEXT DEFAULT 'string', -- string, number, boolean, json
  description TEXT,
  is_public BOOLEAN DEFAULT 0, -- Can be accessed by frontend
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default settings
INSERT INTO app_settings (key, value, data_type, description, is_public) VALUES
('max_file_size', '10485760', 'number', 'Maximum upload file size in bytes (10MB)', 1),
('allowed_mime_types', '["image/jpeg", "image/png", "image/webp"]', 'json', 'Allowed image formats', 1),
('max_photos_per_user', '100', 'number', 'Maximum photos per user', 1),
('image_quality', '85', 'number', 'JPEG compression quality (1-100)', 1),
('thumbnail_size', '300', 'number', 'Thumbnail max dimension in pixels', 1),
('session_duration', '2592000', 'number', 'Session duration in seconds (30 days)', 0),
('enable_geolocation', 'false', 'boolean', 'Enable location capture', 1),
('enable_analytics', 'false', 'boolean', 'Enable usage analytics', 1);
```

#### upload_queue (For background processing)
```sql
CREATE TABLE upload_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  photo_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,

  -- Processing details
  queue_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  -- Error handling
  last_error TEXT,
  last_attempt_at DATETIME,

  -- Timing
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,

  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_upload_queue_status ON upload_queue(queue_status);
CREATE INDEX idx_upload_queue_priority ON upload_queue(priority);
CREATE INDEX idx_upload_queue_created_at ON upload_queue(created_at);
```

## Database Utilities & Helpers

### Database Connection (TypeScript)
```typescript
// src/database/connection.ts
import { Database } from 'bun:sqlite';

export class DatabaseManager {
  private static instance: Database;

  public static getInstance(): Database {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new Database('classic_web_fotos.db');
      DatabaseManager.instance.exec('PRAGMA journal_mode = WAL;');
      DatabaseManager.instance.exec('PRAGMA synchronous = NORMAL;');
      DatabaseManager.instance.exec('PRAGMA cache_size = 1000;');
      DatabaseManager.instance.exec('PRAGMA temp_store = memory;');
    }
    return DatabaseManager.instance;
  }
}
```

### Common Queries
```sql
-- Get user photos with pagination
SELECT p.*, COUNT(pf.id) as filter_count
FROM photos p
LEFT JOIN photo_filters pf ON p.id = pf.photo_id
WHERE p.user_id = ? AND p.deleted_at IS NULL
GROUP BY p.id
ORDER BY p.created_at DESC
LIMIT ? OFFSET ?;

-- Get photos with specific filter applied
SELECT p.*, f.display_name as filter_name
FROM photos p
JOIN photo_filters pf ON p.id = pf.photo_id
JOIN filters f ON pf.filter_id = f.id
WHERE p.user_id = ? AND f.name = ?;

-- Get user storage usage
SELECT
  COUNT(*) as photo_count,
  SUM(file_size) as total_size,
  AVG(file_size) as avg_size
FROM photos
WHERE user_id = ? AND deleted_at IS NULL;

-- Get popular filters
SELECT f.*, COUNT(pf.id) as usage_count
FROM filters f
LEFT JOIN photo_filters pf ON f.id = pf.filter_id
GROUP BY f.id
ORDER BY usage_count DESC;
```

## Performance Optimization

### Indexes Strategy
- **Primary Keys**: All tables have auto-increment primary keys
- **Foreign Keys**: Indexed for join performance
- **Composite Indexes**: For common query patterns (user_id + created_at)
- **Partial Indexes**: For filtered queries (WHERE deleted_at IS NULL)

### Query Optimization
- **Pagination**: Use LIMIT/OFFSET with proper ordering
- **Joins**: Prefer LEFT JOIN over subqueries for better performance
- **Aggregations**: Use GROUP BY efficiently
- **Caching**: Implement query result caching for expensive operations

### Maintenance Tasks
```sql
-- Cleanup old sessions (run daily)
DELETE FROM user_sessions
WHERE expires_at < datetime('now') OR last_activity_at < datetime('now', '-30 days');

-- Cleanup deleted photos (run weekly)
DELETE FROM photos
WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-7 days');

-- Update storage usage (run hourly)
UPDATE users SET storage_used = (
  SELECT COALESCE(SUM(file_size), 0)
  FROM photos
  WHERE user_id = users.id AND deleted_at IS NULL
);

-- Analyze tables for query optimization (run weekly)
ANALYZE;
```

## Migration Strategy

### Initial Migration
```sql
-- Create all tables in order (respecting foreign key dependencies)
-- 1. Independent tables first
-- 2. Tables with foreign keys second
-- 3. Insert default data
-- 4. Create indexes
```

### Future Migrations
```sql
-- Track schema versions
CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Example migration structure
-- v001_initial_schema.sql
-- v002_add_geolocation.sql
-- v003_add_user_preferences.sql
```

## Backup & Recovery

### Backup Strategy
```bash
# Daily backup
cp classic_web_fotos.db "backups/db_$(date +%Y%m%d).db"

# Weekly backup with compression
sqlite3 classic_web_fotos.db ".backup backups/weekly_$(date +%Y%m%d).db"
gzip "backups/weekly_$(date +%Y%m%d).db"
```

### Recovery Testing
```sql
-- Verify database integrity
PRAGMA integrity_check;

-- Check foreign key constraints
PRAGMA foreign_key_check;

-- Vacuum database (reclaim space)
VACUUM;
```