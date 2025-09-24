-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE,
  preferences JSON DEFAULT ('{}'),
  storage_quota BIGINT UNSIGNED DEFAULT 1073741824, -- 1GB in bytes
  storage_used BIGINT UNSIGNED DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_device_id (device_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Filter categories
CREATE TABLE IF NOT EXISTS filter_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(255),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_sort_order (sort_order),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Filters
CREATE TABLE IF NOT EXISTS filters (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  filter_type ENUM('paper', 'color', 'composite') NOT NULL,
  parameters JSON NOT NULL,
  css_class VARCHAR(255),
  preview_image VARCHAR(500),
  texture_image VARCHAR(500),
  lut_file VARCHAR(500),
  processing_complexity ENUM('low', 'medium', 'high') DEFAULT 'low',
  is_premium BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count BIGINT UNSIGNED DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES filter_categories(id) ON DELETE CASCADE,
  INDEX idx_category_id (category_id),
  INDEX idx_filter_type (filter_type),
  INDEX idx_is_active (is_active),
  INDEX idx_sort_order (sort_order),
  INDEX idx_usage_count (usage_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Photos
CREATE TABLE IF NOT EXISTS photos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  filename VARCHAR(255) UNIQUE NOT NULL,
  original_filename VARCHAR(255),
  display_name VARCHAR(255),
  file_size BIGINT UNSIGNED NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
  width INT UNSIGNED NOT NULL,
  height INT UNSIGNED NOT NULL,

  -- File paths
  original_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500),
  processed_path VARCHAR(500),

  -- Metadata
  camera_info JSON DEFAULT ('{}'),
  capture_settings JSON DEFAULT ('{}'),
  location_data JSON DEFAULT ('{}'),
  exif_data JSON DEFAULT ('{}'),

  -- Processing status
  processing_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  processing_error TEXT,

  -- User interaction
  is_favorite BOOLEAN DEFAULT FALSE,
  view_count BIGINT UNSIGNED DEFAULT 0,
  last_viewed_at TIMESTAMP NULL,

  -- System fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL, -- Soft delete

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_filename (filename),
  INDEX idx_processing_status (processing_status),
  INDEX idx_is_favorite (is_favorite),
  INDEX idx_deleted_at (deleted_at),
  INDEX idx_user_created (user_id, created_at DESC),
  INDEX idx_user_favorite (user_id, is_favorite, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Photo filters (many-to-many)
CREATE TABLE IF NOT EXISTS photo_filters (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  photo_id BIGINT UNSIGNED NOT NULL,
  filter_id BIGINT UNSIGNED NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processing_time_ms INT UNSIGNED,
  filter_intensity DECIMAL(3,2) DEFAULT 1.00, -- 0.00 to 1.00
  custom_parameters JSON DEFAULT ('{}'),
  result_file_path VARCHAR(500),
  file_size BIGINT UNSIGNED,

  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (filter_id) REFERENCES filters(id) ON DELETE CASCADE,
  UNIQUE KEY unique_photo_filter (photo_id, filter_id),
  INDEX idx_photo_id (photo_id),
  INDEX idx_filter_id (filter_id),
  INDEX idx_applied_at (applied_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  device_info JSON DEFAULT ('{}'),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  login_method VARCHAR(50) DEFAULT 'anonymous',
  security_flags JSON DEFAULT ('{}'),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_session_token (session_token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_last_activity (last_activity_at),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- App settings
CREATE TABLE IF NOT EXISTS app_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_key (`key`),
  INDEX idx_is_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes are already defined inline with table creation above