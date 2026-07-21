const { Pool } = require('pg');
require('dotenv').config();

const DB = process.env.DB_NAME || 'queuefree_db';

async function migrate() {
  // Connect WITHOUT database first to create it
  const init = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'postgres'
  });
  
  try {
    await init.query(`CREATE DATABASE "${DB}"`);
    console.log(`📦 Database '${DB}' created`);
  } catch (err) {
    if (err.code === '42P04') {
      console.log(`📦 Database '${DB}' already exists`);
    } else {
      throw err;
    }
  }
  await init.end();

  // Reconnect WITH database selected
  const conn = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: DB
  });

  try {
    // Create ENUM types
    await conn.query(`DO $$ BEGIN
      CREATE TYPE admin_role AS ENUM ('super_admin','admin','electoral_commission');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);

    await conn.query(`DO $$ BEGIN
      CREATE TYPE student_level AS ENUM ('100','200','300','400','500','600','postgrad');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);

    await conn.query(`DO $$ BEGIN
      CREATE TYPE verification_status AS ENUM ('pending','verified','rejected');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);

    await conn.query(`DO $$ BEGIN
      CREATE TYPE semester_type AS ENUM ('first','second','summer');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);

    await conn.query(`DO $$ BEGIN
      CREATE TYPE election_status AS ENUM ('draft','published','active','closed','results_published');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);

    await conn.query(`DO $$ BEGIN
      CREATE TYPE candidate_status AS ENUM ('pending','approved','rejected','disqualified');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);

    await conn.query(`DO $$ BEGIN
      CREATE TYPE notification_type AS ENUM ('election_open','election_close','results','system','verification');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);

    await conn.query(`DO $$ BEGIN
      CREATE TYPE notification_target AS ENUM ('all','verified','specific');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);

    await conn.query(`DO $$ BEGIN
      CREATE TYPE actor_type AS ENUM ('admin','student','system');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);

    await conn.query(`DO $$ BEGIN
      CREATE TYPE face_match_status AS ENUM ('pending','matched','mismatch');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role admin_role DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ admins');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(20) UNIQUE NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        program VARCHAR(100),
        level student_level DEFAULT '100',
        department VARCHAR(100),
        faculty VARCHAR(100),
        hall VARCHAR(100),
        profile_photo VARCHAR(255),
        id_photo_url VARCHAR(255),
        selfie_url VARCHAR(255),
        verification_status verification_status DEFAULT 'pending',
        verification_note TEXT,
        verified_by INT REFERENCES admins(id) ON DELETE SET NULL,
        verified_at TIMESTAMP,
        face_match_score DECIMAL(5,2),
        face_match_status face_match_status DEFAULT 'pending',
        is_active BOOLEAN DEFAULT TRUE,
        login_attempts INT DEFAULT 0,
        locked_until TIMESTAMP,
        device_fingerprint VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ students');


    await conn.query(`
      CREATE TABLE IF NOT EXISTS elections (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        academic_year VARCHAR(20) NOT NULL,
        semester semester_type DEFAULT 'first',
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        status election_status DEFAULT 'draft',
        allow_all_students BOOLEAN DEFAULT TRUE,
        eligible_halls TEXT,
        eligible_departments TEXT,
        eligible_faculties TEXT,
        eligible_programs TEXT,
        eligible_levels TEXT,
        created_by INT REFERENCES admins(id) ON DELETE SET NULL,
        published_at TIMESTAMP,
        closed_at TIMESTAMP,
        results_published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ elections');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        election_id INT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
        title VARCHAR(150) NOT NULL,
        description TEXT,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ positions');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY,
        election_id INT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
        position_id INT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        manifesto TEXT,
        nickname VARCHAR(100),
        photo_url VARCHAR(255),
        status candidate_status DEFAULT 'pending',
        approved_by INT REFERENCES admins(id) ON DELETE SET NULL,
        approved_at TIMESTAMP,
        rejection_reason TEXT,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (election_id, position_id, student_id)
      )
    `);
    console.log('✅ candidates');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS voting_tokens (
        id SERIAL PRIMARY KEY,
        token VARCHAR(255) UNIQUE NOT NULL,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        election_id INT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
        device_fingerprint VARCHAR(255) NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        used_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, election_id)
      )
    `);
    console.log('✅ voting_tokens');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        election_id INT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
        position_id INT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
        candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        token_id INT NOT NULL REFERENCES voting_tokens(id) ON DELETE CASCADE,
        vote_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ votes');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS voter_records (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        election_id INT NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
        device_fingerprint VARCHAR(255) NOT NULL,
        voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        UNIQUE (student_id, election_id)
      )
    `);
    console.log('✅ voter_records');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS device_registry (
        id SERIAL PRIMARY KEY,
        device_fingerprint VARCHAR(255) UNIQUE NOT NULL,
        first_student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        is_blocked BOOLEAN DEFAULT FALSE,
        elections_voted TEXT,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ device_registry');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type notification_type DEFAULT 'system',
        target notification_target DEFAULT 'all',
        election_id INT REFERENCES elections(id) ON DELETE SET NULL,
        created_by INT REFERENCES admins(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ notifications');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        actor_type actor_type NOT NULL,
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
