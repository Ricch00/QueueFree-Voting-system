const mysql = require('mysql2/promise');
require('dotenv').config();

const DB = process.env.DB_NAME || 'queuefree_db';

async function migrate() {
  // Connect WITHOUT database first to create it
  const init = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });
  await init.query(`CREATE DATABASE IF NOT EXISTS \`${DB}\``);
  console.log(`📦 Database '${DB}' ready`);
  await init.end();

  // Reconnect WITH database selected
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: DB
  });

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('super_admin','admin','electoral_commission') DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        last_login DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ admins');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id VARCHAR(20) UNIQUE NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        program VARCHAR(100),
        level ENUM('100','200','300','400','500','600','postgrad') DEFAULT '100',
        department VARCHAR(100),
        faculty VARCHAR(100),
        hall VARCHAR(100),
        profile_photo VARCHAR(255),
        verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
        verification_note TEXT,
        verified_by INT,
        verified_at DATETIME,
        is_active BOOLEAN DEFAULT TRUE,
        login_attempts INT DEFAULT 0,
        locked_until DATETIME,
        device_fingerprint VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (verified_by) REFERENCES admins(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ students');

    // Add columns if they don't exist (MySQL doesn't support IF NOT EXISTS in ALTER TABLE)
    const [columns] = await conn.query("SHOW COLUMNS FROM students");
    const columnNames = columns.map(c => c.Field);
    
    if (!columnNames.includes('id_photo_url')) {
      await conn.query("ALTER TABLE students ADD COLUMN id_photo_url VARCHAR(255) AFTER profile_photo");
    }
    if (!columnNames.includes('selfie_url')) {
      await conn.query("ALTER TABLE students ADD COLUMN selfie_url VARCHAR(255) AFTER id_photo_url");
    }
    if (!columnNames.includes('face_match_score')) {
      await conn.query("ALTER TABLE students ADD COLUMN face_match_score DECIMAL(5,2) DEFAULT NULL AFTER verified_at");
    }
    if (!columnNames.includes('face_match_status')) {
      await conn.query("ALTER TABLE students ADD COLUMN face_match_status ENUM('pending','matched','mismatch') DEFAULT 'pending' AFTER face_match_score");
    }
    if (!columnNames.includes('hall')) {
      await conn.query("ALTER TABLE students ADD COLUMN hall VARCHAR(100) AFTER faculty");
    }
    
    // Check candidates table for photo_url column
    const [candidateColumns] = await conn.query("SHOW COLUMNS FROM candidates");
    const candidateColumnNames = candidateColumns.map(c => c.Field);
    
    if (!candidateColumnNames.includes('photo_url')) {
      await conn.query("ALTER TABLE candidates ADD COLUMN photo_url VARCHAR(255) AFTER nickname");
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS elections (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        academic_year VARCHAR(20) NOT NULL,
        semester ENUM('first','second','summer') DEFAULT 'first',
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        status ENUM('draft','published','active','closed','results_published') DEFAULT 'draft',
        allow_all_students BOOLEAN DEFAULT TRUE,
        created_by INT,
        published_at DATETIME,
        closed_at DATETIME,
        results_published_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ elections');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        election_id INT NOT NULL,
        title VARCHAR(150) NOT NULL,
        description TEXT,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ positions');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        election_id INT NOT NULL,
        position_id INT NOT NULL,
        student_id INT NOT NULL,
        manifesto TEXT,
        nickname VARCHAR(100),
        photo_url VARCHAR(255),
        status ENUM('pending','approved','rejected','disqualified') DEFAULT 'pending',
        approved_by INT,
        approved_at DATETIME,
        rejection_reason TEXT,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_candidate (election_id, position_id, student_id),
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
        FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES admins(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ candidates');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS voting_tokens (
        id INT PRIMARY KEY AUTO_INCREMENT,
        token VARCHAR(255) UNIQUE NOT NULL,
        student_id INT NOT NULL,
        election_id INT NOT NULL,
        device_fingerprint VARCHAR(255) NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        used_at DATETIME,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_student_election (student_id, election_id),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ voting_tokens');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        election_id INT NOT NULL,
        position_id INT NOT NULL,
        candidate_id INT NOT NULL,
        token_id INT NOT NULL,
        vote_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
        FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
        FOREIGN KEY (token_id) REFERENCES voting_tokens(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ votes');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS voter_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id INT NOT NULL,
        election_id INT NOT NULL,
        device_fingerprint VARCHAR(255) NOT NULL,
        voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        UNIQUE KEY unique_voter (student_id, election_id),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ voter_records');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS device_registry (
        id INT PRIMARY KEY AUTO_INCREMENT,
        device_fingerprint VARCHAR(255) UNIQUE NOT NULL,
        first_student_id INT NOT NULL,
        is_blocked BOOLEAN DEFAULT FALSE,
        elections_voted TEXT,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (first_student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ device_registry');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('election_open','election_close','results','system','verification') DEFAULT 'system',
        target ENUM('all','verified','specific') DEFAULT 'all',
        election_id INT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ notifications');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        actor_type ENUM('admin','student','system') NOT NULL,
        actor_id INT,
        actor_email VARCHAR(150),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id INT,
        details TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ audit_logs');

    console.log('\n🎉 All tables created successfully!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    await conn.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
