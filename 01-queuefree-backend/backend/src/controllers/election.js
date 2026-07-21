const crypto = require('crypto');
const pool = require('../config/database');
const { auditLog } = require('../middleware/audit');

// ── ADMIN ──────────────────────────────────────────────────────────────────
const createElection = async (req, res) => {
  try {
    const { title, description, academic_year, semester, start_date, end_date, allow_all_students, eligible_halls, eligible_departments, eligible_faculties, eligible_programs, eligible_levels } = req.body;
    if (!title || !academic_year || !start_date || !end_date) return res.status(400).json({ success: false, message: 'title, academic_year, start_date and end_date are required' });
    const r = await pool.query(
      'INSERT INTO elections (title, description, academic_year, semester, start_date, end_date, allow_all_students, eligible_halls, eligible_departments, eligible_faculties, eligible_programs, eligible_levels, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id',
      [title, description || null, academic_year, semester || 'first', start_date, end_date, allow_all_students !== false ? true : false, eligible_halls ? JSON.stringify(eligible_halls) : null, eligible_departments ? JSON.stringify(eligible_departments) : null, eligible_faculties ? JSON.stringify(eligible_faculties) : null, eligible_programs ? JSON.stringify(eligible_programs) : null, eligible_levels ? JSON.stringify(eligible_levels) : null, req.admin.id]
    );
    await auditLog({ actorType: 'admin', actorId: req.admin.id, actorEmail: req.admin.email, action: 'CREATE_ELECTION', resourceType: 'election', resourceId: r.rows[0].id, req });
    res.status(201).json({ success: true, message: 'Election created', data: { id: r.rows[0].id } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to create election' }); }
};

const getAllElections = async (req, res) => {
  try {
    const rows = await pool.query(`
      SELECT e.*, a.name as created_by_name,
        (SELECT COUNT(*) FROM positions WHERE election_id = e.id) as position_count,
        (SELECT COUNT(*) FROM candidates WHERE election_id = e.id AND status = 'approved') as candidate_count,
        (SELECT COUNT(*) FROM voter_records WHERE election_id = e.id) as vote_count
      FROM elections e LEFT JOIN admins a ON e.created_by = a.id ORDER BY e.created_at DESC`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const getElectionById = async (req, res) => {
  try {
    const elections = await pool.query('SELECT e.*, a.name as created_by_name FROM elections e LEFT JOIN admins a ON e.created_by = a.id WHERE e.id = $1', [req.params.id]);
    if (!elections.length) return res.status(404).json({ success: false, message: 'Election not found' });
    const positions = await pool.query('SELECT p.*, (SELECT COUNT(*) FROM candidates WHERE position_id = p.id AND status=$1) as candidate_count FROM positions p WHERE p.election_id = $2 ORDER BY p.sort_order', ['approved', req.params.id]);
    res.json({ success: true, data: { ...elections[0], positions } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const updateElection = async (req, res) => {
  try {
    const { title, description, academic_year, semester, start_date, end_date, allow_all_students, eligible_halls, eligible_departments, eligible_faculties, eligible_programs, eligible_levels } = req.body;
    const ex = await pool.query('SELECT status FROM elections WHERE id = $1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (['active', 'closed'].includes(ex[0].status)) return res.status(400).json({ success: false, message: 'Cannot edit active or closed election' });
    await pool.query('UPDATE elections SET title=$1, description=$2, academic_year=$3, semester=$4, start_date=$5, end_date=$6, allow_all_students=$7, eligible_halls=$8, eligible_departments=$9, eligible_faculties=$10, eligible_programs=$11, eligible_levels=$12 WHERE id=$13',
      [title, description, academic_year, semester, start_date, end_date, allow_all_students !== false ? true : false, eligible_halls ? JSON.stringify(eligible_halls) : null, eligible_departments ? JSON.stringify(eligible_departments) : null, eligible_faculties ? JSON.stringify(eligible_faculties) : null, eligible_programs ? JSON.stringify(eligible_programs) : null, eligible_levels ? JSON.stringify(eligible_levels) : null, req.params.id]);
    res.json({ success: true, message: 'Updated' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const updateElectionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['draft', 'published', 'active', 'closed', 'results_published'];
    if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    let extra = '';
    if (status === 'published') extra = ', published_at = NOW()';
    if (status === 'closed') extra = ', closed_at = NOW()';
    if (status === 'results_published') extra = ', results_published_at = NOW()';
    await pool.query(`UPDATE elections SET status = $1${extra} WHERE id = $2`, [status, req.params.id]);
    if (status === 'active') await generateTokens(req.params.id);
    await auditLog({ actorType: 'admin', actorId: req.admin.id, actorEmail: req.admin.email, action: `ELECTION_${status.toUpperCase()}`, resourceType: 'election', resourceId: req.params.id, req });
    res.json({ success: true, message: `Election ${status}` });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed' }); }
};

const generateTokens = async (electionId) => {
  try {
    const elections = await pool.query('SELECT * FROM elections WHERE id = $1', [electionId]);
    if (!elections.length) return;
    const e = elections[0];
    
    let whereClause = "WHERE verification_status = 'verified' AND is_active = true AND device_fingerprint IS NOT NULL";
    const params = [];
    
    // Apply eligibility filters if not allowing all students
    if (!e.allow_all_students) {
      if (e.eligible_halls) {
        const halls = JSON.parse(e.eligible_halls);
        if (halls.length > 0) {
          whereClause += ' AND hall IN (' + halls.map((_, i) => `$${params.length + i + 1}`).join(',') + ')';
          params.push(...halls);
        }
      }
      if (e.eligible_departments) {
        const departments = JSON.parse(e.eligible_departments);
        if (departments.length > 0) {
          whereClause += ' AND department IN (' + departments.map((_, i) => `$${params.length + i + 1}`).join(',') + ')';
          params.push(...departments);
        }
      }
      if (e.eligible_faculties) {
        const faculties = JSON.parse(e.eligible_faculties);
        if (faculties.length > 0) {
          whereClause += ' AND faculty IN (' + faculties.map((_, i) => `$${params.length + i + 1}`).join(',') + ')';
          params.push(...faculties);
        }
      }
      if (e.eligible_programs) {
        const programs = JSON.parse(e.eligible_programs);
        if (programs.length > 0) {
          whereClause += ' AND program IN (' + programs.map((_, i) => `$${params.length + i + 1}`).join(',') + ')';
          params.push(...programs);
        }
      }
      if (e.eligible_levels) {
        const levels = JSON.parse(e.eligible_levels);
        if (levels.length > 0) {
          whereClause += ' AND level IN (' + levels.map((_, i) => `$${params.length + i + 1}`).join(',') + ')';
          params.push(...levels);
        }
      }
    }
    
    const students = await pool.query(
      `SELECT id, device_fingerprint FROM students ${whereClause}
       AND id NOT IN (SELECT student_id FROM voting_tokens WHERE election_id = $1)`,
      [...params, electionId]
    );
    
    for (const s of students) {
      const token = crypto.randomBytes(32).toString('hex');
      try {
        await pool.query('INSERT INTO voting_tokens (token, student_id, election_id, device_fingerprint, expires_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (student_id, election_id) DO NOTHING',
          [token, s.id, electionId, s.device_fingerprint, e.end_date]);
      } catch (_) {}
    }
    console.log(`✅ Generated ${students.length} tokens for election ${electionId}`);
  } catch (err) { console.error('Token generation error:', err.message); }
};

const deleteElection = async (req, res) => {
  try {
    const ex = await pool.query('SELECT status FROM elections WHERE id = $1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (ex[0].status === 'active') return res.status(400).json({ success: false, message: 'Cannot delete active election' });
    await pool.query('DELETE FROM elections WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

// ── POSITIONS ──────────────────────────────────────────────────────────────
const createPosition = async (req, res) => {
  try {
    const { title, description, sort_order } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });
    const r = await pool.query('INSERT INTO positions (election_id, title, description, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.params.id, title, description || null, sort_order || 0]);
    res.status(201).json({ success: true, message: 'Position created', data: { id: r.rows[0].id } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const updatePosition = async (req, res) => {
  try {
    const { title, description, sort_order } = req.body;
    await pool.query('UPDATE positions SET title=$1, description=$2, sort_order=$3 WHERE id=$4 AND election_id=$5',
      [title, description, sort_order || 0, req.params.positionId, req.params.id]);
    res.json({ success: true, message: 'Updated' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const deletePosition = async (req, res) => {
  try {
    await pool.query('DELETE FROM positions WHERE id=$1 AND election_id=$2', [req.params.positionId, req.params.id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

// ── STUDENT ────────────────────────────────────────────────────────────────
const getStudentElections = async (req, res) => {
  try {
    const rows = await pool.query(`
      SELECT e.id, e.title, e.description, e.academic_year, e.semester, e.start_date, e.end_date, e.status,
        (SELECT COUNT(*) FROM voter_records WHERE election_id = e.id) as total_votes,
        (SELECT COUNT(*) FROM students WHERE verification_status='verified' AND is_active=true) as total_eligible,
        (SELECT COUNT(*) FROM positions WHERE election_id = e.id) as position_count,
        (SELECT COUNT(*) FROM candidates WHERE election_id = e.id AND status='approved') as candidate_count,
        EXISTS(SELECT 1 FROM voter_records WHERE election_id = e.id AND student_id = $1) as has_voted,
        EXISTS(SELECT 1 FROM voting_tokens WHERE election_id = e.id AND student_id = $2 AND is_used = false AND expires_at > NOW()) as has_active_token
      FROM elections e WHERE e.status IN ('active','closed','results_published') ORDER BY e.start_date DESC`,
      [req.student.id, req.student.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed' }); }
};

const getElectionCandidates = async (req, res) => {
  try {
    const positions = await pool.query('SELECT * FROM positions WHERE election_id = $1 ORDER BY sort_order', [req.params.id]);
    for (const pos of positions) {
      const candidates = await pool.query(
        `SELECT c.id, c.manifesto, c.nickname, s.full_name, s.student_id as student_number, s.program, s.level, s.profile_photo
         FROM candidates c JOIN students s ON c.student_id = s.id
         WHERE c.position_id = $1 AND c.election_id = $2 AND c.status = 'approved' ORDER BY c.sort_order`,
        [pos.id, req.params.id]
      );
      pos.candidates = candidates;
    }
    res.json({ success: true, data: positions });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

module.exports = {
  createElection, getAllElections, getElectionById, updateElection, updateElectionStatus, deleteElection,
  createPosition, updatePosition, deletePosition,
  getStudentElections, getElectionCandidates
};
