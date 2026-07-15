import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminLogin, getAdminProfile } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

const normalizeResponse = res => {
  const body = res?.data ?? res;
  if (body?.data?.token) return body.data;
  if (body?.token) return body;
  if (body?.data) return body.data;
  return body;
};

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const stored = localStorage.getItem('admin_user');
    if (token && stored) {
      try {
        setAdmin(JSON.parse(stored));
      } catch (err) {
        console.warn('Failed to parse stored admin user:', err);
        localStorage.removeItem('admin_user');
        localStorage.removeItem('admin_token');
      }
      getAdminProfile()
        .then(r => {
          const profile = normalizeResponse(r);
          setAdmin(profile);
          localStorage.setItem('admin_user', JSON.stringify(profile));
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await adminLogin({ email, password });
    const payload = normalizeResponse(res);
    const adminData = payload.admin || payload;
    localStorage.setItem('admin_token', payload.token);
    localStorage.setItem('admin_user', JSON.stringify(adminData));
    setAdmin(adminData);
    toast.success(`Welcome, ${adminData.name}!`);
    return adminData;
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setAdmin(null);
  };

  return <AuthContext.Provider value={{ admin, login, logout, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
