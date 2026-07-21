const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { auditLog } = require('../middleware/audit');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const rows = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
    if (!rows.length || !await bcrypt.compare(password, rows[0].password)) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const admin = rows[0];
    if (!admin.is_active) return res.status(403).json({ success: false, message: 'Account disabled' });
    await pool.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);
    const token = jwt.sign({ id: admin.id, type: 'admin', role: admin.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    await auditLog({ actorType: 'admin', actorId: admin.id, actorEmail: email, action: 'LOGIN', req });
    res.json({ success: true, data: { token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } } });
  } catch (err) {
    console.error('Admin login failed:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

const getProfile = async (req, res) => res.json({ success: true, data: req.admin });

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const rows = await pool.query('SELECT password FROM admins WHERE id = $1', [req.admin.id]);
    if (!await bcrypt.compare(current_password, rows[0].password)) return res.status(400).json({ success: false, message: 'Current password incorrect' });
    await pool.query('UPDATE admins SET password = $1 WHERE id = $2', [await bcrypt.hash(new_password, 12), req.admin.id]);
    res.json({ success: true, message: 'Password changed' });
  } catch (err) { res.status(500).json({ success: false, message: 'Password change failed' }); }
};

const getAdmins = async (req, res) => {
  try {
    const rows = await pool.query('SELECT id, name, email, role, is_active, last_login, created_at FROM admins ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch admins' }); }
};

const createAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const ex = await pool.query('SELECT id FROM admins WHERE email = $1', [email]);
    if (ex.length) return res.status(409).json({ success: false, message: 'Email already exists' });
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query('INSERT INTO admins (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id', [name, email, hash, role || 'admin']);
    res.status(201).json({ success: true, message: 'Admin created', data: { id: result.rows[0].id } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to create admin' }); }
};

module.exports = { login, getProfile, changePassword, getAdmins, createAdmin };
