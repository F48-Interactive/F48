import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api, idempotencyKey } from '../lib/api';
import { Video, CheckCircle, Loader2, ExternalLink } from 'lucide-react';
import './Onboarding.css';

interface ChannelPreview {
  channelId: string;
  channelName: string;
  handle: string | null;
  imageUrl: string | null;
  subscriberCount: number | null;
}

export function Onboarding() {
  const { hasOrganizerProfile, hasOrganizerAccess, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [channelUrl, setChannelUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<ChannelPreview | null>(null);

  useEffect(() => {
    if (hasOrganizerAccess) navigate('/dashboard', { replace: true });
  }, [hasOrganizerAccess, navigate]);

  const handleConnect = async () => {
    if (!channelUrl.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // Create organizer profile first (if not exists)
      if (!hasOrganizerProfile) {
        await api.post('/organizers/profile', {}, idempotencyKey());
      }

      // Connect YouTube channel
      const channel = await api.post<ChannelPreview>(
        '/organizers/youtube',
        { channelUrl: channelUrl.trim() },
        idempotencyKey(),
      );
      setConnected(channel);
      await refreshUser();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect YouTube channel. Please check the URL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        {!connected ? (
          <>
            <div className="onboarding-icon">
              <Video size={32} />
            </div>
            <h1 className="onboarding-title">Connect Your YouTube Channel</h1>
            <p className="onboarding-desc">
              Your YouTube channel is your public identity on F48.
              Paste your channel URL below.
            </p>

            <div className="input-group" style={{ width: '100%' }}>
              <label className="input-label" htmlFor="channel-url">
                YouTube Channel URL
              </label>
              <input
                id="channel-url"
                className={`input ${error ? 'input-error' : ''}`}
                type="url"
                placeholder="https://youtube.com/@yourchannel"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {error && <p className="onboarding-error">{error}</p>}

            <button
              className="btn btn-primary btn-lg"
              onClick={handleConnect}
              disabled={isSubmitting || !channelUrl.trim()}
              style={{ width: '100%' }}
            >
              {isSubmitting ? <Loader2 size={18} className="spinning" /> : null}
              {isSubmitting ? 'Connecting...' : 'Connect Channel'}
            </button>

            <p className="onboarding-hint">
              We'll fetch your channel name and avatar to verify your identity.
            </p>
          </>
        ) : (
          <>
            <div className="onboarding-success-icon">
              <CheckCircle size={40} />
            </div>
            <h1 className="onboarding-title">Channel Connected</h1>

            <div className="channel-preview">
              {connected.imageUrl && (
                <img
                  src={connected.imageUrl}
                  alt={connected.channelName}
                  className="avatar avatar-xl"
                />
              )}
              <div className="channel-preview-info">
                <span className="channel-preview-name">{connected.channelName}</span>
                {connected.handle && (
                  <span className="channel-preview-handle">{connected.handle}</span>
                )}
                {connected.subscriberCount != null && (
                  <span className="channel-preview-subs">
                    {connected.subscriberCount.toLocaleString()} subscribers
                  </span>
                )}
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg"
              onClick={handleContinue}
              style={{ width: '100%' }}
            >
              Continue to Dashboard
              <ExternalLink size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
