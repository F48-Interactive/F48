import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { signInWithGoogle, firebaseSignOut } from '../lib/firebase';
import { AuthContext } from './auth-context';
import type { OrganizerProfile, User } from './auth-types';

const SESSION_MARKER_KEY = 'f48_organizer_session_seen';

async function withFullOrganizerProfile(user: User): Promise<User> {
  if (!user.organizer) return user;

  try {
    const organizer = await api.get<OrganizerProfile>('/organizers/profile');
    return { ...user, organizer };
  } catch {
    return user;
  }
}

function hasActiveChannel(user: User | null): boolean {
  return !!user?.organizer?.youtubeChannels?.some(
    (channel) => !channel.status || channel.status === 'active',
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await api.get<{ user: User }>('/auth/me');
      setUser(await withFullOrganizerProfile(data.user));
      localStorage.setItem(SESSION_MARKER_KEY, '1');
    } catch {
      setUser(null);
      localStorage.removeItem(SESSION_MARKER_KEY);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const initialize = useCallback(async () => {
    const hasSeenSession = localStorage.getItem(SESSION_MARKER_KEY) === '1';
    const isPublicLanding = window.location.pathname === '/';

    if (hasSeenSession || !isPublicLanding) {
      await fetchUser();
    }
    setIsLoading(false);
  }, [fetchUser]);

  useEffect(() => {
    // Auth bootstrapping must update local state after checking the session cookie.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initialize();
  }, [initialize]);

  const login = useCallback(async () => {
    const idToken = await signInWithGoogle();
    const data = await api.post<{ user: User }>('/auth/google', { idToken });
    setUser(await withFullOrganizerProfile(data.user));
    localStorage.setItem(SESSION_MARKER_KEY, '1');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // The local Firebase session should still be cleared.
    }
    await firebaseSignOut();
    setUser(null);
    localStorage.removeItem(SESSION_MARKER_KEY);
  }, []);

  const isAuthenticated = !!user?.id;
  const hasOrganizerProfile = !!user?.organizer;
  const hasActiveYoutubeChannel = hasActiveChannel(user);
  const hasOrganizerAccess = hasOrganizerProfile && hasActiveYoutubeChannel;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        hasOrganizerProfile,
        hasActiveYoutubeChannel,
        hasOrganizerAccess,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
