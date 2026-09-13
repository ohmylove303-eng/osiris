import { NextResponse } from 'next/server';
import { latLngToMGRS } from '@/lib/mgrs-converter';

export const dynamic = 'force-dynamic';

export interface DroneTarget {
  id: string;
  name: string;
  category: 'STRATEGIC_RECON_UAV' | 'STRIKE_ATTACK_UAV' | 'TACTICAL_BORDER_UAV' | 'USV_SURFACE_DRONE' | 'CIVIL_REMOTEID_DRONE';
  model: string;
  affiliation: string;
  affiliation_code: 'ROK_US' | 'DPRK' | 'PLA' | 'RUSSIA' | 'UKRAINE' | 'IRAN' | 'CIVIL';
  lat: number;
  lng: number;
  mgrs: string;
  alt_feet: number;
  speed_kts: number;
  rf_freq: string;
  remote_id: string;
  control_station: string;
  gcs_lat?: number;
  gcs_lng?: number;
  gcs_mgrs?: string;
  mission: string;
  color: string;
  status: string;
  trust_score: number;
  timestamp?: string;
}

// In-Memory Store for Real Sensor Telemetry Ingestion (No Mock Synthetic Data)
let realIngestedDronesStore: DroneTarget[] = [];

export async function GET() {
  // Purge stale ingested telemetry older than 60 seconds
  const now = Date.now();
  realIngestedDronesStore = realIngestedDronesStore.filter(d => {
    if (!d.timestamp) return false;
    const t = new Date(d.timestamp).getTime();
    return now - t < 60000;
  });

  return NextResponse.json({
    status: 'success',
    data_source: 'REAL_LIVE_SENSOR_INGESTION_ONLY',
    notice: 'Synthetic mock drones disabled. Returning real live telemetry received via hardware SDR / OpenDroneID receivers.',
    drones: realIngestedDronesStore,
    total: realIngestedDronesStore.length,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

// Real Sensor Ingestion POST Endpoint for SDR / OpenDroneID Receivers
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !body.lat || !body.lng) {
      return NextResponse.json({ status: 'error', message: 'Missing lat/lng payload' }, { status: 400 });
    }

    const newTarget: DroneTarget = {
      id: body.id || `SDR-RID-${Date.now()}`,
      name: body.name || 'Live Received Drone Target',
      category: body.category || 'CIVIL_REMOTEID_DRONE',
      model: body.model || 'OpenDroneID Signal',
      affiliation: body.affiliation || 'REAL_LIVE_RF_TARGET',
      affiliation_code: body.affiliation_code || 'CIVIL',
      lat: Number(body.lat),
      lng: Number(body.lng),
      mgrs: latLngToMGRS(Number(body.lat), Number(body.lng)),
      alt_feet: Number(body.alt_feet || 0),
      speed_kts: Number(body.speed_kts || 0),
      rf_freq: body.rf_freq || '2.4 GHz',
      remote_id: body.remote_id || 'BLE-RID-LIVE',
      control_station: body.control_station || 'Live SDR Receiver',
      gcs_lat: body.gcs_lat ? Number(body.gcs_lat) : undefined,
      gcs_lng: body.gcs_lng ? Number(body.gcs_lng) : undefined,
      gcs_mgrs: body.gcs_lat && body.gcs_lng ? latLngToMGRS(Number(body.gcs_lat), Number(body.gcs_lng)) : undefined,
      mission: body.mission || 'Live RF Telemetry Stream',
      color: body.color || '#FF9100',
      status: 'REALTIME_LIVE',
      trust_score: 100,
      timestamp: new Date().toISOString(),
    };

    // Upsert by ID
    const idx = realIngestedDronesStore.findIndex(d => d.id === newTarget.id);
    if (idx >= 0) {
      realIngestedDronesStore[idx] = newTarget;
    } else {
      realIngestedDronesStore.push(newTarget);
    }

    return NextResponse.json({
      status: 'success',
      message: 'Real live sensor telemetry ingested successfully',
      target: newTarget,
      total_active_targets: realIngestedDronesStore.length,
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : 'Invalid JSON' }, { status: 400 });
  }
}
