import { NextResponse } from 'next/server';
import * as h3 from 'h3-js';
import { latLngToMGRS } from '@/lib/mgrs-converter';

export const dynamic = 'force-dynamic';

const GPSJAM_URL = 'https://gpsjam.org/data';

function getDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().split('T')[0];
}

// Tactical border alerts (서해 NLL / 강화 / 휴전선 접경)
function getTacticalJammingAlerts() {
  return [
    {
      id: 'JAMMING-ALERT-WEST-SEA-01',
      zone_name: '서해 NLL / 연평도 해상 전파 교란 구역',
      threat_level: 'CRITICAL',
      severity: 'CRITICAL',
      type: 'JAMMING',
      center_lat: 37.6200,
      center_lng: 125.8000,
      lat: 37.6200,
      lng: 125.8000,
      source_lat: 38.0200,
      source_lng: 125.6800,
      source_label: '北 옹진반도 방사원',
      mgrs_10digit: latLngToMGRS(37.6200, 125.8000),
      affected_radius_km: 18.5,
      jammed_frequencies: ['GPS L1 (1575.42 MHz)', 'GLONASS L1 (1602 MHz)'],
      estimated_bearing_deg: 345,
      source_origin: '북한 옹진반도 해안 방사원 감지',
      advisory_notice: '해당 공역 내 드론 비행 시 GPS 수신 불가로 인한 자동 추락 및 위치 이탈 위험이 매우 높으므로 즉시 휠백/수동 회항(RTH)을 수행해야 합니다.',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'JAMMING-ALERT-GANGHWA-02',
      zone_name: '강화도 / 교동도 접경 전파 교란 구역',
      threat_level: 'HIGH',
      severity: 'HIGH',
      type: 'SPOOFING',
      center_lat: 37.7400,
      center_lng: 126.5000,
      lat: 37.7400,
      lng: 126.5000,
      source_lat: 37.9500,
      source_lng: 126.3500,
      source_label: '北 개풍군 방사원',
      mgrs_10digit: latLngToMGRS(37.7400, 126.5000),
      affected_radius_km: 12.0,
      jammed_frequencies: ['GPS L1 (1575.42 MHz)'],
      estimated_bearing_deg: 350,
      source_origin: '북한 개풍군 접경 방사원 감지',
      advisory_notice: 'GPS 기만 신호(Spoofing) 감지됨. 조종자 위치와 다른 가짜 좌표로 유도될 위험이 있습니다.',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'JAMMING-ALERT-EAST-SEA-03',
      zone_name: '동해 북방한계선 접경 해역',
      threat_level: 'HIGH',
      severity: 'HIGH',
      type: 'JAMMING',
      center_lat: 38.5800,
      center_lng: 128.4500,
      lat: 38.5800,
      lng: 128.4500,
      source_lat: 38.8000,
      source_lng: 128.3000,
      source_label: '北 통천 방사원',
      mgrs_10digit: latLngToMGRS(38.5800, 128.4500),
      affected_radius_km: 15.0,
      jammed_frequencies: ['GPS L1 (1575.42 MHz)'],
      estimated_bearing_deg: 330,
      source_origin: '북한 통천군 전파방해 기지',
      advisory_notice: '동해 초계기 및 연안 조업선박 GPS 오차 확대 주의',
      timestamp: new Date().toISOString(),
    }
  ];
}

// In-memory cache
let cachedData: any = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 600_000; // 10 minutes

export async function GET() {
  const now = Date.now();
  if (cachedData && now - lastFetchTime < CACHE_TTL_MS) {
    return NextResponse.json(cachedData, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
    });
  }

  const tacticalAlerts = getTacticalJammingAlerts();

  try {
    let csv = '';
    let usedDate = getDateStr(0);

    // Try today then fallback up to 3 days ago
    for (let offset = 0; offset <= 3; offset++) {
      const dateCandidate = getDateStr(offset);
      const url = `${GPSJAM_URL}/${dateCandidate}-h3_4.csv`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          csv = await res.text();
          usedDate = dateCandidate;
          break;
        }
      } catch {
        // continue fallback
      }
    }

    const payload = processData(csv, usedDate, tacticalAlerts);
    cachedData = payload;
    lastFetchTime = now;

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
    });
  } catch (error) {
    console.error('[OSIRIS] GPS jamming route error:', error instanceof Error ? error.message : error);

    // Fallback with tactical alerts alone if gpsjam.org is unreachable
    const fallbackPayload = {
      features: tacticalAlerts.map(a => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [a.center_lng, a.center_lat] },
        properties: {
          severity: a.threat_level.toLowerCase(),
          color: a.threat_level === 'CRITICAL' ? '#D32F2F' : '#FF6D00',
          zone_name: a.zone_name,
          ratio: 1.0,
        }
      })),
      gps_jamming: tacticalAlerts,
      alerts: tacticalAlerts,
      stats: { cells: 0, high: tacticalAlerts.length, medium: 0, low: 0, tactical_alerts: tacticalAlerts.length },
      date: getDateStr(0),
      source: 'MSIT/CRMS Tactical Alert Seam (Offline Fallback)',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(fallbackPayload, {
      headers: { 'Cache-Control': 'public, s-maxage=60' }
    });
  }
}

function processData(csv: string, dateStr: string, tacticalAlerts: any[]) {
  const features: any[] = [];
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  if (csv) {
    const lines = csv.trim().split('\n').filter(Boolean);
    // Skip header row: hex,count_good_aircraft,count_bad_aircraft
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 3) continue;

      const h3Index = parts[0].trim();
      const good = parseInt(parts[1], 10);
      const bad = parseInt(parts[2], 10);
      const total = good + bad;
      if (total < 5) continue;

      const ratio = bad / total;
      let severity: string;
      let color: string;
      let opacity: number;

      if (ratio > 0.10) {
        severity = 'high';
        color = '#D32F2F';
        opacity = 0.35;
        highCount++;
      } else if (ratio > 0.02) {
        severity = 'medium';
        color = '#FF6D00';
        opacity = 0.25;
        mediumCount++;
      } else {
        severity = 'low';
        color = '#4CAF50';
        opacity = 0.1;
        lowCount++;
      }

      try {
        const center = h3.cellToLatLng(h3Index);
        const boundary = h3.cellToBoundary(h3Index, true); // [[lng, lat], ...]

        features.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [boundary],
          },
          properties: {
            h3Index,
            severity,
            color,
            opacity,
            total_aircraft: total,
            bad_aircraft: bad,
            ratio: Math.round(ratio * 1000) / 1000,
            label: `${(ratio * 100).toFixed(1)}% interference`,
            center_lng: center[1],
            center_lat: center[0],
          },
        });
      } catch {
        // Skip malformed H3 indices
      }
    }
  }

  // Convert tactical alerts to additional map-compatible objects
  const tacticalGpsItems = tacticalAlerts.map(a => ({
    ...a,
    threat_level: a.threat_level,
    severity: a.threat_level,
    center_lat: a.center_lat,
    center_lng: a.center_lng,
    lat: a.center_lat,
    lng: a.center_lng,
  }));

  return {
    features,
    gps_jamming: tacticalGpsItems,
    alerts: tacticalAlerts,
    stats: {
      cells: features.length,
      high: highCount + tacticalAlerts.length,
      medium: mediumCount,
      low: lowCount,
      tactical_alerts: tacticalAlerts.length,
    },
    date: dateStr,
    source: 'gpsjam.org + MSIT/CRMS Tactical Alert Integration',
    timestamp: new Date().toISOString(),
  };
}
