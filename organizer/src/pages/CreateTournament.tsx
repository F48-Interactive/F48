import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getErrorMessage, idempotencyKey } from '../lib/api';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import './CreateTournament.css';

type TournamentMode = 'solo' | 'duo' | 'squad';
type FundingType = 'free' | 'organizer_funded' | 'f48_sponsored' | 'entry_fee';
type StructureType = 'direct_final' | 'qualifiers_to_final';
type ScoringModel = 'combined' | 'placement_only' | 'kills_only';

interface FormData {
  title: string;
  description: string;
  mode: TournamentMode;
  maxUnits: number;
  fundingType: FundingType;
  prizePoolRupees: string;
  structureType: StructureType;
  scoringModel: ScoringModel;
  scheduledStartAt: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
}

interface ScoringConfig {
  id: string;
}

const STEPS = ['Details', 'Mode', 'Funding', 'Schedule', 'Review'];
const MAX_UNITS_MAP: Record<TournamentMode, number> = { solo: 48, duo: 24, squad: 12 };
const FUNDED_TYPES: FundingType[] = ['organizer_funded', 'f48_sponsored'];

const DEFAULT: FormData = {
  title: '',
  description: '',
  mode: 'solo',
  maxUnits: 48,
  fundingType: 'free',
  prizePoolRupees: '',
  structureType: 'direct_final',
  scoringModel: 'combined',
  scheduledStartAt: '',
  registrationOpenAt: '',
  registrationCloseAt: '',
};

const MODES = [
  { value: 'solo' as const, label: 'Solo', desc: '48 players, 1 per slot' },
  { value: 'duo' as const, label: 'Duo', desc: '24 teams x 2 players' },
  { value: 'squad' as const, label: 'Squad', desc: '12 teams x 4 players' },
];

const FUNDING_TYPES = [
  { value: 'free' as const, label: 'Free Entry', desc: 'No entry fee, no prize pool' },
  { value: 'organizer_funded' as const, label: 'Organizer Funded', desc: 'You fund the prize pool' },
  { value: 'f48_sponsored' as const, label: 'F48 Sponsored', desc: 'F48 sponsors the prize pool' },
  { value: 'entry_fee' as const, label: 'Entry Fee', desc: 'Coming soon - requires wallet support', disabled: true },
];

function loadDraft(): FormData {
  const saved = localStorage.getItem('f48_draft_tournament');
  if (!saved) return DEFAULT;

  try {
    return { ...DEFAULT, ...JSON.parse(saved) };
  } catch {
    localStorage.removeItem('f48_draft_tournament');
    return DEFAULT;
  }
}

function toIsoOrUndefined(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

function toPrizePoolPaise(value: string): number {
  const rupees = Number(value);
  if (!Number.isFinite(rupees) || rupees <= 0) return 0;
  return Math.round(rupees * 100);
}

function requiresPrizePool(fundingType: FundingType): boolean {
  return FUNDED_TYPES.includes(fundingType);
}

function getScheduleError(form: FormData): string | null {
  const open = form.registrationOpenAt ? new Date(form.registrationOpenAt).getTime() : null;
  const close = form.registrationCloseAt ? new Date(form.registrationCloseAt).getTime() : null;
  const start = form.scheduledStartAt ? new Date(form.scheduledStartAt).getTime() : null;

  if (open && close && open >= close) {
    return 'Registration close time must be after registration open time.';
  }
  if (close && start && close >= start) {
    return 'Tournament start time must be after registration close time.';
  }
  return null;
}

function defaultPlacementPoints(maxUnits: number) {
  return Array.from({ length: maxUnits }, (_, index) => ({
    position: index + 1,
    points: (maxUnits - index - 1).toFixed(2),
  }));
}

export function CreateTournament() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(loadDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prizePoolPaise = toPrizePoolPaise(form.prizePoolRupees);
  const scheduleError = getScheduleError(form);

  const update = (patch: Partial<FormData>) => {
    const next = { ...form, ...patch };
    if (patch.mode) {
      next.maxUnits = MAX_UNITS_MAP[patch.mode];
    }
    if (patch.fundingType === 'free') {
      next.prizePoolRupees = '';
    }
    setForm(next);
    localStorage.setItem('f48_draft_tournament', JSON.stringify(next));
  };

  const canProceed = (): boolean => {
    if (step === 0) return form.title.trim().length >= 3;
    if (step === 1) return !!form.mode && form.maxUnits === MAX_UNITS_MAP[form.mode];
    if (step === 2) return !requiresPrizePool(form.fundingType) || prizePoolPaise > 0;
    if (step === 3) return !scheduleError;
    return true;
  };

  const handleCreateDraft = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const tournament = await api.post<{ id: string }>('/tournaments', {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        mode: form.mode,
        fundingType: form.fundingType,
        structureType: form.structureType,
        scoringModel: form.scoringModel,
        maxUnits: form.maxUnits,
        prizePoolPaise: prizePoolPaise || undefined,
        scheduledStartAt: toIsoOrUndefined(form.scheduledStartAt),
        registrationOpenAt: toIsoOrUndefined(form.registrationOpenAt),
        registrationCloseAt: toIsoOrUndefined(form.registrationCloseAt),
      }, idempotencyKey());

      const config = await api.post<ScoringConfig>(
        `/tournaments/${tournament.id}/scoring-config`,
        {
          scoringModel: form.scoringModel,
          killMultiplier: form.scoringModel === 'placement_only' ? '0.00' : '1.00',
          placementPoints: defaultPlacementPoints(form.maxUnits),
        },
        idempotencyKey(),
      );

      if (prizePoolPaise > 0) {
        await api.post(
          `/tournaments/${tournament.id}/config/${config.id}/prizes`,
          { rules: [{ rankStart: 1, rankEnd: 1, amountPaise: prizePoolPaise }] },
          idempotencyKey(),
        );
      }

      localStorage.removeItem('f48_draft_tournament');
      navigate(`/tournaments/${tournament.id}`, { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create tournament.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-enter">
      <div className="create-header">
        <button className="btn btn-ghost" onClick={() => navigate('/tournaments')}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>Create Tournament</h1>
      </div>

      <div className="steps">
        {STEPS.map((label, index) => (
          <div key={label} className={`step ${index === step ? 'step-active' : ''} ${index < step ? 'step-done' : ''}`}>
            <div className="step-number">
              {index < step ? <Check size={14} /> : index + 1}
            </div>
            <span className="step-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="create-content card">
        {step === 0 && (
          <div className="create-step">
            <h2>Tournament Details</h2>
            <p className="text-secondary">Give your tournament a clear name and optional details.</p>
            <div className="create-fields">
              <div className="input-group">
                <label className="input-label" htmlFor="title">Tournament Title *</label>
                <input id="title" className="input" placeholder="e.g. Weekly Showdown #5" value={form.title} onChange={(event) => update({ title: event.target.value })} autoFocus />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="desc">Description</label>
                <textarea id="desc" className="input textarea" placeholder="Rules, details, or announcements..." value={form.description} onChange={(event) => update({ description: event.target.value })} />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="create-step">
            <h2>Mode & Capacity</h2>
            <p className="text-secondary">Capacity is locked to the backend-approved Free Fire format.</p>
            <div className="mode-grid">
              {MODES.map((mode) => (
                <button key={mode.value} className={`mode-option ${form.mode === mode.value ? 'mode-selected' : ''}`} onClick={() => update({ mode: mode.value })}>
                  <span className="mode-option-label">{mode.label}</span>
                  <span className="mode-option-desc">{mode.desc}</span>
                </button>
              ))}
            </div>
            <div className="review-item" style={{ marginTop: 'var(--space-4)' }}>
              <span className="review-label">Backend capacity</span>
              <span className="review-value">{form.maxUnits} {form.mode === 'solo' ? 'players' : 'teams'}</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="create-step">
            <h2>Funding Type</h2>
            <p className="text-secondary">Entry-fee tournaments stay disabled until wallet support is ready.</p>
            <div className="mode-grid">
              {FUNDING_TYPES.map((funding) => (
                <button key={funding.value} className={`mode-option ${form.fundingType === funding.value ? 'mode-selected' : ''} ${funding.disabled ? 'mode-disabled' : ''}`} onClick={() => !funding.disabled && update({ fundingType: funding.value })} disabled={funding.disabled}>
                  <span className="mode-option-label">{funding.label}</span>
                  <span className="mode-option-desc">{funding.desc}</span>
                </button>
              ))}
            </div>
            {requiresPrizePool(form.fundingType) && (
              <div className="input-group" style={{ marginTop: 'var(--space-5)' }}>
                <label className="input-label" htmlFor="prizePool">Prize Pool (INR) *</label>
                <input id="prizePool" className="input" type="number" min="1" step="1" placeholder="5000" value={form.prizePoolRupees} onChange={(event) => update({ prizePoolRupees: event.target.value })} />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="create-step">
            <h2>Schedule</h2>
            <p className="text-secondary">Dates are optional, but their order must be valid.</p>
            <div className="create-fields">
              <div className="input-group">
                <label className="input-label">Tournament Start</label>
                <input className="input" type="datetime-local" value={form.scheduledStartAt} onChange={(event) => update({ scheduledStartAt: event.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Registration Opens</label>
                <input className="input" type="datetime-local" value={form.registrationOpenAt} onChange={(event) => update({ registrationOpenAt: event.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Registration Closes</label>
                <input className="input" type="datetime-local" value={form.registrationCloseAt} onChange={(event) => update({ registrationCloseAt: event.target.value })} />
              </div>
            </div>
            {scheduleError && <p style={{ color: 'var(--error)', fontSize: '0.875rem' }}>{scheduleError}</p>}
          </div>
        )}

        {step === 4 && (
          <div className="create-step">
            <h2>Review</h2>
            <p className="text-secondary">This creates a draft with default combined scoring configured.</p>
            <div className="review-grid">
              <div className="review-item">
                <span className="review-label">Title</span>
                <span className="review-value">{form.title}</span>
              </div>
              <div className="review-item">
                <span className="review-label">Mode</span>
                <span className="review-value">{form.mode.toUpperCase()}</span>
              </div>
              <div className="review-item">
                <span className="review-label">Capacity</span>
                <span className="review-value">{form.maxUnits} {form.mode === 'solo' ? 'players' : 'teams'}</span>
              </div>
              <div className="review-item">
                <span className="review-label">Funding</span>
                <span className="review-value" style={{ textTransform: 'capitalize' }}>{form.fundingType.replace(/_/g, ' ')}</span>
              </div>
              {prizePoolPaise > 0 && (
                <div className="review-item">
                  <span className="review-label">Prize Pool</span>
                  <span className="review-value">INR {Number(form.prizePoolRupees).toLocaleString()}</span>
                </div>
              )}
              {form.scheduledStartAt && (
                <div className="review-item">
                  <span className="review-label">Start</span>
                  <span className="review-value">{new Date(form.scheduledStartAt).toLocaleString()}</span>
                </div>
              )}
            </div>
            {error && <p style={{ color: 'var(--error)', fontSize: '0.875rem', marginTop: 'var(--space-3)' }}>{error}</p>}
          </div>
        )}
      </div>

      <div className="create-nav">
        <button className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>
          <ArrowLeft size={16} /> Previous
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleCreateDraft} disabled={isSubmitting || !canProceed()}>
            {isSubmitting ? <Loader2 size={16} className="spinning" /> : null}
            {isSubmitting ? 'Creating...' : 'Create Draft'}
          </button>
        )}
      </div>
    </div>
  );
}
