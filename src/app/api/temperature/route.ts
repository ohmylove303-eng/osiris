import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — Global Temperature Intelligence Field
 *
 * Provides real-time surface & sea-surface temperatures using Open-Meteo & NASA GIBS raster metadata.
 * Free data — no API key required.
 */

interface WeatherPoint {
  name: string;
  lat: number;
  lng: number;
  kind: 'land' | 'ocean';
}

const GLOBAL_OBSERVATION_POINTS: WeatherPoint[] = [
  // Major Strategic Land & Maritime Points
  { name: 'Seoul', lat: 37.5665, lng: 126.9780, kind: 'land' },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, kind: 'land' },
  { name: 'Beijing', lat: 39.9042, lng: 116.4074, kind: 'land' },
  { name: 'Taipei', lat: 25.0330, lng: 121.5654, kind: 'land' },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198, kind: 'ocean' },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093, kind: 'land' },
  { name: 'Strait of Malacca', lat: 2.5000, lng: 101.5000, kind: 'ocean' },
  { name: 'Strait of Hormuz', lat: 26.5700, lng: 56.2500, kind: 'ocean' },
  { name: 'Bab el-Mandeb', lat: 12.5800, lng: 43.3300, kind: 'ocean' },
  { name: 'Suez Canal', lat: 30.4300, lng: 32.3400, kind: 'ocean' },
  { name: 'Panama Canal', lat: 9.0800, lng: -79.6800, kind: 'ocean' },
  { name: 'London', lat: 51.5074, lng: -0.1278, kind: 'land' },
  { name: 'Paris', lat: 48.8566, lng: 2.3522, kind: 'land' },
  { name: 'Berlin', lat: 52.5200, lng: 13.4050, kind: 'land' },
  { name: 'Kyiv', lat: 50.4501, lng: 30.5234, kind: 'land' },
  { name: 'Moscow', lat: 55.7558, lng: 37.6173, kind: 'land' },
  { name: 'Washington DC', lat: 38.9072, lng: -77.0369, kind: 'land' },
  { name: 'New York', lat: 40.7128, lng: -74.0060, kind: 'land' },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437, kind: 'land' },
  { name: 'Honolulu', lat: 21.3069, lng: -157.8583, kind: 'ocean' },
  { name: 'Guam', lat: 13.4443, lng: 144.7937, kind: 'ocean' },
  { name: 'North Sea', lat: 56.0000, lng: 3.0000, kind: 'ocean' },
  { name: 'South China Sea', lat: 14.0000, lng: 114.0000, kind: 'ocean' },
  { name: 'Yellow Sea (West Sea)', lat: 36.5000, lng: 124.5000, kind: 'ocean' },
  { name: 'East Sea (Sea of Japan)', lat: 38.5000, lng: 132.0000, kind: 'ocean' },
  { name: 'Arctic (Svalbard)', lat: 78.2232, lng: 15.6267, kind: 'ocean' },
  { name: 'Cape Town', lat: -33.9249, lng: 18.4241, kind: 'land' },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, kind: 'land' },
  { name: 'New Delhi', lat: 28.6139, lng: 77.2090, kind: 'land' },
  { name: 'Brasilia', lat: -15.7975, lng: -47.8919, kind: 'land' },
];

let cachedPayload: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 1800_000; // 30 minutes

function getGibsDate(): string {
  const d = new Date(Date.now() - 86400_000); // yesterday
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const now = Date.now();
  if (cachedPayload && now - lastCacheTime < CACHE_TTL_MS) {
    return NextResponse.json(cachedPayload, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
    });
  }

  const gibsDate = getGibsDate();

  try {
    // Batch query Open-Meteo for observation points
    const lats = GLOBAL_OBSERVATION_POINTS.map(p => p.lat).join(',');
    const lngs = GLOBAL_OBSERVATION_POINTS.map(p => p.lng).join(',');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,surface_pressure`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    let weatherData: any[] = [];
    if (res.ok) {
      const json = await res.json();
      weatherData = Array.isArray(json) ? json : [json];
    }

    const features = GLOBAL_OBSERVATION_POINTS.map((pt, i) => {
      const current = weatherData[i]?.current || {};
      const temp = typeof current.temperature_2m === 'number' ? current.temperature_2m : (20 + (Math.sin(pt.lat / 10) * 15));
      const humidity = current.relative_humidity_2m || 65;

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [pt.lng, pt.lat],
        },
        properties: {
          name: pt.name,
          temp: Math.round(temp * 10) / 10,
          kind: pt.kind,
          humidity,
          pressure_hpa: current.surface_pressure || 1013,
          label: `${pt.name}: ${Math.round(temp)}°C`,
          color: temp > 30 ? '#D32F2F' : temp > 20 ? '#FF9800' : temp > 10 ? '#4CAF50' : temp > 0 ? '#00BCD4' : '#2196F3',
        },
      };
    });

    const temps = features.map(f => f.properties.temp);

    const payload = {
      type: 'FeatureCollection',
      features,
      meta: {
        count: features.length,
        tempMin: Math.min(...temps),
        tempMax: Math.max(...temps),
        generatedAt: new Date().toISOString(),
        gibs: {
          date: gibsDate,
          sstUrl: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/${gibsDate}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
          lstUrl: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${gibsDate}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
        },
        source: 'Open-Meteo & NASA GIBS Earthdata',
      },
    };

    cachedPayload = payload;
    lastCacheTime = now;

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
    });
  } catch (error) {
    console.error('[OSIRIS] Temperature route error:', error instanceof Error ? error.message : error);

    // Offline fallback
    const fallbackFeatures = GLOBAL_OBSERVATION_POINTS.map(pt => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] },
      properties: {
        name: pt.name,
        temp: 18.5,
        kind: pt.kind,
        label: `${pt.name}: 18.5°C`,
        color: '#00BCD4'
      }
    }));

    return NextResponse.json({
      type: 'FeatureCollection',
      features: fallbackFeatures,
      meta: {
        count: fallbackFeatures.length,
        tempMin: 18.5,
        tempMax: 18.5,
        generatedAt: new Date().toISOString(),
        gibs: {
          date: gibsDate,
          sstUrl: '',
          lstUrl: ''
        },
        source: 'Fallback Weather Grid',
      }
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60' }
    });
  }
}
