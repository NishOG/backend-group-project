const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'gamezone.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Centralised Relational JOIN Query (shared by /bookings/join and /bookings/details)
const BOOKING_JOIN_QUERY = `
  SELECT
    b.id,
    g.name AS gamer_name,
    c.name AS console_name,
    c.platform,
    b.booking_date,
    b.hours,
    b.total_amount,
    b.status
  FROM bookings b
  INNER JOIN gamers g ON g.id = b.gamer_id
  INNER JOIN consoles c ON c.id = b.console_id
  WHERE c.is_deleted = 0
  ORDER BY b.id ASC
`;

// Ensure database directory exists
if (DB_PATH !== ':memory:') {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

let connectionResolve;
let connectionReject;

const connectionReady = new Promise((resolve, reject) => {
  connectionResolve = resolve;
  connectionReject = reject;
});

// Suppress unhandled rejection if initializeDatabase is not invoked immediately
connectionReady.catch(() => {});

// Synchronously initialize the SQLite Database instance so it is never null or stale
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    return connectionReject(new Error('Failed to open SQLite database: ' + err.message));
  }

  console.log('Connected to SQLite database at:', DB_PATH);
  connectionResolve(db);
});

/**
 * Await connection completion. Rejects if database opening failed.
 * @returns {Promise<sqlite3.Database>}
 */
function connectDatabase() {
  return connectionReady;
}

/**
 * Execute an INSERT, UPDATE, or DELETE SQL statement.
 * @param {string} sql Parameterised SQL query
 * @param {Array} params Query arguments
 * @returns {Promise<{id: number, changes: number}>}
 */
async function runQuery(sql, params = []) {
  const connection = await connectDatabase();
  return new Promise((resolve, reject) => {
    connection.run(sql, params, function (err) {
      if (err) {
        return reject(err);
      }
      resolve({
        id: this.lastID,
        changes: this.changes,
      });
    });
  });
}

/**
 * Fetch a single row (SELECT ... WHERE id = ?).
 * @param {string} sql Parameterised SQL query
 * @param {Array} params Query arguments
 * @returns {Promise<Object|undefined>}
 */
async function getQuery(sql, params = []) {
  const connection = await connectDatabase();
  return new Promise((resolve, reject) => {
    connection.get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

/**
 * Fetch multiple rows (SELECT * ...).
 * @param {string} sql Parameterised SQL query
 * @param {Array} params Query arguments
 * @returns {Promise<Array<Object>>}
 */
async function allQuery(sql, params = []) {
  const connection = await connectDatabase();
  return new Promise((resolve, reject) => {
    connection.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

/**
 * Initialize database schema asynchronously:
 * 1. Awaits database connection opening;
 * 2. Executes PRAGMA foreign_keys = ON;
 * 3. Verifies PRAGMA foreign_keys returns 1;
 * 4. Executes schema.sql using db.exec() to create tables and indexes.
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
  const connection = await connectDatabase();

  return new Promise((resolve, reject) => {
    // Step 1: Enable foreign key constraints
    connection.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
      if (pragmaErr) {
        return reject(new Error('Failed to enable foreign key constraints: ' + pragmaErr.message));
      }

      // Step 2: Verify foreign key enforcement is active (value === 1)
      connection.get('PRAGMA foreign_keys;', (verifyErr, row) => {
        if (verifyErr) {
          return reject(new Error('Failed to verify foreign key pragma: ' + verifyErr.message));
        }

        if (!row || row.foreign_keys !== 1) {
          const actualVal = row ? row.foreign_keys : 'undefined';
          return reject(new Error(`Foreign key enforcement could not be verified (expected 1, got ${actualVal})`));
        }

        // Step 3: Read schema.sql and execute using db.exec()
        fs.readFile(SCHEMA_PATH, 'utf-8', (readErr, schemaSql) => {
          if (readErr) {
            return reject(new Error('Failed to read schema.sql: ' + readErr.message));
          }

          connection.exec(schemaSql, (execErr) => {
            if (execErr) {
              return reject(new Error('Failed to execute database schema: ' + execErr.message));
            }

            console.log('Database schema successfully initialized.');
            resolve();
          });
        });
      });
    });
  });
}

/**
 * Centralised helper to fetch bookings joined with gamer and console details.
 * Used by both /bookings/join and /bookings/details endpoints.
 * @returns {Promise<Array<Object>>}
 */
function getJoinedBookings() {
  return allQuery(BOOKING_JOIN_QUERY);
}

/**
 * Safely close the database connection.
 * @returns {Promise<void>}
 */
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      return resolve();
    }

    db.close((err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

module.exports = {
  db,
  DB_PATH,
  BOOKING_JOIN_QUERY,
  connectDatabase,
  runQuery,
  getQuery,
  allQuery,
  getJoinedBookings,
  initializeDatabase,
  closeDatabase,
};
