
// ============================================================
// GAMEZONE ARCADE - BACKEND SERVER
// ============================================================
//
// PERSON 1: NISHANT KUMAR THAKUR - 252U1R3067
// Server and routes: Express setup, middleware, API routing,
// HTTP methods, status codes and server startup.
//
// PERSON 2: SREE CHARANI - 252U1R3059
// SQL database: SQLite setup, tables, relationships and queries.
//
// PERSON 3: ADITYA PRASOON - 252U1R3095
// REST endpoints: CRUD operations and the booking JOIN endpoint.
//
// PERSON 4: MANOJ KUMAR REDDY - 252U1R3076
// Validation: input checks, error responses and PUT request checks.
//
// PERSON 5: NIHARIKA - 252U1R3070
// Soft delete and restore: hide, retrieve and restore consoles.
//
// PERSON 6: TILAK - 252U1R3096
// Documentation, Postman testing and submission screenshots.
//
// Database: SQLite
// ============================================================


// ============================================================
// PERSON 1: IMPORTS AND SERVER CONFIGURATION
// ============================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();

const PORT = process.env.PORT || 3000;

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'gamezone.db');

// Create the data folder if it does not exist.
fs.mkdirSync(DB_DIR, { recursive: true });


// ============================================================
// PERSON 2: DATABASE CONNECTION
// ============================================================

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open SQLite database:', err.message);
    process.exit(1);
  }

  console.log('Connected to SQLite database at:', DB_PATH);
});


// ============================================================
// PERSON 2: DATABASE QUERY HELPER FUNCTIONS
// These functions allow SQLite queries to use async/await.
// ============================================================

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
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

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }

      resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }

      resolve(rows);
    });
  });
}


// ============================================================
// PERSON 2: DATABASE INITIALIZATION AND TABLE SCHEMA
// Creates the gamers, consoles and bookings tables.
// ============================================================

async function initializeDatabase() {

  // Enable foreign key constraints.
  await runQuery('PRAGMA foreign_keys = ON');

  // Gamers Table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS gamers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

   // PERSON 5: 0 = active console; 1 = soft-deleted console.
  await runQuery(`
    CREATE TABLE IF NOT EXISTS consoles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      price_per_hour REAL NOT NULL CHECK(price_per_hour >= 0),
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bookings Table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gamer_id INTEGER NOT NULL,
      console_id INTEGER NOT NULL,
      booking_date TEXT NOT NULL,
      hours INTEGER NOT NULL CHECK(hours > 0),
      total_amount REAL NOT NULL CHECK(total_amount >= 0),
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (gamer_id) REFERENCES gamers(id),
      FOREIGN KEY (console_id) REFERENCES consoles(id)
    )
  `);

  console.log('Database tables initialized successfully.');
}


// ============================================================
// PERSON 4: COMMON INPUT VALIDATION FUNCTIONS
// ============================================================

function isValidString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidNumericValue(value) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return false;
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return false;
  }

  return Number.isFinite(Number(value));
}

function isPositiveInteger(value) {
  return isValidNumericValue(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0;
}

function isNonNegativeNumber(value) {
  return isValidNumericValue(value) && Number(value) >= 0;
}

function normalizeName(value) {
  return value.trim();
}


// ============================================================
// PERSON 1: EXPRESS JSON MIDDLEWARE
// PERSON 4: REQUEST-BODY VALIDATION MIDDLEWARE
// Allows the server to receive JSON request bodies.
// ============================================================

app.use(express.json());

function requireJsonObject(req, res, next) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      error: 'Request body must be a JSON object.',
    });
  }

  return next();
}


// ============================================================
// PERSON 1: HOME ROUTE
// GET /
// Displays the API status and available main routes.
// ============================================================

app.get('/', (req, res) => {
  return res.status(200).json({
    status: 'OK',
    message: 'GameZone Arcade API is running.',
    routes: [
      'GET /health',
      'GET /gamers',
      'GET /gamers/:id',
      'POST /gamers',
      'PUT /gamers/:id',
      'DELETE /gamers/:id',
      'GET /consoles',
      'GET /consoles/:id',
      'POST /consoles',
      'PUT /consoles/:id',
      'DELETE /consoles/:id',
      'POST /consoles/:id/restore',
      'GET /bookings',
      'GET /bookings/:id',
      'POST /bookings',
      'PUT /bookings/:id',
      'DELETE /bookings/:id',
      'GET /bookings/join'
    ]
  });
});


// ============================================================
// PERSON 1: HEALTH CHECK ROUTE
// GET /health
// Checks whether the API server is running.
// ============================================================

app.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'OK',
    message: 'GameZone Arcade API is running.',
  });
});


// ============================================================
// PERSON 3: GAMER CRUD ROUTES
// PERSON 4: GAMER REQUEST VALIDATION
// ============================================================


// PERSON 3: GET /gamers
// Fetch all gamers.

app.get('/gamers', async (req, res) => {
  try {
    const gamers = await allQuery(
      'SELECT * FROM gamers ORDER BY id ASC'
    );

    return res.status(200).json(gamers);

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to fetch gamers.',
      message: error.message,
    });
  }
});


// PERSON 3: GET /gamers/:id
// Fetch a particular gamer using their ID.

app.get('/gamers/:id', async (req, res) => {
  try {
    const gamer = await getQuery(
      'SELECT * FROM gamers WHERE id = ?',
      [req.params.id]
    );

    if (!gamer) {
      return res.status(404).json({
        error: 'Gamer not found.',
      });
    }

    return res.status(200).json(gamer);

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to fetch gamer.',
      message: error.message,
    });
  }
});


// PERSON 3: POST /gamers
// PERSON 4: Validate the new gamer fields.
// Create a new gamer.

app.post('/gamers', requireJsonObject, async (req, res) => {
  const { name, email, phone } = req.body;

  if (!isValidString(name)) {
    return res.status(400).json({
      error: 'Name is required.',
    });
  }

  if (!isValidString(email)) {
    return res.status(400).json({
      error: 'Email is required.',
    });
  }

  try {
    const result = await runQuery(
      'INSERT INTO gamers (name, email, phone) VALUES (?, ?, ?)',
      [
        normalizeName(name),
        email.trim(),
        phone ? phone.trim() : null
      ]
    );

    const gamer = await getQuery(
      'SELECT * FROM gamers WHERE id = ?',
      [result.id]
    );

    return res.status(201).json({
      message: 'Gamer created successfully.',
      gamer,
    });

  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        error: 'A gamer with this email already exists.',
      });
    }

    return res.status(500).json({
      error: 'Unable to create gamer.',
      message: error.message,
    });
  }
});


// PERSON 3: PUT /gamers/:id
// PERSON 4: Validate the fields being updated.
// Update an existing gamer's information.

app.put('/gamers/:id', requireJsonObject, async (req, res) => {
  const { name, email, phone } = req.body;

  if (name === undefined && email === undefined && phone === undefined) {
    return res.status(400).json({
      error: 'Provide at least one field to update.',
    });
  }

  const fields = [];
  const values = [];

  if (name !== undefined) {
    if (!isValidString(name)) {
      return res.status(400).json({
        error: 'Name cannot be empty.',
      });
    }

    fields.push('name = ?');
    values.push(normalizeName(name));
  }

  if (email !== undefined) {
    if (!isValidString(email)) {
      return res.status(400).json({
        error: 'Email cannot be empty.',
      });
    }

    fields.push('email = ?');
    values.push(email.trim());
  }

  if (phone !== undefined) {
    fields.push('phone = ?');
    values.push(phone ? phone.trim() : null);
  }

  try {
    const result = await runQuery(
      `UPDATE gamers SET ${fields.join(', ')} WHERE id = ?`,
      [...values, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Gamer not found.',
      });
    }

    const gamer = await getQuery(
      'SELECT * FROM gamers WHERE id = ?',
      [req.params.id]
    );

    return res.status(200).json({
      message: 'Gamer updated successfully.',
      gamer,
    });

  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        error: 'A gamer with this email already exists.',
      });
    }

    return res.status(500).json({
      error: 'Unable to update gamer.',
      message: error.message,
    });
  }
});


// PERSON 3: DELETE /gamers/:id
// Permanently delete a gamer.

app.delete('/gamers/:id', async (req, res) => {
  try {
    const result = await runQuery(
      'DELETE FROM gamers WHERE id = ?',
      [req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Gamer not found.',
      });
    }

    return res.status(200).json({
      message: 'Gamer deleted successfully.',
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to delete gamer.',
      message: error.message,
    });
  }
});


// ============================================================
// PERSON 3: CONSOLE CRUD ROUTES
// PERSON 4: CONSOLE SEARCH AND INPUT VALIDATION
// PERSON 5: SOFT DELETE AND RESTORE
// ============================================================
//
// Person 5's contribution:
// - Hide deleted consoles.
// - Prevent access to deleted consoles.
// - Soft delete consoles instead of permanently deleting them.
// - Restore previously deleted consoles.
//
// ============================================================


// PERSON 3: GET /consoles
// PERSON 4: Filter consoles by the platform query parameter.
// PERSON 5: Display only active consoles.
// Deleted consoles (is_deleted = 1) are hidden.

app.get('/consoles', async (req, res) => {
  const { platform } = req.query;

  try {
    let sql = 'SELECT * FROM consoles WHERE is_deleted = 0';
    const params = [];

    if (platform) {
      sql += ' AND platform = ?';
      params.push(platform);
    }

    sql += ' ORDER BY id ASC';

    const consoles = await allQuery(sql, params);

    return res.status(200).json(consoles);

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to fetch consoles.',
      message: error.message,
    });
  }
});


// PERSON 3: GET /consoles/:id
// PERSON 5: Do not display a deleted console.

app.get('/consoles/:id', async (req, res) => {
  try {
    const consoleItem = await getQuery(
      'SELECT * FROM consoles WHERE id = ? AND is_deleted = 0',
      [req.params.id]
    );

    if (!consoleItem) {
      return res.status(404).json({
        error: 'Console not found or it has been deleted.',
      });
    }

    return res.status(200).json(consoleItem);

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to fetch console.',
      message: error.message,
    });
  }
});


// PERSON 3: POST /consoles
// PERSON 4: Validate the new console fields.
// Create a new console.
// PERSON 5: New consoles are active by default (is_deleted = 0).

app.post('/consoles', requireJsonObject, async (req, res) => {
  const { name, platform, status, price_per_hour } = req.body;

  if (!isValidString(name)) {
    return res.status(400).json({
      error: 'Console name is required.',
    });
  }

  if (!isValidString(platform)) {
    return res.status(400).json({
      error: 'Platform is required.',
    });
  }

  if (!isNonNegativeNumber(price_per_hour)) {
    return res.status(400).json({
      error: 'price_per_hour must be a non-negative number.',
    });
  }

  try {
    const result = await runQuery(
      `INSERT INTO consoles
       (name, platform, status, price_per_hour, is_deleted)
       VALUES (?, ?, ?, ?, 0)`,
      [
        normalizeName(name),
        normalizeName(platform),
        status || 'available',
        Number(price_per_hour)
      ]
    );

    const consoleItem = await getQuery(
      'SELECT * FROM consoles WHERE id = ?',
      [result.id]
    );

    return res.status(201).json({
      message: 'Console created successfully.',
      console: consoleItem,
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to create console.',
      message: error.message,
    });
  }
});


// PERSON 3: PUT /consoles/:id
// PERSON 4: Validate the fields being updated.
// Update an active console.
// PERSON 5: Deleted consoles cannot be updated.

app.put('/consoles/:id', requireJsonObject, async (req, res) => {
  const { name, platform, status, price_per_hour } = req.body;

  if (
    name === undefined &&
    platform === undefined &&
    status === undefined &&
    price_per_hour === undefined
  ) {
    return res.status(400).json({
      error: 'Provide at least one field to update.',
    });
  }

  const fields = [];
  const values = [];

  if (name !== undefined) {
    if (!isValidString(name)) {
      return res.status(400).json({
        error: 'Console name cannot be empty.',
      });
    }

    fields.push('name = ?');
    values.push(normalizeName(name));
  }

  if (platform !== undefined) {
    if (!isValidString(platform)) {
      return res.status(400).json({
        error: 'Platform cannot be empty.',
      });
    }

    fields.push('platform = ?');
    values.push(normalizeName(platform));
  }

  if (status !== undefined) {
    if (!isValidString(status)) {
      return res.status(400).json({
        error: 'Status cannot be empty.',
      });
    }

    fields.push('status = ?');
    values.push(status.trim());
  }

  if (price_per_hour !== undefined) {
    if (!isNonNegativeNumber(price_per_hour)) {
      return res.status(400).json({
        error: 'price_per_hour must be a non-negative number.',
      });
    }

    fields.push('price_per_hour = ?');
    values.push(Number(price_per_hour));
  }

  try {
    const result = await runQuery(
      `UPDATE consoles
       SET ${fields.join(', ')},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND is_deleted = 0`,
      [...values, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Console not found or it has been deleted.',
      });
    }

    const consoleItem = await getQuery(
      'SELECT * FROM consoles WHERE id = ?',
      [req.params.id]
    );

    return res.status(200).json({
      message: 'Console updated successfully.',
      console: consoleItem,
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to update console.',
      message: error.message,
    });
  }
});


// ============================================================
// PERSON 5: SOFT DELETE CONSOLE
// DELETE /consoles/:id
//
// Instead of permanently removing a console from the database,
// this route changes is_deleted from 0 to 1.
//
// The console remains stored and can be restored later.
// ============================================================

app.delete('/consoles/:id', async (req, res) => {
  try {
    const result = await runQuery(
      `UPDATE consoles
       SET is_deleted = 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND is_deleted = 0`,
      [req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Console not found or already deleted.',
      });
    }

    return res.status(200).json({
      message: 'Console soft deleted successfully.',
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to delete console.',
      message: error.message,
    });
  }
});


// ============================================================
// PERSON 5: RESTORE SOFT-DELETED CONSOLE
// POST /consoles/:id/restore
//
// This route changes is_deleted from 1 back to 0.
// Only a previously deleted console can be restored.
// ============================================================

app.post('/consoles/:id/restore', async (req, res) => {
  try {
    const result = await runQuery(
      `UPDATE consoles
       SET is_deleted = 0,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND is_deleted = 1`,
      [req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Console not found or already active.',
      });
    }

    const consoleItem = await getQuery(
      'SELECT * FROM consoles WHERE id = ?',
      [req.params.id]
    );

    return res.status(200).json({
      message: 'Console restored successfully.',
      console: consoleItem,
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to restore console.',
      message: error.message,
    });
  }
});


// ============================================================
// PERSON 3: BOOKING CRUD AND JOIN ROUTES
// PERSON 4: BOOKING INPUT VALIDATION
// PERSON 5: PREVENT BOOKINGS USING DELETED CONSOLES
// ============================================================


// PERSON 3: GET /bookings
// Fetch all bookings.

app.get('/bookings', async (req, res) => {
  try {
    const bookings = await allQuery(
      'SELECT * FROM bookings ORDER BY id ASC'
    );

    return res.status(200).json(bookings);

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to fetch bookings.',
      message: error.message,
    });
  }
});


// PERSON 3: GET /bookings/join
// Fetch booking details with gamer and console information.
// Uses INNER JOIN to combine three tables.

app.get('/bookings/join', async (req, res) => {
  try {
    const bookings = await allQuery(`
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
    `);

    return res.status(200).json(bookings);

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to fetch booking details.',
      message: error.message,
    });
  }
});


// PERSON 3: GET /bookings/details
// Alternative route for viewing joined booking information.

app.get('/bookings/details', async (req, res) => {
  try {
    const bookings = await allQuery(`
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
    `);

    return res.status(200).json(bookings);

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to fetch booking details.',
      message: error.message,
    });
  }
});


// PERSON 3: GET /bookings/:id
// Fetch one booking using its ID.

app.get('/bookings/:id', async (req, res) => {
  try {
    const booking = await getQuery(
      'SELECT * FROM bookings WHERE id = ?',
      [req.params.id]
    );

    if (!booking) {
      return res.status(404).json({
        error: 'Booking not found.',
      });
    }

    return res.status(200).json(booking);

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to fetch booking.',
      message: error.message,
    });
  }
});


// PERSON 3: POST /bookings
// PERSON 4: Validate booking fields.
// PERSON 5: Reject bookings for deleted consoles.
// Create a new booking.

app.post('/bookings', requireJsonObject, async (req, res) => {
  const {
    gamer_id,
    console_id,
    booking_date,
    hours,
    total_amount,
    status
  } = req.body;

  if (
    gamer_id === undefined ||
    console_id === undefined ||
    booking_date === undefined ||
    hours === undefined ||
    total_amount === undefined
  ) {
    return res.status(400).json({
      error: 'gamer_id, console_id, booking_date, hours and total_amount are required.',
    });
  }

  if (!isPositiveInteger(gamer_id) || !isPositiveInteger(console_id)) {
    return res.status(400).json({
      error: 'gamer_id and console_id must be positive integers.',
    });
  }

  if (!isValidString(booking_date)) {
    return res.status(400).json({
      error: 'booking_date is required and cannot be empty.',
    });
  }

  if (!isPositiveInteger(hours)) {
    return res.status(400).json({
      error: 'hours must be a positive integer.',
    });
  }

  if (!isNonNegativeNumber(total_amount)) {
    return res.status(400).json({
      error: 'total_amount must be a non-negative number.',
    });
  }

  if (status !== undefined && !isValidString(status)) {
    return res.status(400).json({
      error: 'status cannot be empty.',
    });
  }

  try {
    const gamer = await getQuery(
      'SELECT id FROM gamers WHERE id = ?',
      [gamer_id]
    );

    // PERSON 5: Prevent bookings for deleted consoles.
    const consoleItem = await getQuery(
      'SELECT id FROM consoles WHERE id = ? AND is_deleted = 0',
      [console_id]
    );

    if (!gamer) {
      return res.status(404).json({
        error: 'Gamer not found.',
      });
    }

    if (!consoleItem) {
      return res.status(404).json({
        error: 'Console not found or it has been deleted.',
      });
    }

    const result = await runQuery(
      `INSERT INTO bookings
       (gamer_id, console_id, booking_date, hours, total_amount, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        gamer_id,
        console_id,
        booking_date,
        Number(hours),
        Number(total_amount),
        status || 'confirmed'
      ]
    );

    const booking = await getQuery(
      'SELECT * FROM bookings WHERE id = ?',
      [result.id]
    );

    return res.status(201).json({
      message: 'Booking created successfully.',
      booking,
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to create booking.',
      message: error.message,
    });
  }
});


// PERSON 3: PUT /bookings/:id
// PERSON 4: Validate booking updates.
// PERSON 5: Reject updates that select deleted consoles.
// Update an existing booking.

app.put('/bookings/:id', requireJsonObject, async (req, res) => {
  const {
    gamer_id,
    console_id,
    booking_date,
    hours,
    total_amount,
    status
  } = req.body;

  if (
    gamer_id === undefined &&
    console_id === undefined &&
    booking_date === undefined &&
    hours === undefined &&
    total_amount === undefined &&
    status === undefined
  ) {
    return res.status(400).json({
      error: 'Provide at least one field to update.',
    });
  }

  const fields = [];
  const values = [];

  if (gamer_id !== undefined) {
    if (!isPositiveInteger(gamer_id)) {
      return res.status(400).json({
        error: 'gamer_id must be a positive integer.',
      });
    }

    fields.push('gamer_id = ?');
    values.push(Number(gamer_id));
  }

  if (console_id !== undefined) {
    if (!isPositiveInteger(console_id)) {
      return res.status(400).json({
        error: 'console_id must be a positive integer.',
      });
    }

    fields.push('console_id = ?');
    values.push(Number(console_id));
  }

  if (booking_date !== undefined) {
    if (!isValidString(booking_date)) {
      return res.status(400).json({
        error: 'booking_date cannot be empty.',
      });
    }

    fields.push('booking_date = ?');
    values.push(booking_date);
  }

  if (hours !== undefined) {
    if (!isPositiveInteger(hours)) {
      return res.status(400).json({
        error: 'hours must be a positive integer.',
      });
    }

    fields.push('hours = ?');
    values.push(Number(hours));
  }

  if (total_amount !== undefined) {
    if (!isNonNegativeNumber(total_amount)) {
      return res.status(400).json({
        error: 'total_amount must be a non-negative number.',
      });
    }

    fields.push('total_amount = ?');
    values.push(Number(total_amount));
  }

  if (status !== undefined) {
    if (!isValidString(status)) {
      return res.status(400).json({
        error: 'status cannot be empty.',
      });
    }

    fields.push('status = ?');
    values.push(status.trim());
  }

  try {
    if (gamer_id !== undefined) {
      const gamer = await getQuery(
        'SELECT id FROM gamers WHERE id = ?',
        [Number(gamer_id)]
      );

      if (!gamer) {
        return res.status(404).json({
          error: 'Gamer not found.',
        });
      }
    }

    if (console_id !== undefined) {
      const consoleItem = await getQuery(
        'SELECT id FROM consoles WHERE id = ? AND is_deleted = 0',
        [Number(console_id)]
      );

      if (!consoleItem) {
        return res.status(404).json({
          error: 'Console not found or it has been deleted.',
        });
      }
    }

    const result = await runQuery(
      `UPDATE bookings
       SET ${fields.join(', ')}
       WHERE id = ?`,
      [...values, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Booking not found.',
      });
    }

    const booking = await getQuery(
      'SELECT * FROM bookings WHERE id = ?',
      [req.params.id]
    );

    return res.status(200).json({
      message: 'Booking updated successfully.',
      booking,
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to update booking.',
      message: error.message,
    });
  }
});


// PERSON 3: DELETE /bookings/:id
// Permanently delete a booking.

app.delete('/bookings/:id', async (req, res) => {
  try {
    const result = await runQuery(
      'DELETE FROM bookings WHERE id = ?',
      [req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Booking not found.',
      });
    }

    return res.status(200).json({
      message: 'Booking deleted successfully.',
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Unable to delete booking.',
      message: error.message,
    });
  }
});


// ============================================================
// PERSON 1: 404 ROUTE HANDLER
// Handles requests for routes that do not exist.
// ============================================================

app.use((req, res) => {
  return res.status(404).json({
    error: 'Route not found.',
  });
});

// PERSON 1: CENTRAL ERROR HANDLER
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Request body contains invalid JSON.',
    });
  }

  console.error('Unhandled request error:', error);
  return res.status(500).json({
    error: 'Internal server error.',
  });
});


// ============================================================
// PERSON 1: SERVER STARTUP
// Initialize the database before starting the Express server.
// ============================================================

async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`GameZone Arcade server running on http://localhost:${PORT}`);
  });
}


// Start the server only when this file is run directly.
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}


// ============================================================
// PERSON 1: EXPRESS APP EXPORT
// PERSON 2: DATABASE AND QUERY HELPER EXPORTS
// Allows the app and database functions to be used elsewhere.
// ============================================================

module.exports = {
  app,
  db,
  initializeDatabase,
  runQuery,
  getQuery,
  allQuery
};
