// src/Pages/Auth/AuthContext.jsx

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router';
import authService from '../../services/authService'; // 1. Impor authService

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);

    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const userData = await authService.login(email, password);
    setUser(userData);
    
    if (userData.role === 'admin') {
      navigate('/admin/dashboard');
    } else if (userData.role === 'super_admin') {
      navigate('/superadmin/dashboard');
    } else {
      navigate('/dashboard');
    }
    return userData;
  };

  const logout = () => {
    authService.logout(); // Panggil fungsi logout dari service
    setUser(null);
    navigate('/'); // Arahkan ke halaman utama setelah logout
  };

  const value = { user, login, logout, isAuthenticated: !!user, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};