import {
  MODE_CAPACITY,
  SCORING_LABEL,
  TIEBREAKER_OPTIONS,
} from './constants';
import { defaultPlacement } from './helpers';
import type { ScoringModel, TournamentForm } from './types';

interface Props {
  form: TournamentForm;
  setForm: (form: TournamentForm) => void;
}

export function ScoringStep({ form, setForm }: Props) {
  const slots = MODE_CAPACITY[form.mode];
  const setModel = (scoringModel: ScoringModel) => {
    const pointsPerKill = scoringModel === 'placement_only' ? '0.00' : form.pointsPerKill || '1.00';
    const placementPoints =
      scoringModel === 'kills_only'
        ? Array(slots).fill('0')
        : form.placementPoints.length === slots
          ? form.placementPoints
          : defaultPlacement(form.mode);
    setForm({ ...form, scoringModel, pointsPerKill, placementPoints });
  };

  const updatePoint = (index: number, value: string) => {
    const placementPoints = form.placementPoints.map((point, i) =>
      i === index ? value : point,
    );
    setForm({ ...form, placementPoints });
  };
  const available = TIEBREAKER_OPTIONS.filter(
    (option) => !form.tiebreakers.includes(option.value),
  );
  const moveTieBreaker = (index: number, direction: -1 | 1) => {
    const next = [...form.tiebreakers];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setForm({ ...form, tiebreakers: next });
  };

  return (
    <div className="create-step">
      <h2>Scoring System</h2>
      <div className="option-grid">
        {(['combined', 'placement_only', 'kills_only'] as ScoringModel[]).map((model) => (
          <button key={model} type="button" className={`choice-card ${form.scoringModel === model ? 'choice-selected' : ''}`} onClick={() => setModel(model)}>
            <span className="choice-title">{SCORING_LABEL[model]}</span>
            <span className="choice-desc">{description(model)}</span>
          </button>
        ))}
      </div>
      <div className="field-grid">
        <div className="input-group">
          <label className="input-label">Points per kill</label>
          <input className="input" type="number" min="0" step="0.01" disabled={form.scoringModel === 'placement_only'} value={form.pointsPerKill} onChange={(e) => setForm({ ...form, pointsPerKill: e.target.value })} />
        </div>
      </div>
      <div className="placement-tools">
        <strong>Placement points ({slots} positions)</strong>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...form, placementPoints: defaultPlacement(form.mode) })}>Load balanced preset</button>
      </div>
      <div className="placement-grid">
        {Array.from({ length: slots }, (_, index) => (
          <label key={index} className="placement-cell">
            <span>#{index + 1}</span>
            <input className="input" type="number" min="0" step="0.01" value={form.placementPoints[index] ?? '0'} disabled={form.scoringModel === 'kills_only' || index === slots - 1} onChange={(e) => updatePoint(index, e.target.value)} />
          </label>
        ))}
      </div>
      <div className="subsection">
        <h3>Tie-breakers</h3>
        <p className="text-secondary">Total points rank first. These rules are applied in order when points tie.</p>
      </div>
      <div className="tiebreak-list">
        {form.tiebreakers.map((field, index) => (
          <div className="tiebreak-row" key={field}>
            <span>{index + 1}. {labelFor(field)}</span>
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveTieBreaker(index, -1)}>Up</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveTieBreaker(index, 1)}>Down</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, tiebreakers: form.tiebreakers.filter((item) => item !== field) })}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {available.length > 0 && (
        <select className="input select" value="" onChange={(e) => e.target.value && setForm({ ...form, tiebreakers: [...form.tiebreakers, e.target.value] })}>
          <option value="">Add tie-breaker...</option>
          {available.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      )}
    </div>
  );
}

function description(model: ScoringModel): string {
  if (model === 'kills_only') return 'Kill points minus penalties. Placement rows stay zero.';
  if (model === 'placement_only') return 'Placement points minus penalties. Kill value stays zero.';
  return 'Kill points plus placement points minus penalties.';
}

function labelFor(value: string): string {
  return TIEBREAKER_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
