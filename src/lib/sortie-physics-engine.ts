/**
 * OSIRIS × 신의 눈 — 번개의 눈동자 (LIGHTNING EYE)
 * 물리적 실재성(Physical Truth Harness) 기반 전술 비행 및 소티 수명 주기 물리 엔진
 * 
 * 1. 무한 궤도 비행(Fake Orbit AI-Slop) 원천 배제
 * 2. 4단계 소티 주기: 출격/상승(TAKEOFF) ➔ 초계(ON_STATION) ➔ 귀환(RTB) ➔ 착륙/계류(LANDED)
 * 3. 실제 공군기지 활주로 좌표계 및 항공역학적 속도/고도/진방위각(True Bearing) 계산
 * 4. 연료 소모율(Fuel Burn Rate) 및 긴급 빙고 연료(Bingo Fuel 25%) 강제 회항 모델
 */

export type SortiePhase = 'TAKEOFF' | 'ON_STATION' | 'RTB' | 'LANDED';

export interface AirbaseInfo {
  icao: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
  elevationM: number;
  country: string;
  branch: string;
  runwayHeading: number;
}

/**
 * 한반도 및 핵심 전역 공군기지 / 민간공항 정밀 WGS84 좌표계
 */
export const AIRBASES: Record<string, AirbaseInfo> = {
  // ── 대한민국 공군 (ROKAF) & 육/해군 ──
  RKTU: {
    icao: 'RKTU',
    name: '청주 공군기지 (제17전투비행단 / 제39정찰비행단)',
    shortName: '청주 (제17전비)',
    lat: 36.7167,
    lng: 127.4989,
    elevationM: 58,
    country: '대한민국',
    branch: '대한민국 공군',
    runwayHeading: 50,
  },
  RKTN: {
    icao: 'RKTN',
    name: '대구 공군기지 (제11전투비행단)',
    shortName: '대구 (제11전비)',
    lat: 35.8941,
    lng: 128.6589,
    elevationM: 35,
    country: '대한민국',
    branch: '대한민국 공군',
    runwayHeading: 130,
  },
  RKTP: {
    icao: 'RKTP',
    name: '서산 공군기지 (제20전투비행단)',
    shortName: '서산 (제20전비)',
    lat: 36.7003,
    lng: 126.4939,
    elevationM: 12,
    country: '대한민국',
    branch: '대한민국 공군',
    runwayHeading: 20,
  },
  RKNW: {
    icao: 'RKNW',
    name: '원주 공군기지 (제8전투비행단)',
    shortName: '원주 (제8전비)',
    lat: 37.4383,
    lng: 127.9606,
    elevationM: 100,
    country: '대한민국',
    branch: '대한민국 공군',
    runwayHeading: 30,
  },
  RKPK: {
    icao: 'RKPK',
    name: '김해 공군기지 (제5공중기동비행단 / 제51항공통제전대)',
    shortName: '김해 (제5공중기동)',
    lat: 35.1794,
    lng: 128.9383,
    elevationM: 4,
    country: '대한민국',
    branch: '대한민국 공군',
    runwayHeading: 360,
  },
  RKTI: {
    icao: 'RKTI',
    name: '육군 항공사령부 (이천 항공작전기지)',
    shortName: '이천 (육군항공사)',
    lat: 37.2408,
    lng: 127.4983,
    elevationM: 65,
    country: '대한민국',
    branch: '대한민국 육군',
    runwayHeading: 320,
  },
  RKTH: {
    icao: 'RKTH',
    name: '포항 해군항공사령부 (해군 항공작전기지)',
    shortName: '포항 (해군항공사)',
    lat: 35.9878,
    lng: 129.4206,
    elevationM: 21,
    country: '대한민국',
    branch: '대한민국 해군',
    runwayHeading: 100,
  },

  // ── 주한미군 (USFK / USAF) ──
  RKSO: {
    icao: 'RKSO',
    name: '오산 미 공군기지 (USAF 제51전투비행단 / 제5정찰대)',
    shortName: '오산 미 공군기지',
    lat: 37.0903,
    lng: 127.0306,
    elevationM: 12,
    country: '미국',
    branch: '미합중국 공군',
    runwayHeading: 90,
  },
  RKJK: {
    icao: 'RKJK',
    name: '군산 미 공군기지 (USAF 제8전투비행단 울프팩)',
    shortName: '군산 미 공군기지',
    lat: 35.9261,
    lng: 126.6158,
    elevationM: 9,
    country: '미국',
    branch: '미합중국 공군',
    runwayHeading: 360,
  },
  RJOI: {
    icao: 'RJOI',
    name: '미 해병대 이와쿠니 항공기지 (MCAS Iwakuni)',
    shortName: '이와쿠니 (미 해병대)',
    lat: 34.1439,
    lng: 132.2356,
    elevationM: 2,
    country: '미국',
    branch: '미합중국 해병대',
    runwayHeading: 20,
  },
  PGUA: {
    icao: 'PGUA',
    name: '앤더슨 공군기지 (미 태평양공군 괌 기지)',
    shortName: '괌 앤더슨 기지',
    lat: 13.5841,
    lng: 144.9244,
    elevationM: 192,
    country: '미국',
    branch: '미합중국 공군',
    runwayHeading: 60,
  },

  // ── 북한 조선인민군 공군 (DPRK KPAF) ──
  ZKPY: {
    icao: 'ZKPY',
    name: '평양 순안 공군기지 (조선인민군 제55항공전대)',
    shortName: '평양 순안',
    lat: 39.2242,
    lng: 125.6703,
    elevationM: 16,
    country: '북한',
    branch: '조선인민군 공군',
    runwayHeading: 10,
  },
  ZKHM: {
    icao: 'ZKHM',
    name: '원산 갈마 비행장 (조선인민군 제56항공전대)',
    shortName: '원산 갈마',
    lat: 39.1308,
    lng: 127.4811,
    elevationM: 5,
    country: '북한',
    branch: '조선인민군 공군',
    runwayHeading: 15,
  },
  ZKHW: {
    icao: 'ZKHW',
    name: '황주 공군기지 (조선인민군 제85항공전대)',
    shortName: '황주 비행장',
    lat: 38.6528,
    lng: 125.7828,
    elevationM: 40,
    country: '북한',
    branch: '조선인민군 공군',
    runwayHeading: 40,
  },
  ZKTT: {
    icao: 'ZKTT',
    name: '태탄 비행장 (조선인민군 특수작전전대)',
    shortName: '태탄 비행장',
    lat: 38.3517,
    lng: 125.4058,
    elevationM: 15,
    country: '북한',
    branch: '조선인민군 공군',
    runwayHeading: 120,
  },
  ZKKC: {
    icao: 'ZKKC',
    name: '개천 비행장 (조선인민군 제1항공사단)',
    shortName: '개천 비행장',
    lat: 38.3556,
    lng: 126.1039,
    elevationM: 20,
    country: '북한',
    branch: '조선인민군 공군',
    runwayHeading: 310,
  },
  ZKPH: {
    icao: 'ZKPH',
    name: '방현 비행장 (조선인민군 무인기 정찰대)',
    shortName: '방현 비행장',
    lat: 38.6500,
    lng: 126.2000,
    elevationM: 30,
    country: '북한',
    branch: '조선인민군 공군',
    runwayHeading: 270,
  },

  // ── 중국 동부/북부 전구 (PLAAF/PLAN) ──
  ZSAN: {
    icao: 'ZSAN',
    name: '중국 동부전구 안산/웨이하이 공군기지',
    shortName: '중국 안산 기지',
    lat: 36.8500,
    lng: 122.5000,
    elevationM: 25,
    country: '중국',
    branch: '중국 인민해방군 공군',
    runwayHeading: 90,
  },
  ZSWH: {
    icao: 'ZSWH',
    name: '중국 북부전구 웨이하이 무인기 기지',
    shortName: '중국 웨이하이',
    lat: 37.1861,
    lng: 122.2389,
    elevationM: 15,
    country: '중국',
    branch: '중국 인민해방군 공군',
    runwayHeading: 80,
  },

  // ── 일본 항공자위대 & 해상자위대 ──
  RJSM: {
    icao: 'RJSM',
    name: '미사와 기지 (일본 항공자위대 제3항공단)',
    shortName: '미사와 기지',
    lat: 40.7033,
    lng: 141.3683,
    elevationM: 36,
    country: '일본',
    branch: '일본 항공자위대',
    runwayHeading: 100,
  },
  RJCJ: {
    icao: 'RJCJ',
    name: '지토세 기지 (일본 항공자위대 제2항공단)',
    shortName: '지토세 기지',
    lat: 42.7944,
    lng: 141.6658,
    elevationM: 25,
    country: '일본',
    branch: '일본 항공자위대',
    runwayHeading: 180,
  },
  RJFA: {
    icao: 'RJFA',
    name: '쓰이키 기지 (일본 항공자위대 제8항공단)',
    shortName: '쓰이키 기지',
    lat: 33.6850,
    lng: 131.0494,
    elevationM: 17,
    country: '일본',
    branch: '일본 항공자위대',
    runwayHeading: 70,
  },
  RJTA: {
    icao: 'RJTA',
    name: '아쓰기 기지 (일본 해상자위대 제3항공대)',
    shortName: '아쓰기 기지',
    lat: 35.4547,
    lng: 139.4500,
    elevationM: 62,
    country: '일본',
    branch: '일본 해상자위대',
    runwayHeading: 10,
  },

  // ── 이스라엘 공군 (IAF) ──
  LLNV: {
    icao: 'LLNV',
    name: '네바팀 공군기지 (이스라엘 제140대대)',
    shortName: '네바팀 기지',
    lat: 31.2075,
    lng: 35.0125,
    elevationM: 400,
    country: '이스라엘',
    branch: '이스라엘 공군',
    runwayHeading: 80,
  },
  LLHA: {
    icao: 'LLHA',
    name: '하체림 공군기지 (이스라엘 제69대대)',
    shortName: '하체림 기지',
    lat: 31.2333,
    lng: 34.6667,
    elevationM: 220,
    country: '이스라엘',
    branch: '이스라엘 공군',
    runwayHeading: 120,
  },

  // ── 우크라이나 국방군 공군 ──
  UKKK: {
    icao: 'UKKK',
    name: '키이우 바실키우 공군기지 (제40전술항공여단)',
    shortName: '바실키우 기지',
    lat: 50.2333,
    lng: 30.3000,
    elevationM: 180,
    country: '우크라이나',
    branch: '우크라이나 공군',
    runwayHeading: 140,
  },

  // ── 러시아 항공우주군 (VKS) ──
  UUOK: {
    icao: 'UUOK',
    name: '쿠르스크 동부 공군기지 (러시아 항공우주군)',
    shortName: '쿠르스크 기지',
    lat: 51.7517,
    lng: 36.2967,
    elevationM: 207,
    country: '러시아',
    branch: '러시아 항공우주군',
    runwayHeading: 120,
  },
  UWWG: {
    icao: 'UWWG',
    name: '엔겔스-2 공군기지 (러시아 제121전략폭격연대)',
    shortName: '엔겔스 전략기지',
    lat: 51.4833,
    lng: 46.2167,
    elevationM: 100,
    country: '러시아',
    branch: '러시아 항공우주군',
    runwayHeading: 40,
  },

  // ── 대한민국 주요 민간 공항 (Commercial Hubs) ──
  RKSI: {
    icao: 'RKSI',
    name: '인천국제공항 (Incheon International Airport)',
    shortName: '인천공항',
    lat: 37.4602,
    lng: 126.4407,
    elevationM: 7,
    country: '대한민국',
    branch: '민간 국제선',
    runwayHeading: 155,
  },
  RKSS: {
    icao: 'RKSS',
    name: '김포국제공항 (Gimpo International Airport)',
    shortName: '김포공항',
    lat: 37.5586,
    lng: 126.7906,
    elevationM: 18,
    country: '대한민국',
    branch: '민간 국내/국제선',
    runwayHeading: 140,
  },
  RKPC: {
    icao: 'RKPC',
    name: '제주국제공항 (Jeju International Airport)',
    shortName: '제주공항',
    lat: 33.5113,
    lng: 126.4929,
    elevationM: 36,
    country: '대한민국',
    branch: '민간 국내/국제선',
    runwayHeading: 70,
  },
  RKPU: {
    icao: 'RKPU',
    name: '울산공항 (Ulsan Airport)',
    shortName: '울산공항',
    lat: 35.5936,
    lng: 129.3517,
    elevationM: 14,
    country: '대한민국',
    branch: '민간 국내선',
    runwayHeading: 180,
  },
  RKNY: {
    icao: 'RKNY',
    name: '양양국제공항 (Yangyang International Airport)',
    shortName: '양양공항',
    lat: 38.0614,
    lng: 128.6692,
    elevationM: 73,
    country: '대한민국',
    branch: '민간 국제선',
    runwayHeading: 150,
  },
  RKJJ: {
    icao: 'RKJJ',
    name: '광주공항 (Gwangju Airport)',
    shortName: '광주공항',
    lat: 35.1264,
    lng: 126.8089,
    elevationM: 12,
    country: '대한민국',
    branch: '민간 국내선',
    runwayHeading: 40,
  },
  RKJB: {
    icao: 'RKJB',
    name: '무안국제공항 (Muan International Airport)',
    shortName: '무안공항',
    lat: 34.9914,
    lng: 126.3828,
    elevationM: 15,
    country: '대한민국',
    branch: '민간 국제선',
    runwayHeading: 10,
  },
  RKJY: {
    icao: 'RKJY',
    name: '여수공항 (Yeosu Airport)',
    shortName: '여수공항',
    lat: 34.8422,
    lng: 127.6172,
    elevationM: 16,
    country: '대한민국',
    branch: '민간 국내선',
    runwayHeading: 170,
  },

  // ── 일본 주요 국제공항 (Japan Commercial Gateways) ──
  RJAA: {
    icao: 'RJAA',
    name: '도쿄 나리타 국제공항 (Tokyo Narita Airport)',
    shortName: '도쿄 나리타',
    lat: 35.7647,
    lng: 140.3863,
    elevationM: 43,
    country: '일본',
    branch: '민간 국제선',
    runwayHeading: 160,
  },
  RJTT: {
    icao: 'RJTT',
    name: '도쿄 하네다 국제공항 (Tokyo Haneda Airport)',
    shortName: '도쿄 하네다',
    lat: 35.5523,
    lng: 139.7798,
    elevationM: 11,
    country: '일본',
    branch: '민간 국제선',
    runwayHeading: 160,
  },
  RJBB: {
    icao: 'RJBB',
    name: '오사카 간사이 국제공항 (Kansai International Airport)',
    shortName: '오사카 간사이',
    lat: 34.4347,
    lng: 135.2442,
    elevationM: 5,
    country: '일본',
    branch: '민간 국제선',
    runwayHeading: 60,
  },
};

/**
 * 구면 삼각법 기반 두 WGS84 좌표 사이의 정밀 진방위각(True Heading, 0~360°)
 */
export function calculateTrueBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const deltaLambda = (lon2 - lon1) * toRad;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const brng = Math.atan2(y, x) * toDeg;
  return Math.round((brng + 360) % 360);
}

/**
 * WGS84 두 좌표 간의 근사 거리(미터)
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export interface SortieConfig {
  hex: string;
  callsign: string;
  category: 'military' | 'commercial' | 'jet' | 'private';
  model: string;
  reg: string;
  affiliation: string;
  country: string;
  model_image: string;
  color?: string;

  // 기지 및 작전 구역 정의
  baseIcao: string;
  originName: string;
  destinationName: string;
  targetAltFt: number;
  cruiseSpeedKnots: number;

  // 초계 구간 Waypoint Alpha & Bravo (CAP 전개 구역)
  patrolWpt1: [number, number]; // [lat, lng]
  patrolWpt2: [number, number]; // [lat, lng]

  // 소티 수명 주기 파라미터
  cycleSec: number;        // 1소티 총 순환 주기 (예: 1800초 = 30분, 실시간 렌더링 최적화)
  offsetSec: number;       // 편대별 교대 시차 오프셋 (초)
  burnRatePerMin: number;  // 분당 연료 소모율 (%)
  bingoFuelPct: number;    // Bingo Fuel 회항 기준 (기본 25%)
}

export interface ComputedSortieTelemetry {
  lat: number;
  lng: number;
  altMeters: number;
  altFeet: number;
  speedKnots: number;
  heading: number;
  grounded: boolean;
  sortiePhase: SortiePhase;
  sortieLabel: string;
  fuelPct: number;
  fuelDurationMin: number;
  sortieElapsedMin: number;
  homeBaseName: string;
  homeBaseIcao: string;
}

/**
 * 물리적 소티 수명 주기 계산 엔진
 * 0.00 ~ 0.12 : TAKEOFF   (기지 이륙 및 초계 구역으로 전술 상승)
 * 0.12 ~ 0.65 : ON_STATION (작전 구역 내 직선 초계 및 선회 기동, 연료 감소)
 * 0.65 ~ 0.85 : RTB       (Bingo Fuel 25% 도달, 모기지로 직선 강하 귀환)
 * 0.85 ~ 1.00 : LANDED    (기지 착륙 완료, 활주로/계류장 정지, 급유 및 재정비 100% 충전)
 */
export function computeSortieState(cfg: SortieConfig, nowMs: number): ComputedSortieTelemetry {
  const base = AIRBASES[cfg.baseIcao] || {
    icao: cfg.baseIcao,
    name: cfg.originName,
    shortName: cfg.originName,
    lat: cfg.patrolWpt1[0],
    lng: cfg.patrolWpt1[1],
    elevationM: 20,
    country: cfg.country,
    branch: cfg.affiliation,
    runwayHeading: 45,
  };

  const cycleSec = cfg.cycleSec || 1800;
  const offsetSec = cfg.offsetSec || 0;
  const t = ((nowMs / 1000) + offsetSec) % cycleSec;
  const phase = t / cycleSec; // 0.00 ~ 1.00
  const sortieElapsedMin = Math.round((t / 60) * 10) / 10;
  const bingo = cfg.bingoFuelPct || 25;
  const burnRate = cfg.burnRatePerMin || 0.8;

  let lat = base.lat;
  let lng = base.lng;
  let altFt = 0;
  let speed = 0;
  let heading = base.runwayHeading;
  let grounded = false;
  let sortiePhase: SortiePhase = 'LANDED';
  let sortieLabel = '';
  let fuelPct = 100;

  if (phase < 0.12) {
    // ── Phase 1: 출격 및 전술 상승 (TAKEOFF) ──
    const s = phase / 0.12; // 0.0 -> 1.0
    lat = base.lat + (cfg.patrolWpt1[0] - base.lat) * s;
    lng = base.lng + (cfg.patrolWpt1[1] - base.lng) * s;
    altFt = Math.round(cfg.targetAltFt * Math.min(1.0, s * 1.15));
    speed = Math.round(140 + (cfg.cruiseSpeedKnots - 140) * s);
    heading = calculateTrueBearing(base.lat, base.lng, cfg.patrolWpt1[0], cfg.patrolWpt1[1]);
    fuelPct = Math.round(100 - s * 10); // 100% -> 90%
    grounded = s < 0.04;
    sortiePhase = 'TAKEOFF';
    sortieLabel = `🚀 [출격/상승] 기지(${base.shortName}) 이륙 후 목표 공역 전술 상승 중`;
  } else if (phase < 0.65) {
    // ── Phase 2: 초계 구역 작전 임무 (ON_STATION) ──
    const s = (phase - 0.12) / (0.65 - 0.12); // 0.0 -> 1.0
    // 4개 왕복 전술 초계 Leg
    const numLegs = 4;
    const totalLegProgress = s * numLegs;
    const legIdx = Math.floor(totalLegProgress);
    const legFrac = totalLegProgress - legIdx;

    if (legIdx % 2 === 0) {
      // Waypoint 1 ➔ Waypoint 2
      lat = cfg.patrolWpt1[0] + (cfg.patrolWpt2[0] - cfg.patrolWpt1[0]) * legFrac;
      lng = cfg.patrolWpt1[1] + (cfg.patrolWpt2[1] - cfg.patrolWpt1[1]) * legFrac;
      heading = calculateTrueBearing(cfg.patrolWpt1[0], cfg.patrolWpt1[1], cfg.patrolWpt2[0], cfg.patrolWpt2[1]);
    } else {
      // Waypoint 2 ➔ Waypoint 1 (선회 후 복귀 경로)
      lat = cfg.patrolWpt2[0] + (cfg.patrolWpt1[0] - cfg.patrolWpt2[0]) * legFrac;
      lng = cfg.patrolWpt2[1] + (cfg.patrolWpt1[1] - cfg.patrolWpt2[1]) * legFrac;
      heading = calculateTrueBearing(cfg.patrolWpt2[0], cfg.patrolWpt2[1], cfg.patrolWpt1[0], cfg.patrolWpt1[1]);
    }

    altFt = cfg.targetAltFt;
    speed = cfg.cruiseSpeedKnots;
    fuelPct = Math.round(90 - s * (90 - bingo)); // 90% -> Bingo(25%)
    grounded = false;
    sortiePhase = 'ON_STATION';
    sortieLabel = `🎯 [초계 비행] 담당 방공 구역(CAP) 요격 초계 임무 수행 중`;
  } else if (phase < 0.85) {
    // ── Phase 3: 기지 귀환 강하 (RTB) ──
    const s = (phase - 0.65) / (0.85 - 0.65); // 0.0 -> 1.0
    // 초계 구역 끝단(Wpt2)에서 모기지로 강하 복귀
    lat = cfg.patrolWpt2[0] + (base.lat - cfg.patrolWpt2[0]) * s;
    lng = cfg.patrolWpt2[1] + (base.lng - cfg.patrolWpt2[1]) * s;
    altFt = Math.round(cfg.targetAltFt * Math.max(0, 1.0 - s * 0.98));
    speed = Math.round(cfg.cruiseSpeedKnots - (cfg.cruiseSpeedKnots - 160) * s);
    heading = calculateTrueBearing(lat, lng, base.lat, base.lng);
    fuelPct = Math.round(bingo - s * 10); // 25% -> 15% (예비 연료)
    grounded = false;
    sortiePhase = 'RTB';
    sortieLabel = `⚠️ [기지 귀환 (RTB)] Bingo Fuel(잔여 25% 이하) 도달에 따른 모기지(${base.shortName}) 복귀 강하 중`;
  } else {
    // ── Phase 4: 기지 착륙 및 계류/정비 (LANDED) ──
    const s = (phase - 0.85) / (1.00 - 0.85); // 0.0 -> 1.0
    lat = base.lat;
    lng = base.lng;
    altFt = 0;
    speed = 0;
    heading = base.runwayHeading;
    fuelPct = Math.round(15 + s * 85); // 15% -> 100% 급유 진행
    grounded = true;
    sortiePhase = 'LANDED';
    sortieLabel = `🅿️ [지상 계류] 기지 착륙 완료 · 정비 및 연료 보급/무장 점검 중 (${Math.round(fuelPct)}% 충전)`;
  }

  const fuelDurationMin = fuelPct > 0 ? Math.round((fuelPct / burnRate) * 10) / 10 : 0;
  const altMeters = Math.round(altFt * 0.3048);

  return {
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
    altMeters,
    altFeet: altFt,
    speedKnots: speed,
    heading,
    grounded,
    sortiePhase,
    sortieLabel,
    fuelPct,
    fuelDurationMin,
    sortieElapsedMin,
    homeBaseName: base.name,
    homeBaseIcao: base.icao,
  };
}

/**
 * 민간 여객기 정기 노선 비행 수명 주기 (출발지 ➔ 순항로 ➔ 목적지 착륙 ➔ 턴어라운드 복귀)
 */
export function computeCommercialAirwayState(
  originIcao: string,
  destIcao: string,
  cruiseAltFt: number,
  cruiseSpeedKnots: number,
  cycleSec: number,
  offsetSec: number,
  nowMs: number
): ComputedSortieTelemetry {
  const orig = AIRBASES[originIcao] || AIRBASES.RKSS;
  const dest = AIRBASES[destIcao] || AIRBASES.RKPC;

  const t = ((nowMs / 1000) + offsetSec) % cycleSec;
  const phase = t / cycleSec; // 0.00 ~ 1.00
  const sortieElapsedMin = Math.round((t / 60) * 10) / 10;

  let lat = orig.lat;
  let lng = orig.lng;
  let altFt = 0;
  let speed = 0;
  let heading = orig.runwayHeading;
  let grounded = false;
  let sortiePhase: SortiePhase = 'LANDED';
  let sortieLabel = '';
  let fuelPct = 100;

  if (phase < 0.08) {
    // 게이트 대기 및 택싱
    lat = orig.lat;
    lng = orig.lng;
    altFt = 0;
    speed = 0;
    heading = orig.runwayHeading;
    grounded = true;
    sortiePhase = 'LANDED';
    sortieLabel = `🅿️ [출발 대기] ${orig.shortName} 탑승 및 지상 대기`;
    fuelPct = 98;
  } else if (phase < 0.22) {
    // 이륙 및 순항고도 상승
    const s = (phase - 0.08) / (0.22 - 0.08);
    lat = orig.lat + (dest.lat - orig.lat) * (s * 0.25);
    lng = orig.lng + (dest.lng - orig.lng) * (s * 0.25);
    altFt = Math.round(cruiseAltFt * s);
    speed = Math.round(140 + (cruiseSpeedKnots - 140) * s);
    heading = calculateTrueBearing(orig.lat, orig.lng, dest.lat, dest.lng);
    grounded = false;
    sortiePhase = 'TAKEOFF';
    sortieLabel = `🛫 [이륙/상승] ${orig.shortName} 이륙 후 표준 항로 상승 중`;
    fuelPct = Math.round(98 - s * 8);
  } else if (phase < 0.72) {
    // 표준 항공로 순항
    const s = (phase - 0.22) / (0.72 - 0.22);
    lat = (orig.lat + (dest.lat - orig.lat) * 0.25) + (dest.lat - orig.lat) * 0.55 * s;
    lng = (orig.lng + (dest.lng - orig.lng) * 0.25) + (dest.lng - orig.lng) * 0.55 * s;
    altFt = cruiseAltFt;
    speed = cruiseSpeedKnots;
    heading = calculateTrueBearing(orig.lat, orig.lng, dest.lat, dest.lng);
    grounded = false;
    sortiePhase = 'ON_STATION';
    sortieLabel = `✈️ [표준 순항] ${orig.shortName} ➔ ${dest.shortName} 항공로 순항 중`;
    fuelPct = Math.round(90 - s * 35);
  } else if (phase < 0.88) {
    // 목적지 강하 및 최종 착륙 접근
    const s = (phase - 0.72) / (0.88 - 0.72);
    lat = (orig.lat + (dest.lat - orig.lat) * 0.80) + (dest.lat - orig.lat) * 0.20 * s;
    lng = (orig.lng + (dest.lng - orig.lng) * 0.80) + (dest.lng - orig.lng) * 0.20 * s;
    altFt = Math.round(cruiseAltFt * (1.0 - s));
    speed = Math.round(cruiseSpeedKnots - (cruiseSpeedKnots - 140) * s);
    heading = calculateTrueBearing(orig.lat, orig.lng, dest.lat, dest.lng);
    grounded = false;
    sortiePhase = 'RTB';
    sortieLabel = `🛬 [착륙 접근] ${dest.shortName} 활주로 강하 진입 중`;
    fuelPct = Math.round(55 - s * 10);
  } else {
    // 목적지 공항 도착 및 턴어라운드
    lat = dest.lat;
    lng = dest.lng;
    altFt = 0;
    speed = 0;
    heading = dest.runwayHeading;
    grounded = true;
    sortiePhase = 'LANDED';
    sortieLabel = `🅿️ [도착 완료] ${dest.shortName} 활주로 착륙 완료 · 계류장 하기 중`;
    fuelPct = 45;
  }

  return {
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
    altMeters: Math.round(altFt * 0.3048),
    altFeet: altFt,
    speedKnots: speed,
    heading,
    grounded,
    sortiePhase,
    sortieLabel,
    fuelPct,
    fuelDurationMin: Math.round(fuelPct * 1.5),
    sortieElapsedMin,
    homeBaseName: orig.name,
    homeBaseIcao: orig.icao,
  };
}
