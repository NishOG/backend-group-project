# GameZone Arcade

This project is a beginner-friendly backend API for a console gaming centre. It follows the GameZone Arcade assignment brief for Backend Development Fundamentals and focuses on Express.js, SQLite, SQL, REST endpoints, soft delete logic, and API testing.

## Project purpose

GameZone Arcade manages:

- gamers
- consoles
- bookings

A gamer books a console for a time slot, and the backend stores that relationship in the `bookings` table.

## Tech stack

- Node.js
- Express.js
- SQLite3
- Postman

## Folder structure

```text
project-root/
├── data/
│   └── gamezone.db
├── .gitignore
├── package.json
├── README.md
├── server.js
└── node_modules/
```

## Setup

1. Open the project folder in VS Code.
2. Run:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

4. For development mode with auto-restart:

```bash
npm run dev
```

The API will run on:

```text
http://localhost:3000
```

## Health check

```http
GET /health
```

Example response:

```json
{
  "status": "OK",
  "message": "GameZone Arcade API is running."
}
```

## Database tables

### gamers

Stores player details.

Columns:

- `id` - unique gamer ID
- `name` - gamer name
- `email` - gamer email
- `phone` - optional phone number
- `created_at` - time when the record was created

### consoles

Stores console availability.

Columns:

- `id` - unique console ID
- `name` - console model name
- `platform` - PS5, Xbox, PC, etc.
- `status` - available or maintenance
- `price_per_hour` - hourly rate
- `is_deleted` - soft delete flag
- `created_at` - creation time
- `updated_at` - last update time

### bookings

Stores a gamer booking for a console.

Columns:

- `id` - unique booking ID
- `gamer_id` - linked gamer
- `console_id` - linked console
- `booking_date` - date of booking
- `hours` - duration of booking
- `total_amount` - total amount charged
- `status` - confirmed or cancelled
- `created_at` - time of booking

## API endpoints

### Gamers

```http
GET /gamers
GET /gamers/:id
POST /gamers
PUT /gamers/:id
DELETE /gamers/:id
```

### Consoles

```http
GET /consoles
GET /consoles/:id
POST /consoles
PUT /consoles/:id
DELETE /consoles/:id
POST /consoles/:id/restore
```

### Bookings

```http
GET /bookings
GET /bookings/:id
POST /bookings
PUT /bookings/:id
DELETE /bookings/:id
GET /bookings/join
GET /bookings/details
```

## Soft delete concept

The console table includes `is_deleted`.

- `0` means the console is active.
- `1` means the console is deleted logically, but the record still exists in the database.

A normal `GET /consoles` query hides deleted consoles.

This is called soft deletion because we do not physically remove the database row.

## Search using query parameters

You can search consoles by platform.

Example:

```http
GET /consoles?platform=PlayStation
```

This is a query parameter because it is sent in the URL after `?`.

## JOIN endpoint

The booking join endpoint combines the `bookings`, `gamers`, and `consoles` tables.

Example:

```http
GET /bookings/join
```

It returns booking data together with the gamer name and console name.

SQL concept used:

```sql
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
WHERE c.is_deleted = 0;
```

## Example Postman requests

### Create a gamer

```http
POST http://localhost:3000/gamers
Content-Type: application/json

{
  "name": "Aarav",
  "email": "aarav@example.com",
  "phone": "9876543210"
}
```

### Create a console

```http
POST http://localhost:3000/consoles
Content-Type: application/json

{
  "name": "PlayStation 5",
  "platform": "PlayStation",
  "status": "available",
  "price_per_hour": 250
}
```

### Create a booking

```http
POST http://localhost:3000/bookings
Content-Type: application/json

{
  "gamer_id": 1,
  "console_id": 1,
  "booking_date": "2026-11-09",
  "hours": 2,
  "total_amount": 500,
  "status": "confirmed"
}
```

### View booking details with JOIN

```http
GET http://localhost:3000/bookings/join
```

### Soft delete a console

```http
DELETE http://localhost:3000/consoles/1
```

### Restore a deleted console

```http
POST http://localhost:3000/consoles/1/restore
```

## Error handling

The API returns JSON error responses such as:

```json
{
  "error": "Console name is required."
}
```

This is useful for beginners because the client clearly sees what went wrong.

## Learning notes

This backend uses the following SQL basics:

- `CREATE TABLE`
- `INSERT INTO`
- `SELECT`
- `WHERE`
- `ORDER BY`
- `UPDATE`
- `DELETE`
- `INNER JOIN`

Parameterised queries are used with `?` placeholders to protect against invalid data and SQL injection.

## Assignment alignment

This project matches the course requirements:

- Express server with routes
- SQLite database with 3 related tables
- CRUD for consoles and other supporting data
- join endpoint for bookings with gamer and console names
- input validation and clear errors
- console search using query parameters
- soft delete and restore logic
- Postman-ready API endpoints

## Notes

This project is intentionally simple and beginner-friendly so it is easy to understand and extend.
