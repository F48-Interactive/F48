import type {
  Registration,
  ResultInput,
  TournamentMatch,
} from './tournament-match.types';

interface Props {
  match: TournamentMatch;
  registrations: Registration[];
  results: Record<string, ResultInput>;
  busy: boolean;
  onChange: (registrationId: string, patch: Partial<ResultInput>) => void;
  onSubmit: () => void;
}

export function TournamentResultEditor({
  match,
  registrations,
  results,
  busy,
  onChange,
  onSubmit,
}: Props) {
  return (
    <div className="result-table">
      <div className="result-head">
        <span>Booking</span>
        <span>Placement</span>
        <span>Kills</span>
      </div>
      {registrations.map((registration) => (
        <div className="result-row" key={registration.id}>
          <span>{bookingLabel(registration)}</span>
          <input
            className="input"
            type="number"
            min="1"
            max={match.room.maxUnits}
            value={results[registration.id]?.placement ?? ''}
            onChange={(event) =>
              onChange(registration.id, { placement: event.target.value })
            }
          />
          <input
            className="input"
            type="number"
            min="0"
            value={results[registration.id]?.kills ?? '0'}
            onChange={(event) =>
              onChange(registration.id, { kills: event.target.value })
            }
          />
        </div>
      ))}
      <button
        className="btn btn-primary"
        onClick={onSubmit}
        disabled={busy || registrations.length === 0}
      >
        Submit Points
      </button>
    </div>
  );
}

function bookingLabel(registration: Registration): string {
  return registration.teamName || `Slot ${registration.slotNumber ?? '-'}`;
}
