require('dotenv').config();
const express  = require('express');
const http     = require('http');
const path     = require('path');
const { Server } = require('socket.io');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const rateLimit = require('express-rate-limit');
const routes   = require('./routes');
const pool     = require('./config/database');

const app    = express();
app.set('trust proxy', false);
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

// ── MIDDLEWARE ─────────────────────────────────────────────────────────────
app.use(cors({ 
  origin: ['http://localhost:3000'], 
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// app.use(helmet({ 
//   contentSecurityPolicy: false,
//   crossOriginEmbedderPolicy: false 
// }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
  }
  next(err);
});
app.use(morgan('dev'));

const limiter     = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, trustProxy: true });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, trustProxy: true });
app.use('/api/', limiter);
app.use('/api/student/login',  authLimiter);
app.use('/api/admin/login',    authLimiter);

// ── ROUTES ─────────────────────────────────────────────────────────────────
app.use('/api', routes);
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date(), version: '1.0.0' }));
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ success: false, message: 'Internal server error' }); });

// ── SOCKET.IO ──────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('join_election', (id) => socket.join(`election_${id}`));
});

// Broadcast live vote counts every 5 seconds
setInterval(async () => {
  try {
    const active = await pool.query("SELECT id FROM elections WHERE status = 'active'");
    for (const e of active) {
      const stats = await pool.query('SELECT COUNT(*) as count FROM voter_records WHERE election_id = $1', [e.id]);
      io.to(`election_${e.id}`).emit('vote_update', { election_id: e.id, votes_cast: stats.rows[0].count, timestamp: new Date() });
    }
  } catch (_) {}
}, 5000);

// ── START ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// Handle EADDRINUSE error by killing existing process on the port
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use. Attempting to free the port...`);
    const { exec } = require('child_process');
    if (process.platform === 'win32') {
      exec(`netstat -ano | findstr :${PORT}`, (error, stdout) => {
        if (!error && stdout) {
          const lines = stdout.trim().split('\n');
          const line = lines.find(l => l.includes('LISTENING'));
          if (line) {
            const pid = line.trim().split(/\s+/)[4];
            if (pid) {
              exec(`taskkill /F /PID ${pid}`, (killError) => {
                if (!killError) {
                  console.log(`✅ Killed process ${pid} on port ${PORT}. Retrying...`);
                  setTimeout(() => server.listen(PORT), 1000);
                } else {
                  console.error('❌ Failed to kill process:', killError);
                  process.exit(1);
                }
              });
            }
          }
        }
      });
    } else {
      exec(`lsof -ti:${PORT} | xargs kill -9`, (error) => {
        if (!error) {
          console.log(`✅ Killed process on port ${PORT}. Retrying...`);
          setTimeout(() => server.listen(PORT), 1000);
        } else {
          console.error('❌ Failed to kill process:', error);
          process.exit(1);
        }
      });
    }
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 QueueFree Server running on http://localhost:${PORT}`);
  console.log(`🌐 API: http://localhost:${PORT}/api`);
  console.log(`❤️  Health: http://localhost:${PORT}/health\n`);
});
