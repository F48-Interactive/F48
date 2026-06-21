import type { OrganizerYoutubeChannel } from '../../contexts/auth-types';
import { MODE_CAPACITY, MODE_LABEL, TEAM_SIZE } from './constants';
import { roomCount, updateMode } from './helpers';
import type { FundingType, TournamentForm, TournamentMode } from './types';

interface Props {
  form: TournamentForm;
  setForm: (form: TournamentForm) => void;
  organizerChannel?: OrganizerYoutubeChannel;
}

const fundingOptions: Array<{ value: FundingType; label: string; desc: string; disabled?: boolean }> = [
  { value: 'free', label: 'No Prize Pool', desc: 'Free entry community tournament.' },
  { value: 'organizer_funded', label: 'Organizer Funded', desc: 'Organizer provides the prize pool.' },
  { value: 'f48_sponsored', label: 'F48 Sponsored', desc: 'F48 provides the agreed prize pool.' },
  { value: 'entry_fee', label: 'Entry Fee', desc: 'Coming later with wallet support.', disabled: true },
];

export function TypeStep({ form, setForm }: Props) {
  return (
    <div className="create-step">
      <h2>Money</h2>
      <div className="option-grid">
        {fundingOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`choice-card ${form.fundingType === option.value ? 'choice-selected' : ''}`}
            disabled={option.disabled}
            onClick={() => setForm({ ...form, fundingType: option.value, prizePoolRupees: option.value === 'free' ? '' : form.prizePoolRupees })}
          >
            <span className="choice-title">{option.label}</span>
            <span className="choice-desc">{option.desc}</span>
          </button>
        ))}
      </div>
      {form.fundingType !== 'free' && form.fundingType !== 'entry_fee' && (
        <div className="input-group">
          <label className="input-label" htmlFor="prizePool">Total Prize Pool (INR)</label>
          <input id="prizePool" className="input" type="number" min="1" value={form.prizePoolRupees} onChange={(e) => setForm({ ...form, prizePoolRupees: e.target.value })} />
        </div>
      )}
    </div>
  );
}

export function DetailsStep({ form, setForm, organizerChannel }: Props) {
  return (
    <div className="create-step">
      <h2>Tournament Details</h2>
      {organizerChannel && (
        <div className="organizer-strip">
          {organizerChannel.imageUrl && <img src={organizerChannel.imageUrl} alt="" className="avatar avatar-lg" />}
          <div>
            <strong>{organizerChannel.channelName}</strong>
            <p>{organizerChannel.handle || organizerChannel.channelId}</p>
          </div>
        </div>
      )}
      <div className="field-grid">
        <Field label="Tournament name" value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="UZUMAKI Full Map Cup" />
        <Field label="Banner Cloudinary URL" value={form.bannerUrl} onChange={(value) => setForm({ ...form, bannerUrl: value })} placeholder="https://res.cloudinary.com/..." />
      </div>
      <Field label="Short description" value={form.shortDescription} onChange={(value) => setForm({ ...form, shortDescription: value })} placeholder="Shown on tournament cards." />
    </div>
  );
}

export function ModeStep({ form, setForm }: Props) {
  const modes: TournamentMode[] = ['solo', 'duo', 'squad'];
  const cap = MODE_CAPACITY[form.mode];
  return (
    <div className="create-step">
      <h2>Slots and Matches</h2>
      <div className="option-grid">
        {modes.map((mode) => (
          <button key={mode} type="button" className={`choice-card ${form.mode === mode ? 'choice-selected' : ''}`} onClick={() => setForm(updateMode(form, mode))}>
            <span className="choice-title">{mode.toUpperCase()}</span>
            <span className="choice-desc">{slotCopy(mode)} {MODE_CAPACITY[mode]} {MODE_LABEL[mode]} per room.</span>
          </button>
        ))}
      </div>
      <div className="input-group">
        <label className="input-label" htmlFor="capacity">Total slots ({MODE_LABEL[form.mode]})</label>
        <input id="capacity" className="input" type="number" min="2" max={cap * 4} value={form.maxUnits} onChange={(e) => setForm({ ...form, maxUnits: Number(e.target.value) })} />
      </div>
      <div className="input-group">
        <label className="input-label" htmlFor="matches">Number of matches per room</label>
        <input id="matches" className="input" type="number" min="1" max="12" value={form.numberOfMatches} onChange={(e) => setForm({ ...form, numberOfMatches: Number(e.target.value) })} />
      </div>
      <div className="info-grid">
        <Info label="Slot booking" value={slotBookingInfo(form.mode)} />
        <Info label="Room capacity" value={`${cap} ${MODE_LABEL[form.mode]}`} />
        <Info label="Calculated rooms" value={`${roomCount(form)} room${roomCount(form) === 1 ? '' : 's'}`} />
        <Info label="Total matches" value={`${roomCount(form) * form.numberOfMatches}`} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="input-group"><label className="input-label">{label}</label><input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="review-item"><span className="review-label">{label}</span><span className="review-value">{value}</span></div>;
}

function slotCopy(mode: TournamentMode): string {
  if (mode === 'solo') return 'Each player books one slot.';
  return `Team leader books one ${TEAM_SIZE[mode]}-player team slot.`;
}

function slotBookingInfo(mode: TournamentMode): string {
  if (mode === 'solo') return 'Each player books their own slot';
  return `Only the team leader books for all ${TEAM_SIZE[mode]} players`;
}
