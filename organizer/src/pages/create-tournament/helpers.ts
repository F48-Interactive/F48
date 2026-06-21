import {
  MAPS,
  MODE_CAPACITY,
  REQUIRED_TIEBREAKERS,
  SQUAD_BALANCED,
} from './constants';
import type { MatchScheduleRow, TournamentForm, TournamentMode } from './types';

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
    fullDescription: '',
    bannerUrl: '',
    visibility: 'public',
    inviteCode: '',
    hideInviteOnly: false,
    livestreamUrl: '',
    discordUrl: '',
    whatsappUrl: '',
    organizerInstructions: '',
    fundingType: 'free',
    prizePoolRupees: '',
    mode: 'squad',
    maxUnits: 12,
    numberOfMatches: 6,
    registrationOpenAt: '',
    registrationCloseAt: '',
    rosterLockAt: '',
    registrationApproval: 'automatic',
    substitutesAllowed: 2,
    mobileOnly: true,
    regionRestriction: '',
    minimumAccountLevel: '',
    rosterCompleteRequired: true,
    lateRegistrationAllowed: false,
    checkInDurationMin: 20,
    roomReleaseMode: 'manual',
    joiningDeadlineMin: 10,
    matchSchedule: generateSchedule('squad', 12, 6),
    scoringModel: 'combined',
    pointsPerKill: '1.00',
    maxKillPoints: '',
    displayIndividualKills: true,
    displayTeamKills: true,
    placementPoints: defaultPlacement('squad'),
    tiebreakers: [...REQUIRED_TIEBREAKERS],
    prizeRows: [],
    specialPrizes: [],
    rulesText: '',
    penaltyRules: '',
    disputeWindowHours: 24,
    evidenceRequirements: 'Screenshot or video evidence is required.',
    resultsAutoFinalize: true,
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

export function toIso(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export function updateMode(form: TournamentForm, mode: TournamentMode): TournamentForm {
  const maxUnits = MODE_CAPACITY[mode];
  return {
    ...form,
    mode,
    maxUnits,
    substitutesAllowed: mode === 'solo' ? 0 : mode === 'duo' ? 1 : 2,
    placementPoints: defaultPlacement(mode),
    matchSchedule: generateSchedule(mode, maxUnits, form.numberOfMatches),
  };
}

export function refreshSchedule(form: TournamentForm): TournamentForm {
  return {
    ...form,
    matchSchedule: generateSchedule(form.mode, form.maxUnits, form.numberOfMatches),
  };
}

export function generateSchedule(
  mode: TournamentMode,
  maxUnits: number,
  numberOfMatches: number,
): MatchScheduleRow[] {
  const rows: MatchScheduleRow[] = [];
  const rooms = Math.ceil(maxUnits / MODE_CAPACITY[mode]);
  for (let roomOrder = 1; roomOrder <= rooms; roomOrder += 1) {
    for (let matchOrder = 1; matchOrder <= numberOfMatches; matchOrder += 1) {
      rows.push(row(roomOrder, matchOrder, rows.length));
    }
  }
  return rows;
}

function row(
  roomOrder: number,
  matchOrder: number,
  index: number,
): MatchScheduleRow {
  return { roomOrder, matchOrder, scheduledAt: '', map: MAPS[index % MAPS.length] ?? MAPS[0] };
}

export function prizeTotal(form: TournamentForm): number {
  const leaderboard = form.prizeRows.reduce(
    (sum, row) => sum + rupeesToPaise(row.amountRupees),
    0,
  );
  const special = form.specialPrizes.reduce(
    (sum, row) => sum + rupeesToPaise(row.amountRupees),
    0,
  );
  return leaderboard + special;
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
    visibility: form.visibility,
    inviteCode: form.inviteCode || null,
    hideInviteOnly: form.hideInviteOnly,
    bannerUrl: form.bannerUrl || null,
    livestreamUrl: form.livestreamUrl || null,
    discordUrl: form.discordUrl || null,
    whatsappUrl: form.whatsappUrl || null,
    organizerInstructions: form.organizerInstructions || null,
    registration: {
      rosterLockAt: toIso(form.rosterLockAt) ?? null,
      approval: form.registrationApproval,
      substitutesAllowed: form.substitutesAllowed,
      mobileOnly: form.mobileOnly,
      regionRestriction: form.regionRestriction || null,
      minimumAccountLevel: form.minimumAccountLevel || null,
      rosterCompleteRequired: form.rosterCompleteRequired,
      lateRegistrationAllowed: form.lateRegistrationAllowed,
    },
    schedule: {
      roomReleaseMode: form.roomReleaseMode,
      joiningDeadlineMin: form.joiningDeadlineMin,
      maps: form.matchSchedule.map(({ roomOrder, matchOrder, map }) => ({
        roomOrder,
        matchOrder,
        map,
      })),
    },
    scoring: {
      maxKillPoints: form.maxKillPoints || null,
      displayIndividualKills: form.displayIndividualKills,
      displayTeamKills: form.displayTeamKills,
    },
    specialPrizes: form.specialPrizes,
    rulesText: form.rulesText,
    penaltyRules: form.penaltyRules,
    evidenceRequirements: form.evidenceRequirements,
    resultsAutoFinalize: form.resultsAutoFinalize,
  });
}
