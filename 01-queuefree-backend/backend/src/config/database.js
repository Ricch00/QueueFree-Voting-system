require('dotenv').config();
const { Pool } = require('pg');

// Validate required env vars
const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('   Please edit your .env file and fill in all required values.\n');
  process.exit(1);
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('\n❌ JWT_SECRET must be at least 32 characters long.');
  console.error('   Please set a strong JWT_SECRET in your .env file.\n');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

pool.connect()
  .then(conn => {
    console.log(`✅ PostgreSQL connected to '${process.env.DB_NAME}' on ${process.env.DB_HOST}`);
    conn.release();
  })
  .catch(err => {
    console.error(`\n❌ PostgreSQL connection failed: ${err.message}`);
    console.error('   Check your .env DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
    console.error('   Make sure PostgreSQL is running.\n');
    process.exit(1);
  });

module.exports = pool;
