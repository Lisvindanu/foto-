import React, { useState } from 'react';
import { PinModal } from './PinModal';

interface AuthPanelProps {
  onLogin: (user: any, token: string) => void;
}

export function AuthPanel({ onLogin }: AuthPanelProps) {
  const [deviceId, setDeviceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState<'setup' | 'verify'>('setup');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId.trim()) {
      setError('Please enter a device ID');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId: deviceId.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.data.requiresPinSetup) {
          // Show PIN setup modal
          setPinMode('setup');
          setShowPinModal(true);
        } else if (data.data.requiresPinVerification) {
          // Show PIN verification modal
          setPinMode('verify');
          setShowPinModal(true);
        } else if (data.data.user && data.data.session) {
          // Success - user logged in
          onLogin(data.data.user, data.data.session.sessionToken);
        } else {
          setError('Unexpected response from server');
        }
      } else {
        setError(data.error?.message || data.message || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }

    setIsLoading(false);
  };

  const handlePinSuccess = (sessionData: any) => {
    setShowPinModal(false);
    onLogin(sessionData.user, sessionData.session.sessionToken);
  };

  const handlePinCancel = () => {
    setShowPinModal(false);
    setError('PIN is required to access your photos');
  };

  return (
    <div className="auth-panel">
      <div className="auth-card">
        <h2>
          <span className="design-text">FOTOS</span>
          <span className="studio-text">STUDIO</span>
        </h2>
        <div className="japanese-text">写真スタジオ</div>
        <p className="subtitle">BETTER THAN BEFORE</p>
        <p>MADE YOUR PHOTO DESIGN BETTER</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="deviceId">Device ID</label>
            <input
              type="text"
              id="deviceId"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="Enter your device ID"
              disabled={isLoading}
              className="form-input"
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !deviceId.trim()}
            className="auth-button"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-help">
          <p>
            <strong>New user?</strong> Just enter any unique device ID and we'll set up PIN protection.
          </p>
          <p>
            <strong>Returning user?</strong> Use the same device ID and enter your PIN.
          </p>
        </div>
      </div>

      <PinModal
        isOpen={showPinModal}
        mode={pinMode}
        deviceId={deviceId}
        onSuccess={handlePinSuccess}
        onCancel={handlePinCancel}
      />
    </div>
  );
}