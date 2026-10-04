/**
 * OSIRIS — Cockpit Camera Engine (God's Eye View integration)
 *
 * Positions the map camera behind a tracked aircraft, interpolating between
 * the 15-second ADS-B poll updates at 60 fps so the ride feels smooth.
 *
 * The camera sits at a fixed offset behind and above the aircraft, looking
 * forward along the heading. Altitude is clamped so the viewpoint never
 * drops below the terrain floor (150 m above ground level).
 *
 * Integration:
 *  - OsirisMap.tsx calls `interpolatePosition()` every animation frame
 *    and feeds the result into `map.easeTo()` with duration 0.
 *  - On cockpit exit, the previously saved camera state is restored.
 */

export interface TrackedAircraft {
  icao24: string;
  callsign?: string;
  lat: number;
  lng: number;
  /** Barometric altitude in metres. */
  alt: number;
  /** True heading in degrees (0–360). */
  heading: number;
  /** Ground speed in knots. */
  speed?: number;
  /** Vertical rate in ft/min. */
  verticalRate?: number;
  /** Aircraft type designator, e.g. "B738". */
  type?: string;
}

export interface CockpitState {
  targetIcao: string;
  prevPos: TrackedAircraft;
  currPos: TrackedAircraft;
  /** Timestamp (ms) when currPos was received. */
  lastUpdate: number;
  /** Estimated poll interval in ms. */
  pollInterval: number;
}

export interface CockpitCamera {
  lat: number;
  lng: number;
  /** Map zoom level for the cockpit altitude. */
  zoom: number;
  /** Camera pitch in degrees (0 = straight down, 60 = steep oblique). */
  pitch: number;
  /** Camera bearing in degrees (following the aircraft heading). */
  bearing: number;
}

/** Saved map camera to restore when exiting cockpit. */
export interface SavedCamera {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

/* ── Constants ── */

/** Minimum AGL altitude in metres — keeps the camera above terrain. */
const MIN_ALT_M = 150;

/** Altitude-to-zoom mapping breakpoints.
 *  Low altitude → high zoom, high altitude → low zoom. */
const ALT_ZOOM_STOPS: [number, number][] = [
  [0, 18],
  [500, 16],
  [2000, 14],
  [5000, 12],
  [10000, 10],
  [15000, 8.5],
  [40000, 6],
];

/** Camera pitch: higher altitudes get a shallower pitch. */
const ALT_PITCH_STOPS: [number, number][] = [
  [0, 70],
  [2000, 65],
  [5000, 60],
  [10000, 55],
  [40000, 45],
];

/* ── Helpers ── */

/**
 * Linearly interpolate a value from an altitude lookup table.
 */
function lerpTable(table: [number, number][], alt: number): number {
  if (alt <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (alt <= table[i][0]) {
      const [a0, v0] = table[i - 1];
      const [a1, v1] = table[i];
      const t = (alt - a0) / (a1 - a0);
      return v0 + (v1 - v0) * t;
    }
  }
  return table[table.length - 1][1];
}

/**
 * Interpolate between two angles, taking the shortest arc.
 * All angles in degrees.
 */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + 540) % 360) - 180;
  return ((a + diff * t) % 360 + 360) % 360;
}

/**
 * Clamp a value between min and max.
 */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/* ── Core ── */

/**
 * Create a fresh cockpit state when entering cockpit mode.
 */
export function createCockpitState(aircraft: TrackedAircraft): CockpitState {
  return {
    targetIcao: aircraft.icao24,
    prevPos: { ...aircraft },
    currPos: { ...aircraft },
    lastUpdate: Date.now(),
    pollInterval: 15_000,
  };
}

/**
 * Feed a new position into the cockpit state.
 * Call this every time the ADS-B poll delivers an update for the tracked aircraft.
 */
export function updateCockpitState(
  state: CockpitState,
  aircraft: TrackedAircraft,
): CockpitState {
  const now = Date.now();
  const elapsed = now - state.lastUpdate;
  // Adapt the estimated poll interval with a simple moving average
  const interval = elapsed > 2000 ? elapsed : state.pollInterval;
  return {
    ...state,
    prevPos: { ...state.currPos },
    currPos: { ...aircraft },
    lastUpdate: now,
    pollInterval: Math.round(state.pollInterval * 0.7 + interval * 0.3),
  };
}

/**
 * Compute the interpolated position between the last two poll updates.
 *
 * `now` is `Date.now()` — passed as a parameter for testability.
 * Returns the smoothed aircraft position with altitude clamped.
 */
export function interpolatePosition(
  state: CockpitState,
  now: number,
): TrackedAircraft {
  const elapsed = now - state.lastUpdate;
  const t = clamp(elapsed / state.pollInterval, 0, 1);

  const lat = state.prevPos.lat + (state.currPos.lat - state.prevPos.lat) * t;
  const lng = state.prevPos.lng + (state.currPos.lng - state.prevPos.lng) * t;
  const alt = Math.max(MIN_ALT_M, state.prevPos.alt + (state.currPos.alt - state.prevPos.alt) * t);
  const heading = lerpAngle(state.prevPos.heading, state.currPos.heading, t);
  const speed = (state.prevPos.speed ?? 0) + ((state.currPos.speed ?? 0) - (state.prevPos.speed ?? 0)) * t;

  return {
    ...state.currPos,
    lat,
    lng,
    alt,
    heading,
    speed,
  };
}

/**
 * Compute the cockpit camera parameters from the interpolated aircraft position.
 */
export function computeCockpitCamera(aircraft: TrackedAircraft): CockpitCamera {
  return {
    lat: aircraft.lat,
    lng: aircraft.lng,
    zoom: lerpTable(ALT_ZOOM_STOPS, aircraft.alt),
    pitch: lerpTable(ALT_PITCH_STOPS, aircraft.alt),
    bearing: aircraft.heading,
  };
}

/**
 * Convert altitude in metres to a formatted display string.
 * Below 1000 m → metres, above → feet (standard aviation).
 */
export function formatAltitude(altM: number): string {
  const ft = Math.round(altM * 3.28084);
  if (ft < 1000) return `${ft} ft`;
  return `FL${Math.round(ft / 100).toString().padStart(3, '0')}`;
}

/**
 * Convert speed in knots to a formatted display string.
 */
export function formatSpeed(knots: number): string {
  return `${Math.round(knots)} KTS`;
}
