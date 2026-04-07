/**
 * Heuristic service and component guidance from odometer trend + vehicle age.
 * Odometer values are in miles.
 * Not a substitute for the owner's manual or a qualified mechanic.
 */

function weeksBetween(a, b) {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return ms / (7 * 24 * 60 * 60 * 1000);
}

function computeUsage(entries) {
  if (!entries || entries.length < 2) return { miPerWeek: null, miPerDay: null };
  const sorted = [...entries].sort(
    (x, y) => new Date(y.recorded_at) - new Date(x.recorded_at)
  );
  const latest = sorted[0];
  const prev = sorted[1];
  const mi = latest.odometer_mi - prev.odometer_mi;
  const days =
    (new Date(latest.recorded_at) - new Date(prev.recorded_at)) / (24 * 60 * 60 * 1000);
  if (days <= 0 || mi < 0) return { miPerWeek: null, miPerDay: null };
  const miPerDay = mi / days;
  return { miPerWeek: miPerDay * 7, miPerDay };
}

function buildRecommendations(vehicle, mileageEntries) {
  const now = new Date();
  const ageYears = Math.max(0, now.getFullYear() - Number(vehicle.year));
  const { miPerWeek, miPerDay } = computeUsage(mileageEntries);
  const items = [];
  const currentMi = Number(vehicle.current_odometer_mi) || 0;

  if (miPerWeek != null) {
    items.push({
      type: 'usage',
      severity: 'info',
      title: 'Recent driving rate',
      detail: `About ${Math.round(miPerWeek)} mi/week based on your last two readings.`,
    });
    const oilIntervalMi = 6000;
    const monthsOil = 12;
    if (vehicle.last_service_odometer_mi != null && vehicle.last_service_date) {
      const sinceMi = currentMi - vehicle.last_service_odometer_mi;
      const sinceMonths =
        (now - new Date(vehicle.last_service_date)) / (30.44 * 24 * 60 * 60 * 1000);
      if (sinceMi >= oilIntervalMi || sinceMonths >= monthsOil) {
        items.push({
          type: 'service',
          severity: 'due',
          title: 'Oil & filter service',
          detail: `Last logged service was ${Math.round(sinceMi)} mi ago (~${Math.round(sinceMonths)} months). Typical interval ~${oilIntervalMi} mi or 12 months.`,
        });
      } else {
        const miLeft = oilIntervalMi - sinceMi;
        const estWeeks = miPerWeek > 0 ? miLeft / miPerWeek : null;
        items.push({
          type: 'service',
          severity: 'ok',
          title: 'Oil & filter',
          detail:
            estWeeks != null && estWeeks < 520
              ? `Roughly ${Math.max(0, Math.round(estWeeks))} weeks of driving at your current rate until ~${oilIntervalMi} mi since last service.`
              : `${Math.round(miLeft)} mi remaining before typical ${oilIntervalMi} mi oil interval (since last logged service).`,
        });
      }
    } else {
      items.push({
        type: 'service',
        severity: 'watch',
        title: 'Log last service',
        detail:
          'Add your last oil service odometer and date in vehicle settings to get accurate oil-change timing.',
      });
    }
  }

  if (ageYears >= 3) {
    items.push({
      type: 'component',
      severity: ageYears >= 4 ? 'due' : 'watch',
      title: 'Battery',
      detail: 'Most batteries last about 3–5 years; consider testing or replacement.',
    });
  }
  if (ageYears >= 2) {
    items.push({
      type: 'fluid',
      severity: 'watch',
      title: 'Brake fluid',
      detail: 'Many manufacturers suggest replacement every 2 years.',
    });
  }
  if (ageYears >= 5) {
    items.push({
      type: 'component',
      severity: 'watch',
      title: 'Coolant / hoses',
      detail: 'Coolant exchange and hose inspection are common around 5+ years.',
    });
  }
  if (ageYears >= 7 || currentMi >= 100000) {
    items.push({
      type: 'component',
      severity: 'watch',
      title: 'Timing belt / chain',
      detail:
        'If your engine uses a timing belt, many schedules are near 7 years or 100k mi—confirm in your manual.',
    });
  }
  if (currentMi >= 60000 && (miPerWeek == null || miPerWeek > 0)) {
    items.push({
      type: 'service',
      severity: 'info',
      title: 'Spark plugs / filters',
      detail: 'Air filter and spark plugs are often due in the 60k–100k mi range depending on model.',
    });
  }

  return {
    generatedAt: now.toISOString(),
    ageYears,
    miPerWeek,
    miPerDay,
    items,
  };
}

module.exports = { buildRecommendations, computeUsage, weeksBetween };
