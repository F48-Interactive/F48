export type TournamentMode = 'solo' | 'duo' | 'squad';
export type FundingType = 'free' | 'organizer_funded' | 'f48_sponsored' | 'entry_fee';
export type ScoringModel = 'combined' | 'placement_only' | 'kills_only';
export type Visibility = 'public' | 'invite_only';
export type RegistrationApproval = 'automatic' | 'organizer_approval';

export interface MatchScheduleRow {
  roomOrder: number;
  matchOrder: number;
  scheduledAt: string;
  map: string;
}

export interface PrizeRow {
  rank: number;
  amountRupees: string;
}

export interface SpecialPrizeRow {
  name: string;
  calculationType: string;
  amountRupees: string;
  tieBreaker: string;
}

export interface TournamentForm {
  title: string;
  shortDescription: string;
  fullDescription: string;
  bannerUrl: string;
  visibility: Visibility;
  inviteCode: string;
  hideInviteOnly: boolean;
  livestreamUrl: string;
  discordUrl: string;
  whatsappUrl: string;
  organizerInstructions: string;
  fundingType: FundingType;
  prizePoolRupees: string;
  mode: TournamentMode;
  maxUnits: number;
  numberOfMatches: number;
  registrationOpenAt: string;
  registrationApproval: RegistrationApproval;
  mobileOnly: boolean;
  regionRestriction: string;
  minimumAccountLevel: string;
  checkInDurationMin: number;
  roomReleaseMode: 'manual' | 'scheduled';
  joiningDeadlineMin: number;
  matchSchedule: MatchScheduleRow[];
  scoringModel: ScoringModel;
  pointsPerKill: string;
  maxKillPoints: string;
  displayIndividualKills: boolean;
  displayTeamKills: boolean;
  placementPoints: string[];
  tiebreakers: string[];
  prizeRows: PrizeRow[];
  specialPrizes: SpecialPrizeRow[];
  rulesText: string;
  penaltyRules: string;
  disputeWindowHours: number;
  evidenceRequirements: string;
  resultsAutoFinalize: boolean;
}
