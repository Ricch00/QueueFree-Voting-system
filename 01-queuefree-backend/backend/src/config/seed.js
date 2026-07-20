const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const DB = process.env.DB_NAME || 'queuefree_db';

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: DB
  });

  try {
    const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123456', 12);
    await conn.query(
      `INSERT IGNORE INTO admins (name, email, password, role) VALUES (?, ?, ?, 'super_admin')`,
      [process.env.ADMIN_NAME || 'System Administrator', process.env.ADMIN_EMAIL || 'admin@queuefree.edu.gh', adminHash]
    );
    console.log('✅ Super admin:', process.env.ADMIN_EMAIL || 'admin@queuefree.edu.gh');

    const ecHash = await bcrypt.hash('Electoral@123', 12);
    await conn.query(
      `INSERT IGNORE INTO admins (name, email, password, role) VALUES (?, ?, ?, 'electoral_commission')`,
      ['Electoral Commission', 'ec@queuefree.edu.gh', ecHash]
    );
    console.log('✅ Electoral commission: ec@queuefree.edu.gh');

    const sHash = await bcrypt.hash('Student@123', 12);
    const students = [
      ['USTED/CS/001', 'Kwame Asante',  'kwame@usted.edu.gh',  'Computer Science',        '300', 'Comp. Science', 'Science'],
      ['USTED/IT/002', 'Ama Boateng',   'ama@usted.edu.gh',    'Information Technology',  '200', 'Comp. Science', 'Science'],
      ['USTED/BA/003', 'Kofi Mensah',   'kofi@usted.edu.gh',   'Business Administration', '400', 'Management',    'Business'],
    ];
    for (const [sid, name, email, program, level, dept, faculty] of students) {
      await conn.query(
        `INSERT IGNORE INTO students (student_id, full_name, email, password, program, level, department, faculty, verification_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified')`,
        [sid, name, email, sHash, program, level, dept, faculty]
      );
    }
    console.log('✅ Sample students (password: Student@123)');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin   : admin@queuefree.edu.gh  / Admin@123456');
    console.log('EC      : ec@queuefree.edu.gh     / Electoral@123');
    console.log('Student : kwame@usted.edu.gh          / Student@123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    console.error('❌ Seed error:', err.message);
  } finally {
    await conn.end();
  }
}

seed();
