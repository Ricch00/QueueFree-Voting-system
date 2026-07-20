import axios from 'axios';

const API_BASE_URL = 'https://queuefree-voting-system-2.onrender.com/api';

const api = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || { message: 'Network error' });
  }
);

export const adminLogin         = d => api.post('/admin/login', d);
export const getAdminProfile    = () => api.get('/admin/profile');
export const changeAdminPw      = d => api.put('/admin/change-password', d);
export const getAdmins          = () => api.get('/admin/admins');
export const createAdmin        = d => api.post('/admin/admins', d);
export const getDashboard       = () => api.get('/admin/dashboard');
export const getLiveMonitoring  = id => api.get(`/admin/monitoring/${id}`);
export const getAuditLogs       = p => api.get('/admin/audit-logs', { params: p });
export const getElections       = () => api.get('/admin/elections');
export const createElection     = d => api.post('/admin/elections', d);
export const getElection        = id => api.get(`/admin/elections/${id}`);
export const updateElection     = (id, d) => api.put(`/admin/elections/${id}`, d);
export const updateElectionStatus = (id, status) => api.patch(`/admin/elections/${id}/status`, { status });
export const deleteElection     = id => api.delete(`/admin/elections/${id}`);
export const getElectionResults = id => api.get(`/admin/elections/${id}/results`);
export const getElectionReport  = id => api.get(`/admin/elections/${id}/report`);
export const createPosition     = (eid, d) => api.post(`/admin/elections/${eid}/positions`, d);
export const updatePosition     = (eid, pid, d) => api.put(`/admin/elections/${eid}/positions/${pid}`, d);
export const deletePosition     = (eid, pid) => api.delete(`/admin/elections/${eid}/positions/${pid}`);
export const getStudents        = p => api.get('/admin/students', { params: p });
export const getStudentStats    = () => api.get('/admin/students/stats');
export const getStudent         = id => api.get(`/admin/students/${id}`);
export const verifyStudent      = (id, d) => api.patch(`/admin/students/${id}/verify`, d);
export const toggleStudent      = id => api.patch(`/admin/students/${id}/toggle-active`);
export const bulkVerify         = d => api.post('/admin/students/bulk-verify', d);
export const getCandidates      = p => api.get('/admin/candidates', { params: p });
export const addCandidate       = d => api.post('/admin/candidates', d);
export const updateCandidate    = (id, d) => api.put(`/admin/candidates/${id}`, d);
export const approveCandidate   = (id, d) => api.patch(`/admin/candidates/${id}/status`, d);
export const deleteCandidate    = id => api.delete(`/admin/candidates/${id}`);
export const createNotification = d => api.post('/admin/notifications', d);

export default api;
