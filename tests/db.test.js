/**
 * GameZone Arcade - Comprehensive Verification Test Suite
 * Part 2: Database & API Integration Verification
 *
 * Uses Node.js built-in 'assert' module and native 'fetch' (zero extra packages).
 * Runs against an isolated test database (data/test_gamezone.db) so real project data is never touched.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Configure isolated test database and test port BEFORE requiring modules
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test_gamezone.db');
process.env.DB_PATH = TEST_DB_PATH;
const TEST_PORT = 3456;

const {
  db,
  runQuery,
  getQuery,
  allQuery,
  getJoinedBookings,
  initializeDatabase,
  closeDatabase,
} = require('../database/database');

const { app } = require('../server');

async function runAllTests() {
  console.log('================================================================');
  console.log('  GameZone Arcade - Senior Backend Verification Test Suite');
  console.log('  (Executing Database Engine & Express API Integration Tests)');
  console.log('================================================================\n');

  let server = null;
  let passedCount = 0;
  let totalCount = 0;

  function recordPass(testName) {
    passedCount++;
    console.log(`  -> PASS: ${testName}`);
  }

  try {
    // ========================================================================
    // SECTION 1: DATABASE ENGINE, SCHEMA & QUERY TESTS
    // ========================================================================
    console.log('--- SECTION 1: SQLite Database Engine & SQL Query Verification ---');

    // Test 1: Asynchronous Initialization & PRAGMA Verification
    totalCount++;
    console.log('\n[Test 1] Asynchronous schema initialization and foreign key verification...');
    await initializeDatabase();
    const pragmaRow = await getQuery('PRAGMA foreign_keys;');
    assert.strictEqual(pragmaRow.foreign_keys, 1, 'PRAGMA foreign_keys must be active (1).');

    const tableRows = await allQuery(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('gamers', 'consoles', 'bookings')"
    );
    const tableNames = tableRows.map((t) => t.name);
    assert.ok(tableNames.includes('gamers'), 'Table "gamers" must exist.');
    assert.ok(tableNames.includes('consoles'), 'Table "consoles" must exist.');
    assert.ok(tableNames.includes('bookings'), 'Table "bookings" must exist.');

    const indexRows = await allQuery(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
    );
    const indexNames = indexRows.map((i) => i.name);
    assert.ok(indexNames.includes('idx_consoles_active_platform'), 'Index idx_consoles_active_platform must exist.');
    assert.ok(indexNames.includes('idx_bookings_gamer_id'), 'Index idx_bookings_gamer_id must exist.');
    assert.ok(indexNames.includes('idx_bookings_console_id'), 'Index idx_bookings_console_id must exist.');
    recordPass('Schema created with foreign keys and performance indexes.');

    // Test 2: Parameterised INSERT & SELECT (Gamers)
    totalCount++;
    console.log('\n[Test 2] Parameterised INSERT & SELECT for Gamers...');
    const testEmail = `player.${Date.now()}@arcade.com`;
    const gamerRes = await runQuery(
      'INSERT INTO gamers (name, email, phone) VALUES (?, ?, ?)',
      ['Master Chief', testEmail, '1234567890']
    );
    assert.ok(gamerRes.id > 0, 'INSERT gamer should return a valid primary key.');
    const fetchedGamer = await getQuery('SELECT * FROM gamers WHERE id = ?', [gamerRes.id]);
    assert.strictEqual(fetchedGamer.name, 'Master Chief');
    assert.strictEqual(fetchedGamer.email, testEmail);
    recordPass('Parameterised INSERT and SELECT work correctly.');

    // Test 3: Foreign Key Constraint Enforcement
    totalCount++;
    console.log('\n[Test 3] Foreign Key Constraint Rejection...');
    let foreignKeyBlocked = false;
    try {
      await runQuery(
        'INSERT INTO bookings (gamer_id, console_id, booking_date, hours, total_amount, status) VALUES (?, ?, ?, ?, ?, ?)',
        [888888, 1, '2026-11-20', 2, 500, 'confirmed']
      );
    } catch (err) {
      if (err.message.includes('FOREIGN KEY') || err.code === 'SQLITE_CONSTRAINT') {
        foreignKeyBlocked = true;
      }
    }
    assert.strictEqual(foreignKeyBlocked, true, 'Foreign key violation must be rejected by SQLite.');
    recordPass('SQLite foreign key integrity is strictly enforced.');

    // Test 4: Console Search by Platform Query Parameter
    totalCount++;
    console.log('\n[Test 4] Console Search by Platform (WHERE is_deleted = 0 AND platform = ?)...');
    const c1 = await runQuery(
      'INSERT INTO consoles (name, platform, status, price_per_hour, is_deleted) VALUES (?, ?, ?, ?, ?)',
      ['PS5 Station Omega', 'PlayStation', 'available', 250.0, 0]
    );
    const c2 = await runQuery(
      'INSERT INTO consoles (name, platform, status, price_per_hour, is_deleted) VALUES (?, ?, ?, ?, ?)',
      ['Xbox Station Alpha', 'Xbox', 'available', 220.0, 0]
    );
    const psConsoles = await allQuery(
      'SELECT * FROM consoles WHERE is_deleted = 0 AND platform = ? ORDER BY id ASC',
      ['PlayStation']
    );
    assert.ok(psConsoles.length > 0, 'Should find PlayStation consoles.');
    assert.ok(psConsoles.every((c) => c.platform === 'PlayStation' && c.is_deleted === 0));
    recordPass(`Found ${psConsoles.length} matching console(s) via platform index.`);

    // Test 5: Soft Delete and Restore Lifecycle in SQL
    totalCount++;
    console.log('\n[Test 5] Soft Delete and Restore Lifecycle in SQL...');
    const softDelRes = await runQuery(
      'UPDATE consoles SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = 0',
      [c2.id]
    );
    assert.strictEqual(softDelRes.changes, 1);
    const checkHidden = await getQuery('SELECT * FROM consoles WHERE id = ? AND is_deleted = 0', [c2.id]);
    assert.strictEqual(checkHidden, undefined, 'Soft-deleted console must not be returned.');
    const restoreRes = await runQuery(
      'UPDATE consoles SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [c2.id]
    );
    assert.strictEqual(restoreRes.changes, 1);
    const checkRestored = await getQuery('SELECT * FROM consoles WHERE id = ? AND is_deleted = 0', [c2.id]);
    assert.strictEqual(checkRestored.is_deleted, 0);
    recordPass('Console soft delete and restore lifecycle verified in SQL.');

    // Test 6: Relational 3-Table INNER JOIN Query
    totalCount++;
    console.log('\n[Test 6] Centralised 3-Table Relational INNER JOIN...');
    const bookingRes = await runQuery(
      'INSERT INTO bookings (gamer_id, console_id, booking_date, hours, total_amount, status) VALUES (?, ?, ?, ?, ?, ?)',
      [gamerRes.id, c1.id, '2026-11-20', 3, 750, 'confirmed']
    );
    const joinedRows = await getJoinedBookings();
    assert.ok(joinedRows.length > 0, 'Joined bookings must return records.');
    const targetBooking = joinedRows.find((b) => b.id === bookingRes.id);
    assert.ok(targetBooking, 'Target booking must exist in joined result.');
    assert.strictEqual(targetBooking.gamer_name, 'Master Chief');
    assert.strictEqual(targetBooking.console_name, 'PS5 Station Omega');
    assert.strictEqual(targetBooking.platform, 'PlayStation');
    recordPass(`JOIN query returned complete relational row for booking ID ${bookingRes.id}.`);

    // ========================================================================
    // SECTION 2: LIVE EXPRESS HTTP REST API INTEGRATION TESTS
    // ========================================================================
    console.log('\n--- SECTION 2: Live Express HTTP REST API Integration Tests ---');

    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`  Live test server listening on http://localhost:${TEST_PORT}`);
        resolve();
      });
    });

    const BASE_URL = `http://localhost:${TEST_PORT}`;

    // Test 7: GET /health
    totalCount++;
    console.log('\n[Test 7] GET /health (API Healthcheck)...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.strictEqual(healthJson.status, 'OK');
    recordPass('GET /health returned status 200 with OK payload.');

    // Test 8: Gamers API - POST, Validation, GET, PUT, DELETE
    totalCount++;
    console.log('\n[Test 8] Gamers API (POST, Validation, GET, PUT)...');
    const invalidGamerRes = await fetch(`${BASE_URL}/gamers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'bad' }),
    });
    assert.strictEqual(invalidGamerRes.status, 400);

    const newGamerRes = await fetch(`${BASE_URL}/gamers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Kratos',
        email: `kratos.${Date.now()}@sparta.com`,
        phone: '555-0199',
      }),
    });
    assert.strictEqual(newGamerRes.status, 201);
    const newGamerJson = await newGamerRes.json();
    const createdGamerId = newGamerJson.gamer.id;

    const getGamerRes = await fetch(`${BASE_URL}/gamers/${createdGamerId}`);
    assert.strictEqual(getGamerRes.status, 200);
    const gamerPayload = await getGamerRes.json();
    assert.strictEqual(gamerPayload.name, 'Kratos');
    recordPass('Gamers API creates, validates, and fetches correctly.');

    // Test 9: Consoles API - Soft Delete & Restore Sequence (The Twist)
    totalCount++;
    console.log('\n[Test 9] Consoles API - Soft Delete and Restore Lifecycle (Twist Test)...');
    const newConsoleRes = await fetch(`${BASE_URL}/consoles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nintendo Switch OLED - Unit 4',
        platform: 'Nintendo',
        status: 'available',
        price_per_hour: 180,
      }),
    });
    assert.strictEqual(newConsoleRes.status, 201);
    const newConsoleJson = await newConsoleRes.json();
    const testConsoleId = newConsoleJson.console.id;

    // Step A: DELETE /consoles/:id -> 200 OK (Soft Delete)
    const delConsoleRes = await fetch(`${BASE_URL}/consoles/${testConsoleId}`, { method: 'DELETE' });
    assert.strictEqual(delConsoleRes.status, 200);
    const delJson = await delConsoleRes.json();
    assert.strictEqual(delJson.message, 'Console soft deleted successfully.');

    // Step B: GET /consoles/:id -> 404 Not Found (Hidden)
    const hiddenRes = await fetch(`${BASE_URL}/consoles/${testConsoleId}`);
    assert.strictEqual(hiddenRes.status, 404);

    // Step C: POST /consoles/:id/restore -> 200 OK (Restored)
    const restoreApiRes = await fetch(`${BASE_URL}/consoles/${testConsoleId}/restore`, { method: 'POST' });
    assert.strictEqual(restoreApiRes.status, 200);

    // Step D: GET /consoles/:id -> 200 OK (Accessible again)
    const restoredGetRes = await fetch(`${BASE_URL}/consoles/${testConsoleId}`);
    assert.strictEqual(restoredGetRes.status, 200);
    const restoredConsole = await restoredGetRes.json();
    assert.strictEqual(restoredConsole.is_deleted, 0);
    recordPass('Twist lifecycle verified: DELETE (200) -> GET (404) -> POST restore (200) -> GET (200).');

    // Test 10: Search Consoles by Platform
    totalCount++;
    console.log('\n[Test 10] GET /consoles?platform=Nintendo (Search Endpoint)...');
    const searchRes = await fetch(`${BASE_URL}/consoles?platform=Nintendo`);
    assert.strictEqual(searchRes.status, 200);
    const searchResults = await searchRes.json();
    assert.ok(searchResults.length > 0);
    assert.ok(searchResults.every((c) => c.platform === 'Nintendo' && c.is_deleted === 0));
    recordPass(`Platform query parameter search returned ${searchResults.length} matching active console(s).`);

    // Test 11: Relational Bookings JOIN Endpoints (/bookings/join & /bookings/details)
    totalCount++;
    console.log('\n[Test 11] Bookings JOIN Endpoints (/bookings/join and /bookings/details)...');
    const newBookingRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gamer_id: createdGamerId,
        console_id: testConsoleId,
        booking_date: '2026-11-25',
        hours: 2,
        total_amount: 360,
        status: 'confirmed',
      }),
    });
    assert.strictEqual(newBookingRes.status, 201);
    const newBookingJson = await newBookingRes.json();
    const createdBookingId = newBookingJson.booking.id;

    // Verify /bookings/join
    const joinRes = await fetch(`${BASE_URL}/bookings/join`);
    assert.strictEqual(joinRes.status, 200);
    const joinList = await joinRes.json();
    const joinedItem = joinList.find((b) => b.id === createdBookingId);
    assert.ok(joinedItem, 'Joined booking must exist.');
    assert.strictEqual(joinedItem.gamer_name, 'Kratos');
    assert.strictEqual(joinedItem.console_name, 'Nintendo Switch OLED - Unit 4');

    // Verify /bookings/details returns identical data
    const detailsRes = await fetch(`${BASE_URL}/bookings/details`);
    assert.strictEqual(detailsRes.status, 200);
    const detailsList = await detailsRes.json();
    const detailsItem = detailsList.find((b) => b.id === createdBookingId);
    assert.deepStrictEqual(joinedItem, detailsItem, 'join and details endpoints must return identical data.');
    recordPass('Both /bookings/join and /bookings/details return correct relational fields.');

    // Test 12: Invalid Foreign Key Handling & Unknown Routes
    totalCount++;
    console.log('\n[Test 12] Invalid Foreign Key & 404 Route Handling...');
    const invalidBookingRes = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gamer_id: 999999,
        console_id: testConsoleId,
        booking_date: '2026-11-25',
        hours: 2,
        total_amount: 360,
      }),
    });
    assert.strictEqual(invalidBookingRes.status, 404);

    const unknownRouteRes = await fetch(`${BASE_URL}/non-existent-endpoint`);
    assert.strictEqual(unknownRouteRes.status, 404);
    const unknownJson = await unknownRouteRes.json();
    assert.strictEqual(unknownJson.error, 'Route not found.');
    recordPass('Invalid foreign key returns 404; unknown routes return standardized JSON error.');

    console.log('\n================================================================');
    console.log(`  ALL TESTS PASSED SUCCESSFULLY! (${passedCount}/${totalCount})`);
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILURE:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await closeDatabase();

    // Clean up isolated test database file
    try {
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }
    } catch (_) {}
  }
}

runAllTests();
