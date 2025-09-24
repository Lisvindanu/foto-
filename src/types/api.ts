// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
  pagination?: PaginationInfo;
  timestamp?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// User & Session Types
export interface User {
  id: number;
  sessionToken: string;
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
  preferences: UserPreferences;
  storageQuota: number;
  storageUsed: number;
  createdAt: string;
  lastActiveAt: string;
  isActive: boolean;
}

export interface UserPreferences {
  theme?: 'light' | 'dark';
  language?: 'en' | 'id';
  autoSave?: boolean;
  quality?: 'normal' | 'high';
}

export interface UserSession {
  id: number;
  userId: number;
  sessionToken: string;
  deviceInfo: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt?: string;
  isActive: boolean;
  loginMethod: string;
  securityFlags: Record<string, any>;
}

// Photo Types
export interface Photo {
  id: number;
  userId: number;
  filename: string;
  originalFilename?: string;
  displayName?: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
  originalPath: string;
  thumbnailPath?: string;
  processedPath?: string;
  cameraInfo: CameraInfo;
  captureSettings: CaptureSettings;
  locationData: LocationData;
  exifData: Record<string, any>;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  isFavorite: boolean;
  viewCount: number;
  lastViewedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CameraInfo {
  deviceType?: 'mobile' | 'desktop';
  cameraType?: 'front' | 'back' | 'external';
  resolution?: string;
}

export interface CaptureSettings {
  quality?: 'normal' | 'high';
  format?: 'jpeg' | 'png' | 'webp';
}

export interface LocationData {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

// Filter Types
export interface FilterCategory {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface Filter {
  id: number;
  categoryId: number;
  name: string;
  displayName: string;
  description?: string;
  filterType: 'paper' | 'color' | 'composite';
  parameters: Record<string, any>;
  cssClass?: string;
  previewImage?: string;
  textureImage?: string;
  lutFile?: string;
  processingComplexity: 'low' | 'medium' | 'high';
  isPremium: boolean;
  isActive: boolean;
  usageCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoFilter {
  id: number;
  photoId: number;
  filterId: number;
  appliedAt: string;
  processingTimeMs?: number;
  filterIntensity: number;
  customParameters: Record<string, any>;
  resultFilePath?: string;
  fileSize?: number;
}

// Request Types
export interface CreateSessionRequest {
  deviceId?: string;
  userAgent?: string;
  preferences?: UserPreferences;
}

export interface UploadPhotoRequest {
  file: File;
  filterId?: number;
  quality?: 'normal' | 'high';
  metadata?: {
    cameraInfo?: CameraInfo;
    captureSettings?: CaptureSettings;
    location?: LocationData;
  };
}

export interface GetPhotosRequest {
  page?: number;
  limit?: number;
  filter?: string;
  favorite?: boolean;
  search?: string;
  sortBy?: 'created_at' | 'updated_at' | 'file_size';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdatePhotoRequest {
  displayName?: string;
  isFavorite?: boolean;
}

export interface ApplyFilterRequest {
  photoId: number;
  filterId: number;
  intensity?: number;
  customParameters?: Record<string, any>;
}

export interface BatchExportRequest {
  photoIds: number[];
  format: 'zip' | 'pdf';
  options: {
    quality?: 'high' | 'print';
    includeOriginals?: boolean;
    paperSize?: '4x6' | '5x7' | '8x10';
    layout?: 'single' | 'grid';
  };
}

// Response Types
export interface SessionResponse {
  sessionToken: string;
  user: User;
}

export interface PhotoResponse {
  photo: Photo;
  appliedFilters?: FilterWithCategory[];
}

export interface PhotosResponse {
  photos: PhotoWithFilters[];
}

export interface PhotoWithFilters extends Photo {
  appliedFilters: FilterWithCategory[];
}

export interface FilterWithCategory extends Filter {
  category: FilterCategory;
}

export interface FiltersResponse {
  categories: FilterCategoryWithFilters[];
}

export interface FilterCategoryWithFilters extends FilterCategory {
  filters: Filter[];
}

export interface ProcessedPhotoResponse {
  processedPhoto: {
    id: number;
    originalPhotoId: number;
    processedPath: string;
    processingTimeMs: number;
    appliedFilter: Filter;
    fileSize: number;
  };
}

export interface ExportResponse {
  exportId: string;
  downloadUrl: string;
  expiresAt: string;
  fileSize: number;
  photoCount: number;
}

export interface UserStatsResponse {
  photoCount: number;
  storageUsed: number;
  storageQuota: number;
  favoriteCount: number;
  totalViews: number;
  mostUsedFilter?: {
    id: number;
    name: string;
    usageCount: number;
  };
  uploadStats: {
    thisWeek: number;
    thisMonth: number;
    allTime: number;
  };
}

export interface FilterStatsResponse {
  popularFilters: Array<{
    filter: Filter;
    usageCount: number;
    userCount: number;
  }>;
  categoryStats: Array<{
    category: string;
    totalUsage: number;
    filterCount: number;
  }>;
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export const ErrorCodes = {
  // Authentication
  INVALID_SESSION: 'INVALID_SESSION',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Validation
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',

  // Resources
  PHOTO_NOT_FOUND: 'PHOTO_NOT_FOUND',
  FILTER_NOT_FOUND: 'FILTER_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // Limits
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  MAX_PHOTOS_EXCEEDED: 'MAX_PHOTOS_EXCEEDED',

  // Processing
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',

  // Server
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
} as const;