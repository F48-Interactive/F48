import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface Props {
  children: React.ReactNode;
  requireOrganizer?: boolean;
}

export function ProtectedRoute({ children, requireOrganizer = true }: Props) {
  const { isAuthenticated, hasOrganizerAccess, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner-lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requireOrganizer && !hasOrganizerAccess) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
