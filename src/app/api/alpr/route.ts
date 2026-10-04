import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export interface AlprCameraNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'ALPR' | 'SPEED_ENFORCEMENT' | 'SECURITY_CHECKPOINT';
  road: string;
  direction?: string;
  operator?: string;
}

export const SAMPLE_ALPR_NODES: AlprCameraNode[] = [
  {
    id: 'alpr-kr-001',
    name: '서울 톨게이트 스마트 ALPR 감시국',
    lat: 37.3695,
    lng: 127.1065,
    type: 'ALPR',
    road: 'Gyeongbu Expressway (1)',
    direction: 'NB / SB',
    operator: 'EX Korea Expressway Corp',
  },
  {
    id: 'alpr-kr-002',
    name: '인천대교 영종 관문 번호판인식 카메라',
    lat: 37.478,
    lng: 126.541,
    type: 'ALPR',
    road: 'Incheon Grand Bridge (110)',
    direction: 'Airport Bound',
    operator: 'Incheon Bridge Co.',
  },
  {
    id: 'alpr-kr-003',
    name: '통일대교 민통선 통제 관문 감시',
    lat: 37.892,
    lng: 126.745,
    type: 'SECURITY_CHECKPOINT',
    road: 'National Route 1 (Tongil Bridge)',
    direction: 'DMZ Security Boundary',
    operator: 'ROK Army / MND',
  },
  {
    id: 'alpr-kr-004',
    name: '남산 1호터널 혼잡통행료 차량인식',
    lat: 37.554,
    lng: 126.991,
    type: 'ALPR',
    road: 'Samil-daero',
    direction: 'City Hall Bound',
    operator: 'Seoul Metropolitan Govt',
  },
  {
    id: 'alpr-kr-005',
    name: '동해선 고성 제진 통일출입사무소',
    lat: 38.578,
    lng: 128.362,
    type: 'SECURITY_CHECKPOINT',
    road: 'National Route 7',
    direction: 'Northern Border Line',
    operator: 'Ministry of Unification',
  },
  {
    id: 'alpr-us-001',
    name: 'George Washington Bridge GWB ALPR Array',
    lat: 40.8517,
    lng: -73.9527,
    type: 'ALPR',
    road: 'I-95 / US-1',
    direction: 'Eastbound Upper Level',
    operator: 'Port Authority NYNJ',
  },
  {
    id: 'alpr-us-002',
    name: 'San Ysidro Border Checkpoint Automated Plate Reader',
    lat: 32.5428,
    lng: -117.0297,
    type: 'SECURITY_CHECKPOINT',
    road: 'I-5 South Terminus',
    direction: 'US-Mexico Border',
    operator: 'US Customs & Border Protection',
  },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const minLat = parseFloat(searchParams.get('minLat') || '-90');
  const maxLat = parseFloat(searchParams.get('maxLat') || '90');
  const minLng = parseFloat(searchParams.get('minLng') || '-180');
  const maxLng = parseFloat(searchParams.get('maxLng') || '180');

  const filtered = SAMPLE_ALPR_NODES.filter(
    (c) => c.lat >= minLat && c.lat <= maxLat && c.lng >= minLng && c.lng <= maxLng
  );

  const geojson = {
    type: 'FeatureCollection',
    features: filtered.map((cam) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [cam.lng, cam.lat],
      },
      properties: {
        id: cam.id,
        name: cam.name,
        type: cam.type,
        road: cam.road,
        direction: cam.direction,
        operator: cam.operator,
      },
    })),
  };

  return NextResponse.json(geojson, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
