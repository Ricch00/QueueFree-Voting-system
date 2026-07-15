import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { loginStudent, getProfile } from '../services/api';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [student, setStudent]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [deviceFingerprint, setDeviceFP]  = useState(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    try {
      const fp = await getDeviceFingerprint();
      setDeviceFP(fp);
      const token  = await SecureStore.getItemAsync('student_token');
      const stored = await SecureStore.getItemAsync('student_data');
      if (token && stored) {
        setStudent(JSON.parse(stored));
        getProfile()
          .then(r => {
            const profile = r.data ?? r;
            setStudent(profile);
            SecureStore.setItemAsync('student_data', JSON.stringify(profile));
          })
          .catch(async () => { await logout(); });
      }
    } catch (_) {}
    finally { setLoading(false); }
  };

  const login = async (email, password) => {
    const fp  = deviceFingerprint || await getDeviceFingerprint();
    const res = await loginStudent({ email, password, device_fingerprint: fp });
    const payload = res.data?.data ?? res.data ?? res;
    const studentData = payload.student || payload;
    await SecureStore.setItemAsync('student_token', payload.token);
    await SecureStore.setItemAsync('student_data', JSON.stringify(studentData));
    setStudent(studentData);
    return studentData;
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('student_token');
    await SecureStore.deleteItemAsync('student_data');
    setStudent(null);
  };

  const refreshStudent = async () => {
    const r = await getProfile();
    const profile = r.data ?? r;
    setStudent(profile);
    await SecureStore.setItemAsync('student_data', JSON.stringify(profile));
    return profile;
  };

  return (
    <AuthContext.Provider value={{ student, login, logout, loading, deviceFingerprint, refreshStudent }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
