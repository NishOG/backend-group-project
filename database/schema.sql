-- ============================================================================
-- GameZone Arcade - Database Schema (Part 2: Database)
-- Database Engine: SQLite3
-- ============================================================================

-- Enforce foreign key constraints
PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. GAMERS TABLE
-- Stores registered player details
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gamers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. CONSOLES TABLE
-- Stores console stations with soft-delete flag support
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consoles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  price_per_hour REAL NOT NULL CHECK(price_per_hour >= 0),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. BOOKINGS TABLE
-- Junction table connecting a gamer to a console station
-- ----------------------------------------------------------------------------
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
);

-- ----------------------------------------------------------------------------
-- INDEXES
-- 1. Composite Index on (is_deleted, platform):
--    Optimizes both active listings (WHERE is_deleted = 0) and platform search
--    (WHERE is_deleted = 0 AND platform = ?) in a single B-tree index.
-- 2. Indexes on foreign keys to accelerate relational JOINs and FK checks.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_consoles_active_platform ON consoles(is_deleted, platform);
CREATE INDEX IF NOT EXISTS idx_bookings_gamer_id ON bookings(gamer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_console_id ON bookings(console_id);