-- Supabase PostgreSQL Schema for Classic Web Fotos

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE,
  preferences JSONB DEFAULT '{}',
  storage_quota BIGINT DEFAULT 1073741824, -- 1GB in bytes
  storage_used BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Filter categories
CREATE TABLE IF NOT EXISTS filter_categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(255),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for filter_categories table
CREATE INDEX IF NOT EXISTS idx_filter_categories_name ON filter_categories(name);
CREATE INDEX IF NOT EXISTS idx_filter_categories_sort_order ON filter_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_filter_categories_is_active ON filter_categories(is_active);

-- Create filter_type enum
DO $$ BEGIN
    CREATE TYPE filter_type_enum AS ENUM ('paper', 'color', 'composite');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create processing_complexity enum
DO $$ BEGIN
    CREATE TYPE processing_complexity_enum AS ENUM ('low', 'medium', 'high');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Filters
CREATE TABLE IF NOT EXISTS filters (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES filter_categories(id) ON DELETE CASCADE,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  filter_type filter_type_enum NOT NULL,
  parameters JSONB NOT NULL,
  css_class VARCHAR(255),
  preview_image VARCHAR(500),
  texture_image VARCHAR(500),
  lut_file VARCHAR(500),
  processing_complexity processing_complexity_enum DEFAULT 'low',
  is_premium BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count BIGINT DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for filters table
CREATE INDEX IF NOT EXISTS idx_filters_category_id ON filters(category_id);
CREATE INDEX IF NOT EXISTS idx_filters_filter_type ON filters(filter_type);
CREATE INDEX IF NOT EXISTS idx_filters_is_active ON filters(is_active);
CREATE INDEX IF NOT EXISTS idx_filters_sort_order ON filters(sort_order);
CREATE INDEX IF NOT EXISTS idx_filters_usage_count ON filters(usage_count);

-- Create processing_status enum
DO $$ BEGIN
    CREATE TYPE processing_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Photos
CREATE TABLE IF NOT EXISTS photos (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) UNIQUE NOT NULL,
  original_filename VARCHAR(255),
  display_name VARCHAR(255),
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,

  -- File paths
  original_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500),
  processed_path VARCHAR(500),

  -- Metadata
  camera_info JSONB DEFAULT '{}',
  capture_settings JSONB DEFAULT '{}',
  location_data JSONB DEFAULT '{}',
  exif_data JSONB DEFAULT '{}',

  -- Processing status
  processing_status processing_status_enum DEFAULT 'pending',
  processing_error TEXT,

  -- User interaction
  is_favorite BOOLEAN DEFAULT FALSE,
  view_count BIGINT DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,

  -- System fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- Create indexes for photos table
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at);
CREATE INDEX IF NOT EXISTS idx_photos_filename ON photos(filename);
CREATE INDEX IF NOT EXISTS idx_photos_processing_status ON photos(processing_status);
CREATE INDEX IF NOT EXISTS idx_photos_is_favorite ON photos(is_favorite);
CREATE INDEX IF NOT EXISTS idx_photos_deleted_at ON photos(deleted_at);
CREATE INDEX IF NOT EXISTS idx_photos_user_created ON photos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_user_favorite ON photos(user_id, is_favorite, created_at DESC);

-- Photo filters (many-to-many)
CREATE TABLE IF NOT EXISTS photo_filters (
  id BIGSERIAL PRIMARY KEY,
  photo_id BIGINT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  filter_id BIGINT NOT NULL REFERENCES filters(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  processing_time_ms INTEGER,
  filter_intensity DECIMAL(3,2) DEFAULT 1.00, -- 0.00 to 1.00
  custom_parameters JSONB DEFAULT '{}',
  result_file_path VARCHAR(500),
  file_size BIGINT,

  UNIQUE(photo_id, filter_id)
);

-- Create indexes for photo_filters table
CREATE INDEX IF NOT EXISTS idx_photo_filters_photo_id ON photo_filters(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_filters_filter_id ON photo_filters(filter_id);
CREATE INDEX IF NOT EXISTS idx_photo_filters_applied_at ON photo_filters(applied_at);

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  device_info JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  login_method VARCHAR(50) DEFAULT 'anonymous',
  security_flags JSONB DEFAULT '{}'
);

-- Create indexes for user_sessions table
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

-- Create data_type enum
DO $$ BEGIN
    CREATE TYPE data_type_enum AS ENUM ('string', 'number', 'boolean', 'json');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- App settings
CREATE TABLE IF NOT EXISTS app_settings (
  id BIGSERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  data_type data_type_enum DEFAULT 'string',
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for app_settings table
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
CREATE INDEX IF NOT EXISTS idx_app_settings_is_public ON app_settings(is_public);

-- Create triggers for updated_at fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_filters_updated_at
    BEFORE UPDATE ON filters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_photos_updated_at
    BEFORE UPDATE ON photos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for better security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be customized later)
CREATE POLICY "Users can view their own data" ON users
  FOR ALL USING (auth.uid()::text = device_id);

CREATE POLICY "Users can manage their own photos" ON photos
  FOR ALL USING (user_id = (SELECT id FROM users WHERE device_id = auth.uid()::text));

CREATE POLICY "Users can manage their own sessions" ON user_sessions
  FOR ALL USING (user_id = (SELECT id FROM users WHERE device_id = auth.uid()::text));

-- Public read access for filter_categories and filters
CREATE POLICY "Anyone can read filter categories" ON filter_categories
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read filters" ON filters
  FOR SELECT USING (true);

-- Public read access for app_settings (only public ones)
CREATE POLICY "Anyone can read public app settings" ON app_settings
  FOR SELECT USING (is_public = true);

-- Create share_type enum
DO $$ BEGIN
    CREATE TYPE share_type_enum AS ENUM ('single', 'batch');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Public shares
CREATE TABLE IF NOT EXISTS public_shares (
  id BIGSERIAL PRIMARY KEY,
  share_token VARCHAR(255) UNIQUE NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_type share_type_enum NOT NULL,
  photo_ids BIGINT[] NOT NULL, -- Array of photo IDs
  title VARCHAR(255),
  description TEXT,
  download_type VARCHAR(50) DEFAULT 'original', -- original, processed, thumbnail
  is_active BOOLEAN DEFAULT TRUE,
  view_count BIGINT DEFAULT 0,
  download_count BIGINT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for public_shares table
CREATE INDEX IF NOT EXISTS idx_public_shares_share_token ON public_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_public_shares_user_id ON public_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_public_shares_created_at ON public_shares(created_at);
CREATE INDEX IF NOT EXISTS idx_public_shares_is_active ON public_shares(is_active);
CREATE INDEX IF NOT EXISTS idx_public_shares_expires_at ON public_shares(expires_at);

-- Apply updated_at trigger to public_shares
CREATE OR REPLACE TRIGGER update_public_shares_updated_at
    BEFORE UPDATE ON public_shares
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Public read access for public shares (no auth required)
ALTER TABLE public_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active public shares" ON public_shares
  FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));