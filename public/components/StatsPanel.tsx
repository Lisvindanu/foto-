import React, { useState, useEffect } from 'react';

interface UserStats {
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
    return (stats.storageUsed / stats.storageQuota) * 100;
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
            {stats.photoCount}
            <span className="stat-unit">photos</span>
          </div>
          <div className="stat-details">
            <div className="detail-item">
              <span className="detail-label">Favorites:</span>
              <span className="detail-value">{stats.favoriteCount}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Total Views:</span>
              <span className="detail-value">{stats.totalViews}</span>
            </div>
          </div>
        </div>

        {/* Storage Card */}
        <div className="stat-card storage">
          <h3>Storage Usage</h3>
          <div className="storage-info">
            <div className="storage-text">
              <span className="storage-used">{formatBytes(stats.storageUsed)}</span>
              <span className="storage-total">of {formatBytes(stats.storageQuota)}</span>
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
              <span className="activity-value">{stats.uploadStats.thisWeek}</span>
              <span className="activity-label">This Week</span>
            </div>
            <div className="activity-item">
              <span className="activity-value">{stats.uploadStats.thisMonth}</span>
              <span className="activity-label">This Month</span>
            </div>
            <div className="activity-item">
              <span className="activity-value">{stats.uploadStats.allTime}</span>
              <span className="activity-label">All Time</span>
            </div>
          </div>
        </div>

        {/* Most Used Filter */}
        {stats.mostUsedFilter && (
          <div className="stat-card filter">
            <h3>Favorite Filter</h3>
            <div className="filter-info">
              <div className="filter-name">{stats.mostUsedFilter.name}</div>
              <div className="filter-usage">
                Used {stats.mostUsedFilter.usageCount} times
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