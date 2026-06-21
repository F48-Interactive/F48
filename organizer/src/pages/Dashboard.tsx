import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Plus, Trophy, Users, CheckCircle, Zap } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import './Dashboard.css';

interface TournamentSummary {
  id: string;
  title: string;
  mode: string;
  status: string;
  createdAt: string;
  maxUnits: number | null;
}

export function Dashboard() {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<{ items: TournamentSummary[]; pagination: unknown }>('/tournaments/my?limit=5')
      .then((data) => setTournaments(data.items || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const stats = {
    total: tournaments.length,
    active: tournaments.filter((t) =>
      ['published', 'registration_open', 'registration_closed', 'check_in', 'live'].includes(t.status),
    ).length,
    completed: tournaments.filter((t) => t.status === 'completed').length,
    draft: tournaments.filter((t) => t.status === 'draft').length,
  };

  return (
    <div className="page-enter">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-secondary">Your tournament command center</p>
        </div>
        <Link to="/tournaments/create" className="btn btn-primary">
          <Plus size={16} />
          Create Tournament
        </Link>
      </div>

      {/* Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--primary)' }}>
            <Trophy size={20} />
          </div>
          <div className="stat-card-value">{isLoading ? '-' : stats.total}</div>
          <div className="stat-card-label">Total Tournaments</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--success)' }}>
            <Zap size={20} />
          </div>
          <div className="stat-card-value">{isLoading ? '-' : stats.active}</div>
          <div className="stat-card-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--text-secondary)' }}>
            <CheckCircle size={20} />
          </div>
          <div className="stat-card-value">{isLoading ? '-' : stats.completed}</div>
          <div className="stat-card-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--text-muted)' }}>
            <Users size={20} />
          </div>
          <div className="stat-card-value">{isLoading ? '-' : stats.draft}</div>
          <div className="stat-card-label">Drafts</div>
        </div>
      </div>

      {/* Recent Tournaments */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <h3>Recent Tournaments</h3>
          {tournaments.length > 0 && (
            <Link to="/tournaments" className="btn btn-ghost btn-sm">View all</Link>
          )}
        </div>

        {isLoading ? (
          <div className="dashboard-skeleton">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton skeleton-card" style={{ height: '72px' }} />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-12) var(--space-8)' }}>
            <Trophy size={40} className="empty-state-icon" />
            <div className="empty-state-title">No tournaments yet</div>
            <div className="empty-state-desc">
              Create your first tournament and start hosting Free Fire competitions.
            </div>
            <Link to="/tournaments/create" className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }}>
              <Plus size={16} />
              Create Tournament
            </Link>
          </div>
        ) : (
          <div className="tournament-list">
            {tournaments.map((t) => (
              <Link key={t.id} to={`/tournaments/${t.id}`} className="tournament-row">
                <div className="tournament-row-info">
                  <span className="tournament-row-title">{t.title}</span>
                  <span className="tournament-row-meta">
                    <span className="badge badge-mode">{t.mode}</span>
                    <span className="text-muted">/</span>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                </div>
                <StatusBadge status={t.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
