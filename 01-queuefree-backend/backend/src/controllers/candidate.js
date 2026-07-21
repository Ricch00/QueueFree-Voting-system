const pool = require('../config/database');
const { auditLog } = require('../middleware/audit');
const fs = require('fs');
const path = require('path');

const ensureUploadDir = () => {
  const dir = path.join(__dirname, '../uploads/candidate_photos');
  if (!fs.existsSync(dir)) {
    console.log('Creating candidate upload directory:', dir);
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const saveBase64Image = (data, filename) => {
  const clean = data.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
  const buffer = Buffer.from(clean, 'base64');
  fs.promises.writeFile(path.join(ensureUploadDir(), filename), buffer);
  return `/uploads/candidate_photos/${filename}`;
};

const getImageExtension = data => {
  const match = data?.match(/^data:image\/(png|jpe?g|webp|gif);base64,/i);
  if (!match) return 'jpg';
  return match[1];
};

const getAllCandidates = async (req, res) => {
  try {
    const { election_id, status, position_id } = req.query;
    let where = 'WHERE 1=1'; const params = [];
    let paramIndex = 1;
    if (election_id) { where += ` AND c.election_id = $${paramIndex++}`; params.push(election_id); }
    if (status) { where += ` AND c.status = $${paramIndex++}`; params.push(status); }
    if (position_id) { where += ` AND c.position_id = $${paramIndex++}`; params.push(position_id); }
    const rows = await pool.query(
      `SELECT c.*, s.full_name, s.student_id as student_number, s.program, s.level, s.department, s.profile_photo,
        p.title as position_title, e.title as election_title, a.name as approved_by_name
       FROM candidates c JOIN students s ON c.student_id = s.id JOIN positions p ON c.position_id = p.id
       JOIN elections e ON c.election_id = e.id LEFT JOIN admins a ON c.approved_by = a.id
       ${where} ORDER BY c.created_at DESC`, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const addCandidate = async (req, res) => {
  try {
    const { election_id, position_id, student_id, manifesto, nickname, sort_order, photo } = req.body;
    if (!election_id || !position_id || !student_id) return res.status(400).json({ success: false, message: 'election_id, position_id and student_id required' });
    const ex = await pool.query('SELECT id FROM candidates WHERE election_id=$1 AND position_id=$2 AND student_id=$3', [election_id, position_id, student_id]);
    if (ex.length) return res.status(409).json({ success: false, message: 'Candidate already nominated for this position' });
    const r = await pool.query('INSERT INTO candidates (election_id, position_id, student_id, manifesto, nickname, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [election_id, position_id, student_id, manifesto || null, nickname || null, sort_order || 0]);
    
    let photoUrl = null;
    if (photo) {
      photoUrl = saveBase64Image(photo, `${r.rows[0].id}-photo-${Date.now()}.${getImageExtension(photo)}`);
      await pool.query('UPDATE candidates SET photo_url = $1 WHERE id = $2', [photoUrl, r.rows[0].id]);
    }
    
    await auditLog({ actorType: 'admin', actorId: req.admin.id, actorEmail: req.admin.email, action: 'ADD_CANDIDATE', resourceType: 'candidate', resourceId: r.rows[0].id, req });
    res.status(201).json({ success: true, message: 'Candidate added', data: { id: r.rows[0].id, photo_url: photoUrl } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const updateCandidate = async (req, res) => {
  try {
    const { manifesto, nickname, sort_order, photo } = req.body;
    let photoUrl = null;
    if (photo) {
      photoUrl = saveBase64Image(photo, `${req.params.id}-photo-${Date.now()}.${getImageExtension(photo)}`);
    }
    await pool.query('UPDATE candidates SET manifesto=$1, nickname=$2, sort_order=$3, photo_url=COALESCE($4, photo_url) WHERE id=$5', 
      [manifesto, nickname, sort_order || 0, photoUrl, req.params.id]);
    res.json({ success: true, message: 'Updated' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const approveCandidate = async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    if (!['approved', 'rejected', 'disqualified'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    await pool.query('UPDATE candidates SET status=$1, approved_by=$2, approved_at=NOW(), rejection_reason=$3 WHERE id=$4', [status, req.admin.id, rejection_reason || null, req.params.id]);
    await auditLog({ actorType: 'admin', actorId: req.admin.id, actorEmail: req.admin.email, action: `CANDIDATE_${status.toUpperCase()}`, resourceType: 'candidate', resourceId: req.params.id, req });
    res.json({ success: true, message: `Candidate ${status}` });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const deleteCandidate = async (req, res) => {
  try {
    await pool.query('DELETE FROM candidates WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Removed' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

module.exports = { getAllCandidates, addCandidate, updateCandidate, approveCandidate, deleteCandidate };
