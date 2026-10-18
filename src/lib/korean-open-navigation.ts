/**
 * OSIRIS — 국토교통부 표준노드링크 & 국내 오픈 내비게이션 엔진 (Korean Open Navigation & MOLIT Standards)
 *
 * [국내 내비게이션 상용 키(네이버/카카오) 대체 공공·오픈소스 아키텍처]:
 * 1. 국토교통부 표준노드링크 (MOLIT ITS Standard Node-Link):
 *    - 대한민국 모든 내비게이션(티맵, 카카오내비, 네이버지도 등)이 도로교통정보 및 소통 속도를
 *      매칭할 때 표준(Standard)으로 사용하는 국가 공인 기간망 지리정보체계(GIS).
 *    - 고속국도(101), 일반국도(102), 특·광역시도(103), 지방도(104), 시·군도(105), 국가지원지방도(106)
 *      등 모든 국가 관리 도로의 Link ID, Node ID, 차로수, 제한속도, 회전규제 제공.
 * 2. 국토교통부 브이월드(V-World) 공공 공간정보 오픈 플랫폼:
 *    - 국토교통부 산하 공간정보산업진흥원 WFS 서비스(LT_L_MOCTLINK / LT_L_SPRD).
 * 3. 오픈소스 내비게이션 라우팅 엔진 (FOSSGIS - Valhalla / OSRM):
 *    - OpenStreetMap Korea의 최신 도로망 PBF와 국토교통부 고시 노선을 기반으로,
 *      상용 키 없이 100% 무료·무제한 한국어 턴바이턴 안내와 미터 단위 정밀 폴리라인 산출.
 */

export interface MolitStandardLink {
  linkId: string;
  fNode: string; // 시작 노드 ID
  tNode: string; // 종료 노드 ID
  roadName: string; // 도로명 (예: 김포대로, 대명항로)
  roadNo: string; // 노선번호 (예: 48, 356, 355, 78)
  roadRank: '101' | '102' | '103' | '104' | '105' | '106'; // 도로 등급
  roadRankName: string;
  lanes: number; // 차로수
  speedLimit: number; // 법정 최고속도 (km/h)
  adminCode: string; // 행정동 코드 (예: 41570 김포시)
  lengthMeters: number;
}

export interface MolitCorridorSummary {
  corridorId: string;
  roadName: string;
  officialRouteNo: string;
  category: 'national' | 'local' | 'expressway';
  governingBody: string; // 관할 관청 (국토교통부 서울지방국토관리청, 경기도 등)
  totalDistanceMeters: number;
  vertexCount: number;
  speedLimitKmh: number;
  cctvCount: number;
  dataSource: string;
  standardNodeLinkVersion: string;
}

/**
 * 국토교통부 고시 기준 김포 및 경기 서북부 4대 핵심 도로 회랑 표준 메타데이터
 */
export const MOLIT_CORRIDOR_REGISTRY: Record<string, MolitCorridorSummary> = {
  route48: {
    corridorId: 'route48',
    roadName: '김포대로 (일반국도 제48호선)',
    officialRouteNo: '48',
    category: 'national',
    governingBody: '국토교통부 서울지방국토관리청',
    totalDistanceMeters: 36082,
    vertexCount: 897,
    speedLimitKmh: 70,
    cctvCount: 6,
    dataSource: '국토교통부 고시 일반국도 48호선 노선대장 & OpenStreetMap Korea 실측 도로망',
    standardNodeLinkVersion: 'MOLIT-ITS-2026-Q3'
  },
  route356: {
    corridorId: 'route356',
    roadName: '대명항로·양곡우회로 (지방도 제356호선)',
    officialRouteNo: '356',
    category: 'local',
    governingBody: '경기도 건설본부 북부도로과',
    totalDistanceMeters: 10117,
    vertexCount: 274,
    speedLimitKmh: 60,
    cctvCount: 4,
    dataSource: '경기도 고시 제2005-116호 대명항로 본선축 & OpenStreetMap Korea 실측 도로망',
    standardNodeLinkVersion: 'MOLIT-ITS-2026-Q3'
  },
  route355: {
    corridorId: 'route355',
    roadName: '봉수대로·구래로 (지방도 제355호선)',
    officialRouteNo: '355',
    category: 'local',
    governingBody: '경기도 건설본부 북부도로과',
    totalDistanceMeters: 17385,
    vertexCount: 579,
    speedLimitKmh: 60,
    cctvCount: 5,
    dataSource: '경기도 고시 제2005-116호 봉수대로 본선축 & OpenStreetMap Korea 실측 도로망',
    standardNodeLinkVersion: 'MOLIT-ITS-2026-Q3'
  },
  route78: {
    corridorId: 'route78',
    roadName: '김포한강로 (국가지원지방도 제78호선)',
    officialRouteNo: '78',
    category: 'local',
    governingBody: '경기도·김포시 도로관리과',
    totalDistanceMeters: 18450,
    vertexCount: 711,
    speedLimitKmh: 80,
    cctvCount: 6,
    dataSource: '국토교통부 고시 국가지원지방도 78호선 & OpenStreetMap Korea 실측 도로망',
    standardNodeLinkVersion: 'MOLIT-ITS-2026-Q3'
  }
};

/**
 * 국가 공공기관 및 오픈소스 내비게이션 데이터 소스 카탈로그
 */
export const KOREAN_OPEN_NAV_SOURCES = {
  its_standard_node_link: {
    name: 'ITS 국가교통정보센터 표준노드링크',
    url: 'https://www.its.go.kr/nodelink/intro',
    description: '국내 모든 상용 내비(티맵, 카카오, 네이버)가 기반으로 사용하는 대한민국 표준 전자 도로망 GIS',
    format: 'SHP, WGS84 (EPSG:4326), Link/Node 테이블',
    freePublicAccess: true,
    commercialKeyRequired: false
  },
  molit_ktdb: {
    name: '국토교통부 국가교통DB (KTDB)',
    url: 'https://www.ktdb.go.kr',
    description: '국가 공인 교통수요예측 및 도로망 네트워크 기하 데이터베이스',
    format: 'GIS Shapefile, 전국 간선도로망 링크',
    freePublicAccess: true,
    commercialKeyRequired: false
  },
  vworld_wfs: {
    name: '국토교통부 브이월드(V-World) 공간정보 오픈플랫폼',
    url: 'https://api.vworld.kr',
    layerMOCTLINK: 'LT_L_MOCTLINK', // 국토교통부 표준노드링크 도로망 레이어
    layerSPRD: 'LT_L_SPRD', // 행정안전부 도로명주소 도로구간 레이어
    description: '국토교통부 산하 공간정보산업진흥원 공식 오픈 WFS/WMS 서비스',
    format: 'GeoJSON, EPSG:4326',
    freePublicAccess: true,
    commercialKeyRequired: false
  },
  open_routing_engine: {
    name: 'FOSSGIS 오픈 내비게이션 엔진 (Valhalla & OSRM Korea)',
    primaryEndpoint: '/api/directions',
    upstreamValhalla: 'https://valhalla1.openstreetmap.de',
    upstreamOSRM: 'https://router.project-osrm.org',
    description: '한국어 턴바이턴 안내, 실시간 경로 탐색, 고도 프로필, 거리/시간을 완전 무상 제공하는 오픈 내비게이션 라우터',
    format: 'GeoJSON LineString + Step Narratives',
    freePublicAccess: true,
    commercialKeyRequired: false
  }
} as const;

/**
 * 국토교통부 표준 도로 등급 코드 해석
 */
export function getRoadRankLabel(rankCode: string): string {
  switch (rankCode) {
    case '101': return '고속국도';
    case '102': return '일반국도';
    case '103': return '특별시·광역시도';
    case '104': return '지방도';
    case '105': return '시·군도';
    case '106': return '국가지원지방도';
    default: return '일반도로';
  }
}
