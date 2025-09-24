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

interface PrintDownloadProps {
  selectedPhotos: Photo[];
  onClose: () => void;
}

export function PrintDownload({ selectedPhotos, onClose }: PrintDownloadProps) {
  const [layoutType, setLayoutType] = useState<'single' | 'grid_2x2' | 'grid_3x3' | 'contact_sheet'>('grid_2x2');
  const [paperSize, setPaperSize] = useState<'A4' | 'letter' | '4x6' | '5x7'>('A4');
  const [photoType, setPhotoType] = useState<'original' | 'processed'>('processed');
  const [isProcessing, setIsProcessing] = useState(false);

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
          console.log(`Downloaded: ${photo.filename}`);
        } else {
          console.error(`Failed to download ${photo.filename}:`, response.status);
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          alert(`Failed to download ${photo.filename}: ${errorData.error || 'Unknown error'}`);
        }
      } else {
        // Multiple photos - download individually for now
        alert('Batch download is not implemented yet. Photos will be downloaded individually.');

        for (const photo of selectedPhotos) {
          const downloadType = photoType === 'processed' && photo.processedPath ? 'processed' : 'original';

          const response = await fetch(`/api/downloads/photo/${photo.id}/${downloadType}`, {
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

            // Add small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.error(`Failed to download ${photo.filename}`);
          }
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

    try {
      const token = localStorage.getItem('authToken');
      const photoIds = selectedPhotos.map(p => p.id);

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
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

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
      }
    } catch (error) {
      console.error('Print failed:', error);
      alert('Print preparation failed. Please try again.');
    } finally {
      setIsProcessing(false);
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
              {isProcessing ? '⏳ Processing...' : `📥 Download ${selectedPhotos.length > 1 ? 'ZIP' : 'Photo'}`}
            </button>

            <button
              onClick={printSelected}
              disabled={isProcessing}
              className="action-button print-button"
            >
              {isProcessing ? '⏳ Processing...' : '🖨️ Prepare for Print'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}