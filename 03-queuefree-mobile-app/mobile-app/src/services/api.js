import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ─────────────────────────────────────────────────────────────────
//  ⚠️  IMPORTANT: Change this to your computer's local IP address
//  Found it with: ipconfig (Windows) or ifconfig (Mac/Linux)
//  Use the address your phone or emulator can reach.
//  Example: 'http://10.20.70.147:5000/api'
// ─────────────────────────────────────────────────────────────────
const API_BASE = 'http://172.20.10.5:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token and device fingerprint to every request
api.interceptors.request.use(async config => {
  try {
    const token = await SecureStore.getItemAsync('student_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const fp = await SecureStore.getItemAsync('device_fingerprint')
            || await SecureStore.getItemAsync('device_fingerprint_fb');
    if (fp) config.headers['x-device-fingerprint'] = fp;
  } catch (_) {}
  return config;
}, error => Promise.reject(error));

// Handle responses and errors
api.interceptors.response.use(
  response => response.data,
  error => {
    if (!error.response) {
      return Promise.reject({ message: 'Cannot connect to server. Check your IP address in api.js and make sure backend is running.' });
    }
    const data = error.response.data;
    return Promise.reject(data || { message: `Server error: ${error.response.status}` });
  }
);

// Auth
export const registerStudent       = data => api.post('/student/register', data);
export const loginStudent          = data => api.post('/student/login', data);
export const getProfile            = ()   => api.get('/student/profile');
export const updateProfile         = data => api.put('/student/profile', data);
export const uploadStudentDocuments = data => api.post('/student/documents', data);
export const changePassword        = data => api.put('/student/change-password', data);

// Elections
export const getElections          = ()   => api.get('/elections');
export const getElectionCandidates = id   => api.get(`/elections/${id}/candidates`);
export const getVotingToken        = id   => api.get(`/elections/${id}/token`);
export const castVote              = data => api.post('/elections/vote', data);
export const getResults            = id   => api.get(`/elections/${id}/results`);
export const getVotingStatus       = id   => api.get(`/elections/${id}/status`);

// Notifications
export const getNotifications      = ()   => api.get('/notifications');

export default api;
