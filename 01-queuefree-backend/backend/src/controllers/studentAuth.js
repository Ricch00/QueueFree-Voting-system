const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { auditLog } = require('../middleware/audit');
const { validateRegistrationPayload } = require('./registrationValidation');

const ensureUploadDir = () => {
  const dir = path.join(__dirname, '../../uploads/student_docs');
  if (!fs.existsSync(dir)) {
    console.log('Creating upload directory:', dir);
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const getImageExtension = data => {
  const match = data?.match(/^data:image\/(png|jpe?g|webp|gif);base64,/i);
  if (!match) return 'jpg';
  return match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
};

const saveBase64Image = async (base64, filename) => {
  const clean = base64.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
  const buffer = Buffer.from(clean, 'base64');
  await fs.promises.writeFile(path.join(ensureUploadDir(), filename), buffer);
  return `/uploads/student_docs/${filename}`;
};

const register = async (req, res) => {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const { student_id, full_name, email, password, phone, program, level, department, faculty, hall, device_fingerprint, id_photo, selfie } = req.body;

    const validation = validateRegistrationPayload({ student_id, full_name, email, password, id_photo, selfie });
    if (!validation.valid) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: validation.error });
    }

    const existing = await conn.query('SELECT id FROM students WHERE email = $1 OR student_id = $2', [email, student_id]);
    if (existing.rows.length) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Student ID or email already registered' });
    }

    if (device_fingerprint) {
      const devCheck = await conn.query('SELECT id FROM device_registry WHERE device_fingerprint = $1', [device_fingerprint]);
      if (devCheck.rows.length) {
        await conn.rollback();
        return res.status(409).json({ success: false, message: 'This device is already registered to another account' });
      }
    }

    const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const result = await conn.query(
      `INSERT INTO students (student_id, full_name, email, password, phone, program, level, department, faculty, hall, device_fingerprint)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [student_id, full_name, email, hash, phone || null, program || null, level || '100', department || null, faculty || null, hall || null, device_fingerprint || null]
    );

    if (device_fingerprint) {
      await conn.query('INSERT INTO device_registry (device_fingerprint, first_student_id) VALUES ($1, $2) ON CONFLICT (device_fingerprint) DO NOTHING', [device_fingerprint, result.rows[0].id]);
    }

    if (id_photo || selfie) {
      const idPhotoUrl = id_photo ? await saveBase64Image(id_photo, `${result.rows[0].id}-id-${Date.now()}.${getImageExtension(id_photo)}`) : null;
      const selfieUrl = selfie ? await saveBase64Image(selfie, `${result.rows[0].id}-selfie-${Date.now()}.${getImageExtension(selfie)}`) : null;
      await conn.query(
        'UPDATE students SET id_photo_url = COALESCE($1, id_photo_url), selfie_url = COALESCE($2, selfie_url), verification_status = $3 WHERE id = $4',
        [idPhotoUrl, selfieUrl, 'pending', result.rows[0].id]
      );
    }

    await conn.query('COMMIT');
    await auditLog({ actorType: 'student', actorId: result.rows[0].id, actorEmail: email, action: 'REGISTER', req });
    res.status(201).json({ success: true, message: 'Registration successful. Await verification by the Electoral Commission.' });
  } catch (err) {
    await conn.query('ROLLBACK');
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  } finally {
    conn.release();
  }
};

const login = async (req, res) => {
  try {
    const { email, password, device_fingerprint } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    const rows = await pool.query('SELECT * FROM students WHERE email = $1', [email]);
    if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const student = rows[0];
    if (!student.is_active) return res.status(403).json({ success: false, message: 'Account deactivated' });

    if (student.locked_until && new Date(student.locked_until) > new Date()) {
      return res.status(423).json({ success: false, message: `Account locked until ${new Date(student.locked_until).toLocaleTimeString()}` });
    }

    const valid = await bcrypt.compare(password, student.password);
    if (!valid) {
      const attempts = student.login_attempts + 1;
      const max = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
      const lockUntil = attempts >= max ? new Date(Date.now() + (parseInt(process.env.LOCK_TIME_MINUTES) || 15) * 60000) : null;
      await pool.query('UPDATE students SET login_attempts = $1, locked_until = $2 WHERE id = $3', [attempts, lockUntil, student.id]);
      return res.status(401).json({ success: false, message: `Invalid credentials. ${max - attempts} attempts remaining.` });
    }

    // Device fingerprint check
    if (device_fingerprint) {
      if (student.device_fingerprint && student.device_fingerprint !== device_fingerprint) {
        await auditLog({ actorType: 'student', actorId: student.id, actorEmail: email, action: 'LOGIN_DEVICE_MISMATCH', req });
        return res.status(403).json({ success: false, message: 'This account is bound to a different device' });
      }
      const devReg = await pool.query('SELECT first_student_id FROM device_registry WHERE device_fingerprint = $1', [device_fingerprint]);
      if (devReg.rows.length && devReg.rows[0].first_student_id !== student.id) {
        return res.status(403).json({ success: false, message: 'This device is registered to another student account' });
      }
      if (!student.device_fingerprint) {
        await pool.query('UPDATE students SET device_fingerprint = $1 WHERE id = $2', [device_fingerprint, student.id]);
        await pool.query('INSERT INTO device_registry (device_fingerprint, first_student_id) VALUES ($1, $2) ON CONFLICT (device_fingerprint) DO NOTHING', [device_fingerprint, student.id]);
      }
    }

    await pool.query('UPDATE students SET login_attempts = 0, locked_until = NULL WHERE id = $1', [student.id]);
    const token = jwt.sign({ id: student.id, type: 'student', email: student.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    await auditLog({ actorType: 'student', actorId: student.id, actorEmail: email, action: 'LOGIN', req });

    res.json({
      success: true,
      data: {
        token,
        student: {
          id: student.id, student_id: student.student_id, full_name: student.full_name,
          email: student.email, phone: student.phone, program: student.program,
          level: student.level, department: student.department, faculty: student.faculty,
          verification_status: student.verification_status, profile_photo: student.profile_photo,
          id_photo_url: student.id_photo_url, selfie_url: student.selfie_url
        }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

const getProfile = async (req, res) => {
  try {
    const rows = await pool.query(
      'SELECT id, student_id, full_name, email, phone, program, level, department, faculty, profile_photo, id_photo_url, selfie_url, verification_status, device_fingerprint, created_at FROM students WHERE id = $1',
      [req.student.id]
    );
    const profile = rows[0];
    if (profile?.id_photo_url) profile.id_photo_url = `${req.protocol}://${req.get('host')}${profile.id_photo_url}`;
    if (profile?.selfie_url) profile.selfie_url = `${req.protocol}://${req.get('host')}${profile.selfie_url}`;
    res.json({ success: true, data: profile });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch profile' }); }
};

const updateProfile = async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    await pool.query('UPDATE students SET full_name = $1, phone = $2 WHERE id = $3', [full_name, phone || null, req.student.id]);
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) { res.status(500).json({ success: false, message: 'Update failed' }); }
};

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const rows = await pool.query('SELECT password FROM students WHERE id = $1', [req.student.id]);
    if (!await bcrypt.compare(current_password, rows[0].password)) return res.status(400).json({ success: false, message: 'Current password incorrect' });
    await pool.query('UPDATE students SET password = $1 WHERE id = $2', [await bcrypt.hash(new_password, 12), req.student.id]);
    res.json({ success: true, message: 'Password changed' });
  } catch (err) { res.status(500).json({ success: false, message: 'Password change failed' }); }
};

const uploadDocuments = async (req, res) => {
  try {
    const { id_photo, selfie } = req.body;
    if (!id_photo && !selfie) return res.status(400).json({ success: false, message: 'id_photo or selfie is required' });
    const rows = await pool.query('SELECT student_id FROM students WHERE id = $1', [req.student.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student not found' });
    const studentRef = rows[0].student_id || req.student.id;
    const idPhotoUrl = id_photo ? await saveBase64Image(id_photo, `${studentRef}-id-${Date.now()}.${getImageExtension(id_photo)}`) : null;
    const selfieUrl = selfie ? await saveBase64Image(selfie, `${studentRef}-selfie-${Date.now()}.${getImageExtension(selfie)}`) : null;
    const updates = [];
    const params = [];
    let paramIndex = 1;
    if (idPhotoUrl) { updates.push(`id_photo_url = $${paramIndex++}`); params.push(idPhotoUrl); }
    if (selfieUrl) { updates.push(`selfie_url = $${paramIndex++}`); params.push(selfieUrl); }
    updates.push(`verification_status = $${paramIndex++}`); params.push('pending');
    params.push(req.student.id);
    await pool.query(`UPDATE students SET ${updates.join(', ')} WHERE id = $1`, params);
    res.json({ success: true, data: { id_photo_url: idPhotoUrl, selfie_url: selfieUrl } });
  } catch (err) {
    console.error('Upload documents error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload documents' });
  }
};

module.exports = { register, login, getProfile, updateProfile, changePassword, uploadDocuments };
