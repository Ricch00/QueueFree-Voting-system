const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authStudent = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'No token provided' });
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.type !== 'student') return res.status(403).json({ success: false, message: 'Access denied' });
    const rows = await pool.query('SELECT id, student_id, full_name, email, verification_status, is_active, device_fingerprint FROM students WHERE id = $1', [decoded.id]);
    if (!rows.rows.length || !rows.rows[0].is_active) return res.status(401).json({ success: false, message: 'Account not found or disabled' });
    req.student = rows.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' });
  }
};

const authAdmin = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'No token provided' });
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.type !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });
    const rows = await pool.query('SELECT id, name, email, role, is_active FROM admins WHERE id = $1', [decoded.id]);
    if (!rows.rows.length || !rows.rows[0].is_active) return res.status(401).json({ success: false, message: 'Admin not found or disabled' });
    req.admin = rows.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.admin?.role)) return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  next();
};

module.exports = { authStudent, authAdmin, requireRole };
