import { MAPS } from './constants';
import type { MatchScheduleRow, TournamentForm } from './types';

interface Props {
  form: TournamentForm;
  setForm: (form: TournamentForm) => void;
}

export function RegistrationStep({ form, setForm }: Props) {
  return (
    <div className="create-step">
      <h2>Registration Settings</h2>
      <div className="field-grid">
        <DateField label="Registration opens" value={form.registrationOpenAt} onChange={(value) => setForm({ ...form, registrationOpenAt: value })} />
        <DateField label="Registration closes" value={form.registrationCloseAt} onChange={(value) => setForm({ ...form, registrationCloseAt: value })} />
        <DateField label="Roster lock" value={form.rosterLockAt} onChange={(value) => setForm({ ...form, rosterLockAt: value })} />
      </div>
      <div className="field-grid">
        <Select label="Registration approval" value={form.registrationApproval} onChange={(value) => setForm({ ...form, registrationApproval: value as TournamentForm['registrationApproval'] })} options={[['automatic', 'Automatic'], ['organizer_approval', 'Organizer approval required']]} />
        <NumberField label="Substitutes allowed" value={form.substitutesAllowed} onChange={(value) => setForm({ ...form, substitutesAllowed: value })} />
        <Field label="Region restriction" value={form.regionRestriction} onChange={(value) => setForm({ ...form, regionRestriction: value })} placeholder="Optional" />
        <Field label="Minimum FF level" value={form.minimumAccountLevel} onChange={(value) => setForm({ ...form, minimumAccountLevel: value })} placeholder="Optional" />
      </div>
      <div className="check-grid">
        <Check label="Mobile only" checked={form.mobileOnly} onChange={(checked) => setForm({ ...form, mobileOnly: checked })} />
        <Check label="Roster must be complete before registration" checked={form.rosterCompleteRequired} onChange={(checked) => setForm({ ...form, rosterCompleteRequired: checked })} />
        <Check label="Late registration allowed" checked={form.lateRegistrationAllowed} onChange={(checked) => setForm({ ...form, lateRegistrationAllowed: checked })} />
      </div>
    </div>
  );
}

export function ScheduleStep({ form, setForm }: Props) {
  const updateRow = (index: number, patch: Partial<MatchScheduleRow>) => {
    const matchSchedule = form.matchSchedule.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    );
    setForm({ ...form, matchSchedule });
  };

  return (
    <div className="create-step">
      <h2>Schedule and Maps</h2>
      <div className="field-grid">
        <NumberField label="Check-in duration (minutes)" value={form.checkInDurationMin} onChange={(value) => setForm({ ...form, checkInDurationMin: value })} />
        <Select label="Room-detail release" value={form.roomReleaseMode} onChange={(value) => setForm({ ...form, roomReleaseMode: value as TournamentForm['roomReleaseMode'] })} options={[['manual', 'Manual'], ['scheduled', 'Scheduled']]} />
        <NumberField label="Joining deadline before match (minutes)" value={form.joiningDeadlineMin} onChange={(value) => setForm({ ...form, joiningDeadlineMin: value })} />
      </div>
      <div className="schedule-table">
        <div className="schedule-head">
          <span>Match</span>
          <span>Date and time</span>
          <span>Map</span>
        </div>
        {form.matchSchedule.map((row, index) => (
          <div className="schedule-row" key={`${row.stage}-${row.roomOrder}-${row.matchOrder}`}>
            <strong>{label(row)}</strong>
            <input className="input" type="datetime-local" value={row.scheduledAt} onChange={(e) => updateRow(index, { scheduledAt: e.target.value })} />
            <select className="input select" value={row.map} onChange={(e) => updateRow(index, { map: e.target.value })}>
              {MAPS.map((map) => <option key={map} value={map}>{map}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function label(row: MatchScheduleRow): string {
  if (row.stage === 'final') return `Final M${row.matchOrder}`;
  return `Qualifier R${row.roomOrder} M${row.matchOrder}`;
}

function Field({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="input-group"><label className="input-label">{label}</label><input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></div>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="input-group"><label className="input-label">{label}</label><input className="input" type="number" min="0" value={value} onChange={(e) => onChange(Number(e.target.value))} /></div>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="input-group"><label className="input-label">{label}</label><input className="input" type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <div className="input-group"><label className="input-label">{label}</label><select className="input select" value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="check-row"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
}
