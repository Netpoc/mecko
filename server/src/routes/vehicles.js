const express = require('express');
const { z } = require('zod');
const { db, generateId } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { buildRecommendations } = require('../lib/recommendations');

const router = express.Router();
router.use(authMiddleware);

const vehicleCreate = z.object({
  nickname: z.string().min(1).max(120),
  make: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  current_odometer_km: z.coerce.number().int().min(0),
  last_service_odometer_km: z.coerce.number().int().min(0).optional().nullable(),
  last_service_date: z.string().optional().nullable(),
});

const vehiclePatch = vehicleCreate.partial();

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, nickname, make, model, year, current_odometer_km, last_mileage_at,
              last_service_odometer_km, last_service_date, created_at
       FROM vehicles WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(req.userId);
  res.json(rows);
});

router.post('/', (req, res) => {
  const parsed = vehicleCreate.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const d = parsed.data;
  const id = generateId();
  const last_mileage_at = new Date().toISOString();
  db.prepare(
    `INSERT INTO vehicles (
      id, user_id, nickname, make, model, year, current_odometer_km, last_mileage_at,
      last_service_odometer_km, last_service_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.userId,
    d.nickname,
    d.make,
    d.model,
    d.year,
    d.current_odometer_km,
    last_mileage_at,
    d.last_service_odometer_km ?? null,
    d.last_service_date ?? null
  );
  db.prepare(
    `INSERT INTO mileage_entries (id, vehicle_id, odometer_km, recorded_at, note)
     VALUES (?, ?, ?, ?, ?)`
  ).run(generateId(), id, d.current_odometer_km, last_mileage_at, 'Initial odometer');
  const row = db
    .prepare(
      `SELECT id, nickname, make, model, year, current_odometer_km, last_mileage_at,
              last_service_odometer_km, last_service_date, created_at
       FROM vehicles WHERE id = ?`
    )
    .get(id);
  res.status(201).json(row);
});

router.get('/:id/mileage', (req, res) => {
  const v = db
    .prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!v) return res.status(404).json({ error: 'Vehicle not found' });
  const entries = db
    .prepare(
      `SELECT id, odometer_km, recorded_at, note FROM mileage_entries
       WHERE vehicle_id = ? ORDER BY recorded_at DESC LIMIT 100`
    )
    .all(req.params.id);
  res.json(entries);
});

const mileagePost = z.object({
  odometer_km: z.coerce.number().int().min(0),
  note: z.string().max(500).optional().nullable(),
});

router.post('/:id/mileage', (req, res) => {
  const parsed = mileagePost.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const vehicle = db
    .prepare(
      `SELECT id, nickname, make, model, year, current_odometer_km, last_mileage_at,
              last_service_odometer_km, last_service_date
       FROM vehicles WHERE id = ? AND user_id = ?`
    )
    .get(req.params.id, req.userId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  const { odometer_km, note } = parsed.data;
  if (odometer_km < vehicle.current_odometer_km) {
    return res.status(400).json({ error: 'Odometer cannot be less than current reading' });
  }
  const recorded_at = new Date().toISOString();
  const entryId = generateId();
  db.prepare(
    `INSERT INTO mileage_entries (id, vehicle_id, odometer_km, recorded_at, note)
     VALUES (?, ?, ?, ?, ?)`
  ).run(entryId, vehicle.id, odometer_km, recorded_at, note ?? null);
  db.prepare(
    `UPDATE vehicles SET current_odometer_km = ?, last_mileage_at = ? WHERE id = ?`
  ).run(odometer_km, recorded_at, vehicle.id);
  const entries = db
    .prepare(
      `SELECT id, odometer_km, recorded_at, note FROM mileage_entries
       WHERE vehicle_id = ? ORDER BY recorded_at DESC LIMIT 20`
    )
    .all(vehicle.id);
  const updated = db
    .prepare(
      `SELECT id, nickname, make, model, year, current_odometer_km, last_mileage_at,
              last_service_odometer_km, last_service_date, created_at
       FROM vehicles WHERE id = ?`
    )
    .get(vehicle.id);
  res.status(201).json({ vehicle: updated, entry: entries[0], entries });
});

router.get('/:id/recommendations', (req, res) => {
  const vehicle = db
    .prepare(
      `SELECT id, nickname, make, model, year, current_odometer_km, last_mileage_at,
              last_service_odometer_km, last_service_date
       FROM vehicles WHERE id = ? AND user_id = ?`
    )
    .get(req.params.id, req.userId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  const mileageEntries = db
    .prepare(
      `SELECT odometer_km, recorded_at FROM mileage_entries
       WHERE vehicle_id = ? ORDER BY recorded_at DESC LIMIT 10`
    )
    .all(req.params.id);
  res.json(buildRecommendations(vehicle, mileageEntries));
});

const activityTypes = z.enum([
  'spark_plug_change',
  'obdii_scan',
  'obdii_error_fix',
  'tire_replacement',
  'brake_fluid_change',
  'recommendation_completed',
  'other',
]);

const recommendationRefSchema = z
  .object({
    title: z.string().min(1).max(200),
    type: z.string().max(80).optional().nullable(),
    severity: z.string().max(40).optional().nullable(),
    detail: z.string().max(2000).optional().nullable(),
  })
  .optional()
  .nullable();

const serviceActivityPost = z.object({
  activity_type: activityTypes,
  title: z.string().min(1).max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  obd_codes: z.string().max(500).optional().nullable(),
  recommendation_ref: recommendationRefSchema,
  performed_at: z.string().optional().nullable(),
  odometer_km: z.coerce.number().int().min(0).optional().nullable(),
});

const DEFAULT_ACTIVITY_TITLES = {
  spark_plug_change: 'Spark plug replacement',
  obdii_scan: 'OBD-II scan / diagnostic reading',
  obdii_error_fix: 'Error code repair / fix',
  tire_replacement: 'Tire replacement',
  brake_fluid_change: 'Brake fluid change',
  recommendation_completed: 'Recommended maintenance completed',
  other: 'Service activity',
};

function assertVehicleOwner(vehicleId, userId) {
  return db
    .prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?')
    .get(vehicleId, userId);
}

router.get('/:id/service-activities', (req, res) => {
  if (!assertVehicleOwner(req.params.id, req.userId)) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  let rows;
  try {
    rows = db
      .prepare(
        `SELECT id, vehicle_id, activity_type, title, notes, obd_codes, recommendation_ref,
                odometer_km, performed_at, created_at
         FROM service_activities WHERE vehicle_id = ? ORDER BY performed_at DESC, created_at DESC LIMIT 200`
      )
      .all(req.params.id);
  } catch (e) {
    return res.status(503).json({
      error: 'Service activities unavailable',
      detail: 'Restart the API server after updating so the database schema can create service_activities.',
    });
  }
  const parsed = rows.map((r) => {
    let recommendation_ref = null;
    if (r.recommendation_ref) {
      try {
        recommendation_ref = JSON.parse(r.recommendation_ref);
      } catch {
        recommendation_ref = null;
      }
    }
    return { ...r, recommendation_ref };
  });
  res.json(parsed);
});

router.post('/:id/service-activities', (req, res) => {
  const parsed = serviceActivityPost.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  if (!assertVehicleOwner(req.params.id, req.userId)) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const d = parsed.data;
  let title =
    (d.title && d.title.trim()) ||
    DEFAULT_ACTIVITY_TITLES[d.activity_type] ||
    'Service activity';
  if (d.activity_type === 'recommendation_completed' && d.recommendation_ref?.title) {
    title = `Done: ${d.recommendation_ref.title}`;
  }
  const performed_at = d.performed_at
    ? new Date(d.performed_at).toISOString()
    : new Date().toISOString();
  const activityId = generateId();
  const refJson = d.recommendation_ref ? JSON.stringify(d.recommendation_ref) : null;
  db.prepare(
    `INSERT INTO service_activities (
      id, vehicle_id, activity_type, title, notes, obd_codes, recommendation_ref, odometer_km, performed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    activityId,
    req.params.id,
    d.activity_type,
    title,
    d.notes ?? null,
    d.obd_codes ?? null,
    refJson,
    d.odometer_km ?? null,
    performed_at
  );
  const row = db
    .prepare(
      `SELECT id, vehicle_id, activity_type, title, notes, obd_codes, recommendation_ref,
              odometer_km, performed_at, created_at FROM service_activities WHERE id = ?`
    )
    .get(activityId);
  let recommendation_ref = null;
  if (row.recommendation_ref) {
    try {
      recommendation_ref = JSON.parse(row.recommendation_ref);
    } catch {
      recommendation_ref = null;
    }
  }
  res.status(201).json({ ...row, recommendation_ref });
});

router.delete('/:id/service-activities/:activityId', (req, res) => {
  if (!assertVehicleOwner(req.params.id, req.userId)) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const r = db
    .prepare(
      'DELETE FROM service_activities WHERE id = ? AND vehicle_id = ?'
    )
    .run(req.params.activityId, req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Activity not found' });
  res.status(204).send();
});

router.get('/:id', (req, res) => {
  const row = db
    .prepare(
      `SELECT id, nickname, make, model, year, current_odometer_km, last_mileage_at,
              last_service_odometer_km, last_service_date, created_at
       FROM vehicles WHERE id = ? AND user_id = ?`
    )
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(row);
});

router.patch('/:id', (req, res) => {
  const parsed = vehiclePatch.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const existing = db
    .prepare('SELECT id FROM vehicles WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Vehicle not found' });
  const d = parsed.data;
  const fields = [];
  const values = [];
  for (const key of [
    'nickname',
    'make',
    'model',
    'year',
    'current_odometer_km',
    'last_service_odometer_km',
    'last_service_date',
  ]) {
    if (d[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(d[key]);
    }
  }
  if (fields.length === 0) {
    const row = db
      .prepare(
        `SELECT id, nickname, make, model, year, current_odometer_km, last_mileage_at,
                last_service_odometer_km, last_service_date, created_at
         FROM vehicles WHERE id = ?`
      )
      .get(req.params.id);
    return res.json(row);
  }
  values.push(req.params.id, req.userId);
  db.prepare(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(
    ...values
  );
  const row = db
    .prepare(
      `SELECT id, nickname, make, model, year, current_odometer_km, last_mileage_at,
              last_service_odometer_km, last_service_date, created_at
       FROM vehicles WHERE id = ?`
    )
    .get(req.params.id);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const r = db
    .prepare('DELETE FROM vehicles WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);
  if (r.changes === 0) return res.status(404).json({ error: 'Vehicle not found' });
  res.status(204).send();
});

module.exports = router;
