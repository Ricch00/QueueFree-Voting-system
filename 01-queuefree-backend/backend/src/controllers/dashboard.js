const pool = require('../config/database');

const getDashboardStats = async (req, res) => {
  try {
    const [[students]] = await pool.query(`SELECT COUNT(*) as total, SUM(verification_status='verified') as verified, SUM(verification_status='pending') as pending, SUM(is_active=1) as active FROM students`);
    const [[elections]] = await pool.query(`SELECT COUNT(*) as total, SUM(status='active') as active, SUM(status='closed') as closed, SUM(status='draft') as draft FROM elections`);
    const [[votes]] = await pool.query('SELECT COUNT(*) as total FROM voter_records');
    const [recentActivity] = await pool.query('SELECT actor_type, actor_email, action, resource_type, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 15');
    const [activeElections] = await pool.query(`SELECT e.id, e.title, e.end_date, (SELECT COUNT(*) FROM voter_records WHERE election_id=e.id) as votes_cast, (SELECT COUNT(*) FROM voting_tokens WHERE election_id=e.id) as tokens_issued FROM elections e WHERE e.status='active' ORDER BY e.start_date`);
    const [turnoutChart] = await pool.query(`SELECT e.title, COUNT(vr.id) as votes FROM elections e LEFT JOIN voter_records vr ON e.id=vr.election_id WHERE e.status IN ('closed','results_published','active') GROUP BY e.id ORDER BY e.created_at DESC LIMIT 6`);
    res.json({ success: true, data: { students, elections, votes: votes.total, recent_activity: recentActivity, active_elections: activeElections, turnout_chart: turnoutChart } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed' }); }
};

const getLiveMonitoring = async (req, res) => {
  try {
    const { election_id } = req.params;
    const [election] = await pool.query('SELECT * FROM elections WHERE id = ?', [election_id]);
    if (!election.length) return res.status(404).json({ success: false, message: 'Not found' });
    const [[votes]] = await pool.query('SELECT COUNT(*) as count FROM voter_records WHERE election_id=?', [election_id]);
    const [[tokens]] = await pool.query('SELECT COUNT(*) as count FROM voting_tokens WHERE election_id=?', [election_id]);
    const [[used]] = await pool.query('SELECT COUNT(*) as count FROM voting_tokens WHERE election_id=? AND is_used=1', [election_id]);
    const [[eligible]] = await pool.query("SELECT COUNT(*) as count FROM students WHERE verification_status='verified' AND is_active=1");
    const [byHour] = await pool.query(`SELECT DATE_FORMAT(voted_at,'%Y-%m-%d %H:00') as hour, COUNT(*) as count FROM voter_records WHERE election_id=? GROUP BY hour ORDER BY hour`, [election_id]);
    const turnout = eligible.count > 0 ? ((votes.count / eligible.count) * 100).toFixed(1) : 0;
    res.json({ success: true, data: { election: election[0], stats: { votes_cast: votes.count, tokens_issued: tokens.count, tokens_used: used.count, total_eligible: eligible.count, turnout }, votes_by_hour: byHour } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, actor_type } = req.query;
    let where = 'WHERE 1=1'; const params = [];
    if (action) { where += ' AND action LIKE ?'; params.push(`%${action}%`); }
    if (actor_type) { where += ' AND actor_type = ?'; params.push(actor_type); }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [logs] = await pool.query(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`, params);
    const [[total]] = await pool.query(`SELECT COUNT(*) as count FROM audit_logs ${where}`, params);
    res.json({ success: true, data: logs, pagination: { total: total.count, page: parseInt(page), pages: Math.ceil(total.count / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const getNotifications = async (req, res) => {
  try {
    const student = req.student;
    const [rows] = await pool.query(
      `SELECT * FROM notifications WHERE target = 'all' OR (target = 'verified' AND ?) ORDER BY created_at DESC LIMIT 20`,
      [student.verification_status === 'verified' ? 1 : 0]
    );
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const createNotification = async (req, res) => {
  try {
    const { title, message, type, target, election_id } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, message: 'title and message required' });
    const [r] = await pool.query('INSERT INTO notifications (title, message, type, target, election_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [title, message, type || 'system', target || 'all', election_id || null, req.admin.id]);
    res.status(201).json({ success: true, message: 'Notification sent', data: { id: r.insertId } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const generateReport = async (req, res) => {
  try {
    const { election_id } = req.params;
    const [election] = await pool.query('SELECT * FROM elections WHERE id = ?', [election_id]);
    if (!election.length) return res.status(404).json({ success: false, message: 'Not found' });
    const [positions] = await pool.query('SELECT * FROM positions WHERE election_id=? ORDER BY sort_order', [election_id]);
    const results = [];
    for (const pos of positions) {
      const [candidates] = await pool.query(
        `SELECT c.id, c.nickname, s.full_name, s.student_id, s.program, s.level, COUNT(v.id) as vote_count
         FROM candidates c JOIN students s ON c.student_id=s.id LEFT JOIN votes v ON v.candidate_id=c.id AND v.election_id=?
         WHERE c.position_id=? AND c.election_id=? AND c.status='approved' GROUP BY c.id ORDER BY vote_count DESC`,
        [election_id, pos.id, election_id]);
      const total = candidates.reduce((s, c) => s + parseInt(c.vote_count), 0);
      results.push({ position: pos, candidates: candidates.map(c => ({ ...c, percentage: total > 0 ? ((c.vote_count / total) * 100).toFixed(1) : '0.0' })), total_votes: total });
    }
    const [[stats]] = await pool.query(`SELECT COUNT(DISTINCT student_id) as total_voters, (SELECT COUNT(*) FROM voting_tokens WHERE election_id=? AND is_used=1) as tokens_used, (SELECT COUNT(*) FROM students WHERE verification_status='verified' AND is_active=1) as eligible FROM voter_records WHERE election_id=?`, [election_id, election_id]);
    res.json({ success: true, data: { election: election[0], results, stats: { ...stats, turnout: stats.eligible > 0 ? ((stats.total_voters / stats.eligible) * 100).toFixed(2) : 0 }, generated_at: new Date() } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed' }); }
};

module.exports = { getDashboardStats, getLiveMonitoring, getAuditLogs, getNotifications, createNotification, generateReport };
