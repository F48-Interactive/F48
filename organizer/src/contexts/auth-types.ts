export interface OrganizerYoutubeChannel {
  id?: string;
  channelId: string;
  channelName: string;
  handle: string | null;
  url?: string;
  imageUrl: string | null;
  subscriberCount: number | null;
  status?: string;
}

export interface OrganizerProfile {
  id: string;
  displayName: string | null;
  description: string | null;
  verificationStatus: string;
  youtubeChannels?: OrganizerYoutubeChannel[];
}

export interface User {
  id: string | null;
  email: string;
  role: string;
  status: string;
  isNewUser: boolean;
  player: unknown | null;
  organizer: OrganizerProfile | null;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasOrganizerProfile: boolean;
  hasActiveYoutubeChannel: boolean;
  hasOrganizerAccess: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
