/**
 * OSIRIS — Contacts Engine (God's Eye View integration)
 *
 * Finds and ranks all entities within a configurable radius of a tracked
 * target. The roster supports flights, ships, and satellites, each normalised
 * into a common `Contact` shape.
 *
 * Performance target: < 20 ms for 5 000 entities (the maximum realistic
 * count in a 250 km circle over busy airspace plus AIS + LEO satellites).
 * This is achieved by precomputing a bounding box filter before running the
 * haversine formula.
 */

import { haversine, type LngLat } from './geo';

/* ── Types ── */

export type ContactType = 'flight' | 'ship' | 'satellite';

export interface Contact {
  id: string;
  type: ContactType;
  label: string;
  /** Position: [lng, lat]. */
  position: LngLat;
  /** Distance from tracked target in km. */
  distanceKm: number;
  /** Bearing from target in degrees, 0–360. */
  bearingDeg: number;
  /** Altitude in metres (0 for ships, orbit km for satellites). */
  alt: number;
  /** Additional display metadata. */
  meta: Record<string, string | number | undefined>;
}

export interface ContactsConfig {
  /** Search radius in km. Default 250. */
  radiusKm: number;
  /** Maximum contacts to return. Default 100. */
  maxContacts: number;
}

const DEFAULT_CONFIG: ContactsConfig = {
  radiusKm: 250,
  maxContacts: 100,
};

/* ── Raw entity shapes (as they arrive from the API layer) ── */

export interface RawFlight {
  icao24: string;
  callsign?: string;
  lat: number;
  lng: number;
  alt?: number;
  heading?: number;
  speed?: number;
  type?: string;
}

export interface RawShip {
  mmsi: string;
  name?: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  type?: string;
}

export interface RawSatellite {
  noradId: string;
  name: string;
  lat: number;
  lng: number;
  alt: number;
  category?: string;
}

/* ── Helpers ── */

const toRad = (d: number) => (d * Math.PI) / 180;

/**
 * Initial bearing from a to b in degrees, 0–360.
 */
function bearingDeg(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/**
 * Quick bounding box check — filters out entities that are obviously
 * outside the radius without computing a full haversine.
 *
 * 1° latitude ≈ 111 km. For longitude, the km-per-degree shrinks by
 * cos(lat). We add a 10% margin so no true positives are missed.
 */
function boundingBox(
  center: LngLat,
  radiusKm: number,
): { minLng: number; maxLng: number; minLat: number; maxLat: number } {
  const margin = radiusKm * 1.1;
  const latDelta = margin / 111;
  const lngDelta = margin / (111 * Math.max(0.01, Math.cos(toRad(center[1]))));
  return {
    minLng: center[0] - lngDelta,
    maxLng: center[0] + lngDelta,
    minLat: center[1] - latDelta,
    maxLat: center[1] + latDelta,
  };
}

/* ── Core ── */

/**
 * Build a contacts roster around a center point.
 *
 * Returns contacts sorted by distance (nearest first), capped at
 * `config.maxContacts`.
 */
export function buildContacts(
  center: LngLat,
  flights: RawFlight[],
  ships: RawShip[],
  satellites: RawSatellite[],
  config: Partial<ContactsConfig> = {},
): Contact[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const bbox = boundingBox(center, cfg.radiusKm);

  const contacts: Contact[] = [];

  // Collect candidates with distance only to minimize allocations & trig math
  interface Candidate {
    id: string;
    type: ContactType;
    label: string;
    pos: LngLat;
    dist: number;
    alt: number;
    meta: Record<string, string | number | undefined>;
  }

  const candidates: Candidate[] = [];

  // Process flights
  for (const f of flights) {
    if (f.lat < bbox.minLat || f.lat > bbox.maxLat) continue;
    if (f.lng < bbox.minLng || f.lng > bbox.maxLng) continue;
    const pos: LngLat = [f.lng, f.lat];
    const dist = haversine(center, pos);
    if (dist > cfg.radiusKm) continue;
    candidates.push({
      id: f.icao24,
      type: 'flight',
      label: f.callsign?.trim() || f.icao24.toUpperCase(),
      pos,
      dist,
      alt: f.alt ?? 0,
      meta: {
        speed: f.speed,
        heading: f.heading,
        type: f.type,
      },
    });
  }

  // Process ships
  for (const s of ships) {
    if (s.lat < bbox.minLat || s.lat > bbox.maxLat) continue;
    if (s.lng < bbox.minLng || s.lng > bbox.maxLng) continue;
    const pos: LngLat = [s.lng, s.lat];
    const dist = haversine(center, pos);
    if (dist > cfg.radiusKm) continue;
    candidates.push({
      id: s.mmsi,
      type: 'ship',
      label: s.name?.trim() || `MMSI ${s.mmsi}`,
      pos,
      dist,
      alt: 0,
      meta: {
        speed: s.speed,
        heading: s.heading,
        type: s.type,
      },
    });
  }

  // Process satellites
  for (const sat of satellites) {
    if (sat.lat < bbox.minLat || sat.lat > bbox.maxLat) continue;
    if (sat.lng < bbox.minLng || sat.lng > bbox.maxLng) continue;
    const pos: LngLat = [sat.lng, sat.lat];
    const dist = haversine(center, pos);
    if (dist > cfg.radiusKm) continue;
    candidates.push({
      id: sat.noradId,
      type: 'satellite',
      label: sat.name,
      pos,
      dist,
      alt: sat.alt,
      meta: {
        category: sat.category,
      },
    });
  }

  // Sort by distance and cap
  candidates.sort((a, b) => a.dist - b.dist);
  const top = candidates.slice(0, cfg.maxContacts);

  // Compute bearingDeg only for the capped contacts to keep 60fps / <10ms performance
  return top.map(c => ({
    id: c.id,
    type: c.type,
    label: c.label,
    position: c.pos,
    distanceKm: c.dist,
    bearingDeg: bearingDeg(center, c.pos),
    alt: c.alt,
    meta: c.meta,
  }));
}

/**
 * Filter contacts by type.
 */
export function filterByType(contacts: Contact[], type: ContactType): Contact[] {
  return contacts.filter(c => c.type === type);
}

/**
 * Format a distance for display.
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Format a bearing for display (3-digit, zero-padded).
 */
export function formatBearing(deg: number): string {
  return `${Math.round(deg).toString().padStart(3, '0')}°`;
}
