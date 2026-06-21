import {
  CORE_RULES,
  MODE_CAPACITY,
  REQUIRED_TIEBREAKERS,
  SQUAD_BALANCED,
  TEAM_SIZE,
} from './constants';
import type { TournamentForm, TournamentMode } from './types';

export function defaultPlacement(mode: TournamentMode): string[] {
  const slots = MODE_CAPACITY[mode];
  if (mode === 'squad') return SQUAD_BALANCED.map(String);
  return Array.from({ length: slots }, (_, i) => {
    const value = Math.max(slots - i - 1, 0);
    return String(value);
  });
}

export function defaultForm(): TournamentForm {
  return {
    title: '',
    shortDescription: '',
    bannerUrl: '',
    fundingType: 'free',
    prizePoolRupees: '',
    mode: 'squad',
    maxUnits: 12,
    numberOfMatches: 6,
    scoringModel: 'combined',
    pointsPerKill: '1.00',
    placementPoints: defaultPlacement('squad'),
    tiebreakers: [...REQUIRED_TIEBREAKERS],
    prizeRows: [],
    disputeWindowHours: 24,
    evidenceRequirements: 'Screenshot or video evidence is required.',
  };
}

export function roomCount(form: Pick<TournamentForm, 'mode' | 'maxUnits'>): number {
  return Math.ceil(form.maxUnits / MODE_CAPACITY[form.mode]);
}

export function rupeesToPaise(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

export function updateMode(form: TournamentForm, mode: TournamentMode): TournamentForm {
  const maxUnits = MODE_CAPACITY[mode];
  return {
    ...form,
    mode,
    maxUnits,
    placementPoints: defaultPlacement(mode),
  };
}

export function prizeTotal(form: TournamentForm): number {
  return form.prizeRows.reduce(
    (sum, row) => sum + rupeesToPaise(row.amountRupees),
    0,
  );
}

export function leaderboardPrizeRules(form: TournamentForm) {
  return form.prizeRows
    .filter((row) => row.rank > 0 && rupeesToPaise(row.amountRupees) > 0)
    .map((row) => ({
      rankStart: row.rank,
      rankEnd: row.rank,
      amountPaise: rupeesToPaise(row.amountRupees),
    }));
}

export function placementPayload(form: TournamentForm) {
  return form.placementPoints.map((points, index) => ({
    position: index + 1,
    points: Number(points || 0).toFixed(2),
  }));
}

export function metadata(form: TournamentForm): string {
  return JSON.stringify({
    version: 1,
    identity: {
      bannerUrl: form.bannerUrl || null,
      shortDescription: form.shortDescription,
    },
    slotBooking: {
      slotBookedBy: form.mode === 'solo' ? 'player' : 'team_leader',
      slotUnit: form.mode === 'solo' ? 'player' : 'team',
      teamSize: TEAM_SIZE[form.mode],
      fullTeamRequiredAtSlotBooking: form.mode !== 'solo',
      closesWhen: 'full_or_organizer_hold',
    },
    safety: {
      coreRules: CORE_RULES,
      disputeWindowHours: form.disputeWindowHours,
      evidenceRequirements: form.evidenceRequirements,
    },
  });
}
