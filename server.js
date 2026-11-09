const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'gamezone.db');

fs.mkdirSync(DB_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open SQLite database:', err.message);
    process.exit(1);
  }

  console.log('Connected to SQLite database at:', DB_PATH);
});

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
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
        reject(err);
        return;
      }

      resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

async function initializeDatabase() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    db.run(`
      CREATE TABLE IF NOT EXISTS gamers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
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

    db.run(`
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
  });
}

function isValidString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeName(value) {
  return value.trim();
}

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'GameZone Arcade API is running.',
  });
});

app.get('/gamers', async (req, res) => {
  try {
    const gamers = await allQuery('SELECT * FROM gamers ORDER BY id ASC');
    res.status(200).json(gamers);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch gamers.', message: error.message });
  }
});

app.get('/gamers/:id', async (req, res) => {
  try {
    const gamer = await getQuery('SELECT * FROM gamers WHERE id = ?', [req.params.id]);

    if (!gamer) {
      return res.status(404).json({ error: 'Gamer not found.' });
    }

    return res.status(200).json(gamer);
  } catch (error) {
    return res.status(500).json({ error: 'Unable to fetch gamer.', message: error.message });
  }
});

app.post('/gamers', async (req, res) => {
  const { name, email, phone } = req.body;

  if (!isValidString(name)) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  if (!isValidString(email)) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const result = await runQuery(
      'INSERT INTO gamers (name, email, phone) VALUES (?, ?, ?)',
      [normalizeName(name), email.trim(), phone ? phone.trim() : null]
    );

    const gamer = await getQuery('SELECT * FROM gamers WHERE id = ?', [result.id]);
    return res.status(201).json({
      message: 'Gamer created successfully.',
      gamer,
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'A gamer with this email already exists.' });
    }

    return res.status(500).json({ error: 'Unable to create gamer.', message: error.message });
  }
});

app.put('/gamers/:id', async (req, res) => {
  const { name, email, phone } = req.body;

  if (!name && !email && !phone) {
    return res.status(400).json({ error: 'Provide at least one field to update.' });
  }

  const fields = [];
  const values = [];

  if (name !== undefined) {
    if (!isValidString(name)) {
      return res.status(400).json({ error: 'Name cannot be empty.' });
    }
    fields.push('name = ?');
    values.push(normalizeName(name));
  }

  if (email !== undefined) {
    if (!isValidString(email)) {
      return res.status(400).json({ error: 'Email cannot be empty.' });
    }
    fields.push('email = ?');
    values.push(email.trim());
  }

  if (phone !== undefined) {
    fields.push('phone = ?');
    values.push(phone.trim());
  }

  try {
    const result = await runQuery(
      `UPDATE gamers SET ${fields.join(', ')} WHERE id = ?`,
      [...values, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Gamer not found.' });
    }

    const gamer = await getQuery('SELECT * FROM gamers WHERE id = ?', [req.params.id]);
    return res.status(200).json({ message: 'Gamer updated successfully.', gamer });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'A gamer with this email already exists.' });
    }

    return res.status(500).json({ error: 'Unable to update gamer.', message: error.message });
  }
});

app.delete('/gamers/:id', async (req, res) => {
  try {
    const result = await runQuery('DELETE FROM gamers WHERE id = ?', [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Gamer not found.' });
    }

    return res.status(200).json({ message: 'Gamer deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to delete gamer.', message: error.message });
  }
});

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
    return res.status(500).json({ error: 'Unable to fetch consoles.', message: error.message });
  }
});

app.get('/consoles/:id', async (req, res) => {
  try {
    const consoleItem = await getQuery(
      'SELECT * FROM consoles WHERE id = ? AND is_deleted = 0',
      [req.params.id]
    );

    if (!consoleItem) {
      return res.status(404).json({ error: 'Console not found or it has been deleted.' });
    }

    return res.status(200).json(consoleItem);
  } catch (error) {
    return res.status(500).json({ error: 'Unable to fetch console.', message: error.message });
  }
});

app.post('/consoles', async (req, res) => {
  const { name, platform, status, price_per_hour } = req.body;

  if (!isValidString(name)) {
    return res.status(400).json({ error: 'Console name is required.' });
  }

  if (!isValidString(platform)) {
    return res.status(400).json({ error: 'Platform is required.' });
  }

  if (price_per_hour === undefined || price_per_hour === null || Number.isNaN(Number(price_per_hour)) || Number(price_per_hour) < 0) {
    return res.status(400).json({ error: 'price_per_hour must be a non-negative number.' });
  }

  try {
    const result = await runQuery(
      'INSERT INTO consoles (name, platform, status, price_per_hour) VALUES (?, ?, ?, ?)',
      [normalizeName(name), normalizeName(platform), status || 'available', Number(price_per_hour)]
    );

    const consoleItem = await getQuery('SELECT * FROM consoles WHERE id = ?', [result.id]);
    return res.status(201).json({
      message: 'Console created successfully.',
      console: consoleItem,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to create console.', message: error.message });
  }
});

app.put('/consoles/:id', async (req, res) => {
  const { name, platform, status, price_per_hour } = req.body;

  if (name === undefined && platform === undefined && status === undefined && price_per_hour === undefined) {
    return res.status(400).json({ error: 'Provide at least one field to update.' });
  }

  const fields = [];
  const values = [];

  if (name !== undefined) {
    if (!isValidString(name)) {
      return res.status(400).json({ error: 'Console name cannot be empty.' });
    }
    fields.push('name = ?');
    values.push(normalizeName(name));
  }

  if (platform !== undefined) {
    if (!isValidString(platform)) {
      return res.status(400).json({ error: 'Platform cannot be empty.' });
    }
    fields.push('platform = ?');
    values.push(normalizeName(platform));
  }

  if (status !== undefined) {
    if (!isValidString(status)) {
      return res.status(400).json({ error: 'Status cannot be empty.' });
    }
    fields.push('status = ?');
    values.push(status.trim());
  }

  if (price_per_hour !== undefined) {
    if (Number.isNaN(Number(price_per_hour)) || Number(price_per_hour) < 0) {
      return res.status(400).json({ error: 'price_per_hour must be a non-negative number.' });
    }
    fields.push('price_per_hour = ?');
    values.push(Number(price_per_hour));
  }

  try {
    const result = await runQuery(
      `UPDATE consoles SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = 0`,
      [...values, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Console not found or it has been deleted.' });
    }

    const consoleItem = await getQuery('SELECT * FROM consoles WHERE id = ?', [req.params.id]);
    return res.status(200).json({ message: 'Console updated successfully.', console: consoleItem });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to update console.', message: error.message });
  }
});

app.delete('/consoles/:id', async (req, res) => {
  try {
    const result = await runQuery(
      'UPDATE consoles SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = 0',
      [req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Console not found or already deleted.' });
    }

    return res.status(200).json({ message: 'Console soft deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to delete console.', message: error.message });
  }
});

app.post('/consoles/:id/restore', async (req, res) => {
  try {
    const result = await runQuery(
      'UPDATE consoles SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Console not found.' });
    }

    const consoleItem = await getQuery('SELECT * FROM consoles WHERE id = ?', [req.params.id]);
    return res.status(200).json({
      message: 'Console restored successfully.',
      console: consoleItem,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to restore console.', message: error.message });
  }
});

app.get('/bookings', async (req, res) => {
  try {
    const bookings = await allQuery('SELECT * FROM bookings ORDER BY id ASC');
    return res.status(200).json(bookings);
  } catch (error) {
    return res.status(500).json({ error: 'Unable to fetch bookings.', message: error.message });
  }
});

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
    return res.status(500).json({ error: 'Unable to fetch booking details.', message: error.message });
  }
});

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
    return res.status(500).json({ error: 'Unable to fetch booking details.', message: error.message });
  }
});

app.get('/bookings/:id', async (req, res) => {
  try {
    const booking = await getQuery('SELECT * FROM bookings WHERE id = ?', [req.params.id]);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    return res.status(200).json(booking);
  } catch (error) {
    return res.status(500).json({ error: 'Unable to fetch booking.', message: error.message });
  }
});

app.post('/bookings', async (req, res) => {
  const { gamer_id, console_id, booking_date, hours, total_amount, status } = req.body;

  if (!gamer_id || !console_id || !booking_date || !hours || total_amount === undefined) {
    return res.status(400).json({
      error: 'gamer_id, console_id, booking_date, hours and total_amount are required.',
    });
  }

  if (Number.isNaN(Number(gamer_id)) || Number.isNaN(Number(console_id)) || Number.isNaN(Number(hours)) || Number.isNaN(Number(total_amount))) {
    return res.status(400).json({ error: 'gamer_id, console_id, hours and total_amount must be numeric values.' });
  }

  try {
    const gamer = await getQuery('SELECT id FROM gamers WHERE id = ?', [gamer_id]);
    const consoleItem = await getQuery('SELECT id FROM consoles WHERE id = ? AND is_deleted = 0', [console_id]);

    if (!gamer) {
      return res.status(404).json({ error: 'Gamer not found.' });
    }

    if (!consoleItem) {
      return res.status(404).json({ error: 'Console not found or it has been deleted.' });
    }

    const result = await runQuery(
      'INSERT INTO bookings (gamer_id, console_id, booking_date, hours, total_amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [gamer_id, console_id, booking_date, Number(hours), Number(total_amount), status || 'confirmed']
    );

    const booking = await getQuery('SELECT * FROM bookings WHERE id = ?', [result.id]);
    return res.status(201).json({ message: 'Booking created successfully.', booking });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to create booking.', message: error.message });
  }
});

app.put('/bookings/:id', async (req, res) => {
  const { gamer_id, console_id, booking_date, hours, total_amount, status } = req.body;

  if (gamer_id === undefined && console_id === undefined && booking_date === undefined && hours === undefined && total_amount === undefined && status === undefined) {
    return res.status(400).json({ error: 'Provide at least one field to update.' });
  }

  const fields = [];
  const values = [];

  if (gamer_id !== undefined) {
    fields.push('gamer_id = ?');
    values.push(gamer_id);
  }

  if (console_id !== undefined) {
    fields.push('console_id = ?');
    values.push(console_id);
  }

  if (booking_date !== undefined) {
    fields.push('booking_date = ?');
    values.push(booking_date);
  }

  if (hours !== undefined) {
    fields.push('hours = ?');
    values.push(Number(hours));
  }

  if (total_amount !== undefined) {
    fields.push('total_amount = ?');
    values.push(Number(total_amount));
  }

  if (status !== undefined) {
    fields.push('status = ?');
    values.push(status);
  }

  try {
    const result = await runQuery(
      `UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`,
      [...values, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const booking = await getQuery('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    return res.status(200).json({ message: 'Booking updated successfully.', booking });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to update booking.', message: error.message });
  }
});

app.delete('/bookings/:id', async (req, res) => {
  try {
    const result = await runQuery('DELETE FROM bookings WHERE id = ?', [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    return res.status(200).json({ message: 'Booking deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to delete booking.', message: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`GameZone Arcade server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = { app, db };
