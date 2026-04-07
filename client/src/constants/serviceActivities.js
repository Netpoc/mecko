/** Labels for `activity_type` from the API */
export const ACTIVITY_TYPE_LABELS = {
  spark_plug_change: 'Spark plug change',
  obdii_scan: 'OBD-II scan / codes',
  obdii_error_fix: 'Error fix / repair',
  tire_replacement: 'Tire replacement',
  brake_fluid_change: 'Brake fluid change',
  recommendation_completed: 'Recommended item done',
  other: 'Other',
}

export const QUICK_ACTIVITY_TYPES = [
  { type: 'spark_plug_change', label: 'Spark plugs' },
  { type: 'obdii_scan', label: 'OBD-II scan' },
  { type: 'obdii_error_fix', label: 'Error fix' },
  { type: 'tire_replacement', label: 'Tires' },
  { type: 'brake_fluid_change', label: 'Brake fluid' },
]
