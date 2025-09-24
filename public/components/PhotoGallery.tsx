import React, { useState } from 'react';

interface Photo {
  id: number;
  filename: string;
  displayName: string;
  thumbnailPath: string;
  originalPath: string;
  processedPath?: string;
  width: number;
  height: number;
  fileSize: number;
  isFavorite: boolean;
  viewCount: number;
  createdAt: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
  onPhotoSelect: (photo: Photo) => void;
  onPhotoUpdate: () => void;
  onPhotosSelected?: (photos: Photo[]) => void;
}

export function PhotoGallery({ photos, onPhotoSelect, onPhotoUpdate, onPhotosSelected }: PhotoGalleryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'favorites'>('newest');
  const [photoFilter, setPhotoFilter] = useState<'all' | 'original' | 'filtered'>('all');
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Filter photos berdasarkan type (all/original/filtered)
  const filteredPhotos = photos.filter(photo => {
    switch (photoFilter) {
      case 'original':
        return !photo.processedPath; // Original photos (belum ada filter)
      case 'filtered':
        return !!photo.processedPath; // Filtered photos (sudah ada filter)
      case 'all':
      default:
        return true; // Semua photos
    }
  });

  const sortedPhotos = [...filteredPhotos].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'favorites':
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      default:
        return 0;
    }
  });

  const toggleFavorite = async (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/photos/${photo.id}/favorite`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isFavorite: !photo.isFavorite })
      });

      if (response.ok) {
        onPhotoUpdate();
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const deletePhoto = async (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${photo.displayName}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/photos/${photo.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        onPhotoUpdate();
      }
    } catch (error) {
      console.error('Failed to delete photo:', error);
    }
  };

  const downloadPhoto = async (photo: Photo, type: 'original' | 'processed' = 'original') => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/downloads/photo/${photo.id}/${type}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${photo.filename}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download photo:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString || dateString === 'null' || dateString === 'undefined') {
      return 'Unknown date';
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'for dateString:', dateString);
      return 'Unknown date';
    }
  };

  const togglePhotoSelection = (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation();

    const newSelection = new Set(selectedPhotos);
    if (newSelection.has(photo.id)) {
      newSelection.delete(photo.id);
    } else {
      newSelection.add(photo.id);
    }

    setSelectedPhotos(newSelection);

    // Notify parent with selected photos
    if (onPhotosSelected) {
      const selectedPhotoObjects = photos.filter(p => newSelection.has(p.id));
      onPhotosSelected(selectedPhotoObjects);
    }
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedPhotos(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedPhotos(new Set());
    if (onPhotosSelected) {
      onPhotosSelected([]);
    }
  };

  const selectAll = () => {
    const allIds = new Set(photos.map(p => p.id));
    setSelectedPhotos(allIds);
    if (onPhotosSelected) {
      onPhotosSelected([...photos]);
    }
  };

  const clearSelection = () => {
    setSelectedPhotos(new Set());
    if (onPhotosSelected) {
      onPhotosSelected([]);
    }
  };

  if (photos.length === 0) {
    return (
      <div className="photo-gallery-empty">
        <div className="empty-state">
          <div className="empty-icon">📷</div>
          <h2>No photos yet</h2>
          <p>Upload your first photo to get started creating beautiful polaroid-style images!</p>
        </div>
      </div>
    );
  }

  if (filteredPhotos.length === 0) {
    const emptyMessages = {
      original: {
        icon: '📷',
        title: 'No original photos',
        message: 'All your photos have been processed with filters. Use "All" tab to see them!'
      },
      filtered: {
        icon: '✨',
        title: 'No filtered photos yet',
        message: 'Apply some filters to your photos to see them here!'
      }
    };

    const emptyState = emptyMessages[photoFilter as keyof typeof emptyMessages];

    if (emptyState) {
      return (
        <div className="photo-gallery-empty">
          <div className="empty-state">
            <div className="empty-icon">{emptyState.icon}</div>
            <h2>{emptyState.title}</h2>
            <p>{emptyState.message}</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="photo-gallery">
      <div className="gallery-header">
        <div className="gallery-stats">
          {selectionMode ? (
            <>
              <span>{selectedPhotos.size} selected</span>
              <button onClick={selectAll} className="select-button">Select All</button>
              <button onClick={clearSelection} className="select-button">Clear</button>
              {selectedPhotos.size > 0 && (
                <button
                  onClick={() => {
                    if (onPhotosSelected) {
                      const selectedPhotoObjects = photos.filter(p => selectedPhotos.has(p.id));
                      onPhotosSelected(selectedPhotoObjects);
                    }
                  }}
                  className="select-button print-button"
                >
                  🖨️ Print & Download
                </button>
              )}
              <button onClick={exitSelectionMode} className="select-button">Cancel</button>
            </>
          ) : (
            <>
              <span>{filteredPhotos.length} photos</span>
              <span>{filteredPhotos.filter(p => p.isFavorite).length} favorites</span>
              <button onClick={enterSelectionMode} className="select-button">📋 Select Photos</button>
            </>
          )}
        </div>

        <div className="gallery-controls">
          <div className="controls-row">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="sort-select"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="favorites">Favorites first</option>
            </select>

            <div className="view-controls">
            <button
              className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              ⊞
            </button>
            <button
              className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              ☰
            </button>
            </div>
          </div>

          <div className="filter-tabs">
            <button
              className={`filter-tab ${photoFilter === 'all' ? 'active' : ''}`}
              onClick={() => setPhotoFilter('all')}
            >
              📁 All ({photos.length})
            </button>
            <button
              className={`filter-tab ${photoFilter === 'original' ? 'active' : ''}`}
              onClick={() => setPhotoFilter('original')}
            >
              📷 Original ({photos.filter(p => !p.processedPath).length})
            </button>
            <button
              className={`filter-tab ${photoFilter === 'filtered' ? 'active' : ''}`}
              onClick={() => setPhotoFilter('filtered')}
            >
              ✨ Filtered ({photos.filter(p => !!p.processedPath).length})
            </button>
          </div>
        </div>
      </div>

      <div className={`photo-grid ${viewMode}`}>
        {sortedPhotos.map(photo => (
          <div
            key={photo.id}
            className={`photo-card ${selectionMode ? 'selection-mode' : ''} ${selectedPhotos.has(photo.id) ? 'selected' : ''}`}
            onClick={() => selectionMode ? togglePhotoSelection(photo, { stopPropagation: () => {} } as React.MouseEvent) : onPhotoSelect(photo)}
          >
            <div className="photo-thumbnail">
              <img
                src={photo.thumbnailPath}
                alt={photo.displayName}
                loading="lazy"
              />
              <div className="photo-overlay">
                {selectionMode && (
                  <div className="selection-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedPhotos.has(photo.id)}
                      onChange={(e) => togglePhotoSelection(photo, e as any)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                <button
                  className={`favorite-button ${photo.isFavorite ? 'active' : ''}`}
                  onClick={(e) => toggleFavorite(photo, e)}
                  title={photo.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  style={selectionMode ? { display: 'none' } : {}}
                >
                  ♥
                </button>
                <div className="photo-actions" style={selectionMode ? { display: 'none' } : {}}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPhotoSelect(photo);
                    }}
                    title="Apply filter"
                    className="filter-button"
                  >
                    ✨
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadPhoto(photo, 'original');
                    }}
                    title="Download original"
                  >
                    ↓
                  </button>
                  {photo.processedPath && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadPhoto(photo, 'processed');
                      }}
                      title="Download processed"
                    >
                      ↓✨
                    </button>
                  )}
                  <button
                    onClick={(e) => deletePhoto(photo, e)}
                    title="Delete photo"
                    className="delete-button"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>

            <div className="photo-info">
              <h3 className="photo-title">{photo.displayName}</h3>
              <div className="photo-meta">
                <span className="photo-date">{formatDate(photo.createdAt)}</span>
                <span className="photo-size">{formatFileSize(photo.fileSize)}</span>
                <span className="photo-views">{photo.viewCount} views</span>
              </div>
              <div className="photo-dimensions">
                {photo.width} × {photo.height}
              </div>
              {photo.processedPath && (
                <div className="processed-badge">✨ Filtered</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}