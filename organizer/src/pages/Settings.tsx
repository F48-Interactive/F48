import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api, getErrorMessage, idempotencyKey } from '../lib/api';
import { Video, Plus, CheckCircle, Loader2 } from 'lucide-react';
import './Settings.css';

export function Settings() {
  const { user, refreshUser } = useAuth();
  const organizer = user?.organizer;
  const channels = organizer?.youtubeChannels || [];

  const [showAdd, setShowAdd] = useState(false);
  const [channelUrl, setChannelUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddChannel = async () => {
    if (!channelUrl.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/organizers/youtube', { channelUrl: channelUrl.trim() }, idempotencyKey());
      await refreshUser();
      setChannelUrl('');
      setShowAdd(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to connect channel.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-enter">
      <h1>Settings</h1>
      <p className="text-secondary" style={{ marginBottom: 'var(--space-8)' }}>
        Manage your organizer profile and connected channels.
      </p>

      {/* Profile */}
      <div className="settings-section card">
        <h3>Profile</h3>
        <div className="settings-field">
          <span className="settings-field-label">Display Name</span>
          <span className="settings-field-value">
            {organizer?.displayName || '-'}
            <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: 'var(--space-2)' }}>
              Set from YouTube channel
            </span>
          </span>
        </div>
        <div className="settings-field">
          <span className="settings-field-label">Email</span>
          <span className="settings-field-value">{user?.email || '-'}</span>
        </div>
        <div className="settings-field">
          <span className="settings-field-label">Verification</span>
          <span className="settings-field-value">
            {organizer?.verificationStatus === 'verified' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)' }}>
                <CheckCircle size={14} /> Verified
              </span>
            ) : (
              <span className="text-muted">{organizer?.verificationStatus || '-'}</span>
            )}
          </span>
        </div>
      </div>

      {/* YouTube Channels */}
      <div className="settings-section card" style={{ marginTop: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ margin: 0 }}>YouTube Channels</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={14} /> Add Channel
          </button>
        </div>

        {channels.length === 0 && !showAdd && (
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <Video size={32} className="empty-state-icon" />
            <div className="empty-state-title">No channels connected</div>
            <div className="empty-state-desc">Connect a YouTube channel to create tournaments.</div>
          </div>
        )}

        {channels.map((ch) => (
          <div key={ch.channelId} className="channel-item">
            {ch.imageUrl && <img src={ch.imageUrl} alt="" className="avatar" />}
            <div className="channel-item-info">
              <span className="channel-item-name">{ch.channelName}</span>
              {ch.handle && <span className="text-muted" style={{ fontSize: '0.8125rem' }}>{ch.handle}</span>}
            </div>
            <span className="badge badge-success">Connected</span>
          </div>
        ))}

        {showAdd && (
          <div className="settings-add-channel">
            <div className="input-group" style={{ flex: 1 }}>
              <input
                className={`input ${error ? 'input-error' : ''}`}
                placeholder="https://youtube.com/@channel"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddChannel()}
              />
            </div>
            <button className="btn btn-primary" onClick={handleAddChannel} disabled={isSubmitting || !channelUrl.trim()}>
              {isSubmitting ? <Loader2 size={16} className="spinning" /> : null}
              Connect
            </button>
            {error && <p style={{ color: 'var(--error)', fontSize: '0.8125rem', width: '100%' }}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
