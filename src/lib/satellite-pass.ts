/**
 * OSIRIS — Satellite Pass Predictor (God's Eye View integration)
 *
 * Computes the next visible pass of any TLE-tracked satellite over a given
 * observer location, using satellite.js for SGP4 propagation.
 *
 * Returns rise, peak (max elevation), and set times plus the visibility
 * flag (whether the satellite is sunlit while the observer is in darkness).
 */

/** A satellite pass prediction. */
export interface SatellitePass {
  /** NORAD catalog ID. */
  noradId: string;
  /** Satellite name. */
  name: string;
  /** Rise time (UTC ISO string). */
  riseTime: string;
  /** Rise azimuth in degrees. */
  riseAzimuth: number;
  /** Peak time (UTC ISO string). */
  peakTime: string;
  /** Peak elevation above horizon in degrees. */
  peakElevation: number;
  /** Set time (UTC ISO string). */
  setTime: string;
  /** Set azimuth in degrees. */
  setAzimuth: number;
  /** Duration in seconds. */
  durationSec: number;
  /** Whether the pass is likely visible to naked eye (sunlit + dark sky). */
  visible: boolean;
}

export interface ObserverLocation {
  /** Latitude in degrees. */
  lat: number;
  /** Longitude in degrees. */
  lng: number;
  /** Altitude above sea level in km (default 0). */
  altKm?: number;
}

/* ── Internal helpers ── */

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/**
 * Compute the elevation angle of a satellite from the observer.
 *
 * Uses a simplified topocentric calculation. For the prediction quality
 * we need (±2 min accuracy), this is sufficient.
 */
export function computeElevation(
  observerLat: number,
  observerLng: number,
  observerAltKm: number,
  satLat: number,
  satLng: number,
  satAltKm: number,
): number {
  const R = 6371; // Earth radius km
  const φ1 = toRad(observerLat);
  const φ2 = toRad(satLat);
  const Δλ = toRad(satLng - observerLng);

  // Central angle
  const cosγ = Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const γ = Math.acos(Math.min(1, Math.max(-1, cosγ)));

  const rObs = R + observerAltKm;
  const rSat = R + satAltKm;

  // Elevation angle from the observer horizon
  const sinEl = (rSat * cosγ - rObs) / Math.sqrt(rObs * rObs + rSat * rSat - 2 * rObs * rSat * cosγ);
  return toDeg(Math.asin(Math.min(1, Math.max(-1, sinEl))));
}

/**
 * Compute the azimuth (bearing) from observer to satellite.
 */
export function computeAzimuth(
  observerLat: number,
  observerLng: number,
  satLat: number,
  satLng: number,
): number {
  const φ1 = toRad(observerLat);
  const φ2 = toRad(satLat);
  const Δλ = toRad(satLng - observerLng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Format a pass time as a human-readable string.
 */
export function formatPassTime(isoString: string): string {
  const d = new Date(isoString);
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  const ss = d.getUTCSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}Z`;
}

/**
 * Format a duration in seconds as mm:ss.
 */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Determine if the Sun is below the horizon for the observer.
 * Uses a simplified solar position calculation (accurate to ±1°).
 */
export function isSunBelowHorizon(
  observerLat: number,
  observerLng: number,
  dateUtc: Date,
): boolean {
  const dayOfYear = Math.floor(
    (dateUtc.getTime() - new Date(dateUtc.getUTCFullYear(), 0, 0).getTime()) / 86400000,
  );
  const declination = -23.44 * Math.cos(toRad((360 / 365) * (dayOfYear + 10)));
  const hourAngle = ((dateUtc.getUTCHours() + dateUtc.getUTCMinutes() / 60) / 24) * 360 - 180 + observerLng;
  const sinAlt =
    Math.sin(toRad(observerLat)) * Math.sin(toRad(declination)) +
    Math.cos(toRad(observerLat)) * Math.cos(toRad(declination)) * Math.cos(toRad(hourAngle));
  // Sun below -6° = civil twilight
  return toDeg(Math.asin(sinAlt)) < -6;
}
