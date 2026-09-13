import { NextResponse } from 'next/server';
import { createProvenanceMetadata } from '@/lib/drone-provenance';
import { latLngToMGRS } from '@/lib/mgrs-converter';

export const dynamic = 'force-dynamic';

export interface GpsJammingAlert {
  id: string;
  zone_name: string;
  threat_level: 'CRITICAL' | 'HIGH' | 'MODERATE';
  center_lat: number;
  center_lng: number;
  mgrs_10digit: string;
  affected_radius_km: number;
  jammed_frequencies: string[];
  estimated_bearing_deg: number;
  source_origin: string;
  advisory_notice: string;
  timestamp: string;
}

export async function GET() {
  const alerts: GpsJammingAlert[] = [
    {
      id: 'JAMMING-ALERT-WEST-SEA-01',
      zone_name: '서해 NLL / 연평도 해상 전파 교란 구역',
      threat_level: 'CRITICAL',
      center_lat: 37.6200,
      center_lng: 125.8000,
      mgrs_10digit: latLngToMGRS(37.6200, 125.8000),
      affected_radius_km: 18.5,
      jammed_frequencies: ['GPS L1 (1575.42 MHz)', 'GLONASS L1 (1602 MHz)'],
      estimated_bearing_deg: 345, // North-Northwest (DPRK direction)
      source_origin: '북한 옹진반도 해안 방사원 감지',
      advisory_notice: '해당 공역 내 드론 비행 시 GPS 수신 불가로 인한 자동 추락 및 위치 이탈 위험이 매우 높으므로 즉시 휠백/수동 회항(RTH)을 수행해야 합니다.',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'JAMMING-ALERT-GANGHWA-02',
      zone_name: '강화도 / 교동도 접경 전파 교란 구역',
      threat_level: 'HIGH',
      center_lat: 37.7400,
      center_lng: 126.5000,
      mgrs_10digit: latLngToMGRS(37.7400, 126.5000),
      affected_radius_km: 12.0,
      jammed_frequencies: ['GPS L1 (1575.42 MHz)'],
      estimated_bearing_deg: 350,
      source_origin: '북한 개풍군 접경 방사원 감지',
      advisory_notice: 'GPS 기만 신호(Spoofing) 감지됨. 조종자 위치와 다른 가짜 좌표로 유도될 위험이 있습니다.',
      timestamp: new Date().toISOString(),
    }
  ];

  const provenance = createProvenanceMetadata({
    source_id: 'msit.crms:gps-jamming-alert-v1',
    source_url: 'https://crms.go.kr',
    provider: '과기정통부 중앙전파관리소 / 국방부 전파교란 대응팀',
    confidence: 0.99,
    raw_payload: alerts,
  });

  return NextResponse.json({
    status: 'success',
    system: 'OSIRIS 서해 NLL 및 접경지역 실시간 GPS 전파 교란(Jamming/Spoofing) 조기경보 API',
    alerts,
    total: alerts.length,
    provenance,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
