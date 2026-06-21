export type TournamentMode = 'solo' | 'duo' | 'squad';
export type FundingType = 'free' | 'organizer_funded' | 'f48_sponsored' | 'entry_fee';
export type ScoringModel = 'combined' | 'placement_only' | 'kills_only';

export interface PrizeRow {
  rank: number;
  amountRupees: string;
}

export interface TournamentForm {
  title: string;
  shortDescription: string;
  bannerUrl: string;
  fundingType: FundingType;
  prizePoolRupees: string;
  mode: TournamentMode;
  maxUnits: number;
  numberOfMatches: number;
  scoringModel: ScoringModel;
  pointsPerKill: string;
  placementPoints: string[];
  tiebreakers: string[];
  prizeRows: PrizeRow[];
  disputeWindowHours: number;
  evidenceRequirements: string;
}
