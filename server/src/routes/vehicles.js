const express = require('express');
const { z } = require('zod');
const { authMiddleware } = require('../middleware/auth');
const { buildRecommendations } = require('../lib/recommendations');
const { generateId } = require('../lib/ids');
const Vehicle = require('../models/Vehicle');
const MileageEntry = require('../models/MileageEntry');
const ServiceActivity = require('../models/ServiceActivity');

const router = express.Router();
router.use(authMiddleware);

const vehicleCreate = z.object({
  nickname: z.string().min(1).max(120),
  make: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  current_odometer_mi: z.coerce.number().int().min(0),
  last_service_odometer_mi: z.coerce.number().int().min(0).optional().nullable(),
  last_service_date: z.string().optional().nullable(),
});

const vehiclePatch = vehicleCreate.partial();

function stripId(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}

async function assertVehicleOwner(vehicleId, userId) {
  const v = await Vehicle.findOne({ _id: vehicleId, user_id: userId }).select({ _id: 1 }).lean();
  return Boolean(v);
}

router.get('/', async (req, res) => {
  const rows = await Vehicle.find({ user_id: req.userId })
    .sort({ created_at: -1 })
    .select({
      _id: 1,
      nickname: 1,
      make: 1,
      model: 1,
      year: 1,
      current_odometer_mi: 1,
      last_mileage_at: 1,
      last_service_odometer_mi: 1,
      last_service_date: 1,
      created_at: 1,
    })
    .lean();
  res.json(rows.map(stripId));
});

router.post('/', async (req, res) => {
  const parsed = vehicleCreate.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const d = parsed.data;
  const id = generateId();
  const last_mileage_at = new Date().toISOString();

  await Vehicle.create({
    _id: id,
    user_id: req.userId,
    nickname: d.nickname,
    make: d.make,
    model: d.model,
    year: d.year,
    current_odometer_mi: d.current_odometer_mi,
    last_mileage_at,
    last_service_odometer_mi: d.last_service_odometer_mi ?? null,
    last_service_date: d.last_service_date ?? null,
  });
  await MileageEntry.create({
    _id: generateId(),
    vehicle_id: id,
    odometer_mi: d.current_odometer_mi,
    recorded_at: last_mileage_at,
    note: 'Initial odometer',
  });

  const row = await Vehicle.findById(id)
    .select({
      _id: 1,
      nickname: 1,
      make: 1,
      model: 1,
      year: 1,
      current_odometer_mi: 1,
      last_mileage_at: 1,
      last_service_odometer_mi: 1,
      last_service_date: 1,
      created_at: 1,
    })
    .lean();
  res.status(201).json(stripId(row));
});

router.get('/:id/mileage', async (req, res) => {
  if (!(await assertVehicleOwner(req.params.id, req.userId))) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const entries = await MileageEntry.find({ vehicle_id: req.params.id })
    .sort({ recorded_at: -1 })
    .limit(100)
    .select({ _id: 1, odometer_mi: 1, recorded_at: 1, note: 1 })
    .lean();
  res.json(entries.map(stripId));
});

const mileagePost = z.object({
  odometer_mi: z.coerce.number().int().min(0),
  note: z.string().max(500).optional().nullable(),
});

router.post('/:id/mileage', async (req, res) => {
  const parsed = mileagePost.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const vehicle = await Vehicle.findOne({ _id: req.params.id, user_id: req.userId })
    .select({
      _id: 1,
      nickname: 1,
      make: 1,
      model: 1,
      year: 1,
      current_odometer_mi: 1,
      last_mileage_at: 1,
      last_service_odometer_mi: 1,
      last_service_date: 1,
    })
    .lean();
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const { odometer_mi, note } = parsed.data;
  if (odometer_mi < vehicle.current_odometer_mi) {
    return res.status(400).json({ error: 'Odometer cannot be less than current reading' });
  }

  const recorded_at = new Date().toISOString();
  const entryId = generateId();
  await MileageEntry.create({
    _id: entryId,
    vehicle_id: vehicle._id,
    odometer_mi,
    recorded_at,
    note: note ?? null,
  });
  await Vehicle.updateOne(
    { _id: vehicle._id, user_id: req.userId },
    { $set: { current_odometer_mi: odometer_mi, last_mileage_at: recorded_at } }
  );

  const entries = await MileageEntry.find({ vehicle_id: vehicle._id })
    .sort({ recorded_at: -1 })
    .limit(20)
    .select({ _id: 1, odometer_mi: 1, recorded_at: 1, note: 1 })
    .lean();
  const updated = await Vehicle.findById(vehicle._id)
    .select({
      _id: 1,
      nickname: 1,
      make: 1,
      model: 1,
      year: 1,
      current_odometer_mi: 1,
      last_mileage_at: 1,
      last_service_odometer_mi: 1,
      last_service_date: 1,
      created_at: 1,
    })
    .lean();

  res.status(201).json({
    vehicle: stripId(updated),
    entry: stripId(entries[0]),
    entries: entries.map(stripId),
  });
});

router.get('/:id/recommendations', async (req, res) => {
  const vehicle = await Vehicle.findOne({ _id: req.params.id, user_id: req.userId })
    .select({
      _id: 1,
      nickname: 1,
      make: 1,
      model: 1,
      year: 1,
      current_odometer_mi: 1,
      last_mileage_at: 1,
      last_service_odometer_mi: 1,
      last_service_date: 1,
    })
    .lean();
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  const mileageEntries = await MileageEntry.find({ vehicle_id: req.params.id })
    .sort({ recorded_at: -1 })
    .limit(10)
    .select({ odometer_mi: 1, recorded_at: 1 })
    .lean();
  res.json(buildRecommendations(stripId(vehicle), mileageEntries));
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
  odometer_mi: z.coerce.number().int().min(0).optional().nullable(),
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

router.get('/:id/service-activities', async (req, res) => {
  if (!(await assertVehicleOwner(req.params.id, req.userId))) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const rows = await ServiceActivity.find({ vehicle_id: req.params.id })
    .sort({ performed_at: -1, created_at: -1 })
    .limit(200)
    .select({
      _id: 1,
      vehicle_id: 1,
      activity_type: 1,
      title: 1,
      notes: 1,
      obd_codes: 1,
      recommendation_ref: 1,
      odometer_mi: 1,
      performed_at: 1,
      created_at: 1,
    })
    .lean();
  res.json(rows.map(stripId));
});

router.post('/:id/service-activities', async (req, res) => {
  const parsed = serviceActivityPost.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  if (!(await assertVehicleOwner(req.params.id, req.userId))) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const d = parsed.data;

  let title =
    (d.title && d.title.trim()) || DEFAULT_ACTIVITY_TITLES[d.activity_type] || 'Service activity';
  if (d.activity_type === 'recommendation_completed' && d.recommendation_ref?.title) {
    title = `Done: ${d.recommendation_ref.title}`;
  }
  const performed_at = d.performed_at
    ? new Date(d.performed_at).toISOString()
    : new Date().toISOString();

  const activityId = generateId();
  await ServiceActivity.create({
    _id: activityId,
    vehicle_id: req.params.id,
    activity_type: d.activity_type,
    title,
    notes: d.notes ?? null,
    obd_codes: d.obd_codes ?? null,
    recommendation_ref: d.recommendation_ref ?? null,
    odometer_mi: d.odometer_mi ?? null,
    performed_at,
  });

  const row = await ServiceActivity.findById(activityId)
    .select({
      _id: 1,
      vehicle_id: 1,
      activity_type: 1,
      title: 1,
      notes: 1,
      obd_codes: 1,
      recommendation_ref: 1,
      odometer_mi: 1,
      performed_at: 1,
      created_at: 1,
    })
    .lean();
  res.status(201).json(stripId(row));
});

router.delete('/:id/service-activities/:activityId', async (req, res) => {
  if (!(await assertVehicleOwner(req.params.id, req.userId))) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const r = await ServiceActivity.deleteOne({
    _id: req.params.activityId,
    vehicle_id: req.params.id,
  });
  if (r.deletedCount === 0) return res.status(404).json({ error: 'Activity not found' });
  res.status(204).send();
});

router.get('/:id', async (req, res) => {
  const row = await Vehicle.findOne({ _id: req.params.id, user_id: req.userId })
    .select({
      _id: 1,
      nickname: 1,
      make: 1,
      model: 1,
      year: 1,
      current_odometer_mi: 1,
      last_mileage_at: 1,
      last_service_odometer_mi: 1,
      last_service_date: 1,
      created_at: 1,
    })
    .lean();
  if (!row) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(stripId(row));
});

router.patch('/:id', async (req, res) => {
  const parsed = vehiclePatch.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const existing = await Vehicle.findOne({ _id: req.params.id, user_id: req.userId })
    .select({ _id: 1 })
    .lean();
  if (!existing) return res.status(404).json({ error: 'Vehicle not found' });

  const d = parsed.data;
  const allowed = [
    'nickname',
    'make',
    'model',
    'year',
    'current_odometer_mi',
    'last_service_odometer_mi',
    'last_service_date',
  ];
  const set = {};
  for (const k of allowed) {
    if (d[k] !== undefined) set[k] = d[k];
  }
  if (Object.keys(set).length) {
    await Vehicle.updateOne({ _id: req.params.id, user_id: req.userId }, { $set: set });
  }

  const row = await Vehicle.findById(req.params.id)
    .select({
      _id: 1,
      nickname: 1,
      make: 1,
      model: 1,
      year: 1,
      current_odometer_mi: 1,
      last_mileage_at: 1,
      last_service_odometer_mi: 1,
      last_service_date: 1,
      created_at: 1,
    })
    .lean();
  res.json(stripId(row));
});

router.delete('/:id', async (req, res) => {
  const r = await Vehicle.deleteOne({ _id: req.params.id, user_id: req.userId });
  if (r.deletedCount === 0) return res.status(404).json({ error: 'Vehicle not found' });
  await MileageEntry.deleteMany({ vehicle_id: req.params.id });
  await ServiceActivity.deleteMany({ vehicle_id: req.params.id });
  res.status(204).send();
});

module.exports = router;
