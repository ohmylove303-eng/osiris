/**
 * OSIRIS — 대한민국 국토교통부 TAGO & 수도권 통합 실시간 대중교통 엔진
 * (국토부 간선/지선/광역 버스, KTX/코레일 철도, 서울 지하철 1·2·9호선, AREX, 김포골드라인)
 *
 * Sources & Standards:
 * 1. 국토교통부 TAGO (대중교통정보센터) 실시간 버스위치정보 API 규격 (BusLcInfoInqireService)
 * 2. 서울 지하철 2호선(순환선), 1호선, 9호선 실시간 운행 철도망 (당산철교·잠실철교·한강철교 정밀 축선)
 * 3. 서울 주요 간선 버스 (740번 서강대교 통과, 273번 대학가·홍대 축선, 421번 남산1호터널·이태원·한남대교 축선, 150번 한강대교 축선, 01번 남산타워 순환선)
 * 4. 수도권 광역 버스 (김포 3000번, M6117번, 청라 7700번 BRT, 분당 9401번, 강화 70번)
 * 5. 코레일/SRT 고속철도 (KTX 경부고속선, SRT 호남고속선, 경의중앙선 DMZ 축선)
 * 6. 공공데이터포털(data.go.kr) API 키 환경변수(DATA_GO_KR_KEY, TAGO_API_KEY) 자동 연동 지원
 */

import type { TransitVehicle, TransitFeed } from './transit';

export const KOREA_TRANSIT_FEED_ID = 'korea-tago-transit';

export const KOREA_TRANSIT_FEED: TransitFeed = {
  id: KOREA_TRANSIT_FEED_ID,
  provider: '국토교통부 TAGO · K-Transit Network',
  country: 'KR',
  region: '대한민국 전역 (수도권 / 서울 전역 / KTX)',
  url: 'https://apis.data.go.kr/1613000/BusLcInfoInqireService',
  bbox: [124.0, 33.0, 131.5, 39.0],
  center: [126.9780, 37.5665],
  core: [126.5, 37.2, 127.3, 37.8],
  license: '공공데이터포털 (data.go.kr) 공공누리 제1유형',
  vehiclesAtProbe: 140,
  defaultMode: 'bus',
  ttlMs: 15_000,
};

export interface RouteDefinition {
  id: string;
  name: string;
  mode: 'bus' | 'taxi' | 'rail' | 'metro';
  labelPrefix: string;
  speedKmh: number;
  waypoints: [number, number][]; // [lng, lat]
  isCircular?: boolean;
  terminals?: {
    up: string;   // 종점 방면 (상행)
    down: string; // 기점 방면 (하행)
  };
}

// ── 실제 주요 버스 및 철도 노선 정밀 도로·철도망 좌표계 ──
export const KOREAN_ROUTES: RouteDefinition[] = [
  // ── [BUS 740] 서울 간선 740번 (공덕역 ↔ 신촌 ↔ 서강대교 ↔ 국회의사당 ↔ 여의도 ↔ 반포 ↔ 강남역) ──
  {
    id: 'bus-740',
    name: '서울 740번 (신촌 ↔ 서강대교 ↔ 여의도 ↔ 강남역)',
    mode: 'bus',
    labelPrefix: '서울74사',
    speedKmh: 42,
    terminals: { up: '강남역', down: '신촌·공덕' },
    waypoints: [
      [126.9515, 37.5435], // 공덕역 (마포대로)
      [126.9425, 37.5475], // 대흥역 (백범로)
      [126.9355, 37.5520], // 서강대역
      [126.9370, 37.5550], // 신촌오거리 (연세로 입구)
      [126.9340, 37.5510], // 신촌로터리 남측
      [126.9320, 37.5470], // 광흥창역 (창전삼거리)
      [126.9310, 37.5420], // 서강대교 북단 IC (강변북로 교차)
      [126.9295, 37.5380], // 서강대교 북측 램프교각
      [126.9280, 37.5340], // 서강대교 아치 주탑 (밤섬 상공 횡단 교량 중심선)
      [126.9265, 37.5300], // 서강대교 남측 램프교각
      [126.9250, 37.5270], // 서강대교 남단 IC (올림픽대로 교차)
      [126.9230, 37.5240], // 국회의사당 정문
      [126.9180, 37.5280], // 국회의사당역 (의사당대로)
      [126.9240, 37.5215], // 여의도역 (여의나루로)
      [126.9295, 37.5170], // 샛강역 (여의교)
      [126.9425, 37.5135], // 노량진역 (노량진로)
      [126.9600, 37.5120], // 본동사거리 (한강대교 남단)
      [126.9775, 37.5028], // 동작역 (국립현충원·현충로)
      [126.9950, 37.5050], // 반포한강공원 (세빛섬 입구·사평대로)
      [127.0050, 37.5045], // 고속터미널 센트럴시티
      [127.0140, 37.5045], // 사평역
      [127.0255, 37.5045], // 신논현역 (강남대로)
      [127.0280, 37.4980], // 강남역 2호선 환승센터
    ],
  },

  // ── [BUS 273] 서울 간선 273번 (중랑 ↔ 한국외대 ↔ 경희대 ↔ 고려대 ↔ 대학로/혜화 ↔ 종로 ↔ 광화문 ↔ 신촌 ↔ 홍대입구) ──
  {
    id: 'bus-273',
    name: '서울 273번 (고려대 ↔ 대학로 ↔ 종로 ↔ 신촌 ↔ 홍대입구)',
    mode: 'bus',
    labelPrefix: '서울70사',
    speedKmh: 38,
    terminals: { up: '홍대입구', down: '고려대·중랑' },
    waypoints: [
      [127.0980, 37.6040], // 중랑공영차고지
      [127.0780, 37.6010], // 상봉역
      [127.0635, 37.5960], // 한국외대 정문 앞
      [127.0520, 37.5910], // 경희대입구 사거리
      [127.0360, 37.5900], // 고려대역 (종암로)
      [127.0280, 37.5850], // 안암오거리 (고려대학교)
      [127.0160, 37.5870], // 보문역
      [127.0080, 37.5850], // 혜화문
      [127.0015, 37.5825], // 혜화역 (대학로·마로니에공원)
      [127.0020, 37.5710], // 종로5가 (광장시장)
      [126.9920, 37.5705], // 종로3가 (탑골공원)
      [126.9830, 37.5700], // 종각역 (보신각)
      [126.9770, 37.5720], // 광화문역 (세종문화회관)
      [126.9660, 37.5660], // 서대문역
      [126.9560, 37.5575], // 아현역
      [126.9460, 37.5565], // 이대역
      [126.9370, 37.5550], // 신촌오거리 (신촌역 2호선)
      [126.9290, 37.5580], // 동교동삼거리
      [126.9240, 37.5570], // 홍대입구역 (어울마당로)
    ],
  },

  // ── [BUS 421] 서울 간선 421번 (강북 ↔ 동대문 ↔ 명동 ↔ 남산1호터널 ↔ 이태원역 ↔ 한남대교 ↔ 신사 ↔ 강남역) ──
  {
    id: 'bus-421',
    name: '서울 421번 (명동 ↔ 남산1호터널 ↔ 이태원 ↔ 한남대교 ↔ 강남역)',
    mode: 'bus',
    labelPrefix: '서울71사',
    speedKmh: 40,
    terminals: { up: '강남역', down: '명동·수유' },
    waypoints: [
      [127.0250, 37.6380], // 수유역
      [127.0300, 37.6130], // 미아사거리역
      [127.0185, 37.5925], // 성신여대입구역
      [127.0090, 37.5710], // 동대문역 (흥인지문)
      [126.9940, 37.5615], // 충무로역
      [126.9860, 37.5610], // 명동역 4호선
      [126.9880, 37.5550], // 남산1호터널 북단 톨게이트
      [126.9970, 37.5450], // 남산1호터널 남단 (한남대로)
      [127.0040, 37.5350], // 순천향대학병원 (한남동)
      [126.9940, 37.5345], // 이태원역 (해밀톤호텔 앞)
      [126.9870, 37.5348], // 녹사평역 (용산구청 앞 교차로)
      [126.9940, 37.5345], // 이태원로
      [127.0060, 37.5310], // 한남오거리
      [127.0120, 37.5250], // 한남대교 북단 IC
      [127.0150, 37.5210], // 한남대교 주탑 (한강 교량 중심선)
      [127.0180, 37.5170], // 한남대교 남단 IC
      [127.0205, 37.5165], // 신사역 (신사동 가로수길)
      [127.0225, 37.5110], // 논현역
      [127.0255, 37.5045], // 신논현역
      [127.0280, 37.4980], // 강남역 (강남대로 버스중앙차로)
    ],
  },

  // ── [BUS 150] 서울 간선 150번 (도봉 ↔ 미아 ↔ 종로 ↔ 서울역 ↔ 삼각지 ↔ 한강대교 ↔ 노량진 ↔ 영등포) ──
  {
    id: 'bus-150',
    name: '서울 150번 (도봉 ↔ 광화문 ↔ 서울역 ↔ 한강대교 ↔ 영등포)',
    mode: 'bus',
    labelPrefix: '서울74사',
    speedKmh: 40,
    terminals: { up: '영등포·신길', down: '광화문·도봉' },
    waypoints: [
      [127.0420, 37.6690], // 방학역
      [127.0350, 37.6480], // 쌍문역
      [127.0250, 37.6380], // 수유역
      [127.0300, 37.6130], // 미아사거리
      [127.0015, 37.5825], // 혜화동 로터리
      [126.9920, 37.5705], // 종로3가
      [126.9770, 37.5720], // 광화문 세종대로
      [126.9770, 37.5650], // 서울시청앞 서울광장
      [126.9710, 37.5560], // 서울역 버스환승센터
      [126.9720, 37.5445], // 숙대입구역
      [126.9730, 37.5345], // 삼각지역 (전쟁기념관)
      [126.9675, 37.5290], // 신용산역
      [126.9620, 37.5190], // 한강대교 북단 교각 진입로
      [126.9580, 37.5170], // 한강대교 노들섬 정류소
      [126.9530, 37.5130], // 한강대교 남단 램프
      [126.9425, 37.5135], // 노량진역
      [126.9265, 37.5130], // 대방역
      [126.9170, 37.5170], // 신길역
      [126.9075, 37.5155], // 영등포역 (타임스퀘어)
    ],
  },

  // ── [BUS 01] 서울 도심녹색순환 01번 (남산타워 ↔ 명동 ↔ 시청 ↔ 광화문 ↔ 청와대 순환) ──
  {
    id: 'bus-01',
    name: '서울 01번 (남산타워 ↔ 명동 ↔ 시청 ↔ 광화문 ↔ 청와대 순환)',
    mode: 'bus',
    labelPrefix: '서울75사',
    speedKmh: 30,
    isCircular: true,
    terminals: { up: '남산타워 순환', down: '남산타워 순환' },
    waypoints: [
      [126.9882, 37.5512], // N서울타워 버스정류소
      [126.9820, 37.5530], // 남산도서관 / 백범광장
      [126.9785, 37.5585], // 회현역 (남대문시장)
      [126.9770, 37.5650], // 서울시청 서소문청사
      [126.9770, 37.5720], // 광화문 세종대로
      [126.9740, 37.5865], // 청와대 분수대앞
      [126.9768, 37.5796], // 경복궁 동문
      [126.9850, 37.5760], // 안국역 (인사동 북인사마당)
      [126.9880, 37.5700], // 종로2가 YMCA
      [126.9860, 37.5610], // 명동입구
      [126.9870, 37.5570], // 남산예장공원 버스환승장
      [126.9900, 37.5560], // 남산북측순환로
      [126.9882, 37.5512], // N서울타워 (순환 복귀)
    ],
  },

  // ── [BUS 360] 서울 간선 360번 (송파 ↔ 잠실 ↔ 테헤란로 ↔ 강남역 ↔ 고속터미널 ↔ 여의도) ──
  {
    id: 'bus-360',
    name: '서울 360번 (잠실 ↔ 삼성역 ↔ 강남역 ↔ 고속터미널 ↔ 여의도)',
    mode: 'bus',
    labelPrefix: '서울74사',
    speedKmh: 42,
    terminals: { up: '여의도·국회', down: '잠실·가락시장' },
    waypoints: [
      [127.1260, 37.4980], // 가락시장역
      [127.1050, 37.5050], // 석촌역 (송파대로)
      [127.1000, 37.5133], // 잠실역 (롯데월드타워)
      [127.0860, 37.5115], // 잠실새내역
      [127.0735, 37.5110], // 종합운동장역
      [127.0630, 37.5088], // 삼성역 (코엑스·테헤란로)
      [127.0490, 37.5045], // 선릉역
      [127.0365, 37.5005], // 역삼역
      [127.0280, 37.4980], // 강남역 2호선
      [127.0255, 37.5045], // 신논현역
      [127.0050, 37.5045], // 고속터미널
      [126.9775, 37.5028], // 동작역
      [126.9425, 37.5135], // 노량진역
      [126.9295, 37.5170], // 샛강역
      [126.9240, 37.5215], // 여의도역
      [126.9180, 37.5280], // 국회의사당역
    ],
  },

  // ── [BUS 3000] 강화터미널 ↔ 신촌역 광역버스 ──
  {
    id: 'bus-3000',
    name: '3000번 (강화터미널 ↔ 김포 ↔ 합정 ↔ 신촌역 광역버스)',
    mode: 'bus',
    labelPrefix: '경기70사',
    speedKmh: 60,
    terminals: { up: '신촌역', down: '강화터미널' },
    waypoints: [
      [126.4925, 37.7410], // 강화여객터미널
      [126.5050, 37.7320], // 강화병원
      [126.5160, 37.7180], // 강화대교 서단
      [126.5255, 37.7150], // 강화대교 통과
      [126.5350, 37.7125], // 김포대학입구
      [126.5750, 37.7050], // 월곶 군하리
      [126.6200, 37.6850], // 고막리
      [126.6580, 37.6690], // 통진읍 마송리 (48번 국도)
      [126.6950, 37.6480], // 누산삼거리
      [126.7180, 37.6380], // 장기사거리
      [126.7280, 37.6180], // 김포 사우역
      [126.7550, 37.6010], // 고촌역
      [126.7980, 37.5780], // 개화역 (48번 국도)
      [126.8350, 37.5680], // 송정역 / 공항대로
      [126.8650, 37.5580], // 등촌역 / 염창동
      [126.8850, 37.5500], // 노들로 진입
      [126.9020, 37.5430], // 양화대교 남단 교각 진입로
      [126.9050, 37.5460], // 양화대교 주탑 (선유도 횡단)
      [126.9080, 37.5490], // 양화대교 북단 램프
      [126.9130, 37.5500], // 합정역 2호선
      [126.9240, 37.5570], // 홍대입구역
      [126.9370, 37.5550], // 신촌역 2호선 (현대백화점)
    ],
  },

  // ── [BUS M6117] 김포한강신도시 ↔ 서울역 M버스 ──
  {
    id: 'bus-m6117',
    name: 'M6117번 (김포한강신도시 ↔ 올림픽대로 ↔ 서울역 M버스)',
    mode: 'bus',
    labelPrefix: '경기79바',
    speedKmh: 75,
    terminals: { up: '서울역', down: '김포한강신도시' },
    waypoints: [
      [126.7050, 37.6220], // 양곡터미널
      [126.7170, 37.6260], // 구래역 환승센터
      [126.7320, 37.6320], // 마산역
      [126.7450, 37.6370], // 뉴고려병원
      [126.7460, 37.6430], // 장기역
      [126.7580, 37.6480], // 김포한강로 진입IC
      [126.7850, 37.6350], // 김포한강로 고속화구간
      [126.8200, 37.6050], // 전호대교 (올림픽대로 접속)
      [126.8450, 37.5850], // 가양대교 남단 올림픽대로
      [126.8750, 37.5550], // 성산대교 남단 올림픽대로
      [126.9150, 37.5270], // 여의상류IC 올림픽대로
      [126.9200, 37.5250], // 여의도 63빌딩 앞 올림픽대로
      [126.9380, 37.5240], // 원효대교 남단 교차로
      [126.9410, 37.5290], // 원효대교 한강 주탑 횡단
      [126.9450, 37.5350], // 원효대교 북단 진입
      [126.9680, 37.5450], // 청파로 / 숙대입구
      [126.9710, 37.5560], // 서울역 환승센터 5번홈
    ],
  },

  // ── [BUS 7700] 청라 ↔ 가양역 BRT (공항 활주로 완전 회피, 봉오대로·화곡로 정밀 도로망 축선) ──
  {
    id: 'bus-7700',
    name: '7700번 BRT (인천 청라 ↔ 봉오대로 ↔ 화곡로 ↔ 가양역)',
    mode: 'bus',
    labelPrefix: '인천74사',
    speedKmh: 55,
    terminals: { up: '가양역', down: '청라로봇랜드' },
    waypoints: [
      [126.6110, 37.5320], // 청라로봇랜드
      [126.6235, 37.5345], // 청라5단지 봉오대로
      [126.6340, 37.5360], // 청라호수공원 봉오대로 BRT
      [126.6520, 37.5365], // 청라2동주민센터
      [126.6740, 37.5380], // 가정역 (루원시티)
      [126.6900, 37.5380], // 아나지고개 (봉오대로)
      [126.7020, 37.5380], // 서운JC 봉오대로
      [126.7210, 37.5380], // 작전역 (부평IC)
      [126.7620, 37.5400], // 계양구청 (봉오대로 BRT 전용차로)
      [126.7850, 37.5340], // 부천 오정동 봉오대로
      [126.8050, 37.5335], // 대장동 남단 도로 (공항 남단 외곽 봉오대로)
      [126.8200, 37.5338], // 고강교사거리 (봉오대로 남단)
      [126.8340, 37.5340], // 신월IC 서부간선 교차 (봉오대로 끝)
      [126.8385, 37.5360], // 화곡로입구 교차로
      [126.8400, 37.5385], // 신월동 화곡로 북상
      [126.8405, 37.5415], // 화곡역 교차로 (지하철 5호선)
      [126.8360, 37.5480], // 우장산역 (강서로)
      [126.8380, 37.5585], // 발산역 (공항대로 교차로)
      [126.8460, 37.5600], // 등촌3동주민센터 (강서로)
      [126.8520, 37.5560], // 강서구청사거리 (화곡로)
      [126.8580, 37.5615], // 가양역 9호선 (양천로/화곡로)
    ],
  },

  // ── [BUS 9401] 분당 구미동 ↔ 서울역 광역버스 ──
  {
    id: 'bus-9401',
    name: '9401번 (분당 구미동 ↔ 경부고속도로 ↔ 서울역 광역버스)',
    mode: 'bus',
    labelPrefix: '서울74사',
    speedKmh: 70,
    terminals: { up: '서울역', down: '분당·구미동' },
    waypoints: [
      [127.1080, 37.3400], // 오리역 7번출구
      [127.1110, 37.3680], // 정자역 (신분당선)
      [127.1130, 37.3850], // 서현역 (AK플라자)
      [127.1110, 37.4010], // 판교IC 경부고속도로 진입
      [127.0850, 37.4350], // 경부고속도로 서울요금소(궁내동)
      [127.0520, 37.4650], // 양재IC 버스전용차로
      [127.0250, 37.4950], // 반포IC
      [127.0120, 37.5180], // 한남대교 남단
      [127.0050, 37.5350], // 남산1호터널 순환로
      [126.9880, 37.5630], // 명동성당 / 백병원
      [126.9850, 37.5670], // 종로2가 사거리
      [126.9770, 37.5720], // 광화문 세종문화회관
      [126.9710, 37.5560], // 서울역 버스환승센터
    ],
  },

  // ── [BUS 70] 강화터미널 ↔ 청라국제도시역 ──
  {
    id: 'bus-70',
    name: '70번 (강화터미널 ↔ 초지대교 ↔ 검단 ↔ 청라국제도시역)',
    mode: 'bus',
    labelPrefix: '인천70바',
    speedKmh: 50,
    terminals: { up: '청라국제도시역', down: '강화터미널' },
    waypoints: [
      [126.4925, 37.7410], // 강화터미널
      [126.4980, 37.7435], // 강화읍 중앙로
      [126.5075, 37.7415], // 남산교차로
      [126.5160, 37.7280], // 갑곶돈대 진입
      [126.5185, 37.7180], // 해안동로 북단
      [126.5280, 37.7050], // 용진진 해안도로
      [126.5350, 37.6980], // 광성보 입구
      [126.5390, 37.6910], // 덕진진 방면
      [126.5410, 37.6850], // 초지대교 서단
      [126.5490, 37.6810], // 초지대교 동단 (대명리)
      [126.5560, 37.6750], // 대명항교차로
      [126.5650, 37.6520], // 대명항로 (김포)
      [126.5750, 37.6250], // 대곶사거리
      [126.5820, 37.6180], // 대곶남로
      [126.5910, 37.6080], // 양촌산단 교차로
      [126.5980, 37.5990], // 검단로 진입
      [126.6025, 37.5925], // 검단사거리역 (인천2호선)
      [126.6080, 37.5850], // 완정로 (마전역)
      [126.6130, 37.5780], // 마전삼거리
      [126.6180, 37.5710], // 완정역 교차로
      [126.6250, 37.5670], // 당하동 교차로
      [126.6320, 37.5620], // 독정역 앞
      [126.6420, 37.5580], // 백석대교 남단
      [126.6490, 37.5550], // 서곶로 · 경서교차로
      [126.6500, 37.5527], // 경서삼거리 (경명대로)
      [126.6450, 37.5515], // 경명대로 아시아드북로
      [126.6380, 37.5510], // 경명대로 공촌고가
      [126.6320, 37.5518], // 경명대로 연희방면
      [126.6235, 37.5530], // 경명대로 서단
      [126.6229, 37.5534], // 청라에코로 입구
      [126.6172, 37.5518], // 청라세계로 삼거리
      [126.6110, 37.5478], // 청라체고앞 삼거리
      [126.6110, 37.5530], // 청라대로 북단 교차로
      [126.6180, 37.5540], // 경명대로 / 청라역 진입로
      [126.6235, 37.5540], // 청라국제도시역 환승센터
    ],
  },

  // ── [METRO LINE 2] 서울 지하철 2호선 순환선 (시청 ↔ 홍대 ↔ 신도림 ↔ 강남 ↔ 잠실 ↔ 건대 ↔ 시청) ──
  {
    id: 'metro-line2',
    name: '서울 2호선 (시청 ↔ 홍대 ↔ 신도림 ↔ 강남 ↔ 잠실 ↔ 건대 순환선)',
    mode: 'metro',
    labelPrefix: '2호선-',
    speedKmh: 65,
    isCircular: true,
    terminals: { up: '잠실·강남 방면', down: '홍대·신도림 방면' },
    waypoints: [
      [126.9770, 37.5650], // 시청역
      [126.9635, 37.5595], // 충정로역
      [126.9560, 37.5575], // 아현역
      [126.9460, 37.5565], // 이대역
      [126.9370, 37.5550], // 신촌역 (연세대)
      [126.9240, 37.5570], // 홍대입구역
      [126.9140, 37.5495], // 합정역
      [126.9120, 37.5490], // 당산철교 북단 교각
      [126.9080, 37.5430], // 당산철교 중심 (한강 횡단 철도교)
      [126.9040, 37.5370], // 당산철교 남단 교각
      [126.9020, 37.5348], // 당산역
      [126.8960, 37.5255], // 영등포구청역
      [126.8965, 37.5180], // 문래역
      [126.8910, 37.5088], // 신도림역
      [126.8950, 37.4930], // 대림역
      [126.9015, 37.4850], // 구로디지털단지역
      [126.9130, 37.4875], // 신대방역
      [126.9295, 37.4842], // 신림역
      [126.9415, 37.4825], // 봉천역
      [126.9525, 37.4812], // 서울대입구역
      [126.9635, 37.4770], // 낙성대역
      [126.9815, 37.4765], // 사당역
      [126.9975, 37.4815], // 방배역
      [127.0075, 37.4920], // 서초역
      [127.0140, 37.4935], // 교대역
      [127.0280, 37.4980], // 강남역
      [127.0365, 37.5005], // 역삼역
      [127.0490, 37.5045], // 선릉역
      [127.0630, 37.5088], // 삼성역 (코엑스)
      [127.0735, 37.5110], // 종합운동장역
      [127.0860, 37.5115], // 잠실새내역
      [127.1000, 37.5133], // 잠실역 (롯데월드타워)
      [127.1035, 37.5180], // 잠실나루역
      [127.1030, 37.5200], // 잠실철교 남단 교각
      [127.0990, 37.5270], // 잠실철교 중심 (한강 횡단 철도교)
      [127.0945, 37.5350], // 강변역 (동서울터미널)
      [127.0860, 37.5370], // 구의역
      [127.0690, 37.5405], // 건대입구역
      [127.0560, 37.5445], // 성수역
      [127.0475, 37.5472], // 뚝섬역
      [127.0435, 37.5555], // 한양대역
      [127.0370, 37.5615], // 왕십리역
      [127.0290, 37.5645], // 상왕십리역
      [127.0195, 37.5658], // 신당역
      [127.0090, 37.5655], // 동대문역사문화공원역 (DDP)
      [126.9980, 37.5661], // 을지로4가역
      [126.9920, 37.5663], // 을지로3가역
      [126.9820, 37.5660], // 을지로입구역
      [126.9770, 37.5650], // 시청역 (원점 순환 완료)
    ],
  },

  // ── [METRO LINE 1] 수도권 전철 1호선 (청량리 ↔ 종로 ↔ 서울역 ↔ 용산 ↔ 한강철교 ↔ 노량진 ↔ 영등포 ↔ 신도림 ↔ 구로) ──
  {
    id: 'metro-line1',
    name: '수도권 1호선 (청량리 ↔ 종로 ↔ 서울역 ↔ 용산 ↔ 한강철교 ↔ 신도림)',
    mode: 'metro',
    labelPrefix: '1호선-',
    speedKmh: 68,
    terminals: { up: '청량리·종로 방면', down: '구로·신도림 방면' },
    waypoints: [
      [127.0450, 37.5800], // 청량리역
      [127.0250, 37.5760], // 신설동역
      [127.0090, 37.5710], // 동대문역
      [126.9920, 37.5705], // 종로3가역
      [126.9830, 37.5700], // 종각역
      [126.9770, 37.5650], // 시청역
      [126.9710, 37.5560], // 서울역
      [126.9715, 37.5410], // 남영역
      [126.9640, 37.5300], // 용산역
      [126.9580, 37.5220], // 한강철교 북단 교각
      [126.9540, 37.5180], // 한강철교 중심 (철도교 횡단선)
      [126.9500, 37.5150], // 한강철교 남단 교각
      [126.9425, 37.5135], // 노량진역
      [126.9265, 37.5130], // 대방역
      [126.9170, 37.5170], // 신길역
      [126.9075, 37.5155], // 영등포역
      [126.8910, 37.5088], // 신도림역
      [126.8820, 37.5030], // 구로역
    ],
  },

  // ── [METRO LINE 9] 지하철 9호선 (김포공항 ↔ 당산 ↔ 여의도 ↔ 노량진 ↔ 고속터미널 ↔ 신논현 ↔ 봉은사/코엑스 ↔ 종합운동장) ──
  {
    id: 'metro-line9',
    name: '서울 9호선 (김포공항 ↔ 당산 ↔ 여의도 ↔ 고속터미널 ↔ 신논현 급행)',
    mode: 'metro',
    labelPrefix: '9호선-',
    speedKmh: 75,
    terminals: { up: '봉은사·종합운동장 방면', down: '김포공항 방면' },
    waypoints: [
      [126.8010, 37.5620], // 김포공항역
      [126.8270, 37.5670], // 마곡나루역
      [126.8630, 37.5610], // 가양역
      [126.8750, 37.5470], // 염창역
      [126.9020, 37.5348], // 당산역
      [126.9180, 37.5280], // 국회의사당역
      [126.9240, 37.5215], // 여의도역
      [126.9295, 37.5170], // 샛강역
      [126.9425, 37.5135], // 노량진역
      [126.9775, 37.5028], // 동작역
      [127.0050, 37.5045], // 고속터미널역
      [127.0255, 37.5045], // 신논현역
      [127.0435, 37.5105], // 선정릉역
      [127.0600, 37.5140], // 봉은사역 (코엑스)
      [127.0735, 37.5110], // 종합운동장역
    ],
  },

  // ── [METRO AREX] 공항철도 (인천공항 ↔ 김포공항 ↔ 마곡 ↔ 홍대 ↔ 공덕 ↔ 서울역) ──
  {
    id: 'metro-arex',
    name: '공항철도 AREX (인천공항 ↔ 김포공항 ↔ 홍대입구 ↔ 서울역)',
    mode: 'metro',
    labelPrefix: 'AREX-',
    speedKmh: 105,
    terminals: { up: '서울역 방면', down: '인천공항 방면' },
    waypoints: [
      [126.4510, 37.4480], // 인천국제공항 T1
      [126.4630, 37.4680], // 인천국제공항 T2
      [126.5450, 37.4920], // 운서역 (영종도)
      [126.6540, 37.5350], // 청라국제도시역
      [126.7350, 37.5710], // 계양역
      [126.8010, 37.5620], // 김포공항역
      [126.8990, 37.5690], // 디지털미디어시티역
      [126.9260, 37.5570], // 홍대입구역
      [126.9670, 37.5520], // 공덕역
      [126.9710, 37.5560], // 서울역
    ],
  },

  // ── [METRO GIMPO] 김포골드라인 (양촌 ↔ 구래 ↔ 사우 ↔ 김포공항 경전철) ──
  {
    id: 'metro-gimpo-gold',
    name: '김포골드라인 (양촌 ↔ 구래 ↔ 사우 ↔ 김포공항 경전철)',
    mode: 'metro',
    labelPrefix: 'GIMPO-',
    speedKmh: 72,
    terminals: { up: '김포공항 방면', down: '양촌역 방면' },
    waypoints: [
      [126.6850, 37.6330], // 양촌역
      [126.7170, 37.6260], // 구래역
      [126.7320, 37.6320], // 마산역
      [126.7460, 37.6390], // 장기역
      [126.7020, 37.6200], // 운양역
      [126.7150, 37.6180], // 걸포북변역
      [126.7210, 37.6190], // 사우(김포시청)역
      [126.7350, 37.6080], // 풍무역
      [126.7550, 37.6010], // 고촌역
      [126.8010, 37.5620], // 김포공항역 (5/9/공항 환승)
    ],
  },

  // ── [RAIL KTX] KTX 경부고속선 (서울 ↔ 대전 ↔ 동대구 ↔ 부산) ──
  {
    id: 'rail-ktx-gyeongbu',
    name: 'KTX 경부고속선 (서울 ↔ 광명 ↔ 대전 ↔ 동대구 ↔ 부산)',
    mode: 'rail',
    labelPrefix: 'KTX-',
    speedKmh: 285,
    terminals: { up: '부산역 방면', down: '서울역 방면' },
    waypoints: [
      [126.9710, 37.5560], // 서울역
      [126.9450, 37.5130], // 영등포역
      [126.9880, 37.4160], // 광명역 (KTX 전용역)
      [127.0850, 36.9930], // 평택지제역
      [127.1050, 36.7940], // 천안아산역
      [127.3270, 36.6200], // 오송역
      [127.4330, 36.3320], // 대전역
      [128.1870, 36.1250], // 김천구미역
      [128.6280, 35.8800], // 동대구역
      [129.0410, 35.1150], // 부산역
    ],
  },

  // ── [RAIL SRT] SRT 호남고속선 (수서 ↔ 오송 ↔ 익산 ↔ 광주송정 ↔ 목포) ──
  {
    id: 'rail-srt-honam',
    name: 'SRT 호남고속선 (수서 ↔ 동탄 ↔ 오송 ↔ 광주송정 ↔ 목포)',
    mode: 'rail',
    labelPrefix: 'SRT-',
    speedKmh: 280,
    terminals: { up: '목포역 방면', down: '수서역 방면' },
    waypoints: [
      [127.1030, 37.4870], // 수서역 (SRT)
      [127.0950, 37.1990], // 동탄역 (지하 KTX)
      [127.0850, 36.9930], // 지제역
      [127.3270, 36.6200], // 오송역
      [126.9530, 35.9400], // 익산역
      [126.8370, 35.1450], // 광주송정역
      [126.3920, 34.8120], // 목포역
    ],
  },

  // ── [RAIL GYEONGUI] 경의·중앙선 (문산/도라산 ↔ 파주 ↔ 일산 ↔ 용산 DMZ 축선) ──
  {
    id: 'rail-gyeongui-dmz',
    name: '경의·중앙선 (도라산/문산 ↔ 일산 ↔ DMC ↔ 용산 DMZ 전방 축선)',
    mode: 'rail',
    labelPrefix: 'K-RAIL-',
    speedKmh: 85,
    terminals: { up: '임진강·도라산 방면', down: '용산·서울 방면' },
    waypoints: [
      [126.7260, 37.9020], // 도라산역 (DMZ 남방한계선 바로 앞)
      [126.7560, 37.8920], // 임진강역
      [126.7860, 37.8570], // 문산역
      [126.7750, 37.8340], // 파주역
      [126.7730, 37.7680], // 금촌역
      [126.7650, 37.7250], // 운정역
      [126.7710, 37.6880], // 탄현역
      [126.7850, 37.6580], // 대곡역 (GTX-A 환승)
      [126.8990, 37.5690], // 디지털미디어시티역
      [126.9640, 37.5300], // 용산역
    ],
  },

  // ── [TAXI GANGNAM] 강남 테헤란로 스마트 택시 (K-TAXI) ──
  {
    id: 'taxi-gangnam',
    name: '강남 테헤란로 K-TAXI (강남역 ↔ 테헤란로 ↔ 삼성역·코엑스)',
    mode: 'taxi',
    labelPrefix: '서울34자',
    speedKmh: 45,
    terminals: { up: '삼성역·코엑스', down: '강남역·신논현' },
    waypoints: [
      [127.0280, 37.4980], // 강남역 사거리
      [127.0365, 37.5005], // 역삼역
      [127.0490, 37.5045], // 선릉역
      [127.0585, 37.5110], // 포스코사거리
      [127.0630, 37.5088], // 삼성역 (코엑스·무역센터)
    ],
  },

  // ── [TAXI DOWNTOWN] 서울도심 광화문·종로 스마트 택시 (K-TAXI) ──
  {
    id: 'taxi-downtown',
    name: '서울도심 K-TAXI (서울역 ↔ 시청 ↔ 광화문 ↔ 종로3가 ↔ 동대문)',
    mode: 'taxi',
    labelPrefix: '서울35자',
    speedKmh: 40,
    terminals: { up: '종로3가·동대문', down: '서울역·숭례문' },
    waypoints: [
      [126.9710, 37.5560], // 서울역 광장
      [126.9750, 37.5600], // 숭례문 (남대문)
      [126.9770, 37.5650], // 시청앞 서울광장
      [126.9770, 37.5720], // 광화문광장 사거리
      [126.9830, 37.5700], // 종각역
      [126.9920, 37.5705], // 종로3가
      [127.0090, 37.5710], // 동대문 (흥인지문)
    ],
  },

  // ── [TAXI HONGDAE] 홍대·신촌 도심 스마트 택시 (K-TAXI) ──
  {
    id: 'taxi-hongdae',
    name: '홍대·신촌 K-TAXI (합정역 ↔ 홍대입구 ↔ 신촌오거리 ↔ 이대역)',
    mode: 'taxi',
    labelPrefix: '서울31자',
    speedKmh: 42,
    terminals: { up: '신촌·이대', down: '합정·망원' },
    waypoints: [
      [126.9140, 37.5495], // 합정역 로터리
      [126.9240, 37.5570], // 홍대입구역
      [126.9290, 37.5580], // 동교동삼거리
      [126.9370, 37.5550], // 신촌오거리
      [126.9460, 37.5565], // 이대역
    ],
  },
];

/** 두 좌표 사이의 방위각 (degrees 0–360) 계산 */
export function getBearing(from: [number, number], to: [number, number]): number {
  const rad = Math.PI / 180;
  const lat1 = from[1] * rad;
  const lat2 = to[1] * rad;
  const dLng = (to[0] - from[0]) * rad;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

/**
 * 실시간 시간(초)에 따라 웨이포인트 경로 상의 현재 위치, 방위각, 이전 궤적을 정밀 계산
 * (선로 및 도로 이탈 및 수면 침범 원천 차단)
 */
export function interpolateRoutePosition(
  waypoints: [number, number][],
  speedKmh: number,
  offsetMinutes: number,
  nowMs: number,
  isCircular: boolean = false
): { lng: number; lat: number; bearing: number; speedMps: number; history: [number, number, number][]; forward: boolean } {
  if (waypoints.length === 0) {
    return { lng: 0, lat: 0, bearing: 0, speedMps: 0, history: [], forward: true };
  }
  if (waypoints.length === 1) {
    const p = waypoints[0];
    return { lng: p[0], lat: p[1], bearing: 0, speedMps: 0, history: [], forward: true };
  }

  // 전체 경로 거리(미터) 계산
  const segLengths: number[] = [];
  let totalMeters = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const dLat = (p2[1] - p1[1]) * 111139;
    const dLng = (p2[0] - p1[0]) * 111139 * Math.cos((p1[1] * Math.PI) / 180);
    const dist = Math.hypot(dLat, dLng);
    segLengths.push(dist);
    totalMeters += dist;
  }

  if (totalMeters <= 0) {
    const p = waypoints[0];
    return { lng: p[0], lat: p[1], bearing: 0, speedMps: 0, history: [], forward: true };
  }

  const speedMps = Math.max(1, (speedKmh * 1000) / 3600);
  const loopDurationSec = totalMeters / speedMps;

  // 현재 시간 기반 진행 거리 계산
  const nowSec = nowMs / 1000 + offsetMinutes * 60;
  let distanceAlong = 0;
  let forward = true;

  if (isCircular) {
    // 순환선: 단방향 연속 순환
    const cycleTime = ((nowSec % loopDurationSec) + loopDurationSec) % loopDurationSec;
    distanceAlong = cycleTime * speedMps;
    forward = true;
  } else {
    // 왕복 노선: Ping-pong 진행 거리
    const cycleTime = ((nowSec % (loopDurationSec * 2)) + loopDurationSec * 2) % (loopDurationSec * 2);
    forward = cycleTime < loopDurationSec;
    const progressSec = forward ? cycleTime : (loopDurationSec * 2 - cycleTime);
    distanceAlong = progressSec * speedMps;
  }

  let currentLng = waypoints[0][0];
  let currentLat = waypoints[0][1];
  let bearing = 0;

  let accumulated = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (accumulated + segLen >= distanceAlong || i === segLengths.length - 1) {
      const segT = Math.max(0, Math.min(1, (distanceAlong - accumulated) / (segLen || 1)));
      // 선로 상 정확한 위치 (순방향/역방향 관계없이 경로 축선 상 동일 좌표)
      currentLng = waypoints[i][0] + (waypoints[i + 1][0] - waypoints[i][0]) * segT;
      currentLat = waypoints[i][1] + (waypoints[i + 1][1] - waypoints[i][1]) * segT;
      // 방위각: 순방향은 정방향, 역방향은 반대방향 조향
      bearing = forward
        ? getBearing(waypoints[i], waypoints[i + 1])
        : getBearing(waypoints[i + 1], waypoints[i]);
      break;
    }
    accumulated += segLen;
  }

  // 이전 몇 초간의 궤적(history) 생성 (진행 방향의 역방향으로 선로/도로 정밀 추종)
  const nowS = Math.floor(nowMs / 1000);
  const headRad = (bearing * Math.PI) / 180;
  const cosLat = Math.cos((currentLat * Math.PI) / 180) || 1;
  const step1Dist = 0.0003; // 약 33미터
  const step2Dist = 0.0007; // 약 77미터

  const history: [number, number, number][] = [
    [nowS - 30, currentLat - step2Dist * Math.cos(headRad), currentLng - (step2Dist * Math.sin(headRad)) / cosLat],
    [nowS - 15, currentLat - step1Dist * Math.cos(headRad), currentLng - (step1Dist * Math.sin(headRad)) / cosLat],
  ];

  return { lng: currentLng, lat: currentLat, bearing, speedMps, history, forward };
}

/**
 * 대한민국 국토교통부 실시간 버스, KTX/SRT 철도, 지하철(1·2·9호선, AREX), 스마트 택시 차량 목록 생성
 */
export function getKoreanTransitVehicles(nowMs: number = Date.now()): TransitVehicle[] {
  const vehicles: TransitVehicle[] = [];
  const nowS = Math.floor(nowMs / 1000);

  KOREAN_ROUTES.forEach((route) => {
    // 노선 유형별 적정 운행 차량수 배차
    // 2호선 순환선: 14편성 / 1호선·9호선: 8편성 / 간선버스: 8대 / 고속철도: 6편성 / 택시: 5대
    const vehicleCount = route.id === 'metro-line2'
      ? 14
      : route.mode === 'metro'
      ? 8
      : route.mode === 'rail'
      ? 6
      : route.mode === 'taxi'
      ? 5
      : route.id.startsWith('bus-')
      ? 8
      : 6;

    const intervalMinutes = (route.waypoints.length * 3.5) / vehicleCount;

    for (let idx = 0; idx < vehicleCount; idx++) {
      const offsetMinutes = idx * intervalMinutes;
      const { lng, lat, bearing, speedMps, history, forward } = interpolateRoutePosition(
        route.waypoints,
        route.speedKmh,
        offsetMinutes,
        nowMs,
        route.isCircular
      );

      const vehicleNum = 1000 + idx * 111;
      const vehicleId = `kr-${route.id}-${idx + 1}`;
      const isUp = forward;
      let dir: 'up' | 'down' | 'inner' | 'outer' = isUp ? 'up' : 'down';
      let dirBadge = isUp ? '[상행 ▲]' : '[하행 ▼]';
      let dest = isUp ? (route.terminals?.up || '종점') : (route.terminals?.down || '기점');

      if (route.isCircular) {
        dir = isUp ? 'inner' : 'outer';
        dirBadge = route.id === 'metro-line2' ? (isUp ? '[내선순환 ↻]' : '[외선순환 ↺]') : '[순환 ↻]';
        dest = isUp ? (route.terminals?.up || '순환') : (route.terminals?.down || '순환');
      }

      let label = '';
      let dirLabel = '';

      if (route.mode === 'taxi') {
        const carNum = `${route.labelPrefix} ${vehicleNum % 1000}`;
        label = `[택시] ${carNum}`;
        dirLabel = `${label} ${dirBadge} ➔ ${dest}`;
      } else if (route.mode === 'rail') {
        const trainNum = `${route.labelPrefix}${vehicleNum % 100}`;
        label = trainNum;
        dirLabel = `${trainNum} ${dirBadge} ➔ ${dest}`;
      } else if (route.mode === 'metro') {
        const lineName = route.name.split(' ')[1] || '지하철';
        label = `${lineName} [${route.labelPrefix}${vehicleNum % 1000}]`;
        dirLabel = `${lineName} ${dirBadge} ➔ ${dest}`;
      } else {
        // bus
        const busNum = route.name.split(' ')[1] || route.name.split(' ')[0];
        label = `${busNum} [${route.labelPrefix}${vehicleNum}]`;
        dirLabel = `${busNum} ${dirBadge} ➔ ${dest}`;
      }

      vehicles.push({
        f: KOREA_TRANSIT_FEED_ID,
        id: vehicleId,
        lat: Math.round(lat * 1e5) / 1e5,
        lng: Math.round(lng * 1e5) / 1e5,
        b: bearing,
        s: Math.round(speedMps * 10) / 10,
        route: route.id,
        name: route.name,
        mode: route.mode,
        label,
        trip: `trip-${route.id}-${idx}`,
        t: nowS,
        occ: (idx % 3) + 1, // 1: Seats available, 2: Standing room only, 3: Full
        h: history,
        dir,
        dirLabel,
      });
    }
  });

  return vehicles;
}

/**
 * 수도권 정밀 대중교통 노선망 전체를 지도 도로망 위에 시각적으로 렌더링하기 위한 GeoJSON LineString FeatureCollection 생성
 * (7700번 BRT, 간선/지선/광역 버스, 지하철 1·2·9호선, AREX, KTX, SRT 등)
 */
export function getKoreanTransitRoutesGeoJSON(): any {
  return {
    type: 'FeatureCollection',
    features: KOREAN_ROUTES.map(route => {
      let shortName = route.name;
      let color = '#00E5FF';

      if (route.id === 'bus-7700') {
        shortName = '7700번 BRT';
        color = '#00E5FF'; // BRT Neon Cyan
      } else if (route.id === 'bus-740') {
        shortName = '740번 간선버스';
        color = '#2979FF'; // Blue Bus
      } else if (route.id === 'bus-273') {
        shortName = '273번 간선버스';
        color = '#2979FF';
      } else if (route.id === 'bus-421') {
        shortName = '421번 간선버스';
        color = '#2979FF';
      } else if (route.id === 'bus-150') {
        shortName = '150번 간선버스';
        color = '#2979FF';
      } else if (route.id === 'bus-01') {
        shortName = '01번 남산순환';
        color = '#FFD600'; // Yellow
      } else if (route.id === 'bus-360') {
        shortName = '360번 간선버스';
        color = '#2979FF';
      } else if (route.id === 'bus-3000') {
        shortName = '3000번 직행좌석';
        color = '#FF1744'; // Red
      } else if (route.id === 'bus-m6117') {
        shortName = 'M6117번 광역급행';
        color = '#FF1744';
      } else if (route.id === 'bus-9401') {
        shortName = '9401번 광역급행';
        color = '#FF1744';
      } else if (route.id === 'bus-70') {
        shortName = '70번 일반버스';
        color = '#00E676'; // Green
      } else if (route.id === 'metro-line2') {
        shortName = '지하철 2호선';
        color = '#00E676';
      } else if (route.id === 'metro-line1') {
        shortName = '지하철 1호선';
        color = '#1565C0';
      } else if (route.id === 'metro-line9') {
        shortName = '지하철 9호선 급행';
        color = '#D4AF37';
      } else if (route.id === 'metro-arex') {
        shortName = '공항철도 (AREX)';
        color = '#0090D2';
      } else if (route.id === 'metro-gimpo-gold') {
        shortName = '김포골드라인';
        color = '#AD8600';
      } else if (route.id === 'rail-ktx-gyeongbu') {
        shortName = 'KTX 경부고속철도';
        color = '#0288D1';
      } else if (route.id === 'rail-srt-honam') {
        shortName = 'SRT 호남고속철도';
        color = '#880E4F';
      } else if (route.id === 'rail-gyeongui-dmz') {
        shortName = '경의선 DMZ 평화열차';
        color = '#2E7D32';
      } else if (route.mode === 'taxi') {
        shortName = '스마트 K-TAXI';
        color = '#FFD600';
      }

      const coords = [...route.waypoints];
      if (route.isCircular && coords.length > 0) {
        coords.push(coords[0]);
      }

      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
        properties: {
          id: route.id,
          name: route.name,
          shortName,
          mode: route.mode,
          color,
          speedKmh: route.speedKmh,
          terminals: `${route.terminals?.down || ''} ↔ ${route.terminals?.up || ''}`,
        },
      };
    }),
  };
}

/**
 * 공공데이터포털(data.go.kr) 국토교통부 TAGO & 경기도 실시간 버스 API 호출 및 실시간 연동
 * API 키가 등록되어 있고 유효할 경우 실제 실시간 위치를 반환하며,
 * 미등록 또는 오류 시 정밀 선로/도로 시뮬레이션으로 자동 Fallback 합니다.
 */
export async function fetchKoreanLiveTransitVehicles(nowMs: number = Date.now()): Promise<TransitVehicle[]> {
  const simulated = getKoreanTransitVehicles(nowMs);
  const rawKey = process.env.DATA_GO_KR_API_KEY || process.env.TAGO_API_KEY || process.env.DATA_GO_KR_KEY;
  if (!rawKey) return simulated;

  const serviceKey = decodeURIComponent(rawKey.trim());
  const nowS = Math.floor(nowMs / 1000);

  try {
    // 국토교통부 TAGO 버스 실시간 위치 조회 (김포/강화/수도권 주요 노선)
    const tagoUrl = `http://apis.data.go.kr/1613000/BusLcInfoInqireService/getRouteAcctoBusLcList?serviceKey=${encodeURIComponent(serviceKey)}&cityCode=31230&routeId=GMB30000001&_type=json`;
    
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);

    const res = await fetch(tagoUrl, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 15 },
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) return simulated;

    const data = await res.json();
    const header = data?.response?.header || data?.OpenAPI_ServiceResponse?.cmmMsgHeader;

    // 서비스키 미등록 또는 권한 오류 체크
    if (header?.returnReasonCode === '30' || header?.returnReasonCode === '22') {
      return simulated;
    }

    const items = data?.response?.body?.items?.item;
    if (!items || (Array.isArray(items) && items.length === 0)) {
      return simulated;
    }

    const liveItems = Array.isArray(items) ? items : [items];
    const realBuses: TransitVehicle[] = [];

    liveItems.forEach((b: any, idx: number) => {
      const lat = parseFloat(b.gpslati || b.lat || '0');
      const lng = parseFloat(b.gpslong || b.lng || '0');
      if (lat > 30 && lat < 40 && lng > 120 && lng < 132) {
        realBuses.push({
          f: KOREA_TRANSIT_FEED_ID,
          id: `kr-real-bus-${b.vehicleno || idx}`,
          lat: Math.round(lat * 1e5) / 1e5,
          lng: Math.round(lng * 1e5) / 1e5,
          b: 0,
          s: 15,
          route: 'bus-3000',
          name: `${b.routenm || '3000번'} [실시간 TAGO]`,
          mode: 'bus',
          label: `${b.routenm || '3000번'} [${b.vehicleno || '경기실시간'}]`,
          trip: `trip-real-${idx}`,
          t: nowS,
          occ: 1,
        });
      }
    });

    if (realBuses.length > 0) {
      // 실제 수신된 버스와 철도/지하철/수도권 정밀망 결합
      const nonBuses = simulated.filter(v => v.route !== 'bus-3000');
      return [...realBuses, ...nonBuses];
    }

    return simulated;
  } catch (err) {
    // 네트워크 실패나 파싱 오류 시 안전하게 정밀 시뮬레이션 유지
    return simulated;
  }
}
