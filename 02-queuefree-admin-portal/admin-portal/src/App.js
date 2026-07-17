import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import LoginPage from './components/pages/LoginPage';
import DashboardPage from './components/pages/DashboardPage';
import ElectionsPage from './components/pages/ElectionsPage';
import ElectionDetailPage from './components/pages/ElectionDetailPage';
import StudentsPage from './components/pages/StudentsPage';
import CandidatesPage from './components/pages/CandidatesPage';
import MonitoringPage from './components/pages/MonitoringPage';
import ResultsPage from './components/pages/ResultsPage';
import AuditLogsPage from './components/pages/AuditLogsPage';
import SettingsPage from './components/pages/SettingsPage';
import NotificationsPage from './components/pages/NotificationsPage';

const Guard = ({ children }) => {
  const { admin, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  return admin ? children : <Navigate to="/login" replace />;
};
const Public = ({ children }) => {
  const { admin } = useAuth();
  return admin ? <Navigate to="/" replace /> : children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <Routes>
          <Route path="/login" element={<Public><LoginPage /></Public>} />
          <Route path="/" element={<Guard><Layout /></Guard>}>
            <Route index element={<DashboardPage />} />
            <Route path="elections" element={<ElectionsPage />} />
            <Route path="elections/:id" element={<ElectionDetailPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="candidates" element={<CandidatesPage />} />
            <Route path="monitoring/:id" element={<MonitoringPage />} />
            <Route path="results/:id" element={<ResultsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
