import type { ScoringModel, TournamentMode } from './types';

export const STEPS = [
  'Type',
  'Details',
  'Mode',
  'Structure',
  'Registration',
  'Schedule',
  'Scoring',
  'Tie-breakers',
  'Prizes',
  'Rules',
  'Preview',
] as const;

export const MODE_CAPACITY: Record<TournamentMode, number> = {
  solo: 48,
  duo: 24,
  squad: 12,
};

export const MODE_LABEL: Record<TournamentMode, string> = {
  solo: 'players',
  duo: 'teams',
  squad: 'teams',
};

export const TEAM_SIZE: Record<TournamentMode, number> = {
  solo: 1,
  duo: 2,
  squad: 4,
};

export const MAPS = ['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'NexTerra'];

export const TIEBREAKER_OPTIONS = [
  { value: 'total_booyahs', label: 'More Booyahs' },
  { value: 'total_kills', label: 'More total kills' },
  { value: 'final_match_placement', label: 'Better final-match placement' },
  { value: 'average_placement', label: 'Better average placement' },
  { value: 'higher_placement_count', label: 'More higher-placement finishes' },
  { value: 'fewer_penalties', label: 'Fewer penalty points' },
  { value: 'deciding_match', label: 'Deciding match' },
];

export const REQUIRED_TIEBREAKERS = [
  'total_booyahs',
  'total_kills',
  'final_match_placement',
];

export const SCORING_LABEL: Record<ScoringModel, string> = {
  combined: 'Combined scoring',
  placement_only: 'Placement-only scoring',
  kills_only: 'Kill-only scoring',
};

export const SQUAD_BALANCED = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 0];
