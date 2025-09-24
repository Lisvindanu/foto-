import React, { useState } from 'react';

interface Filter {
  id: number;
  name: string;
  displayName: string;
  filterType: string;
  previewImage?: string;
  usageCount: number;
  isPremium: boolean;
}

interface Photo {
  id: number;
  filename: string;
  displayName: string;
  thumbnailPath: string;
  originalPath: string;
  processedPath?: string;
}

interface FilterPanelProps {
  photo: Photo;
  filters: Filter[];
  onFilterApplied: (processedPhoto: any) => void;
  onClose: () => void;
}

export function FilterPanel({ photo, filters, onFilterApplied, onClose }: FilterPanelProps) {
  const [selectedFilter, setSelectedFilter] = useState<Filter | null>(null);
  const [intensity, setIntensity] = useState(1.0);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState('');

  console.log('FilterPanel opened for photo:', photo);
  console.log('Available filters:', filters);

  const applyFilter = async () => {
    if (!selectedFilter) return;

    console.log('Applying filter:', {
      photoId: photo.id,
      filterId: selectedFilter.id,
      intensity,
      selectedFilter
    });

    setIsApplying(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');
      console.log('Auth token:', token);

      const response = await fetch('/api/filters/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          photoId: photo.id,
          filterId: selectedFilter.id,
          intensity
        })
      });

      console.log('Filter apply response:', response.status, response.statusText);

      const data = await response.json();
      console.log('Filter apply response data:', data);

      if (response.ok) {
        console.log('Calling onFilterApplied with:', data.data.processedPhoto);
        onFilterApplied(data.data.processedPhoto);
        onClose();
      } else {
        setError(data.error?.message || 'Failed to apply filter');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }

    setIsApplying(false);
  };

  const groupedFilters = filters.reduce((acc, filter) => {
    if (!acc[filter.filterType]) {
      acc[filter.filterType] = [];
    }
    acc[filter.filterType].push(filter);
    return acc;
  }, {} as Record<string, Filter[]>);

  return (
    <div className="filter-panel-overlay">
      <div className="filter-panel">
        <div className="filter-panel-header">
          <h2>Apply Filter</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="filter-panel-content">
          <div className="photo-preview">
            <img
              src={photo.thumbnailPath}
              alt={photo.displayName}
              className="preview-image"
            />
            <h3>{photo.displayName}</h3>
          </div>

          <div className="filter-selection">
            <h3>Choose a Filter</h3>

            {Object.entries(groupedFilters).map(([type, typeFilters]) => (
              <div key={type} className="filter-category">
                <h4>{type.charAt(0).toUpperCase() + type.slice(1)} Filters</h4>
                <div className="filter-grid">
                  {typeFilters.map(filter => (
                    <button
                      key={filter.id}
                      className={`filter-option ${selectedFilter?.id === filter.id ? 'selected' : ''} ${filter.isPremium ? 'premium' : ''}`}
                      onClick={() => setSelectedFilter(filter)}
                    >
                      <div className="filter-preview">
                        {filter.previewImage ? (
                          <img src={filter.previewImage} alt={filter.displayName} />
                        ) : (
                          <div className="filter-placeholder">
                            {filter.displayName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="filter-info">
                        <span className="filter-name">{filter.displayName}</span>
                        {filter.isPremium && <span className="premium-badge">PRO</span>}
                        <span className="usage-count">{filter.usageCount} uses</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {selectedFilter && (
            <div className="filter-controls">
              <h3>Filter Settings</h3>
              <div className="intensity-control">
                <label htmlFor="intensity">Intensity: {Math.round(intensity * 100)}%</label>
                <input
                  type="range"
                  id="intensity"
                  min="0"
                  max="1"
                  step="0.1"
                  value={intensity}
                  onChange={(e) => setIntensity(parseFloat(e.target.value))}
                  className="intensity-slider"
                />
              </div>

              <div className="filter-description">
                <p><strong>{selectedFilter.displayName}</strong></p>
                <p>Type: {selectedFilter.filterType}</p>
                {selectedFilter.isPremium && (
                  <p className="premium-note">🌟 Premium filter</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="filter-actions">
            <button
              className="cancel-button"
              onClick={onClose}
              disabled={isApplying}
            >
              Cancel
            </button>
            <button
              className="apply-button"
              onClick={applyFilter}
              disabled={!selectedFilter || isApplying}
            >
              {isApplying ? 'Applying...' : 'Apply Filter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}