import React, { useState } from 'react';

interface AuthPanelProps {
  onLogin: (user: any, token: string) => void;
}

export function AuthPanel({ onLogin }: AuthPanelProps) {
  const [deviceId, setDeviceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId.trim()) {
      setError('Please enter a device ID');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId: deviceId.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.data.user, data.data.token);
      } else {
        setError(data.error?.message || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }

    setIsLoading(false);
  };

  return (
    <div className="auth-panel">
      <div className="auth-card">
        <h2>Welcome to Classic Web Fotos</h2>
        <p>Enter your device ID to get started</p>

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
            <strong>New user?</strong> Just enter any unique device ID and we'll create your account automatically.
          </p>
          <p>
            <strong>Returning user?</strong> Use the same device ID you used before.
          </p>
        </div>
      </div>
    </div>
  );
}