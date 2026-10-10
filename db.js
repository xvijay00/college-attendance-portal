require('dotenv').config();
const path = require('path');
const bcrypt = require('bcryptjs');

let db = null;
let runAsync = null;
let allAsync = null;
let getAsync = null;
let initDB = null;

const DATABASE_URL = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : '';

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
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
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
    } catch (err) {
      console.error('❌ Failed to connect to Supabase PostgreSQL:', err.message);
      console.error('Please check your DATABASE_URL in .env file');
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
