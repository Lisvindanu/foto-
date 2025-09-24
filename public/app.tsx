import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { PhotoUpload } from './components/PhotoUpload';
import { PhotoGallery } from './components/PhotoGallery';
import { FilterPanel } from './components/FilterPanel';
import { AuthPanel } from './components/AuthPanel';
import { StatsPanel } from './components/StatsPanel';
import { CameraCapture } from './components/CameraCapture';
import { PrintDownload } from './components/PrintDownload';

interface User {
  id: number;
  deviceId: string;
}

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

interface Filter {
  id: number;
  name: string;
  displayName: string;
  filterType: string;
  previewImage?: string;
  usageCount: number;
  isPremium: boolean;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [activeTab, setActiveTab] = useState<'gallery' | 'upload' | 'camera' | 'stats'>('gallery');
  const [showCamera, setShowCamera] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const [showPrintDownload, setShowPrintDownload] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadFilters();
  }, []);

  useEffect(() => {
    if (user) {
      loadPhotos();
    }
  }, [user]);

  const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/validate', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data.user);
      } else {
        localStorage.removeItem('authToken');
      }
    } catch (error) {
      console.error('Auth validation failed:', error);
      localStorage.removeItem('authToken');
    }
    setIsLoading(false);
  };

  const loadPhotos = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch('/api/photos', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPhotos(data.data.photos || []);
      }
    } catch (error) {
      console.error('Failed to load photos:', error);
    }
  };

  const loadFilters = async () => {
    try {
      console.log('Loading filters...');
      const response = await fetch('/api/filters');
      console.log('Filters response:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Filters data:', data);
        const allFilters = data.data.categories.flatMap((cat: any) => cat.filters);
        console.log('All filters:', allFilters);
        setFilters(allFilters);
      }
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  };

  const handleLogin = (userData: User, token: string) => {
    localStorage.setItem('authToken', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
    setPhotos([]);
    setSelectedPhoto(null);
  };

  const handlePhotoUploaded = (newPhoto: Photo) => {
    setPhotos(prev => [newPhoto, ...prev]);
    setActiveTab('gallery');
  };

  const handleCameraPhoto = async (photoBlob: Blob, photoDataUrl: string) => {
    try {
      const formData = new FormData();
      formData.append('file', photoBlob, `instax-${Date.now()}.jpg`);
      formData.append('displayName', `Instax Photo ${new Date().toLocaleString()}`);

      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        const newPhoto = result.data.photo;

        console.log('Photo uploaded successfully:', newPhoto);

        // Add original photo to state first
        setPhotos(prev => [newPhoto, ...prev]);

        // Find Instax Mini filter ID
        const instaxFilter = filters.find(f => f.name === 'instax_mini');

        if (instaxFilter) {
          console.log('Applying Instax filter to photo ID:', newPhoto.id);

          // Automatically apply Instax Mini filter
          const filterResponse = await fetch('/api/filters/apply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              photoId: newPhoto.id,
              filterId: instaxFilter.id,
              intensity: 1.0
            })
          });

          if (filterResponse.ok) {
            const filterResult = await filterResponse.json();
            const processedPhoto = filterResult.data.processedPhoto;
            console.log('Filter applied successfully:', processedPhoto);

            // Add processed photo to state (this creates a new photo entry)
            setPhotos(prev => [processedPhoto, ...prev]);
          } else {
            const errorData = await filterResponse.json();
            console.error('Failed to apply Instax filter:', errorData);
          }
        } else {
          console.error('Instax Mini filter not found');
        }

        setShowCamera(false);
        setActiveTab('gallery');
      } else {
        console.error('Failed to upload camera photo');
      }
    } catch (error) {
      console.error('Error uploading camera photo:', error);
    }
  };

  const handleFilterApplied = (processedPhoto: any) => {
    console.log('handleFilterApplied called with:', processedPhoto);
    setPhotos(prev => [processedPhoto, ...prev]);
  };

  const handlePhotosSelected = (photos: Photo[]) => {
    setSelectedPhotos(photos);
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading Classic Web Fotos...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Classic Web Fotos</h1>
          <p>Create beautiful polaroid-style photos with vintage filters</p>
        </header>
        <main className="app-main">
          <AuthPanel onLogin={handleLogin} />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>Classic Web Fotos</h1>
          <nav className="header-nav">
            <button
              className={`nav-button ${activeTab === 'gallery' ? 'active' : ''}`}
              onClick={() => setActiveTab('gallery')}
            >
              Gallery
            </button>
            <button
              className={`nav-button ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              Upload
            </button>
            <button
              className={`nav-button ${activeTab === 'camera' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('camera');
                setShowCamera(true);
              }}
            >
              📸 Instax Kamera
            </button>
            <button
              className={`nav-button ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              Stats
            </button>
          </nav>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'gallery' && (
          <div className="gallery-container">
            <PhotoGallery
              photos={photos}
              onPhotoSelect={setSelectedPhoto}
              onPhotoUpdate={loadPhotos}
              onPhotosSelected={handlePhotosSelected}
            />
            {selectedPhoto && (
              <FilterPanel
                photo={selectedPhoto}
                filters={filters}
                onFilterApplied={handleFilterApplied}
                onClose={() => setSelectedPhoto(null)}
              />
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <PhotoUpload onPhotoUploaded={handlePhotoUploaded} />
        )}

        {activeTab === 'stats' && (
          <StatsPanel />
        )}

        {showCamera && (
          <CameraCapture
            onPhotoTaken={handleCameraPhoto}
            onClose={() => {
              setShowCamera(false);
              setActiveTab('gallery');
            }}
          />
        )}

        {selectedPhotos.length > 0 && (
          <PrintDownload
            selectedPhotos={selectedPhotos}
            onClose={() => {
              setSelectedPhotos([]);
              setShowPrintDownload(false);
            }}
          />
        )}
      </main>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);