const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.SQLITE_PATH || path.join(dataDir, 'mecko.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    current_odometer_km INTEGER NOT NULL DEFAULT 0,
    last_mileage_at TEXT,
    last_service_odometer_km INTEGER,
    last_service_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mileage_entries (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    odometer_km INTEGER NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS service_activities (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    obd_codes TEXT,
    recommendation_ref TEXT,
    odometer_km INTEGER,
    performed_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);
  CREATE INDEX IF NOT EXISTS idx_mileage_vehicle ON mileage_entries(vehicle_id, recorded_at DESC);
  CREATE INDEX IF NOT EXISTS idx_service_vehicle ON service_activities(vehicle_id, performed_at DESC);
`);

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

module.exports = { db, generateId };
