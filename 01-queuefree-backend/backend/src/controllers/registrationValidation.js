const validateRegistrationPayload = (payload = {}) => {
  const required = ['student_id', 'full_name', 'email', 'password'];
  for (const field of required) {
    if (!payload[field] || String(payload[field]).trim() === '') {
      return { valid: false, error: `${field} is required` };
    }
  }

  if (!payload.id_photo || !payload.selfie) {
    return { valid: false, error: 'Both ID photo and selfie are required for verification' };
  }

  return { valid: true, error: null };
};

module.exports = { validateRegistrationPayload };
