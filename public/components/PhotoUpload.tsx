import React, { useState, useRef } from 'react';

interface PhotoUploadProps {
  onPhotoUploaded: (photo: any) => void;
}

export function PhotoUpload({ onPhotoUploaded }: PhotoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length > 0) {
      handleFileUpload(imageFiles[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Upload response:', data);
        onPhotoUploaded(data.data.photo);
        setUploadProgress(100);
        // Reset form
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setError(data.error?.message || 'Upload failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }

    setIsUploading(false);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="photo-upload">
      <div className="upload-header">
        <h2>Upload Your Photo</h2>
        <p>Add a new photo to create beautiful polaroid-style images</p>
      </div>

      <div
        className={`upload-area ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!isUploading ? openFileDialog : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="upload-progress">
            <div className="upload-spinner"></div>
            <p>Uploading your photo...</p>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="upload-icon">
              📸
            </div>
            <h3>Drop your photo here</h3>
            <p>or click to browse files</p>
            <div className="upload-specs">
              <span>JPEG, PNG, WebP</span>
              <span>Max 10MB</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="upload-tips">
        <h3>Tips for best results:</h3>
        <ul>
          <li>Use high-quality images for better filter effects</li>
          <li>Square or portrait images work best for polaroid style</li>
          <li>Good lighting will enhance the vintage filters</li>
          <li>Consider the mood you want to create when choosing filters</li>
        </ul>
      </div>
    </div>
  );
}