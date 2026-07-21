const pool = require('../config/database');

const auditLog = async ({ actorType, actorId, actorEmail, action, resourceType, resourceId, details, req }) => {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '';
    await pool.query(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_email, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [actorType, actorId || null, actorEmail || null, action, resourceType || null, resourceId || null,
       details ? JSON.stringify(details) : null, ip.substring(0, 45)]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

module.exports = { auditLog };
