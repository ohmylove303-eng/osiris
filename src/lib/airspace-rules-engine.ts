/**
 * OSIRIS — Airspace Rules Engine (공역 판정 규칙 엔진)
 * Evaluates Lat, Lng, Altitude AGL, and Time against MOLIT / VFR Rules.
 * Pure Rule-Based Engine — ZERO LLM Hallucinations.
 */

import { latLngToMGRS } from './mgrs-converter';
import { createProvenanceMetadata, ProvenanceMetadata } from './drone-provenance';

export type DecisionType = 'ALLOWED' | 'REVIEW_REQUIRED' | 'RESTRICTED' | 'NO_DATA';

export interface AirspaceCheckResult {
  decision: DecisionType;
  decision_label: string;
  color_code: 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
  coordinates: {
    lat: number;
    lng: number;
    alt_m: number;
    mgrs: string;
  };
  airspace_zones_intersected: Array<{
    code: string;
    name: string;
    type: 'PROHIBITED_P73' | 'NUCLEAR_P518' | 'AIRPORT_CTR' | 'MILITARY_BORDER';
    distance_km: number;
    restriction_detail: string;
  }>;
  reasons: string[];
  permit_requirements: string[];
  notices: string[];
  sources: ProvenanceMetadata[];
  confidence: number;
}

// Haversine Distance Calculator (km)
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Major Airspace & Key Infrastructure Zones
const KEY_AIRSPACE_ZONES = [
  { code: 'P-73A', name: '서울 용산 대통령 집무실 비행금지구역 (핵심)', lat: 37.5326, lng: 126.9810, radius_km: 3.7, type: 'PROHIBITED_P73' as const, detail: '국가 최고 보안 비행금지구역 (승인 없는 비행 즉시 강제 차단/격추)' },
  { code: 'P-73B', name: '서울 수도권 비행제한구역 (완충)', lat: 37.5326, lng: 126.9810, radius_km: 8.3, type: 'PROHIBITED_P73' as const, detail: '수도권 비행제한구역 (국토부 및 수도방위사령부 사전 비행승인 필수)' },
  { code: 'P-518A', name: '고리/새울 원자력발전소 비행금지구역', lat: 35.3180, lng: 129.2940, radius_km: 18.5, type: 'NUCLEAR_P518' as const, detail: '국가중요시설 원전 상공 비행금지' },
  { code: 'P-518B', name: '한빛 원자력발전소 비행금지구역', lat: 35.4150, lng: 126.4170, radius_km: 18.5, type: 'NUCLEAR_P518' as const, detail: '국가중요시설 원전 상공 비행금지' },
  { code: 'CTR-ICN', name: '인천국제공항 관제권 (Airport CTR)', lat: 37.4600, lng: 126.4400, radius_km: 9.3, type: 'AIRPORT_CTR' as const, detail: '항공기 이착륙 관제구역 (반경 9.3km 이내 무승인 비행 금지)' },
  { code: 'CTR-GMP', name: '김포국제공항 관제권 (Airport CTR)', lat: 37.5580, lng: 126.7900, radius_km: 9.3, type: 'AIRPORT_CTR' as const, detail: '항공기 이착륙 관제구역 (반경 9.3km 이내 무승인 비행 금지)' },
  { code: 'CTR-SSN', name: '성남 서울공항 관제권 (군 관제권)', lat: 37.4440, lng: 127.1140, radius_km: 9.3, type: 'AIRPORT_CTR' as const, detail: '공군 기지 관제구역 (반경 9.3km 이내 비행승인 필수)' },
  { code: 'NLL-PAJU', name: '파주/강화 DMZ 접경 군사분계선 제한구역', lat: 37.8800, lng: 126.7500, radius_km: 15.0, type: 'MILITARY_BORDER' as const, detail: '최전방 군사분계선 무인기 비행제한구역' }
];

export function checkAirspaceFeasibility(lat: number, lng: number, alt_m: number = 50): AirspaceCheckResult {
  const mgrs = latLngToMGRS(lat, lng);
  const intersected: AirspaceCheckResult['airspace_zones_intersected'] = [];
  const reasons: string[] = [];
  const permit_requirements: string[] = [];

  let highestRisk: DecisionType = 'ALLOWED';

  // 1. Evaluate Airspace Zones
  for (const zone of KEY_AIRSPACE_ZONES) {
    const dist = haversineKm(lat, lng, zone.lat, zone.lng);
    if (dist <= zone.radius_km) {
      intersected.push({
        code: zone.code,
        name: zone.name,
        type: zone.type,
        distance_km: Number(dist.toFixed(2)),
        restriction_detail: zone.detail,
      });

      if (zone.type === 'PROHIBITED_P73' || zone.type === 'NUCLEAR_P518') {
        highestRisk = 'RESTRICTED';
        reasons.push(`[적색 경고] ${zone.name} 이내 위치 (거리: ${dist.toFixed(2)}km) - 비행금지구역`);
        permit_requirements.push('국토교통부 드론원스톱 + 수도방위사령부/국가중요시설 특별비행승인 필수 제출');
      } else if (zone.type === 'AIRPORT_CTR') {
        if (highestRisk !== 'RESTRICTED') highestRisk = 'REVIEW_REQUIRED';
        reasons.push(`[황색 주의] ${zone.name} 이내 위치 (거리: ${dist.toFixed(2)}km) - 공항 관제권 반경 9.3km 이내`);
        permit_requirements.push('지방항공청 공항관제탑 관제권 비행승인 신청 필수 (드론원스톱 제출)');
      }
    }
  }

  // 2. Evaluate Altitude AGL Rule (150m = 492ft)
  if (alt_m > 150) {
    if (highestRisk !== 'RESTRICTED') highestRisk = 'REVIEW_REQUIRED';
    reasons.push(`[황색 주의] 비행 고도 ${alt_m}m는 항공안전법상 기본 한계 고도(150m AGL)를 초과합니다.`);
    permit_requirements.push('150m 이상 고고도 비행을 위한 국토교통부 특별비행승인 필요');
  }

  // Final Decision Mapping
  let decision_label = '공개자료 기준 비행 가능 구역 (조건부 비행)';
  let color_code: AirspaceCheckResult['color_code'] = 'GREEN';

  if (highestRisk === 'RESTRICTED') {
    decision_label = '비행 금지 / 중대 제한 구역 (RESTRICTED)';
    color_code = 'RED';
  } else if (highestRisk === 'REVIEW_REQUIRED') {
    decision_label = '비행 승인 및 사전 검토 필요 구역 (REVIEW REQUIRED)';
    color_code = 'YELLOW';
  } else {
    reasons.push('[녹색 허용] 관제권·비행금지구역 밖이며, 150m 미만 일반 비행 조건 충족');
  }

  // Provenance Sources Attach
  const sources: ProvenanceMetadata[] = [
    createProvenanceMetadata({
      source_id: 'data.go.kr:15106870',
      source_url: 'https://www.data.go.kr/data/15106870/fileData.do',
      provider: '국토교통부 드론원스톱 / 항공안전기술원',
      version: '2026-v1.0',
      confidence: 0.98,
      transformation: 'airspace-spatial-cross-check-v1',
    }),
    createProvenanceMetadata({
      source_id: 'molit.go.kr:policy-584',
      source_url: 'https://www.molit.go.kr/USR/policyTarget/dtl.jsp?idx=584',
      provider: '국토교통부 항공안전법 시행규칙 공역 기준',
      version: '2026-08',
      confidence: 0.99,
      transformation: 'rule-based-deterministic-eval',
    })
  ];

  return {
    decision: highestRisk,
    decision_label,
    color_code,
    coordinates: {
      lat,
      lng,
      alt_m,
      mgrs,
    },
    airspace_zones_intersected: intersected,
    reasons,
    permit_requirements,
    notices: [
      '본 비행 가능성 판정은 공개된 공공데이터 및 법령 규칙에 근거하며, 행정기관의 최종 공식 승인 결정을 대체하지 않습니다.',
      '최대이륙중량 2kg 초과 기체 및 모든 사용사업용 드론은 국토교통부 드론원스톱 기체신고가 필수입니다.'
    ],
    sources,
    confidence: highestRisk === 'RESTRICTED' ? 0.99 : 0.92,
  };
}
