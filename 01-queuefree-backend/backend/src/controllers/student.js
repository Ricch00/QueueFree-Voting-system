const pool = require('../config/database');
const { auditLog } = require('../middleware/audit');

const formatStudent = (student, req) => {
  const formatted = { ...student };
  // Convert absolute URLs to relative paths for admin portal proxy
  if (formatted.id_photo_url) {
    formatted.id_photo_url = formatted.id_photo_url.replace(/^https?:\/\/[^\/]+/, '');
  }
  if (formatted.selfie_url) {
    formatted.selfie_url = formatted.selfie_url.replace(/^https?:\/\/[^\/]+/, '');
  }
  return formatted;
};

const getAllStudents = async (req, res) => {
  try {
    const { search, status, level, page = 1, limit = 20 } = req.query;
    let where = 'WHERE 1=1'; const params = [];
    if (search) { where += ' AND (s.full_name LIKE ? OR s.student_id LIKE ? OR s.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (status) { where += ' AND s.verification_status = ?'; params.push(status); }
    if (level) { where += ' AND s.level = ?'; params.push(level); }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [students] = await pool.query(
      `SELECT s.id, s.student_id, s.full_name, s.email, s.phone, s.program, s.level, s.department, s.faculty, s.hall,
        s.id_photo_url, s.selfie_url, s.verification_status, s.verification_note, s.is_active, s.device_fingerprint, s.created_at, a.name as verified_by_name
       FROM students s LEFT JOIN admins a ON s.verified_by = a.id
       ${where} ORDER BY s.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`, params);
    const [[total]] = await pool.query(`SELECT COUNT(*) as count FROM students s ${where}`, params);
    res.json({ success: true, data: students.map(s => formatStudent(s, req)), pagination: { total: total.count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total.count / parseInt(limit)) } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed' }); }
};

const getStudent = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT s.*, a.name as verified_by_name FROM students s LEFT JOIN admins a ON s.verified_by = a.id WHERE s.id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Student not found' });
    const student = formatStudent({ ...rows[0] }, req);
    delete student.password;
    const [voteHistory] = await pool.query('SELECT e.title, e.academic_year, vr.voted_at FROM voter_records vr JOIN elections e ON vr.election_id = e.id WHERE vr.student_id = ? ORDER BY vr.voted_at DESC', [req.params.id]);
    student.vote_history = voteHistory;
    res.json({ success: true, data: student });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const verifyStudent = async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!['verified', 'rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be verified or rejected' });
    await pool.query('UPDATE students SET verification_status=?, verification_note=?, verified_by=?, verified_at=NOW() WHERE id=?', [status, note || null, req.admin.id, req.params.id]);
    await auditLog({ actorType: 'admin', actorId: req.admin.id, actorEmail: req.admin.email, action: `STUDENT_${status.toUpperCase()}`, resourceType: 'student', resourceId: req.params.id, req });
    res.json({ success: true, message: `Student ${status}` });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const toggleStudentActive = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT is_active FROM students WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const newStatus = !rows[0].is_active;
    await pool.query('UPDATE students SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
    res.json({ success: true, message: `Student ${newStatus ? 'activated' : 'deactivated'}` });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const getStudentStats = async (req, res) => {
  try {
    const [[stats]] = await pool.query(`SELECT COUNT(*) as total, SUM(verification_status='verified') as verified, SUM(verification_status='pending') as pending, SUM(verification_status='rejected') as rejected, SUM(device_fingerprint IS NOT NULL) as device_registered FROM students`);
    res.json({ success: true, data: stats });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const bulkVerify = async (req, res) => {
  try {
    const { student_ids, status } = req.body;
    if (!Array.isArray(student_ids) || !student_ids.length) return res.status(400).json({ success: false, message: 'student_ids array required' });
    if (!['verified', 'rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const placeholders = student_ids.map(() => '?').join(',');
    await pool.query(`UPDATE students SET verification_status=?, verified_by=?, verified_at=NOW() WHERE id IN (${placeholders})`, [status, req.admin.id, ...student_ids]);
    res.json({ success: true, message: `${student_ids.length} students ${status}` });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

module.exports = { getAllStudents, getStudent, verifyStudent, toggleStudentActive, getStudentStats, bulkVerify };
