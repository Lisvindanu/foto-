import React, { useState, useEffect } from 'react';

interface UserStats {
  totalPhotos: number;
  totalProcessedPhotos: number;
  totalFavorites: number;
  storageUsed: number;
  storageUsedFormatted: string;
  filtersUsed: number;
  joinedDate: string;
  lastActiveDate: string;
  recentActivity: any[];
  uploadStats?: {
    thisWeek: number;
    thisMonth: number;
    allTime: number;
  };
}

export function StatsPanel() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/stats/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      } else {
        setError('Failed to load statistics');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
    setIsLoading(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStoragePercentage = () => {
    if (!stats) return 0;
    // Assume 100MB quota for now (can be made configurable later)
    const storageQuota = 100 * 1024 * 1024; // 100MB in bytes
    return (stats.storageUsed / storageQuota) * 100;
  };

  const formatStorageQuota = () => {
    const storageQuota = 100 * 1024 * 1024; // 100MB
    return formatBytes(storageQuota);
  };

  if (isLoading) {
    return (
      <div className="stats-panel">
        <div className="loading-spinner"></div>
        <p>Loading statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-panel">
        <div className="error-message">{error}</div>
        <button onClick={loadStats} className="retry-button">
          Try Again
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="stats-panel">
        <p>No statistics available</p>
      </div>
    );
  }

  return (
    <div className="stats-panel">
      <div className="stats-header">
        <h2>Your Statistics</h2>
        <button onClick={loadStats} className="refresh-button">
          🔄 Refresh
        </button>
      </div>

      <div className="stats-grid">
        {/* Overview Cards */}
        <div className="stat-card overview">
          <h3>Photo Library</h3>
          <div className="stat-value">
            {stats.totalPhotos}
            <span className="stat-unit">photos</span>
          </div>
          <div className="stat-details">
            <div className="detail-item">
              <span className="detail-label">Favorites:</span>
              <span className="detail-value">{stats.totalFavorites}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Processed:</span>
              <span className="detail-value">{stats.totalProcessedPhotos}</span>
            </div>
          </div>
        </div>

        {/* Storage Card */}
        <div className="stat-card storage">
          <h3>Storage Usage</h3>
          <div className="storage-info">
            <div className="storage-text">
              <span className="storage-used">{stats.storageUsedFormatted}</span>
              <span className="storage-total">of {formatStorageQuota()}</span>
            </div>
            <div className="storage-bar">
              <div
                className="storage-fill"
                style={{ width: `${Math.min(getStoragePercentage(), 100)}%` }}
              ></div>
            </div>
            <div className="storage-percentage">
              {getStoragePercentage().toFixed(1)}% used
            </div>
          </div>
        </div>

        {/* Upload Activity */}
        <div className="stat-card activity">
          <h3>Upload Activity</h3>
          <div className="activity-stats">
            <div className="activity-item">
              <span className="activity-value">{stats.uploadStats?.thisWeek || 0}</span>
              <span className="activity-label">This Week</span>
            </div>
            <div className="activity-item">
              <span className="activity-value">{stats.uploadStats?.thisMonth || 0}</span>
              <span className="activity-label">This Month</span>
            </div>
            <div className="activity-item">
              <span className="activity-value">{stats.uploadStats?.allTime || stats.totalPhotos || 0}</span>
              <span className="activity-label">All Time</span>
            </div>
          </div>
        </div>

        {/* Filter Usage */}
        {stats.filtersUsed > 0 && (
          <div className="stat-card filter">
            <h3>Filter Usage</h3>
            <div className="filter-info">
              <div className="filter-name">Total Filters Applied</div>
              <div className="filter-usage">
                {stats.filtersUsed} times
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="stat-card actions">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button
              className="action-button"
              onClick={() => window.location.hash = '#upload'}
            >
              📸 Upload Photo
            </button>
            <button
              className="action-button"
              onClick={() => window.location.hash = '#gallery'}
            >
              🖼️ View Gallery
            </button>
          </div>
        </div>

        {/* Storage Tips */}
        <div className="stat-card tips">
          <h3>💡 Tips</h3>
          <ul className="tips-list">
            <li>Delete old photos you no longer need to free up space</li>
            <li>Use favorites to quickly find your best photos</li>
            <li>Try different filters to create unique styles</li>
            <li>Download your processed photos to save them locally</li>
          </ul>
        </div>
      </div>
    </div>
  );
}