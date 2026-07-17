const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRegistrationPayload } = require('./registrationValidation');

test('requires both ID photo and selfie for registration', () => {
  const result = validateRegistrationPayload({
    student_id: 'UG/CS/001',
    full_name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'secret123',
    id_photo: '',
    selfie: 'data:image/jpeg;base64,abc'
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /both/i);
});

test('accepts registration payload when both documents are provided', () => {
  const result = validateRegistrationPayload({
    student_id: 'UG/CS/001',
    full_name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'secret123',
    id_photo: 'data:image/jpeg;base64,abc',
    selfie: 'data:image/jpeg;base64,def'
  });

  assert.equal(result.valid, true);
  assert.equal(result.error, null);
});
