// src/Pages/Auth/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthContext';
import authService from '../../services/authService';

const ProtectedRoute = ({ children, allowedRoles, loginUrl }) => {
  const { loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-600">Loading session...</p>
      </div>
    );
  }

  const isAuthenticated = authService.isAuthenticated();
  const userRole = authService.getUserRole();

  if (!isAuthenticated) {
    // Jika tidak login, redirect ke loginUrl yang ditentukan (misal /login/admin)
    // atau default ke "/" (login user biasa)
    return <Navigate to={loginUrl || "/"} state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return children;
};

export default ProtectedRoute;