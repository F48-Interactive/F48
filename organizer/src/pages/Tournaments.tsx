import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Plus, Trophy, Search } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import './Tournaments.css';

interface Tournament {
  id: string;
  title: string;
  mode: string;
  status: string;
  fundingType: string;
  createdAt: string;
  maxUnits: number | null;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

const ACTIVE_STATUSES = ['published', 'registration_open', 'registration_closed', 'check_in', 'live', 'provisional_results', 'dispute_window', 'results_final'];

export function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<{ items: Tournament[]; pagination: unknown }>('/tournaments/my?limit=100')
      .then((data) => setTournaments(data.items || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = tournaments.filter((t) => {
    if (filter === 'draft') return t.status === 'draft';
    if (filter === 'active') return ACTIVE_STATUSES.includes(t.status);
    if (filter === 'completed') return ['completed', 'canceled', 'voided', 'archived'].includes(t.status);
    return true;
  }).filter((t) =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="page-enter">
      <div className="tournaments-header">
        <div>
          <h1>Tournaments</h1>
          <p className="text-secondary">Manage your competitions</p>
        </div>
        <Link to="/tournaments/create" className="btn btn-primary">
          <Plus size={16} />
          Create Tournament
        </Link>
      </div>

      {/* Filters + Search */}
      <div className="tournaments-toolbar">
        <div className="tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`tab ${filter === f.key ? 'tab-active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="tournaments-search">
          <Search size={16} className="tournaments-search-icon" />
          <input
            className="input"
            placeholder="Search tournaments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="tournaments-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton skeleton-card" style={{ height: '160px' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Trophy size={40} className="empty-state-icon" />
          <div className="empty-state-title">
            {search ? 'No matches found' : 'No tournaments'}
          </div>
          <div className="empty-state-desc">
            {search
              ? 'Try a different search term.'
              : 'Create your first tournament to get started.'}
          </div>
          {!search && (
            <Link to="/tournaments/create" className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }}>
              <Plus size={16} /> Create Tournament
            </Link>
          )}
        </div>
      ) : (
        <div className="tournaments-grid">
          {filtered.map((t) => (
            <Link key={t.id} to={`/tournaments/${t.id}`} className="tournament-card card">
              <div className="tournament-card-top">
                <span className="badge badge-mode">{t.mode.toUpperCase()}</span>
                <StatusBadge status={t.status} />
              </div>
              <h3 className="tournament-card-title">{t.title}</h3>
              <div className="tournament-card-meta">
                <span className="text-muted" style={{ fontSize: '0.8125rem' }}>
                  {new Date(t.createdAt).toLocaleDateString()}
                </span>
                <span className="text-muted" style={{ fontSize: '0.8125rem', textTransform: 'capitalize' }}>
                  {t.fundingType.replace(/_/g, ' ')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
