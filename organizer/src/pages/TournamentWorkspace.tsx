import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getErrorMessage, idempotencyKey } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Loader2,
  Play,
  Swords,
  Trophy as TrophyIcon,
  Users,
} from 'lucide-react';
import './TournamentWorkspace.css';

interface Tournament {
  id: string;
  title: string;
  mode: string;
  status: string;
  fundingType: string;
  description: string | null;
  maxUnits: number | null;
  scheduledStartAt: string | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  createdAt: string;
  organizer?: { displayName: string | null };
}

const TABS = [
  { key: 'overview', icon: ClipboardList, label: 'Overview' },
  { key: 'participants', icon: Users, label: 'Participants' },
  { key: 'matches', icon: Swords, label: 'Matches' },
  { key: 'leaderboard', icon: TrophyIcon, label: 'Leaderboard' },
  { key: 'disputes', icon: AlertTriangle, label: 'Disputes' },
];

const TRANSITIONS: Record<string, { action: string; label: string }[]> = {
  draft: [{ action: 'publish', label: 'Publish' }],
  published: [{ action: 'open_registration', label: 'Open Registration' }],
  registration_open: [{ action: 'close_registration', label: 'Close Registration' }],
  registration_closed: [{ action: 'start_check_in', label: 'Start Check-in' }],
  check_in: [{ action: 'go_live', label: 'Go Live' }],
  live: [{ action: 'publish_provisional_results', label: 'Publish Results' }],
  provisional_results: [{ action: 'open_dispute_window', label: 'Open Dispute Window' }],
  dispute_window: [{ action: 'finalize_results', label: 'Finalize Results' }],
  results_final: [{ action: 'complete', label: 'Complete Tournament' }],
};

export function TournamentWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    api.get<Tournament>(`/tournaments/${id}`)
      .then(setTournament)
      .catch((err: unknown) => setError(getErrorMessage(err, 'Tournament not found.')))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleTransition = async (action: string, reason?: string) => {
    if (!tournament) return;
    setTransitioning(true);
    setError(null);

    try {
      const updated = await api.post<Tournament>(
        `/tournaments/${tournament.id}/transition`,
        { action, reason },
        idempotencyKey(),
      );
      setTournament(updated);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Transition failed.'));
    } finally {
      setTransitioning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-enter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="spinner-lg" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="page-enter empty-state">
        <div className="empty-state-title">{error || 'Tournament not found'}</div>
        <Link to="/tournaments" className="btn btn-secondary">Back to tournaments</Link>
      </div>
    );
  }

  const availableTransitions = TRANSITIONS[tournament.status] || [];
  const canCancel = ['draft', 'published', 'registration_open', 'registration_closed'].includes(tournament.status);

  return (
    <div className="page-enter">
      <div className="workspace-header">
        <Link to="/tournaments" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} /> Tournaments
        </Link>
      </div>

      <div className="workspace-banner">
        <div className="workspace-banner-info">
          <h1 className="workspace-title">{tournament.title}</h1>
          <div className="workspace-meta">
            <span className="badge badge-mode">{tournament.mode.toUpperCase()}</span>
            <StatusBadge status={tournament.status} />
            <span className="text-muted" style={{ fontSize: '0.8125rem', textTransform: 'capitalize' }}>
              {tournament.fundingType.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        {(availableTransitions.length > 0 || canCancel) && (
          <div className="workspace-actions">
            {availableTransitions.map((transition) => (
              <button
                key={transition.action}
                className="btn btn-primary"
                onClick={() => void handleTransition(transition.action)}
                disabled={transitioning}
              >
                {transitioning ? <Loader2 size={16} className="spinning" /> : <Play size={16} />}
                {transition.label}
              </button>
            ))}
            {canCancel && (
              <button
                className="btn btn-ghost"
                style={{ color: 'var(--error)' }}
                onClick={() => {
                  const reason = prompt('Reason for canceling this tournament?');
                  if (reason?.trim()) void handleTransition('cancel', reason.trim());
                }}
                disabled={transitioning}
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: 'var(--error)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
          {error}
        </p>
      )}

      <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={15} style={{ marginRight: '6px' }} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="workspace-content card">
        {activeTab === 'overview' && (
          <div className="overview-grid">
            <div className="review-item">
              <span className="review-label">Status</span>
              <StatusBadge status={tournament.status} />
            </div>
            <div className="review-item">
              <span className="review-label">Mode</span>
              <span className="review-value">{tournament.mode.toUpperCase()}</span>
            </div>
            <div className="review-item">
              <span className="review-label">Capacity</span>
              <span className="review-value">{tournament.maxUnits || '-'} {tournament.mode === 'solo' ? 'players' : 'teams'}</span>
            </div>
            <div className="review-item">
              <span className="review-label">Funding</span>
              <span className="review-value" style={{ textTransform: 'capitalize' }}>{tournament.fundingType.replace(/_/g, ' ')}</span>
            </div>
            <div className="review-item">
              <span className="review-label">Created</span>
              <span className="review-value">{new Date(tournament.createdAt).toLocaleDateString()}</span>
            </div>
            {tournament.scheduledStartAt && (
              <div className="review-item">
                <span className="review-label">Scheduled Start</span>
                <span className="review-value">{new Date(tournament.scheduledStartAt).toLocaleString()}</span>
              </div>
            )}
            {tournament.description && (
              <div className="review-item" style={{ gridColumn: '1 / -1' }}>
                <span className="review-label">Description</span>
                <span className="review-value" style={{ whiteSpace: 'pre-wrap' }}>{tournament.description}</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'participants' && <EmptyTab icon={Users} title="Participants" desc="Registration data will appear here once registration opens." />}
        {activeTab === 'matches' && <EmptyTab icon={Swords} title="Matches" desc="Match management will be available during the live phase." />}
        {activeTab === 'leaderboard' && <EmptyTab icon={TrophyIcon} title="Leaderboard" desc="Standings will appear after results are submitted." />}
        {activeTab === 'disputes' && <EmptyTab icon={AlertTriangle} title="Disputes" desc="No disputes filed for this tournament." />}
      </div>
    </div>
  );
}

function EmptyTab({ icon: Icon, title, desc }: {
  icon: typeof Users;
  title: string;
  desc: string;
}) {
  return (
    <div className="empty-state" style={{ padding: 'var(--space-12)' }}>
      <Icon size={36} className="empty-state-icon" />
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{desc}</div>
    </div>
  );
}
