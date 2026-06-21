import { useContext } from 'react';
import { AuthContext } from '../contexts/auth-context';
import type { AuthState } from '../contexts/auth-types';

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
