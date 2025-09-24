// Database Table Types
export interface UserTable {
  id: number;
  session_token: string;
  device_id?: string;
  user_agent?: string;
  ip_address?: string;
  preferences: string; // JSON string
  storage_quota: number;
  storage_used: number;
  created_at: string;
  last_active_at: string;
  is_active: number; // SQLite boolean (0/1)
}

export interface PhotoTable {
  id: number;
  user_id: number;
  filename: string;
  original_filename?: string;
  display_name?: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
  original_path: string;
  thumbnail_path?: string;
  processed_path?: string;
  camera_info: string; // JSON string
  capture_settings: string; // JSON string
  location_data: string; // JSON string
  exif_data: string; // JSON string
  processing_status: string;
  processing_error?: string;
  is_favorite: number; // SQLite boolean (0/1)
  view_count: number;
  last_viewed_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface FilterCategoryTable {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: number; // SQLite boolean (0/1)
  created_at: string;
}

export interface FilterTable {
  id: number;
  category_id: number;
  name: string;
  display_name: string;
  description?: string;
  filter_type: string;
  parameters: string; // JSON string
  css_class?: string;
  preview_image?: string;
  texture_image?: string;
  lut_file?: string;
  processing_complexity: string;
  is_premium: number; // SQLite boolean (0/1)
  is_active: number; // SQLite boolean (0/1)
  usage_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PhotoFilterTable {
  id: number;
  photo_id: number;
  filter_id: number;
  applied_at: string;
  processing_time_ms?: number;
  filter_intensity: number;
  custom_parameters: string; // JSON string
  result_file_path?: string;
  file_size?: number;
}

export interface UserSessionTable {
  id: number;
  user_id: number;
  session_token: string;
  device_info: string; // JSON string
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  last_activity_at: string;
  expires_at?: string;
  is_active: number; // SQLite boolean (0/1)
  login_method: string;
  security_flags: string; // JSON string
}

export interface AppSettingTable {
  id: number;
  key: string;
  value: string;
  data_type: string;
  description?: string;
  is_public: number; // SQLite boolean (0/1)
  updated_at: string;
}

// Query Parameter Types
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PhotoQueryParams extends PaginationParams {
  userId: number;
  filter?: string;
  favorite?: boolean;
  search?: string;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

// Database Utility Types
export interface InsertResult {
  lastInsertRowid: number;
  changes: number;
}

export interface UpdateResult {
  changes: number;
}

export interface DeleteResult {
  changes: number;
}