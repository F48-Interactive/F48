import type { OrganizerYoutubeChannel } from '../../contexts/auth-types';
import { MODE_CAPACITY, MODE_LABEL, SCORING_LABEL, TIEBREAKER_OPTIONS } from './constants';
import { roomCount, rupeesToPaise } from './helpers';
import type { PrizeRow, SpecialPrizeRow, TournamentForm } from './types';

interface Props {
  form: TournamentForm;
  setForm: (form: TournamentForm) => void;
  organizerChannel?: OrganizerYoutubeChannel;
}

export function PrizeStep({ form, setForm }: Props) {
  const pool = rupeesToPaise(form.prizePoolRupees);
  const total = form.prizeRows.reduce(
    (sum, row) => sum + rupeesToPaise(row.amountRupees),
    0,
  );
  const updatePrize = (index: number, patch: Partial<PrizeRow>) => {
    setForm({ ...form, prizeRows: form.prizeRows.map((row, i) => i === index ? { ...row, ...patch } : row) });
  };
  const updateSpecial = (index: number, patch: Partial<SpecialPrizeRow>) => {
    setForm({ ...form, specialPrizes: form.specialPrizes.map((row, i) => i === index ? { ...row, ...patch } : row) });
  };

  if (form.fundingType === 'free') {
    return <div className="create-step"><h2>Prize Distribution</h2><p className="text-secondary">No prize pool selected. This step is skipped for publishing.</p></div>;
  }

  return (
    <div className="create-step">
      <h2>Prize Distribution</h2>
      <div className="info-grid">
        <Info label="Prize pool" value={`INR ${Number(form.prizePoolRupees || 0).toLocaleString()}`} />
        <Info label="Allocated" value={`INR ${(total / 100).toLocaleString()}`} />
      </div>
      <div className="table-like">
        {form.prizeRows.map((row, index) => (
          <div className="prize-row" key={index}>
            <input className="input" type="number" min="1" max={MODE_CAPACITY[form.mode]} value={row.rank} onChange={(e) => updatePrize(index, { rank: Number(e.target.value) })} />
            <input className="input" type="number" min="1" value={row.amountRupees} onChange={(e) => updatePrize(index, { amountRupees: e.target.value })} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, prizeRows: form.prizeRows.filter((_, i) => i !== index) })}>Remove</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-secondary" onClick={() => setForm({ ...form, prizeRows: [...form.prizeRows, { rank: form.prizeRows.length + 1, amountRupees: '' }] })}>Add leaderboard prize</button>
      <div className="subsection">
        <h3>Special prizes</h3>
        <p className="text-secondary">Saved as tournament rules metadata. Leaderboard prize rows must still cover the official backend prize pool for this release.</p>
        {form.specialPrizes.map((row, index) => (
          <div className="special-row" key={index}>
            <input className="input" placeholder="Prize name" value={row.name} onChange={(e) => updateSpecial(index, { name: e.target.value })} />
            <input className="input" placeholder="Calculation type" value={row.calculationType} onChange={(e) => updateSpecial(index, { calculationType: e.target.value })} />
            <input className="input" type="number" placeholder="Amount INR" value={row.amountRupees} onChange={(e) => updateSpecial(index, { amountRupees: e.target.value })} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, specialPrizes: form.specialPrizes.filter((_, i) => i !== index) })}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => setForm({ ...form, specialPrizes: [...form.specialPrizes, { name: '', calculationType: 'highest_kill_player', amountRupees: '', tieBreaker: 'total_kills' }] })}>Add special prize</button>
      </div>
      {pool !== total && <p className="form-error">Official leaderboard prize rows must equal the total prize pool before publishing.</p>}
    </div>
  );
}

export function RulesStep({ form, setForm }: Props) {
  return (
    <div className="create-step">
      <h2>Rules, Penalties, and Disputes</h2>
      <CoreRules />
      <TextArea label="Organizer rules" value={form.rulesText} onChange={(value) => setForm({ ...form, rulesText: value })} />
      <TextArea label="Penalty options" value={form.penaltyRules} onChange={(value) => setForm({ ...form, penaltyRules: value })} />
      <div className="field-grid">
        <NumberField label="Dispute window (hours)" value={form.disputeWindowHours} onChange={(value) => setForm({ ...form, disputeWindowHours: value })} />
        <TextArea label="Evidence requirements" value={form.evidenceRequirements} onChange={(value) => setForm({ ...form, evidenceRequirements: value })} />
      </div>
      <label className="check-row"><input type="checkbox" checked={form.resultsAutoFinalize} onChange={(e) => setForm({ ...form, resultsAutoFinalize: e.target.checked })} /> Results become final automatically after dispute window</label>
    </div>
  );
}

export function PreviewStep({ form, organizerChannel }: Props) {
  const pool = rupeesToPaise(form.prizePoolRupees);
  return (
    <div className="create-step">
      <h2>Preview and Publish</h2>
      <div className="preview-panel">
        {form.bannerUrl && <img src={form.bannerUrl} alt="" className="preview-banner" />}
        <div className="preview-main">
          <h3>{form.title || 'Untitled tournament'}</h3>
          <p>{form.shortDescription || form.fullDescription || 'No description yet.'}</p>
          {organizerChannel && <span className="badge badge-mode">By {organizerChannel.channelName}</span>}
        </div>
      </div>
      <div className="review-grid">
        <Info label="Mode" value={`${form.mode.toUpperCase()} / ${form.maxUnits} ${MODE_LABEL[form.mode]}`} />
        <Info label="Rooms" value={`${roomCount(form)}`} />
        <Info label="Structure" value={form.structureType.replace(/_/g, ' ')} />
        <Info label="Scoring" value={SCORING_LABEL[form.scoringModel]} />
        <Info label="Kill value" value={form.pointsPerKill} />
        <Info label="Prize pool" value={pool > 0 ? `INR ${(pool / 100).toLocaleString()}` : 'No prize'} />
        <Info label="Registration" value={`${date(form.registrationOpenAt)} to ${date(form.registrationCloseAt)}`} />
        <Info label="Tie-breakers" value={form.tiebreakers.map(labelFor).join(', ')} />
      </div>
    </div>
  );
}

function CoreRules() {
  return (
    <div className="core-rules">
      {['Fake accounts', 'Duplicate Free Fire UID', 'Unregistered players', 'Cheating', 'Collusion', 'Teaming', 'Abusive behaviour', 'Evidence manipulation'].map((rule) => (
        <span key={rule} className="badge badge-muted">{rule}</span>
      ))}
    </div>
  );
}

function date(value: string): string {
  return value ? new Date(value).toLocaleString() : 'not set';
}

function labelFor(value: string): string {
  return TIEBREAKER_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="review-item"><span className="review-label">{label}</span><span className="review-value">{value}</span></div>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="input-group"><label className="input-label">{label}</label><input className="input" type="number" min="1" value={value} onChange={(e) => onChange(Number(e.target.value))} /></div>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="input-group"><label className="input-label">{label}</label><textarea className="input textarea" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
