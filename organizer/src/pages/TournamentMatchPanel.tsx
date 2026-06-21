import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, getErrorMessage, idempotencyKey } from '../lib/api';
import { TournamentResultEditor } from './TournamentResultEditor';
import type {
  CredentialInput,
  Registration,
  RegistrationPage,
  ResultInput,
  TournamentMatch,
} from './tournament-match.types';

interface Props {
  tournamentId: string;
}

const EMPTY_CREDENTIALS: CredentialInput = {
  roomId: '',
  roomPass: '',
  customCode: '',
};

export function TournamentMatchPanel({ tournamentId }: Props) {
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [credentials, setCredentials] = useState<
    Record<string, CredentialInput>
  >({});
  const [results, setResults] = useState<
    Record<string, Record<string, ResultInput>>
  >({});
  const [activeResultMatchId, setActiveResultMatchId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkedIn = registrations.filter(
    (registration) => registration.status === 'checked_in',
  );

  const load = useCallback(async () => {
    try {
      const [matchRows, registrationPage] = await Promise.all([
        api.get<TournamentMatch[]>(`/matches/tournament/${tournamentId}`),
        api.get<RegistrationPage>(
          `/registrations/tournament/${tournamentId}?page=1&limit=100`,
        ),
      ]);
      setError(null);
      setMatches(matchRows);
      setRegistrations(registrationPage.items);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load match cycle.'));
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const run = async (matchId: string, action: () => Promise<void>) => {
    setBusyId(matchId);
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Match action failed.'));
    } finally {
      setBusyId(null);
    }
  };

  const setCredential = (
    matchId: string,
    patch: Partial<CredentialInput>,
  ) => {
    setCredentials((current) => ({
      ...current,
      [matchId]: {
        ...EMPTY_CREDENTIALS,
        ...current[matchId],
        ...patch,
      },
    }));
  };

  const releaseCredentials = async (match: TournamentMatch) => {
    const input = credentials[match.id];
    if (!input?.roomId.trim() || !input.roomPass.trim()) {
      setError('Room ID and password are required before release.');
      return;
    }

    await run(match.id, async () => {
      await api.post(
        `/matches/${match.id}/room-credentials`,
        {
          roomId: input.roomId.trim(),
          roomPass: input.roomPass.trim(),
          customCode: input.customCode.trim() || undefined,
        },
        idempotencyKey(),
      );
      await load();
    });
  };

  const transitionMatch = async (match: TournamentMatch, status: string) => {
    await run(match.id, async () => {
      await api.post(
        `/matches/${match.id}/transition`,
        { status },
        idempotencyKey(),
      );
      await load();
    });
  };

  const setResult = (
    matchId: string,
    registrationId: string,
    patch: Partial<ResultInput>,
  ) => {
    setResults((current) => ({
      ...current,
      [matchId]: {
        ...current[matchId],
        [registrationId]: mergeResultInput(
          current[matchId]?.[registrationId],
          patch,
        ),
      },
    }));
  };

  const submitResult = async (match: TournamentMatch) => {
    const rows = checkedIn.map((registration) => {
      const row = results[match.id]?.[registration.id];
      return {
        registrationId: registration.id,
        placement: Number(row?.placement || 0),
        kills: Number(row?.kills || 0),
      };
    });

    const placements = new Set(rows.map((row) => row.placement));
    const hasInvalidRow = rows.some(
      (row) =>
        !Number.isInteger(row.placement) ||
        !Number.isInteger(row.kills) ||
        row.placement < 1 ||
        row.placement > match.room.maxUnits ||
        row.kills < 0,
    );

    if (checkedIn.length === 0) {
      setError('No checked-in bookings are available for scoring.');
      return;
    }
    if (hasInvalidRow || placements.size !== rows.length) {
      setError('Each checked-in booking needs a unique placement and valid kills.');
      return;
    }

    await run(match.id, async () => {
      await api.post(
        `/matches/${match.id}/result`,
        { playerResults: rows },
        idempotencyKey(),
      );
      setActiveResultMatchId(null);
      await load();
    });
  };

  if (isLoading) {
    return (
      <div className="empty-state">
        <div className="spinner-lg" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No matches created</div>
        <div className="empty-state-desc">
          Matches are created from the tournament match count.
        </div>
      </div>
    );
  }

  return (
    <div className="match-cycle">
      {error && <p className="form-error">{error}</p>}
      <div className="match-cycle-summary">
        <span>{matches.length} matches</span>
        <span>{checkedIn.length} checked-in bookings available for scoring</span>
      </div>

      {matches.map((match) => (
        <div className="match-card" key={match.id}>
          <div className="match-card-head">
            <div>
              <strong>Match {match.matchNumber}</strong>
              <p>
                {match.room.name} - {match.room.maxUnits} slots
              </p>
            </div>
            <span className="badge badge-muted">{label(match.status)}</span>
          </div>

          {canReleaseCredentials(match.status) && (
            <CredentialForm
              match={match}
              value={credentials[match.id] ?? EMPTY_CREDENTIALS}
              busy={busyId === match.id}
              onChange={(patch) => setCredential(match.id, patch)}
              onSubmit={() => void releaseCredentials(match)}
            />
          )}

          <div className="match-actions">
            {match.status === 'room_released' && (
              <button
                className="btn btn-primary"
                onClick={() => void transitionMatch(match, 'live')}
                disabled={busyId === match.id}
              >
                Start Match
              </button>
            )}
            {match.status === 'live' && (
              <button
                className="btn btn-primary"
                onClick={() => void transitionMatch(match, 'awaiting_result')}
                disabled={busyId === match.id}
              >
                End Match
              </button>
            )}
            {['awaiting_result', 'result_submitted'].includes(match.status) && (
              <button
                className="btn btn-secondary"
                onClick={() => toggleResultEditor(match.id)}
              >
                {activeResultMatchId === match.id ? 'Hide Points' : 'Enter Points'}
              </button>
            )}
          </div>

          {activeResultMatchId === match.id && (
            <TournamentResultEditor
              match={match}
              registrations={checkedIn}
              results={results[match.id] ?? {}}
              busy={busyId === match.id}
              onChange={(registrationId, patch) =>
                setResult(match.id, registrationId, patch)
              }
              onSubmit={() => void submitResult(match)}
            />
          )}
        </div>
      ))}
    </div>
  );

  function toggleResultEditor(matchId: string) {
    setActiveResultMatchId(activeResultMatchId === matchId ? null : matchId);
  }
}

function CredentialForm({
  match,
  value,
  busy,
  onChange,
  onSubmit,
}: {
  match: TournamentMatch;
  value: CredentialInput;
  busy: boolean;
  onChange: (patch: Partial<CredentialInput>) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="match-credentials">
      <input
        className="input"
        placeholder="Room ID"
        value={value.roomId}
        onChange={(event) => onChange({ roomId: event.target.value })}
      />
      <input
        className="input"
        placeholder="Room password"
        value={value.roomPass}
        onChange={(event) => onChange({ roomPass: event.target.value })}
      />
      <input
        className="input"
        placeholder="Custom code optional"
        value={value.customCode}
        onChange={(event) => onChange({ customCode: event.target.value })}
      />
      <button className="btn btn-secondary" onClick={onSubmit} disabled={busy}>
        {busy ? <Loader2 size={16} className="spinning" /> : null}
        {match.status === 'room_released' ? 'Update Room Pass' : 'Release Room Pass'}
      </button>
    </div>
  );
}

function canReleaseCredentials(status: string): boolean {
  return ['scheduled', 'check_in', 'room_released'].includes(status);
}

function label(status: string): string {
  return status.replace(/_/g, ' ');
}

function mergeResultInput(
  current: ResultInput | undefined,
  patch: Partial<ResultInput>,
): ResultInput {
  return {
    ...(current ?? { placement: '', kills: '0' }),
    ...patch,
  };
}
