import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── KNOWN INDUSTRIAL & MILITARY HOTSPOT COORDINATES (POH-ANG, GWANGYANG, ULSAN, DMZ) ──
const KNOWN_INDUSTRIAL_ZONES = [
  { name: '포항제철소 (POSCO Pohang)', lat: 35.998, lng: 129.385, radiusKm: 8 },
  { name: '광양제철소 (POSCO Gwangyang)', lat: 34.935, lng: 127.728, radiusKm: 8 },
  { name: '울산 석유화학단지 (Ulsan Petrochemical)', lat: 35.505, lng: 129.362, radiusKm: 10 },
  { name: '여수 국가산업단지 (Yeosu Industrial Complex)', lat: 34.825, lng: 127.695, radiusKm: 8 },
  { name: '당진 현대제철 (Hyundai Steel Dangjin)', lat: 36.985, lng: 126.685, radiusKm: 8 },
];

const STRATEGIC_MILITARY_ZONES = [
  { name: 'DMZ 군사분계선 서부 (Gimpo/Paju Front)', lat: 37.85, lng: 126.75, radiusKm: 25 },
  { name: 'DMZ 군사분계선 중부 (Cheorwon/Yeoncheon Front)', lat: 38.20, lng: 127.20, radiusKm: 25 },
  { name: 'DMZ 군사분계선 동부 (Goseong/Inje Front)', lat: 38.45, lng: 128.35, radiusKm: 25 },
  { name: '북한 삭간몰 미사일 기지 (Sakkanmol Missile Base)', lat: 38.583, lng: 125.750, radiusKm: 15 },
  { name: '북한 신오리 미사일 기지 (Sino-ri Missile Base)', lat: 39.633, lng: 125.350, radiusKm: 15 },
  { name: '북한 동창리 서해위성발사장 (Sohae Satellite Station)', lat: 39.660, lng: 124.705, radiusKm: 15 },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function classifyThermalAnomaly(lat: number, lng: number, frpInput: number) {
  const frp = Number.isFinite(frpInput) ? frpInput : 0;
  // 1. Check Military Strategic Proximity
  for (const mil of STRATEGIC_MILITARY_ZONES) {
    if (haversineKm(lat, lng, mil.lat, mil.lng) <= mil.radiusKm) {
      return {
        classification: 'military_threat' as const,
        facility: mil.name,
        is_military: true,
        is_industrial: false,
        severity: frp > 50 ? 'CRITICAL' : 'HIGH',
        alert_text: `🚨 [전술 열원 감지] ${mil.name} 인근 고열 이상점 (FRP: ${frp.toFixed(1)} MW)`
      };
    }
  }

  // 2. Check Known Industrial Facilities (Popperian Falsifiability: Eliminate False Alarms)
  for (const ind of KNOWN_INDUSTRIAL_ZONES) {
    if (haversineKm(lat, lng, ind.lat, ind.lng) <= ind.radiusKm) {
      return {
        classification: 'industrial_thermal' as const,
        facility: ind.name,
        is_military: false,
        is_industrial: true,
        severity: 'NOMINAL',
        alert_text: `🏭 [산업 공정열] ${ind.name} 정상 제철/정유 플랜트 발열`
      };
    }
  }

  // 3. General Wildfire / Forest Fire
  return {
    classification: 'wildfire' as const,
    facility: '야지/산림 구역',
    is_military: false,
    is_industrial: false,
    severity: frp > 100 ? 'HIGH' : 'ELEVATED',
    alert_text: `🔥 [산불/야지 열원] 지표면 열 이상 감지 (FRP: ${frp.toFixed(1)} MW)`
  };
}

export async function GET() {
  try {
    let fires: any[] = [];
    let source = '';

    // Source 1: NASA FIRMS Open Data (South East Asia / Regional + Global VIIRS C2)
    const firmsSources = [
      'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv',
      'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv',
      'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv'
    ];

    for (const url of firmsSources) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(12000),
          headers: { 'User-Agent': 'OSIRIS-Tactical-FIRMS/4.0' },
        });
        if (res.ok) {
          const text = await res.text();
          if (text && text.includes('latitude') && text.length > 200) {
            const parsed = parseCSV(text);
            if (parsed.length > 0) {
              fires = parsed;
              source = url.includes('SouthEast_Asia') 
                ? 'NASA-FIRMS (VIIRS SE Asia Regional 375m)' 
                : url.includes('SUOMI') ? 'NASA-FIRMS (VIIRS Global)' : 'NASA-FIRMS (MODIS)';
              break;
            }
          }
        }
      } catch { continue; }
    }

    // Source 2: Pull active volcanoes from EONET
    try {
      const volcRes = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=volcanoes&limit=50', {
        signal: AbortSignal.timeout(8000),
      });
      if (volcRes.ok) {
        const volcData = await volcRes.json();
        const volcanoes = (volcData.events || []).map((e: any) => {
          const geo = e.geometry?.[e.geometry.length - 1];
          if (!geo?.coordinates) return null;
          return {
            lat: geo.coordinates[1],
            lng: geo.coordinates[0],
            brightness: 500,
            confidence: 'high',
            date: geo.date?.split('T')[0] || '',
            time: '',
            frp: 100,
            title: `[VOLCANO] ${e.title}`,
            type: 'volcano',
            classification: 'volcano',
            facility: e.title,
            is_military: false,
            is_industrial: false,
            severity: 'HIGH',
            alert_text: `🌋 [화산 활동] ${e.title}`
          };
        }).filter(Boolean);
        fires = [...fires, ...volcanoes];
        if (!source) source = 'NASA-EONET';
      }
    } catch (e) {
      console.warn('[OSIRIS] Suppressed EONET error:', e instanceof Error ? e.message : e);
    }

    if (!source) source = fires.length > 0 ? 'NASA-FIRMS (VIIRS Realtime)' : 'NASA-FIRMS (대기 중 / 궤도 통과 대기)';

    const militaryCount = fires.filter(f => f.is_military).length;
    const industrialCount = fires.filter(f => f.is_industrial).length;

    const now = Date.now();
    const updateIntervalSec = 600; // 10 minutes cache
    const nextUpdateAt = new Date(now + updateIntervalSec * 1000).toISOString();
    const latestFire = fires.find(f => f.date);
    const observedAt = latestFire?.date 
      ? (latestFire.time ? `${latestFire.date}T${latestFire.time.padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2:00Z')}` : `${latestFire.date}T00:00:00Z`)
      : new Date(now).toISOString();

    const temporal = {
      observed_at: observedAt,
      fetched_at: new Date(now).toISOString(),
      next_update_at: nextUpdateAt,
      interval_seconds: updateIntervalSec,
      staleness: 'FRESH' as const,
      source_name: source,
      rate_limit_info: 'NASA FIRMS 오픈 데이터 / 10분 캐시 주기'
    };

    return NextResponse.json({
      fires,
      total: fires.length,
      military_hotspots: militaryCount,
      industrial_hotspots: industrialCount,
      source,
      temporal,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (error) {
    console.error('Fire fetch error:', error);
    return NextResponse.json({ fires: [], error: 'Failed to fetch fire data' }, { status: 500 });
  }
}

function parseCSV(csv: string): any[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',');
  const latIdx = header.indexOf('latitude');
  const lngIdx = header.indexOf('longitude');
  const brightIdx = header.indexOf('bright_ti4') !== -1 ? header.indexOf('bright_ti4') : header.indexOf('brightness');
  const confIdx = header.indexOf('confidence');
  const dateIdx = header.indexOf('acq_date');
  const timeIdx = header.indexOf('acq_time');
  const frpIdx = header.indexOf('frp');

  const fires: any[] = [];
  const maxPoints = 2500;
  const step = lines.length > maxPoints ? Math.ceil(lines.length / maxPoints) : 1;

  for (let i = 1; i < lines.length; i += step) {
    const cols = lines[i].split(',');
    const lat = parseFloat(cols[latIdx]);
    const lng = parseFloat(cols[lngIdx]);
    if (isNaN(lat) || isNaN(lng)) continue;

    const frp = parseFloat(cols[frpIdx]) || 0;
    const meta = classifyThermalAnomaly(lat, lng, frp);

    fires.push({
      lat: Math.round(lat * 1000) / 1000,
      lng: Math.round(lng * 1000) / 1000,
      brightness: parseFloat(cols[brightIdx]) || 0,
      confidence: cols[confIdx] || 'nominal',
      date: cols[dateIdx] || '',
      time: cols[timeIdx] || '',
      frp: Math.round(frp * 10) / 10,
      type: 'fire',
      ...meta,
    });
  }

  return fires;
}


