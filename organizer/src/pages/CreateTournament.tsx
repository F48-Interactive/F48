import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { api, getErrorMessage, idempotencyKey } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { STEPS } from './create-tournament/constants';
import {
  DetailsStep,
  ModeStep,
  StructureStep,
  TypeStep,
} from './create-tournament/BasicsSteps';
import {
  RegistrationStep,
  ScheduleStep,
} from './create-tournament/OperationsSteps';
import { ScoringStep, TiebreakStep } from './create-tournament/ScoringSteps';
import {
  PreviewStep,
  PrizeStep,
  RulesStep,
} from './create-tournament/PrizeRulesSteps';
import {
  defaultForm,
  leaderboardPrizeRules,
  metadata,
  placementPayload,
  roomCount,
  rupeesToPaise,
  toIso,
} from './create-tournament/helpers';
import type { TournamentForm } from './create-tournament/types';
import './CreateTournament.css';

const DRAFT_KEY = 'f48_full_tournament_draft';

interface CreatedTournament {
  id: string;
}

interface ScoringConfig {
  id: string;
}

interface MediaAsset {
  id: string;
}

function loadDraft(): TournamentForm {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (!saved) return defaultForm();
  try {
    return { ...defaultForm(), ...JSON.parse(saved) };
  } catch {
    localStorage.removeItem(DRAFT_KEY);
    return defaultForm();
  }
}

export function CreateTournament() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const organizerChannel = user?.organizer?.youtubeChannels?.[0];
  const [step, setStep] = useState(0);
  const [form, setFormState] = useState<TournamentForm>(loadDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setForm = (next: TournamentForm) => {
    setFormState(next);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form]);

  const errors = validate(form, true);
  const canContinue = validateStep(form, step).length === 0;

  const submit = async (publish: boolean) => {
    const validation = validate(form, publish);
    if (validation.length > 0) {
      setError(validation[0] ?? 'Please complete required fields.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const tournament = await api.post<CreatedTournament>(
        '/tournaments',
        tournamentPayload(form),
        idempotencyKey(),
      );

      if (form.bannerUrl.trim()) {
        const asset = await api.post<MediaAsset>('/media/register', {
          purpose: 'tournament_banner',
          url: form.bannerUrl.trim(),
        });
        await api.patch(`/tournaments/${tournament.id}`, { bannerAssetId: asset.id });
      }

      const config = await api.post<ScoringConfig>(
        `/tournaments/${tournament.id}/scoring-config`,
        scoringPayload(form),
        idempotencyKey(),
      );

      await api.post(
        `/tournaments/${tournament.id}/config/${config.id}/tiebreaks`,
        {
          rules: form.tiebreakers.map((field, index) => ({
            priority: index + 1,
            field,
          })),
        },
        idempotencyKey(),
      );

      if (form.fundingType !== 'free') {
        await api.post(
          `/tournaments/${tournament.id}/config/${config.id}/prizes`,
          { rules: leaderboardPrizeRules(form) },
          idempotencyKey(),
        );
      }

      if (publish) {
        await api.post(
          `/tournaments/${tournament.id}/transition`,
          { action: 'publish' },
          idempotencyKey(),
        );
      }

      localStorage.removeItem(DRAFT_KEY);
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
        <div>
          <h1>Create Tournament</h1>
          <p className="text-secondary">Build the full player-facing tournament contract.</p>
        </div>
      </div>

      <div className="steps create-steps">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`step ${index === step ? 'step-active' : ''} ${index < step ? 'step-done' : ''}`}
            onClick={() => setStep(index)}
          >
            <span className="step-number">{index < step ? <Check size={14} /> : index + 1}</span>
            <span className="step-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="create-content card">{renderStep(step, form, setForm, organizerChannel)}</div>

      {error && <p className="form-error">{error}</p>}

      <div className="create-nav">
        <button className="btn btn-ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <ArrowLeft size={16} /> Previous
        </button>
        <div className="create-actions">
          <button className="btn btn-secondary" onClick={() => void submit(false)} disabled={isSubmitting}>
            Save Draft
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)} disabled={!canContinue}>
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => void submit(true)} disabled={isSubmitting || errors.length > 0}>
              {isSubmitting ? <Loader2 size={16} className="spinning" /> : null}
              Publish Tournament
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function renderStep(
  step: number,
  form: TournamentForm,
  setForm: (form: TournamentForm) => void,
  organizerChannel: Parameters<typeof DetailsStep>[0]['organizerChannel'],
) {
  const props = { form, setForm, organizerChannel };
  if (step === 0) return <TypeStep {...props} />;
  if (step === 1) return <DetailsStep {...props} />;
  if (step === 2) return <ModeStep {...props} />;
  if (step === 3) return <StructureStep {...props} />;
  if (step === 4) return <RegistrationStep {...props} />;
  if (step === 5) return <ScheduleStep {...props} />;
  if (step === 6) return <ScoringStep {...props} />;
  if (step === 7) return <TiebreakStep {...props} />;
  if (step === 8) return <PrizeStep {...props} />;
  if (step === 9) return <RulesStep {...props} />;
  return <PreviewStep {...props} />;
}

function tournamentPayload(form: TournamentForm) {
  const firstMatch = form.matchSchedule.find((row) => row.scheduledAt);
  return {
    title: form.title.trim(),
    description: [form.shortDescription, form.fullDescription].filter(Boolean).join('\n\n'),
    mode: form.mode,
    fundingType: form.fundingType,
    structureType: 'direct_final',
    scoringModel: form.scoringModel,
    maxUnits: form.maxUnits,
    prizePoolPaise: form.fundingType === 'free' ? undefined : rupeesToPaise(form.prizePoolRupees),
    scheduledStartAt: toIso(firstMatch?.scheduledAt ?? ''),
    registrationOpenAt: toIso(form.registrationOpenAt),
    registrationCloseAt: toIso(form.registrationCloseAt),
    checkInDurationMin: form.checkInDurationMin,
    disputeWindowHours: form.disputeWindowHours,
    rulesText: metadata(form),
    stageConfig: {
      roomCount: roomCount(form),
      matchesPerRoom: form.numberOfMatches,
      matchSchedule: form.matchSchedule.map((row) => ({
        roomOrder: row.roomOrder,
        matchOrder: row.matchOrder,
        scheduledAt: toIso(row.scheduledAt),
        map: row.map,
      })),
    },
  };
}

function scoringPayload(form: TournamentForm) {
  return {
    scoringModel: form.scoringModel,
    killMultiplier: form.scoringModel === 'placement_only'
      ? '0.00'
      : Number(form.pointsPerKill || 0).toFixed(2),
    placementPoints: placementPayload(form),
  };
}

function validate(form: TournamentForm, publish: boolean): string[] {
  const errors: string[] = [];
  if (form.title.trim().length < 3) errors.push('Tournament name is required.');
  if (form.fundingType === 'entry_fee') errors.push('Entry-fee tournaments are coming later.');
  if (form.fundingType !== 'free' && rupeesToPaise(form.prizePoolRupees) <= 0) errors.push('Prize pool is required.');
  if (roomCount(form) > 4) errors.push('Tournament capacity cannot exceed four rooms.');
  if (form.numberOfMatches < 1 || form.numberOfMatches > 12) errors.push('Number of matches must be between 1 and 12.');
  if (form.scoringModel !== 'placement_only' && Number(form.pointsPerKill) <= 0) errors.push('Kill points must be greater than zero.');
  if (form.placementPoints[form.placementPoints.length - 1] !== '0') errors.push('Last placement position must be zero.');
  if (new Set(form.tiebreakers).size !== form.tiebreakers.length) errors.push('Tie-breakers cannot repeat.');
  if (form.tiebreakers.length < 3) errors.push('Required tie-breakers are missing.');

  if (publish) {
    if (!form.bannerUrl.trim()) errors.push('Tournament banner URL is required before publishing.');
    if (!form.registrationOpenAt || !form.registrationCloseAt) errors.push('Registration dates are required before publishing.');
    if (!form.matchSchedule.every((row) => row.scheduledAt && row.map)) errors.push('Every match needs a time and map.');
    if (form.fundingType !== 'free' && leaderboardTotal(form) !== rupeesToPaise(form.prizePoolRupees)) {
      errors.push('Official leaderboard prize rows must sum exactly to the prize pool.');
    }
  }
  return errors;
}

function validateStep(form: TournamentForm, step: number): string[] {
  if (step === 0) {
    if (form.fundingType === 'entry_fee') return ['Entry-fee tournaments are coming later.'];
    if (form.fundingType !== 'free' && rupeesToPaise(form.prizePoolRupees) <= 0) return ['Prize pool is required.'];
  }
  if (step === 1 && form.title.trim().length < 3) return ['Tournament name is required.'];
  if (step === 3) {
    if (roomCount(form) > 4) return ['Tournament capacity cannot exceed four rooms.'];
    if (form.numberOfMatches < 1 || form.numberOfMatches > 12) return ['Number of matches must be between 1 and 12.'];
  }
  if (step === 6 && form.scoringModel !== 'placement_only' && Number(form.pointsPerKill) <= 0) {
    return ['Kill points must be greater than zero.'];
  }
  if (step === 7 && form.tiebreakers.length < 3) return ['Required tie-breakers are missing.'];
  if (
    step === 8 &&
    form.fundingType !== 'free' &&
    leaderboardTotal(form) !== rupeesToPaise(form.prizePoolRupees)
  ) {
    return ['Official leaderboard prize rows must sum exactly to the prize pool.'];
  }
  return [];
}

function leaderboardTotal(form: TournamentForm): number {
  return form.prizeRows.reduce((sum, row) => sum + rupeesToPaise(row.amountRupees), 0);
}
