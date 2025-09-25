import React, { useState } from 'react';
import { authApi } from '../api';

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

interface PrintDownloadProps {
  selectedPhotos: Photo[];
  onClose: () => void;
  onPhotosDeleted?: () => void;
}

export function PrintDownload({ selectedPhotos, onClose, onPhotosDeleted }: PrintDownloadProps) {
  const [layoutType, setLayoutType] = useState<'single' | 'grid_2x2' | 'grid_3x3' | 'contact_sheet'>('grid_2x2');
  const [paperSize, setPaperSize] = useState<'A4' | 'letter' | '4x6' | '5x7'>('A4');
  const [photoType, setPhotoType] = useState<'original' | 'processed'>('processed');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const downloadSelected = async () => {
    if (selectedPhotos.length === 0) return;

    setIsProcessing(true);

    try {
      const token = localStorage.getItem('authToken');

      if (selectedPhotos.length === 1) {
        // Single photo download
        const photo = selectedPhotos[0];
        const downloadType = photoType === 'processed' && photo.processedPath ? 'processed' : 'original';

        const response = await fetch(`/api/downloads/photo/${photo.id}/${downloadType}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
          console.log(`Downloaded: ${photo.filename}`);
        } else {
          console.error(`Failed to download ${photo.filename}:`, response.status);
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          alert(`Failed to download ${photo.filename}: ${errorData.error || 'Unknown error'}`);
        }
      } else {
        // Multiple photos - download as ZIP
        const photoIds = selectedPhotos.map(p => p.id);

        const response = await fetch('/api/downloads/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            photoIds,
            type: photoType,
            format: 'zip'
          })
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;

          // Create filename with timestamp
          const timestamp = new Date().toISOString().slice(0, 10);
          a.download = `classic-web-fotos-${timestamp}.zip`;

          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          console.log(`Downloaded ZIP with ${selectedPhotos.length} photos`);
        } else {
          console.error('Failed to download ZIP:', response.status);
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          alert(`Failed to download ZIP: ${errorData.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const printSelected = async () => {
    if (selectedPhotos.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus(`Preparing print layout for ${selectedPhotos.length} photos...`);

    try {
      const token = localStorage.getItem('authToken');
      const photoIds = selectedPhotos.map(p => p.id);

      setProcessingStatus('Generating PDF layout...');

      const response = await fetch('/api/downloads/print-layout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          photoIds,
          layoutType,
          paperSize,
          photoType
        })
      });

      if (response.ok) {
        setProcessingStatus('Preparing PDF for download...');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        setProcessingStatus('Opening print preview...');

        // Open print dialog
        const printWindow = window.open(url);
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        }

        // Also trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `instax_print_layout_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setProcessingStatus('Print layout ready!');
      }
    } catch (error) {
      console.error('Print failed:', error);
      alert('Print preparation failed. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const shareSelected = async () => {
    if (selectedPhotos.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus('Creating public share link...');

    try {
      const token = localStorage.getItem('authToken');
      const photoIds = selectedPhotos.map(p => p.id);

      const response = await fetch('/api/shares/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          photoIds,
          title: `${selectedPhotos.length} photos shared from Classic Web Fotos`,
          description: `Shared photos: ${selectedPhotos.map(p => p.displayName).join(', ')}`,
          downloadType: photoType
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Share created:', data);

        const fullShareUrl = `${window.location.origin}/share/${data.data.shareToken}`;
        setShareLink(fullShareUrl);
        setShowShareModal(true);
        setProcessingStatus('Share link created successfully!');
      } else {
        console.error('Failed to create share:', response.status);
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Failed to create share: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Share creation failed:', error);
      alert('Share creation failed. Please try again.');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProcessingStatus(''), 2000);
    }
  };

  const deleteSelected = async () => {
    if (selectedPhotos.length === 0) return;

    const photoNames = selectedPhotos.map(p => p.displayName).join(', ');
    const confirmMessage = selectedPhotos.length === 1
      ? `Are you sure you want to delete "${photoNames}"?`
      : `Are you sure you want to delete ${selectedPhotos.length} photos?\n\n${photoNames}`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsProcessing(true);
    setProcessingStatus(`Deleting ${selectedPhotos.length} photo${selectedPhotos.length > 1 ? 's' : ''}...`);

    try {
      const token = localStorage.getItem('authToken');
      const photoIds = selectedPhotos.map(p => p.id);

      const response = await fetch('/api/photos/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ photoIds })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Photos deleted:', result);

        alert(`Successfully deleted ${selectedPhotos.length} photo${selectedPhotos.length > 1 ? 's' : ''}!`);

        // Notify parent to refresh photos
        if (onPhotosDeleted) {
          onPhotosDeleted();
        }

        // Close the modal
        onClose();
      } else {
        console.error('Failed to delete photos:', response.status);
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Failed to delete photos: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Delete failed. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  if (selectedPhotos.length === 0) {
    return (
      <div className="print-download-modal">
        <div className="modal-content">
          <div className="modal-header">
            <h2>📋 Print & Download</h2>
            <button onClick={onClose} className="close-button">✕</button>
          </div>
          <div className="empty-selection">
            <p>No photos selected. Please select photos first.</p>
            <button onClick={onClose} className="action-button">Go Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="print-download-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>📋 Print & Download ({selectedPhotos.length} photos)</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>

        <div className="modal-body">
          <div className="selected-photos-preview">
            <h3>Selected Photos</h3>
            <div className="photo-thumbnails">
              {selectedPhotos.map(photo => (
                <div key={photo.id} className="preview-thumbnail">
                  <img src={photo.thumbnailPath} alt={photo.displayName} />
                  <span className="photo-name">{photo.displayName.substring(0, 20)}...</span>
                </div>
              ))}
            </div>
          </div>

          <div className="options-panel">
            <div className="option-group">
              <h4>Photo Type</h4>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    value="processed"
                    checked={photoType === 'processed'}
                    onChange={(e) => setPhotoType(e.target.value as any)}
                  />
                  Processed (with filters) - Recommended
                </label>
                <label>
                  <input
                    type="radio"
                    value="original"
                    checked={photoType === 'original'}
                    onChange={(e) => setPhotoType(e.target.value as any)}
                  />
                  Original (without filters)
                </label>
              </div>
            </div>

            {selectedPhotos.length > 1 && (
              <div className="option-group">
                <h4>Print Layout</h4>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="grid_2x2"
                      checked={layoutType === 'grid_2x2'}
                      onChange={(e) => setLayoutType(e.target.value as any)}
                    />
                    2×2 Grid (4 photos per page)
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="grid_3x3"
                      checked={layoutType === 'grid_3x3'}
                      onChange={(e) => setLayoutType(e.target.value as any)}
                    />
                    3×3 Grid (9 photos per page)
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="contact_sheet"
                      checked={layoutType === 'contact_sheet'}
                      onChange={(e) => setLayoutType(e.target.value as any)}
                    />
                    Contact Sheet (All photos)
                  </label>
                </div>
              </div>
            )}

            <div className="option-group">
              <h4>Paper Size</h4>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    value="A4"
                    checked={paperSize === 'A4'}
                    onChange={(e) => setPaperSize(e.target.value as any)}
                  />
                  A4 (210×297mm)
                </label>
                <label>
                  <input
                    type="radio"
                    value="letter"
                    checked={paperSize === 'letter'}
                    onChange={(e) => setPaperSize(e.target.value as any)}
                  />
                  Letter (8.5×11")
                </label>
                <label>
                  <input
                    type="radio"
                    value="4x6"
                    checked={paperSize === '4x6'}
                    onChange={(e) => setPaperSize(e.target.value as any)}
                  />
                  4×6" Photo Paper
                </label>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button
              onClick={downloadSelected}
              disabled={isProcessing}
              className="action-button download-button"
            >
              {isProcessing ? '⏳ Processing...' : `📥 Download ${selectedPhotos.length > 1 ? 'as ZIP' : 'Photo'}`}
            </button>

            <button
              onClick={printSelected}
              disabled={isProcessing}
              className="action-button print-button"
            >
              {isProcessing ? `⏳ ${processingStatus}` : '🖨️ Prepare for Print'}
            </button>

            <button
              onClick={shareSelected}
              disabled={isProcessing}
              className="action-button share-button"
            >
              {isProcessing ? `⏳ ${processingStatus}` : '🔗 Create Share Link'}
            </button>

            <button
              onClick={deleteSelected}
              disabled={isProcessing}
              className="action-button delete-button"
              style={{ backgroundColor: '#e74c3c', borderColor: '#c0392b' }}
            >
              {isProcessing ? `⏳ ${processingStatus}` : `🗑️ Delete ${selectedPhotos.length > 1 ? 'Photos' : 'Photo'}`}
            </button>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && shareLink && (
        <div className="share-modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="share-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔗 Share Link Created</h3>
              <button onClick={() => setShowShareModal(false)} className="close-button">✕</button>
            </div>
            <div className="share-modal-body">
              <p>Anyone with this link can view and download your selected photos:</p>
              <div className="share-link-container">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="share-link-input"
                  onClick={(e) => e.target.select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                    alert('Link copied to clipboard!');
                  }}
                  className="copy-button"
                >
                  📋 Copy
                </button>
              </div>
              <div className="share-info">
                <p><strong>Photos:</strong> {selectedPhotos.length} selected</p>
                <p><strong>Type:</strong> {photoType === 'processed' ? 'Processed (with filters)' : 'Original'}</p>
                <p><strong>Note:</strong> This link will remain active until you delete it</p>
              </div>
              <div className="share-actions">
                <button
                  onClick={() => window.open(shareLink, '_blank')}
                  className="action-button preview-button"
                >
                  👁️ Preview Link
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="action-button close-button"
                >
                  ✅ Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}