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
    current_odometer_mi INTEGER NOT NULL DEFAULT 0,
    last_mileage_at TEXT,
    last_service_odometer_mi INTEGER,
    last_service_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mileage_entries (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    odometer_mi INTEGER NOT NULL,
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
    odometer_mi INTEGER,
    performed_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);
  CREATE INDEX IF NOT EXISTS idx_mileage_vehicle ON mileage_entries(vehicle_id, recorded_at DESC);
  CREATE INDEX IF NOT EXISTS idx_service_vehicle ON service_activities(vehicle_id, performed_at DESC);
`);

/** Older DBs used *_km column names; values are reinterpreted as miles. */
function migrateOdometerColumnsToMi() {
  const vehicleCols = db.prepare('PRAGMA table_info(vehicles)').all();
  const vNames = vehicleCols.map((c) => c.name);
  if (vNames.includes('current_odometer_km')) {
    db.exec(`
      ALTER TABLE vehicles RENAME COLUMN current_odometer_km TO current_odometer_mi;
      ALTER TABLE vehicles RENAME COLUMN last_service_odometer_km TO last_service_odometer_mi;
    `);
  }
  const meCols = db.prepare('PRAGMA table_info(mileage_entries)').all();
  if (meCols.map((c) => c.name).includes('odometer_km')) {
    db.exec('ALTER TABLE mileage_entries RENAME COLUMN odometer_km TO odometer_mi');
  }
  const saCols = db.prepare('PRAGMA table_info(service_activities)').all();
  if (saCols.map((c) => c.name).includes('odometer_km')) {
    db.exec('ALTER TABLE service_activities RENAME COLUMN odometer_km TO odometer_mi');
  }
}

migrateOdometerColumnsToMi();

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

module.exports = { db, generateId };
