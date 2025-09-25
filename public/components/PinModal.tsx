import React, { useState } from 'react';

interface PinModalProps {
  isOpen: boolean;
  mode: 'setup' | 'verify';
  deviceId: string;
  onSuccess: (sessionData: any) => void;
  onCancel: () => void;
}

export function PinModal({ isOpen, mode, deviceId, onSuccess, onCancel }: PinModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (mode === 'setup') {
        // PIN setup mode
        if (pin !== confirmPin) {
          setError('PINs do not match');
          setIsSubmitting(false);
          return;
        }

        if (!/^\d{4,6}$/.test(pin)) {
          setError('PIN must be 4-6 digits');
          setIsSubmitting(false);
          return;
        }

        // Set PIN first
        const setPinResponse = await fetch('/api/auth/set-pin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId,
            pin
          })
        });

        if (!setPinResponse.ok) {
          const errorData = await setPinResponse.json().catch(() => ({ message: 'Failed to set PIN' }));
          setError(errorData.message || 'Failed to set PIN');
          setIsSubmitting(false);
          return;
        }

        // Then create session with PIN
        const sessionResponse = await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId,
            pin
          })
        });

        const sessionData = await sessionResponse.json();

        if (sessionData.success && sessionData.data.user && sessionData.data.session) {
          onSuccess(sessionData.data);
        } else {
          setError('Failed to create session after PIN setup');
        }
      } else {
        // PIN verification mode
        if (!/^\d{4,6}$/.test(pin)) {
          setError('PIN must be 4-6 digits');
          setIsSubmitting(false);
          return;
        }

        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId,
            pin
          })
        });

        const data = await response.json();

        if (data.success && data.data.user && data.data.session) {
          onSuccess(data.data);
        } else {
          setError(data.message || 'Invalid PIN');
        }
      }
    } catch (error) {
      console.error('PIN submission error:', error);
      setError('Network error. Please try again.');
    }

    setIsSubmitting(false);
  };

  const handlePinChange = (value: string) => {
    // Only allow digits
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setPin(numericValue);
  };

  const handleConfirmPinChange = (value: string) => {
    // Only allow digits
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setConfirmPin(numericValue);
  };

  if (!isOpen) return null;

  return (
    <div className="pin-modal-overlay">
      <div className="pin-modal-content">
        <div className="pin-modal-header">
          <h2>🔒 {mode === 'setup' ? 'Set up Device PIN' : 'Enter Device PIN'}</h2>
          <p>
            {mode === 'setup'
              ? 'Protect your photos with a PIN. Anyone using this device ID will need this PIN to access your photos.'
              : 'Enter your PIN to access your photos on this device.'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="pin-form">
          <div className="pin-input-group">
            <label htmlFor="pin">
              {mode === 'setup' ? 'Create PIN (4-6 digits)' : 'Enter PIN'}
            </label>
            <input
              type="password"
              id="pin"
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              placeholder="••••••"
              maxLength={6}
              className="pin-input"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          {mode === 'setup' && (
            <div className="pin-input-group">
              <label htmlFor="confirmPin">Confirm PIN</label>
              <input
                type="password"
                id="confirmPin"
                value={confirmPin}
                onChange={(e) => handleConfirmPinChange(e.target.value)}
                placeholder="••••••"
                maxLength={6}
                className="pin-input"
                disabled={isSubmitting}
              />
            </div>
          )}

          {error && (
            <div className="pin-error">
              ❌ {error}
            </div>
          )}

          <div className="pin-actions">
            <button
              type="button"
              onClick={onCancel}
              className="pin-cancel-button"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="pin-submit-button"
              disabled={isSubmitting || pin.length < 4}
            >
              {isSubmitting
                ? '⏳ Processing...'
                : mode === 'setup' ? '✅ Set PIN' : '🔓 Unlock'
              }
            </button>
          </div>
        </form>

        <div className="pin-info">
          <small>
            💡 Your PIN is encrypted and stored securely.
            {mode === 'setup' && ' You can change it later in settings.'}
          </small>
        </div>
      </div>
    </div>
  );
}