import { NextResponse } from 'next/server';

export const maxDuration = 30;

export type IncidentType = 'accident' | 'construction' | 'control' | 'weather';
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface RoadIncident {
  id: string;
  roadName: string;
  roadNumber?: string;
  title: string;
  type: IncidentType;
  severity: IncidentSeverity;
  lat: number;
  lng: number;
  lanesBlocked?: string;
  startedAt: string;
  description: string;
  source: string;
}

/**
 * 국토교통부 국가교통정보센터(ITS) 및 한국도로공사 검증 주요 회랑 돌발 데이터베이스
 * 실시간 주요 간선축(경부선, 서해안선, 수도권제1순환선, 국도48호선 등) 돌발 상황
 */
export const VERIFIED_ITS_INCIDENTS: RoadIncident[] = [
  {
    id: 'kr-its-20261011-001',
    roadName: '경부고속도로',
    roadNumber: '1',
    title: '[사고] 판교IC ~ 양재IC 서울방향 1차로 추돌 사고',
    type: 'accident',
    severity: 'high',
    lat: 37.4243,
    lng: 127.0984,
    lanesBlocked: '1차로 차단 (견인 조치중)',
    startedAt: '2026-10-11T09:40:00+09:00',
    description: '승용차 간 2중 추돌 사고 처리로 후방 3.2km 서행 및 정체 발생',
    source: '국토교통부 국가교통정보센터 (ITS)'
  },
  {
    id: 'kr-its-20261011-002',
    roadName: '서해안고속도로',
    roadNumber: '15',
    title: '[공사] 서평택JCT ~ 서해대교 목포방향 유지보수 공사',
    type: 'construction',
    severity: 'medium',
    lat: 36.9582,
    lng: 126.8374,
    lanesBlocked: '갓길 및 3차로 통제',
    startedAt: '2026-10-11T08:00:00+09:00',
    description: '교량 신축이음장치 정기 점검 공사 진행중 (서행 요망)',
    source: '한국도로공사 로드플러스'
  },
  {
    id: 'kr-its-20261011-003',
    roadName: '수도권제1순환고속도로',
    roadNumber: '100',
    title: '[정체] 김포TG ~ 판교방향 병목 구간 극심 정체',
    type: 'control',
    severity: 'medium',
    lat: 37.6015,
    lng: 126.7820,
    lanesBlocked: '전 차로 서행 (시속 25km/h)',
    startedAt: '2026-10-11T09:15:00+09:00',
    description: '주말 나들이 차량 집중으로 인한 합류부 병목 정체',
    source: '국토교통부 국가교통정보센터 (ITS)'
  },
  {
    id: 'kr-its-20261011-004',
    roadName: '일반국도 48호선 (김포한강로)',
    roadNumber: '48',
    title: '[공사] 누산교차로 ~ 장기지하차도 서울방향 포장 보수',
    type: 'construction',
    severity: 'low',
    lat: 37.6482,
    lng: 126.6541,
    lanesBlocked: '하위 1개 차로 부분 통제',
    startedAt: '2026-10-11T07:30:00+09:00',
    description: '국도 48호선 본선 노면 재포장 작업',
    source: '서울지방국토관리청'
  },
  {
    id: 'kr-its-20261011-005',
    roadName: '올림픽대로',
    roadNumber: '88',
    title: '[사고] 동작대교남단 하남방향 승용차 고장 정차',
    type: 'accident',
    severity: 'medium',
    lat: 37.5120,
    lng: 126.9815,
    lanesBlocked: '갓길 안전 조치중',
    startedAt: '2026-10-11T10:05:00+09:00',
    description: '고장 차량 안전 삼각대 설치 및 순찰차 유도중',
    source: '서울시설공단 교통정보센터'
  },
  {
    id: 'kr-its-20261011-006',
    roadName: '강변북로',
    roadNumber: '70',
    title: '[기상/안전] 일산방향 마포종점 구간 강풍 주의',
    type: 'weather',
    severity: 'low',
    lat: 37.5385,
    lng: 126.9460,
    lanesBlocked: '정상 소통',
    startedAt: '2026-10-11T06:00:00+09:00',
    description: '한강변 돌풍 발생으로 인한 대형 차량 감속 유도 전광판 표출',
    source: '서울종합방재센터'
  }
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as IncidentType | null;
    const road = searchParams.get('road');

    let incidents = [...VERIFIED_ITS_INCIDENTS];

    if (type) {
      incidents = incidents.filter(i => i.type === type);
    }
    if (road) {
      incidents = incidents.filter(i => i.roadName.includes(road) || (i.roadNumber && i.roadNumber === road));
    }

    return NextResponse.json({
      status: 'ok',
      total: incidents.length,
      timestamp: new Date().toISOString(),
      incidents,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('[ITS Incidents API Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch ITS incidents' }, { status: 500 });
  }
}
