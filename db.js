require('dotenv').config();
const path = require('path');
const bcrypt = require('bcryptjs');

let db = null;
let runAsync = null;
let allAsync = null;
let getAsync = null;
let initDB = null;

// Helper to ensure IPv4 compatibility on cloud hosts (e.g. Render free tier)
function formatSupabaseUrl(url) {
  if (!url) return '';
  const cleanUrl = url.trim();

  if (cleanUrl.includes('[YOUR-PASSWORD]')) {
    console.error('⚠️ CRITICAL: DATABASE_URL contains "[YOUR-PASSWORD]". Please replace it with your real Supabase password in Render environment variables!');
  }

  // Direct Supabase hostname (db.<project>.supabase.co:5432) resolves only to IPv6!
  // Cloud providers without IPv6 (like Render free tier) fail with ENETUNREACH.
  // We automatically rewrite to Supabase's IPv4 Connection Pooler (port 6543).
  // Project nwcbmyntxijmcnzowoyc is located in AWS region ap-southeast-2 (Sydney)
  const match = cleanUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.*)$/);
  if (match) {
    const [, user, pass, projectRef, dbName] = match;
    const finalUser = user.includes('.') ? user : `${user}.${projectRef}`;
    const poolerUrl = `postgresql://${finalUser}:${pass}@aws-0-ap-southeast-2.pooler.supabase.com:6543/${dbName}`;
    console.log('🔄 Rewriting direct IPv6 Supabase URL to IPv4 Connection Pooler (ap-southeast-2) for Render compatibility.');
    return poolerUrl;
  }
  return cleanUrl;
}

const rawDbUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : '';
const DATABASE_URL = formatSupabaseUrl(rawDbUrl);

if (DATABASE_URL) {
  // =========================================================================
  // SUPABASE / POSTGRESQL MODE
  // =========================================================================
  const { Pool, types } = require('pg');

  // Parse BIGINT and NUMERIC to JavaScript numbers for seamless compatibility
  types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
  types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  db = pool;

  // Convert SQLite-style ? placeholders to PostgreSQL-style $1, $2, ...
  function convertSql(sql, isRun = false) {
    let index = 1;
    let converted = sql.replace(/\?/g, () => `$${index++}`);
    let trimmed = converted.trim();

    if (isRun && /^INSERT\s+INTO/i.test(trimmed) && !/\bRETURNING\b/i.test(trimmed)) {
      if (trimmed.endsWith(';')) {
        trimmed = trimmed.slice(0, -1);
      }
      trimmed += ' RETURNING id';
      return trimmed;
    }
    return converted;
  }

  runAsync = async function (sql, params = []) {
    const pgSql = convertSql(sql, true);
    const res = await pool.query(pgSql, params);
    const lastID = res.rows && res.rows[0] && res.rows[0].id !== undefined ? res.rows[0].id : null;
    return {
      lastID,
      changes: res.rowCount
    };
  };

  allAsync = async function (sql, params = []) {
    const pgSql = convertSql(sql, false);
    const res = await pool.query(pgSql, params);
    return res.rows;
  };

  getAsync = async function (sql, params = []) {
    const pgSql = convertSql(sql, false);
    const res = await pool.query(pgSql, params);
    return res.rows[0] || null;
  };

  initDB = async function () {
    try {
      const res = await pool.query('SELECT NOW() as current_time');
      console.log('✅ Connected to Supabase PostgreSQL database successfully!');
      console.log('🕒 Supabase Server Time:', res.rows[0].current_time);

      // Auto-sync sequence IDs so nextval never collides with existing IDs
      const syncTables = ['teachers', 'students', 'subjects', 'holidays', 'attendance_sessions', 'attendance_records'];
      for (const t of syncTables) {
        try {
          await pool.query(`SELECT setval(pg_get_serial_sequence('public.${t}', 'id'), COALESCE((SELECT MAX(id) FROM public.${t}), 1), true)`);
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.error('❌ Failed to connect to Supabase PostgreSQL:', err.message);
      console.error('Please verify your DATABASE_URL in Render environment settings.');
      throw err;
    }
  };

} else {
  // =========================================================================
  // LOCAL SQLITE FALLBACK MODE
  // =========================================================================
  console.log('ℹ️  DATABASE_URL not set in .env. Running on local SQLite database.');
  console.log('💡 To switch to Supabase, paste your PostgreSQL URL in .env file.');

  const sqlite3 = require('sqlite3').verbose();
  const DB_PATH = path.join(__dirname, 'bca_attendance.db');

  const sqliteDb = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('Connected to SQLite database at', DB_PATH);
    }
  });

  db = sqliteDb;

  runAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };

  allAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  getAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  initDB = async function () {
    await runAsync('PRAGMA foreign_keys = ON;');
  };
}

module.exports = {
  db,
  runAsync,
  allAsync,
  getAsync,
  initDB
};
