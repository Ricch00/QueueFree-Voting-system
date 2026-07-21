const crypto = require('crypto');
const pool = require('../config/database');
const { auditLog } = require('../middleware/audit');

const getVotingToken = async (req, res) => {
  try {
    const { election_id } = req.params;
    const student = req.student;

    if (student.verification_status !== 'verified')
      return res.status(403).json({ success: false, message: 'Your account must be verified before you can vote' });

    const elections = await pool.query("SELECT * FROM elections WHERE id = $1 AND status = 'active'", [election_id]);
    if (!elections.length) return res.status(404).json({ success: false, message: 'Election not active' });
    if (new Date() > new Date(elections[0].end_date)) return res.status(400).json({ success: false, message: 'Election has ended' });

    const voted = await pool.query('SELECT id FROM voter_records WHERE student_id = $1 AND election_id = $2', [student.id, election_id]);
    if (voted.length) return res.status(400).json({ success: false, message: 'You have already voted', already_voted: true });

    const tokens = await pool.query('SELECT * FROM voting_tokens WHERE student_id = $1 AND election_id = $2 AND is_used = false AND expires_at > NOW()', [student.id, election_id]);
    if (tokens.length) return res.json({ success: true, data: { token: tokens[0].token, election_id: parseInt(election_id), expires_at: tokens[0].expires_at } });

    if (!student.device_fingerprint) return res.status(400).json({ success: false, message: 'No device registered to your account' });

    const newToken = crypto.randomBytes(32).toString('hex');
    await pool.query('INSERT INTO voting_tokens (token, student_id, election_id, device_fingerprint, expires_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (student_id, election_id) DO NOTHING',
      [newToken, student.id, election_id, student.device_fingerprint, elections[0].end_date]);

    res.json({ success: true, data: { token: newToken, election_id: parseInt(election_id), expires_at: elections[0].end_date } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to get voting token' }); }
};

const castVote = async (req, res) => {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const { election_id, voting_token, votes } = req.body;
    const student = req.student;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

    if (student.verification_status !== 'verified') {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Account not verified' });
    }

    if (!votes || !Array.isArray(votes) || votes.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'No votes provided' });
    }

    // Lock the token row
    const tokens = await conn.query('SELECT * FROM voting_tokens WHERE token = $1 AND student_id = $2 AND election_id = $3 FOR UPDATE', [voting_token, student.id, election_id]);
    if (!tokens.length) { await conn.rollback(); return res.status(400).json({ success: false, message: 'Invalid voting token' }); }

    const tokenRow = tokens[0];
    if (tokenRow.is_used) { await conn.rollback(); return res.status(400).json({ success: false, message: 'Voting token already used' }); }
    if (new Date(tokenRow.expires_at) < new Date()) { await conn.rollback(); return res.status(400).json({ success: false, message: 'Voting token expired' }); }

    // Verify device
    const deviceFP = req.headers['x-device-fingerprint'] || student.device_fingerprint;
    if (tokenRow.device_fingerprint !== deviceFP && tokenRow.device_fingerprint !== student.device_fingerprint) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Device mismatch. Vote rejected.' });
    }

    // Check election active
    const elections = await conn.query("SELECT * FROM elections WHERE id = $1 AND status = 'active'", [election_id]);
    if (!elections.length) { await conn.rollback(); return res.status(400).json({ success: false, message: 'Election not active' }); }

    // Check not already voted
    const alreadyVoted = await conn.query('SELECT id FROM voter_records WHERE student_id = $1 AND election_id = $2', [student.id, election_id]);
    if (alreadyVoted.length) { await conn.rollback(); return res.status(400).json({ success: false, message: 'Already voted' }); }

    // Validate candidates
    for (const vote of votes) {
      const check = await conn.query("SELECT id FROM candidates WHERE id = $1 AND position_id = $2 AND election_id = $3 AND status = 'approved'",
        [vote.candidate_id, vote.position_id, election_id]);
      if (!check.length) { await conn.rollback(); return res.status(400).json({ success: false, message: `Invalid candidate ${vote.candidate_id}` }); }
    }

    // Mark token used
    await conn.query('UPDATE voting_tokens SET is_used = true, used_at = NOW() WHERE id = $1', [tokenRow.id]);

    // Record voter participation (anonymised - no link to what they voted)
    await conn.query('INSERT INTO voter_records (student_id, election_id, device_fingerprint, ip_address) VALUES ($1, $2, $3, $4)',
      [student.id, election_id, student.device_fingerprint || '', ip.substring(0, 45)]);

    // Store votes with hash (no direct link to student)
    const voteHash = crypto.createHash('sha256').update(`${student.id}-${election_id}-${Date.now()}-${Math.random()}`).digest('hex');
    for (const vote of votes) {
      await conn.query('INSERT INTO votes (election_id, position_id, candidate_id, token_id, vote_hash) VALUES ($1, $2, $3, $4, $5)',
        [election_id, vote.position_id, vote.candidate_id, tokenRow.id, voteHash]);
    }

    // Update device registry
    if (student.device_fingerprint) {
      const devReg = await conn.query('SELECT elections_voted FROM device_registry WHERE device_fingerprint = $1', [student.device_fingerprint]);
      if (devReg.length) {
        let voted = [];
        try { voted = JSON.parse(devReg[0].elections_voted || '[]'); } catch (_) {}
        if (!voted.includes(parseInt(election_id))) {
          voted.push(parseInt(election_id));
          await conn.query('UPDATE device_registry SET elections_voted = $1 WHERE device_fingerprint = $2', [JSON.stringify(voted), student.device_fingerprint]);
        }
      }
    }

    await conn.query('COMMIT');
    await auditLog({ actorType: 'student', actorId: student.id, actorEmail: student.email, action: 'CAST_VOTE', resourceType: 'election', resourceId: election_id, req });
    res.json({ success: true, message: 'Your vote has been cast successfully!' });
  } catch (err) {
    await conn.query('ROLLBACK');
    console.error('Cast vote error:', err);
    res.status(500).json({ success: false, message: 'Failed to cast vote. Please try again.' });
  } finally {
    conn.release();
  }
};

const getResults = async (req, res) => {
  try {
    const { election_id } = req.params;
    const elections = await pool.query('SELECT * FROM elections WHERE id = $1', [election_id]);
    if (!elections.length) return res.status(404).json({ success: false, message: 'Election not found' });
    const election = elections[0];

    if (election.status !== 'results_published') {
      const voted = await pool.query('SELECT id FROM voter_records WHERE student_id = $1 AND election_id = $2', [req.student.id, election_id]);
      if (!voted.length) return res.status(403).json({ success: false, message: 'You must vote before viewing results', must_vote_first: true });
    }

    const results = await buildResults(election_id);
    const stats = await pool.query('SELECT COUNT(*) as total_votes FROM voter_records WHERE election_id = $1', [election_id]);
    const eligible = await pool.query("SELECT COUNT(*) as total_eligible FROM students WHERE verification_status='verified' AND is_active=true");
    const turnout = eligible.rows[0].total_eligible > 0 ? ((stats.rows[0].total_votes / eligible.rows[0].total_eligible) * 100).toFixed(1) : 0;

    res.json({ success: true, data: { election, results, stats: { total_votes: stats.rows[0].total_votes, total_eligible: eligible.rows[0].total_eligible, turnout } } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed' }); }
};

const adminGetResults = async (req, res) => {
  try {
    const { election_id } = req.params;
    const results = await buildResults(election_id);
    const votes = await pool.query('SELECT COUNT(*) as count FROM voter_records WHERE election_id = $1', [election_id]);
    const tokens = await pool.query('SELECT COUNT(*) as count FROM voting_tokens WHERE election_id = $1 AND is_used=true', [election_id]);
    res.json({ success: true, data: { results, stats: { votes_cast: votes.rows[0].count, tokens_used: tokens.rows[0].count } } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

const buildResults = async (election_id) => {
  const positions = await pool.query('SELECT * FROM positions WHERE election_id = $1 ORDER BY sort_order', [election_id]);
  const results = [];
  for (const pos of positions) {
    const candidates = await pool.query(
      `SELECT c.id, c.nickname, s.full_name, s.student_id, s.program, s.level, COUNT(v.id) as vote_count
       FROM candidates c JOIN students s ON c.student_id = s.id
       LEFT JOIN votes v ON v.candidate_id = c.id AND v.election_id = $1
       WHERE c.position_id = $2 AND c.election_id = $3 AND c.status = 'approved'
       GROUP BY c.id ORDER BY vote_count DESC`,
      [election_id, pos.id, election_id]
    );
    const total = candidates.reduce((s, c) => s + parseInt(c.vote_count), 0);
    results.push({
      position: pos,
      candidates: candidates.map(c => ({ ...c, percentage: total > 0 ? ((c.vote_count / total) * 100).toFixed(1) : '0.0' })),
      total_votes: total
    });
  }
  return results;
};

const checkVotingStatus = async (req, res) => {
  try {
    const { election_id } = req.params;
    const voted = await pool.query('SELECT voted_at FROM voter_records WHERE student_id = $1 AND election_id = $2', [req.student.id, election_id]);
    const token = await pool.query('SELECT token, is_used, expires_at FROM voting_tokens WHERE student_id = $1 AND election_id = $2', [req.student.id, election_id]);
    res.json({ success: true, data: { has_voted: voted.length > 0, voted_at: voted[0]?.voted_at || null, has_token: token.length > 0, token_used: token[0]?.is_used || false } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed' }); }
};

module.exports = { getVotingToken, castVote, getResults, adminGetResults, checkVotingStatus };
