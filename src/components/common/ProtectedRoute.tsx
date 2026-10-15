import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import type { RoleType } from '../../types';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  requiredRole?: RoleType;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, loading, currentRole, setRole } = useApp();
  const location = useLocation();

  // Revalidate authentication on page show (handles bfcache / browser back button)
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page was restored from back-forward cache, reload to revalidate auth
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // Sync role if navigation targets a specific role portal
  useEffect(() => {
    if (isAuthenticated && requiredRole && currentRole !== requiredRole) {
      setRole(requiredRole);
    }
  }, [isAuthenticated, requiredRole, currentRole, setRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" role="status" aria-label="Loading session">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-700 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          unauthorized: true,
          message: 'Please sign in or select a portal to access this page.',
          from: location.pathname,
        }}
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
};
