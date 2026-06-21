export interface MatchRoom {
  name: string;
  roomOrder: number;
  maxUnits: number;
}

export interface TournamentMatch {
  id: string;
  matchNumber: number;
  status: string;
  room: MatchRoom;
}

export interface RegistrationMember {
  playerId: string;
  role: string;
}

export interface Registration {
  id: string;
  status: string;
  slotNumber: number | null;
  teamName: string | null;
  members: RegistrationMember[];
}

export interface RegistrationPage {
  items: Registration[];
}

export interface CredentialInput {
  roomId: string;
  roomPass: string;
  customCode: string;
}

export interface ResultInput {
  placement: string;
  kills: string;
}
