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
- `is_deleted` - soft delete flag (0 = active, 1 = deleted)
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
- `GET /gamers` - Get all gamers
- `GET /gamers/:id` - Get gamer by ID
- `POST /gamers` - Create a gamer
- `PUT /gamers/:id` - Update gamer
- `DELETE /gamers/:id` - Delete gamer

### Consoles
- `GET /consoles` - Get active consoles (hides deleted)
- `GET /consoles/:id` - Get active console by ID
- `POST /consoles` - Create console
- `PUT /consoles/:id` - Update console
- `DELETE /consoles/:id` - Soft delete console (marks is_deleted = 1)
- `POST /consoles/:id/restore` - Restore deleted console (marks is_deleted = 0)

### Bookings
- `GET /bookings` - Get all bookings
- `GET /bookings/:id` - Get booking by ID
- `POST /bookings` - Create booking
- `PUT /bookings/:id` - Update booking
- `DELETE /bookings/:id` - Delete booking
- `GET /bookings/join` - View booking details with gamer and console names

---

## Part 5 – Soft Delete and Restore (Individual Feature)

**Feature Responsibility:** Part 5 – Twist Rule: Soft Delete and Restore  
**Contributor:** Pantala Niharika  

Instead of permanently removing a console from the database, this feature updates the `is_deleted` column.

### Behavior:
- `DELETE /consoles/:id`: Updates `is_deleted = 1`. Returns `200` on success, or `404` if the console does not exist or is already deleted.
- `GET /consoles`: Automatically hides deleted consoles (`WHERE is_deleted = 0`). Also respects platform search (`?platform=...`).
- `GET /consoles/:id`: Returns console details if active. Returns `404` if the console is deleted or does not exist.
- `POST /consoles/:id/restore`: Updates `is_deleted = 0`. Returns `200` on success, or `404` if the console does not exist or is already active.

### Compulsory Test Sequence (Console ID 4):
1. **DELETE /consoles/4** → `200 OK` (Soft deleted)
2. **GET /consoles/4** → `404 Not Found` (Console is hidden)
3. **POST /consoles/4/restore** → `200 OK` (Console restored)
4. **GET /consoles/4** → `200 OK` (Console is active again)
