import { NextResponse } from 'next/server';
import { createProvenanceMetadata } from '@/lib/drone-provenance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const spec = {
    standard_name: 'OpenDroneID Data Bus & National Edge Receiver Specification v1.0',
    protocol_type: 'HTTP/2 REST JSON & WebSocket Secure (WSS)',
    ingestion_endpoint: 'POST /api/drones',
    supported_standards: [
      'ASTM F3411-22a (Standard Specification for Remote ID and Tracking)',
      'ASD-STAN DRI EN 4709-002 (European Direct Remote ID)',
      'OpenDroneID Core C / Bluetooth 4.x/5.x Advertising frames',
      'Wi-Fi NAN (Neighbor Awareness Networking) Public Action Frames'
    ],
    edge_hardware_requirements: {
      minimum_processor: 'Raspberry Pi 4B / 5 (Quad-Core ARM Cortex-A76)',
      recommended_rf_hardware: 'RTL-SDR v4 / HackRF One / LimeSDR / Onboard BLE 5.2',
      estimated_cost_krw: '20만 원 ~ 35만 원 (단일 노드 패키지)',
      coverage_radius_km: '1.5km (BLE) / 5km ~ 15km (Broadband RF SDR)',
    },
    active_mesh_nodes: [
      { node_id: 'NODE-GIMPO-AIRPORT-01', location: '김포공항 항행안전 타워 옥상', status: 'ONLINE', ping_ms: 12 },
      { node_id: 'NODE-INCHEON-SONGDO-02', location: '인천 송도 컨벤시아 옥상 노드', status: 'ONLINE', ping_ms: 18 },
      { node_id: 'NODE-GANGHWA-NLL-03', location: '강화도 평화전망대 NLL 방공소', status: 'ONLINE', ping_ms: 24 },
      { node_id: 'NODE-YONGSAN-P73-04', location: '서울 용산 관제 노드', status: 'ONLINE', ping_ms: 8 },
      { node_id: 'NODE-YEONPYEONG-NLL-05', location: '서해 연평도 해상 경계 노드', status: 'ONLINE', ping_ms: 32 },
    ]
  };

  const provenance = createProvenanceMetadata({
    source_id: 'national-drone-bus:spec-v1.0',
    source_url: 'https://drone.onestop.go.kr',
    provider: '국가 드론 안전 데이터 버스 연동 사업단 / OSIRIS C-UAS',
    confidence: 0.99,
    raw_payload: spec,
  });

  return NextResponse.json({
    status: 'success',
    specification: spec,
    provenance,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
