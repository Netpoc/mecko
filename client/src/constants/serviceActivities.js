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

/** Default titles (aligned with server `DEFAULT_ACTIVITY_TITLES`) for offline previews */
export const DEFAULT_ACTIVITY_TITLES = {
  spark_plug_change: 'Spark plug replacement',
  obdii_scan: 'OBD-II scan / diagnostic reading',
  obdii_error_fix: 'Error code repair / fix',
  tire_replacement: 'Tire replacement',
  brake_fluid_change: 'Brake fluid change',
  recommendation_completed: 'Recommended maintenance completed',
  other: 'Service activity',
}

export const QUICK_ACTIVITY_TYPES = [
  { type: 'spark_plug_change', label: 'Spark plugs' },
  { type: 'obdii_scan', label: 'OBD-II scan' },
  { type: 'obdii_error_fix', label: 'Error fix' },
  { type: 'tire_replacement', label: 'Tires' },
  { type: 'brake_fluid_change', label: 'Brake fluid' },
]
