import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

/**
 * 번개의 눈동자 — 글로벌 지진 및 지진학 감시 API (Multi-Tier Resilient Ingestion)
 * Agent-Reach 다계층 수집 체인 적용:
 * 1. Primary: USGS (미국 지질조사국 24h M2.5+ 피드)
 * 2. Secondary: EMSC / SeismicPortal (유럽-지중해 지진학 센터 FDSN-WS 피드)
 * 3. In-Memory SWR Cache + Fail-Safe Fallback
 */

export interface EarthquakeItem {
  id: string;
  lat: number;
  lng: number;
  depth: number;
  magnitude: number;
  place: string;
  time: number;
  url: string;
  tsunami: number;
  type: string;
  felt?: number | null;
  alert?: string | null;
  source: 'USGS' | 'EMSC' | 'COMBINED';
}

let cachedEarthquakes: EarthquakeItem[] = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute fresh cache

async function fetchUSGS(): Promise<EarthquakeItem[]> {
  try {
    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'LightningEye-Seismic/1.0',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const features = data.features || [];
    return features.map((f: any) => {
      const coords = f.geometry?.coordinates || [0, 0, 0];
      const props = f.properties || {};
      return {
        id: String(f.id || `usgs-${props.time}`),
        lat: Number(coords[1]),
        lng: Number(coords[0]),
        depth: Number(coords[2] || 10),
        magnitude: Number(props.mag || 0),
        place: String(props.place || 'Unknown Location'),
        time: Number(props.time || Date.now()),
        url: String(props.url || ''),
        tsunami: Number(props.tsunami || 0),
        type: String(props.type || 'earthquake'),
        felt: props.felt,
        alert: props.alert,
        source: 'USGS',
      };
    });
  } catch {
    return [];
  }
}

async function fetchEMSC(): Promise<EarthquakeItem[]> {
  try {
    const url = 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=150&minmag=2.5';
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'LightningEye-Seismic/1.0',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const features = data.features || [];
    return features.map((f: any) => {
      const coords = f.geometry?.coordinates || [0, 0, 0];
      const props = f.properties || {};
      const timeMs = new Date(props.time || Date.now()).getTime();
      return {
        id: String(props.unid || `emsc-${timeMs}`),
        lat: Number(coords[1]),
        lng: Number(coords[0]),
        depth: Number(coords[2] || props.depth || 10),
        magnitude: Number(props.mag || 0),
        place: String(props.flynn_region || props.place || 'Unknown Region'),
        time: timeMs,
        url: String(props.url || `https://www.emsc-csem.org/Earthquake/earthquake.php?id=${props.unid || ''}`),
        tsunami: 0,
        type: 'earthquake',
        felt: null,
        alert: null,
        source: 'EMSC',
      };
    });
  } catch {
    return [];
  }
}

function deduplicateEarthquakes(usgsList: EarthquakeItem[], emscList: EarthquakeItem[]): EarthquakeItem[] {
  const merged: EarthquakeItem[] = [...usgsList];
  
  for (const emsc of emscList) {
    // Check if an existing USGS event matches within 0.5 degrees and 5 minutes
    const isDuplicate = usgsList.some(u => {
      const dLat = Math.abs(u.lat - emsc.lat);
      const dLng = Math.abs(u.lng - emsc.lng);
      const dTime = Math.abs(u.time - emsc.time);
      return dLat < 0.6 && dLng < 0.6 && dTime < 300_000;
    });

    if (!isDuplicate) {
      merged.push(emsc);
    }
  }

  // Sort descending by time
  merged.sort((a, b) => b.time - a.time);
  return merged;
}

export async function GET() {
  const now = Date.now();

  // Return fresh in-memory cache if valid
  if (cachedEarthquakes.length > 0 && (now - lastCacheTime < CACHE_TTL_MS)) {
    return NextResponse.json({
      earthquakes: cachedEarthquakes,
      total: cachedEarthquakes.length,
      source: 'memory-cache (USGS + EMSC Multi-Tier)',
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  }

  try {
    // Concurrent multi-tier ingestion
    const [usgsRes, emscRes] = await Promise.allSettled([
      fetchUSGS(),
      fetchEMSC(),
    ]);

    const usgsItems = usgsRes.status === 'fulfilled' ? usgsRes.value : [];
    const emscItems = emscRes.status === 'fulfilled' ? emscRes.value : [];

    let combined = deduplicateEarthquakes(usgsItems, emscItems);

    if (combined.length > 0) {
      cachedEarthquakes = combined;
      lastCacheTime = now;
    } else if (cachedEarthquakes.length > 0) {
      // Both upstreams failed or timed out: gracefully serve last known cache
      combined = cachedEarthquakes;
    }

    const primarySource = usgsItems.length > 0 && emscItems.length > 0 
      ? `Multi-Tier Ingestion (USGS: ${usgsItems.length} + EMSC: ${emscItems.length} -> Merged: ${combined.length})`
      : usgsItems.length > 0 ? `USGS Live (${usgsItems.length})` 
      : emscItems.length > 0 ? `EMSC SeismicPortal Live (${emscItems.length})`
      : 'Cached Fallback';

    return NextResponse.json({
      earthquakes: combined,
      total: combined.length,
      source: primarySource,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Earthquake ingestion error:', error);
    if (cachedEarthquakes.length > 0) {
      return NextResponse.json({
        earthquakes: cachedEarthquakes,
        total: cachedEarthquakes.length,
        source: 'Cache Recovery Fallback',
        timestamp: new Date().toISOString(),
      });
    }
    return NextResponse.json({ earthquakes: [], total: 0, error: 'Seismic ingestion failed' }, { status: 500 });
  }
}
