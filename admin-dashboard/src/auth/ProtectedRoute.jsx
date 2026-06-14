import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import FullScreenSpinner from '../components/FullScreenSpinner';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenSpinner label="Restoring session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
