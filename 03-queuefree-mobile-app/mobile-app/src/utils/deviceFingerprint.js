import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import * as Device from 'expo-device';

export const getDeviceFingerprint = async () => {
  try {
    // Return stored fingerprint if already generated
    const stored = await SecureStore.getItemAsync('device_fingerprint');
    if (stored) return stored;

    // Build fingerprint from stable device info
    const parts = [
      Device.modelName || 'unknown_model',
      Device.osName || 'unknown_os',
      Device.osVersion || '0',
      Application.applicationId || 'unknown_app',
    ];

    // Get platform-specific installation ID (most stable identifier)
    try {
      if (Device.osName === 'Android') {
        const androidId = Application.getAndroidId
          ? Application.getAndroidId()
          : null;
        if (androidId) parts.push(androidId);
      } else if (Device.osName === 'iOS') {
        const iosId = await Application.getIosIdForVendorAsync();
        if (iosId) parts.push(iosId);
      }
    } catch (_) {}

    // Simple deterministic hash
    const raw = parts.filter(Boolean).join('|');
    let hash = 5381;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
      hash = hash >>> 0; // keep unsigned
    }

    const fingerprint = `qf_${hash.toString(16)}_${Date.now().toString(36)}`;
    await SecureStore.setItemAsync('device_fingerprint', fingerprint);
    return fingerprint;
  } catch (_) {
    // Fallback: generate a random ID stored permanently
    try {
      const fallback = await SecureStore.getItemAsync('device_fingerprint_fb');
      if (fallback) return fallback;
      const newId = `qf_fb_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      await SecureStore.setItemAsync('device_fingerprint_fb', newId);
      return newId;
    } catch {
      return `qf_tmp_${Math.random().toString(36).slice(2)}`;
    }
  }
};
