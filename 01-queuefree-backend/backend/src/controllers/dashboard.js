const pool = require('../config/database');

const getDashboardStats = async (req, res) => {
  try {
    const students = await pool.query(`SELECT COUNT(*) as total, SUM(CASE WHEN verification_status='verified' THEN 1 ELSE 0 END) as verified, SUM(CASE WHEN verification_status='pending' THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN is_active=true THEN 1 ELSE 0 END) as active FROM students`);
    const elections = await pool.query(`SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) as closed, SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) as draft FROM elections`);
    const votes = await pool.query('SELECT COUNT(*) as total FROM voter_records');
    const recentActivity = await pool.query('SELECT actor_type, actor_email, action, resource_type, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 15');
    const activeElections = await pool.query(`SELECT e.id, e.title, e.end_date, (SELECT COUNT(*) FROM voter_records WHERE election_id=e.id) as votes_cast, (SELECT COUNT(*) FROM voting_tokens WHERE election_id=e.id) as tokens_issued FROM elections e WHERE e.status='active' ORDER BY e.start_date`);
    const turnoutChart = await pool.query(`SELECT e.title, COUNT(vr.id) as votes FROM elections e LEFT JOIN voter_records vr ON e.id=vr.election_id WHERE e.status IN ('closed','results_published','active') GROUP BY e.id ORDER BY e.created_at DESC LIMIT 6`);
    res.json({ success: true, data: { students: students.rows[0], elections: elections.rows[0], votes: votes.rows[0].total, recent_activity: recentActivity, active_elections: activeElections, turnout_chart: turnoutChart } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed' }); }
};

const getLiveMonitoring = async (req, res) => {
  try {
    const { election_id } = req.params;
    const election = await pool.query('SELECT * FROM elections WHERE id = $1', [election_id]);
    if (!election.length) return res.status(404).json({ success: false, message: 'Not found' });
    const votes = await pool.query('SELECT COUNT(*) as count FROM voter_records WHERE election_id=$1', [election_id]);
    const tokens = await pool.query('SELECT COUNT(*) as count FROM voting_tokens WHERE election_id=$1', [election_id]);
    const used = await pool.query('SELECT COUNT(*) as count FROM voting_tokens WHERE election_id=$1 AND is_used=true', [election_id]);
    const eligible = await pool.query("SELECT COUNT(*) as count FROM students WHERE verification_status='verified' AND is_active=true");
    const byHour = await pool.query(`SELECT TO_CHAR(voted_at,'YYYY-MM-DD HH24:00') as hour, COUNT(*) as count FROM voter_records WHERE election_id=$1 GROUP BY hour ORDER BY hour`, [election_id]);
    const turnout = eligible.rows[0].count > 0 ? ((votes.rows[0].count / eligible.rows[0].count) * 100).toFixed(1) : 0;
    res.json({ success: true, data: { election: election[0], stats: { votes_cast: votes.rows[0].count, tokens_issued: tokens.rows[0].count, tokens_used: used.rows[0].count, total_eligible: eligible.rows[0].count, turnout }, votes_by_hour: byHour } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, actor_type } = req.query;
    let where = 'WHERE 1=1'; const params = [];
    let paramIndex = 1;
    if (action) { where += ` AND action LIKE $${paramIndex++}`; params.push(`%${action}%`); }
    if (actor_type) { where += ` AND actor_type = $${paramIndex++}`; params.push(actor_type); }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const logs = await pool.query(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`, params);
    const total = await pool.query(`SELECT COUNT(*) as count FROM audit_logs ${where}`, params);
    res.json({ success: true, data: logs, pagination: { total: total.rows[0].count, page: parseInt(page), pages: Math.ceil(total.rows[0].count / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const getNotifications = async (req, res) => {
  try {
    const student = req.student;
    const rows = await pool.query(
      `SELECT * FROM notifications WHERE target = 'all' OR (target = 'verified' AND $1) ORDER BY created_at DESC LIMIT 20`,
      [student.verification_status === 'verified' ? 1 : 0]
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const createNotification = async (req, res) => {
  try {
    const { title, message, type, target, election_id } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, message: 'title and message required' });
    const r = await pool.query('INSERT INTO notifications (title, message, type, target, election_id, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, message, type || 'system', target || 'all', election_id || null, req.admin.id]);
    res.status(201).json({ success: true, message: 'Notification sent', data: { id: r.rows[0].id } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const generateReport = async (req, res) => {
  try {
    const { election_id } = req.params;
    const election = await pool.query('SELECT * FROM elections WHERE id = $1', [election_id]);
    if (!election.length) return res.status(404).json({ success: false, message: 'Not found' });
    const positions = await pool.query('SELECT * FROM positions WHERE election_id=$1 ORDER BY sort_order', [election_id]);
    const results = [];
    for (const pos of positions) {
      const candidates = await pool.query(
        `SELECT c.id, c.nickname, s.full_name, s.student_id, s.program, s.level, COUNT(v.id) as vote_count
         FROM candidates c JOIN students s ON c.student_id=s.id LEFT JOIN votes v ON v.candidate_id=c.id AND v.election_id=$1
         WHERE c.position_id=$2 AND c.election_id=$3 AND c.status='approved' GROUP BY c.id ORDER BY vote_count DESC`,
        [election_id, pos.id, election_id]);
      const total = candidates.reduce((s, c) => s + parseInt(c.vote_count), 0);
      results.push({ position: pos, candidates: candidates.map(c => ({ ...c, percentage: total > 0 ? ((c.vote_count / total) * 100).toFixed(1) : '0.0' })), total_votes: total });
    }
    const stats = await pool.query(`SELECT COUNT(DISTINCT student_id) as total_voters, (SELECT COUNT(*) FROM voting_tokens WHERE election_id=$1 AND is_used=true) as tokens_used, (SELECT COUNT(*) FROM students WHERE verification_status='verified' AND is_active=true) as eligible FROM voter_records WHERE election_id=$2`, [election_id, election_id]);
    res.json({ success: true, data: { election: election[0], results, stats: { ...stats.rows[0], turnout: stats.rows[0].eligible > 0 ? ((stats.rows[0].total_voters / stats.rows[0].eligible) * 100).toFixed(2) : 0 }, generated_at: new Date() } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed' }); }
};

module.exports = { getDashboardStats, getLiveMonitoring, getAuditLogs, getNotifications, createNotification, generateReport };
