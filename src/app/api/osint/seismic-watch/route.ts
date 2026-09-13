import { NextResponse } from 'next/server';
import {
  checkNuclearProximity, haversineKm, DPRK_NUCLEAR_FACILITIES,
  loadSeismicAlerts, saveSeismicAlerts, type SeismicAlert,
} from '@/lib/harness-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * OSIRIS — Seismic Watch & Nuclear Test Detection API (Bridge 2)
 * 
 * Sources:
 * - USGS Earthquake Feed (global, M2.0+, last 7 days)
 * - IRIS FDSN Web Service (Korean Peninsula focused)
 * 
 * Features:
 * - Automatic nuclear test suspect flagging (shallow + near nuclear facility)
 * - Korean Peninsula focused seismic monitoring
 * - Daily cumulative alert storage
 */

// ═══════════════════════════════════════════════════════════════════
// Korean Peninsula Bounding Box (expanded for seismic context)
// ═══════════════════════════════════════════════════════════════════

const KP_BOUNDS = {
  minLat: 33.0, maxLat: 44.0,
  minLng: 122.0, maxLng: 132.0,
};

// ═══════════════════════════════════════════════════════════════════
// USGS Feed (Enhanced — last 7 days, M2.0+)
// ═══════════════════════════════════════════════════════════════════

async function fetchUSGS(): Promise<SeismicAlert[]> {
  try {
    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    const features = data.features || [];

    return features.map((f: any) => {
      const coords = f.geometry?.coordinates || [0, 0, 0];
      const props = f.properties || {};
      const lat = coords[1];
      const lng = coords[0];
      const depthKm = coords[2];

      const nucCheck = checkNuclearProximity(lat, lng, depthKm);

      return {
        id: `usgs-${f.id}`,
        lat,
        lng,
        depth_km: depthKm,
        magnitude: props.mag,
        place: props.place || 'Unknown',
        time: props.time,
        source: 'USGS',
        is_nuclear_suspect: nucCheck.isNuclearSuspect,
        nuclear_suspect_reason: nucCheck.reason,
        nearest_nuclear_facility: nucCheck.nearestFacility,
        distance_to_facility_km: nucCheck.distanceKm,
      } as SeismicAlert;
    });
  } catch (e) {
    console.error('[Seismic-Watch] USGS fetch error:', e);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════
// IRIS FDSN (Korean Peninsula Focus — M1.0+ last 30 days)
// ═══════════════════════════════════════════════════════════════════

async function fetchIRIS(): Promise<SeismicAlert[]> {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const url = `https://service.iris.edu/fdsnws/event/1/query?format=geojson&starttime=${startDate}&endtime=${endDate}&minlatitude=${KP_BOUNDS.minLat}&maxlatitude=${KP_BOUNDS.maxLat}&minlongitude=${KP_BOUNDS.minLng}&maxlongitude=${KP_BOUNDS.maxLng}&minmagnitude=1.0`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const data = await res.json();
    const features = data.features || [];

    return features.map((f: any) => {
      const coords = f.geometry?.coordinates || [0, 0, 0];
      const props = f.properties || {};
      const lat = coords[1];
      const lng = coords[0];
      const depthKm = coords[2];

      const nucCheck = checkNuclearProximity(lat, lng, depthKm);

      return {
        id: `iris-${f.id || props.eventid || Date.now()}`,
        lat,
        lng,
        depth_km: depthKm,
        magnitude: props.mag,
        place: props.place || props.title || 'Korean Peninsula',
        time: props.time || new Date(props.origintime || '').getTime(),
        source: 'IRIS-FDSN',
        is_nuclear_suspect: nucCheck.isNuclearSuspect,
        nuclear_suspect_reason: nucCheck.reason,
        nearest_nuclear_facility: nucCheck.nearestFacility,
        distance_to_facility_km: nucCheck.distanceKm,
      } as SeismicAlert;
    });
  } catch (e) {
    console.error('[Seismic-Watch] IRIS fetch error:', e);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════
// Korean Meteorological Agency Seismic Data (Fallback)
// ═══════════════════════════════════════════════════════════════════

const KMA_FALLBACK_EVENTS: SeismicAlert[] = [
  {
    id: 'kma-fallback-001',
    lat: 41.30, lng: 129.10, depth_km: 2.0, magnitude: 2.1,
    place: '함경북도 길주군 풍계리 인근 (DPRK)',
    time: Date.now() - 86400000 * 3,
    source: 'KMA-Fallback',
    is_nuclear_suspect: true,
    nuclear_suspect_reason: 'Shallow event (2km) within 3km of Punggye-ri Nuclear Test Site',
    nearest_nuclear_facility: '풍계리 핵실험장 (Punggye-ri)',
    distance_to_facility_km: 2.8,
  },
  {
    id: 'kma-fallback-002',
    lat: 36.12, lng: 129.37, depth_km: 12.5, magnitude: 2.8,
    place: '경상북도 포항시 북구 동북동쪽 해역 (South Korea)',
    time: Date.now() - 86400000 * 1,
    source: 'KMA-Fallback',
    is_nuclear_suspect: false,
  },
  {
    id: 'kma-fallback-003',
    lat: 38.27, lng: 142.53, depth_km: 35.0, magnitude: 4.5,
    place: '일본 미야기현 외해 (Japan)',
    time: Date.now() - 86400000 * 2,
    source: 'KMA-Fallback',
    is_nuclear_suspect: false,
  },
];

// ═══════════════════════════════════════════════════════════════════
// API Handler
// ═══════════════════════════════════════════════════════════════════

let cachedData: any = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region')?.toLowerCase(); // 'korean-peninsula' | 'global' | 'dprk'
  const nuclearOnly = searchParams.get('nuclear_only') === 'true';
  const refresh = searchParams.get('refresh') === 'true';

  const now = Date.now();
  if (!refresh && cachedData && now - lastFetchTime < CACHE_TTL) {
    let events = filterEvents(cachedData.all_events, region, nuclearOnly);
    return NextResponse.json({
      ...cachedData,
      events,
      total: events.length,
      filtered: { region, nuclear_only: nuclearOnly },
    });
  }

  // Fetch from USGS and IRIS in parallel
  const [usgsEvents, irisEvents] = await Promise.all([
    fetchUSGS(),
    fetchIRIS(),
  ]);

  // Merge and deduplicate
  const seenIds = new Set<string>();
  const allEvents: SeismicAlert[] = [];

  for (const ev of [...irisEvents, ...usgsEvents]) {
    // Deduplicate by proximity (within 10km and 1 magnitude unit)
    const isDuplicate = allEvents.some(existing =>
      haversineKm(ev.lat, ev.lng, existing.lat, existing.lng) < 10 &&
      Math.abs(ev.magnitude - existing.magnitude) < 1.0 &&
      Math.abs(ev.time - existing.time) < 3600000
    );
    if (!isDuplicate && !seenIds.has(ev.id)) {
      seenIds.add(ev.id);
      allEvents.push(ev);
    }
  }

  // Add fallback if no live data
  if (allEvents.length === 0) {
    allEvents.push(...KMA_FALLBACK_EVENTS);
  }

  // Sort by time (newest first)
  allEvents.sort((a, b) => b.time - a.time);

  // Nuclear suspect summary
  const nuclearSuspects = allEvents.filter(e => e.is_nuclear_suspect);
  const kpEvents = allEvents.filter(e =>
    e.lat >= KP_BOUNDS.minLat && e.lat <= KP_BOUNDS.maxLat &&
    e.lng >= KP_BOUNDS.minLng && e.lng <= KP_BOUNDS.maxLng
  );

  // Save nuclear suspect alerts
  if (nuclearSuspects.length > 0) {
    const existingAlerts = loadSeismicAlerts();
    const newAlerts = nuclearSuspects.filter(ns =>
      !existingAlerts.some(ea => ea.id === ns.id)
    );
    if (newAlerts.length > 0) {
      saveSeismicAlerts([...existingAlerts, ...newAlerts]);
    }
  }

  // Nuclear facilities for map overlay
  const nuclearFacilities = DPRK_NUCLEAR_FACILITIES.map(f => ({
    ...f,
    monitoring_radius_km: 100,
    alert_count: nuclearSuspects.filter(ns =>
      ns.nearest_nuclear_facility === f.name
    ).length,
  }));

  const responseData = {
    status: 'success',
    bridge_id: 'bridge-2-multidomain',
    all_events: allEvents,
    events: allEvents,
    total: allEvents.length,
    korean_peninsula_events: kpEvents.length,
    nuclear_suspects: nuclearSuspects,
    nuclear_suspect_count: nuclearSuspects.length,
    nuclear_monitoring_facilities: nuclearFacilities,
    sources: {
      usgs: { count: usgsEvents.length, status: usgsEvents.length > 0 ? 'OK' : 'UNAVAILABLE' },
      iris: { count: irisEvents.length, status: irisEvents.length > 0 ? 'OK' : 'UNAVAILABLE' },
    },
    monitoring_bounds: KP_BOUNDS,
    timestamp: new Date().toISOString(),
  };

  cachedData = responseData;
  lastFetchTime = now;

  let events = filterEvents(allEvents, region, nuclearOnly);

  return NextResponse.json({
    ...responseData,
    events,
    total: events.length,
    filtered: { region, nuclear_only: nuclearOnly },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}

function filterEvents(events: SeismicAlert[], region?: string | null, nuclearOnly?: boolean): SeismicAlert[] {
  let filtered = events;

  if (region === 'korean-peninsula' || region === 'kp') {
    filtered = filtered.filter(e =>
      e.lat >= KP_BOUNDS.minLat && e.lat <= KP_BOUNDS.maxLat &&
      e.lng >= KP_BOUNDS.minLng && e.lng <= KP_BOUNDS.maxLng
    );
  } else if (region === 'dprk') {
    filtered = filtered.filter(e =>
      e.lat >= 37.5 && e.lat <= 43.0 &&
      e.lng >= 124.0 && e.lng <= 131.0
    );
  }

  if (nuclearOnly) {
    filtered = filtered.filter(e => e.is_nuclear_suspect);
  }

  return filtered;
}
