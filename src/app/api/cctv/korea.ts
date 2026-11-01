import type { CctvCamera } from './types';
import { KOREA_ITS_CAMERAS } from './korea-snapshot.generated';

/**
 * 번개의 눈동자 (OSIRIS) — 대한민국 수도권 및 서울 핵심 권역 CCTV 통합 피드
 * 
 * Sources:
 * 1. 서울 초고층 랜드마크 파노라마 (N서울타워 남산 정상 4K, 반포대교 달빛무지개분수, 여의도 한강 4K, 롯데월드타워, 63스퀘어)
 * 2. 이태원 및 용산 핵심 보행로/신호등 (이태원역 해밀톤호텔, 녹사평역, 앤틱가구거리, 한남오거리, 반포대교 북단)
 * 3. 강남 테헤란로·강남대로 간선축 신호등 (강남역, 신논현역, 역삼역, 삼성역 코엑스, 교대역, 양재역)
 * 4. 주요 대학가 번화가 및 보행자 신호등 (홍대입구역 4K 라이브 & 보행거리, 신촌오거리 연세로, 건대입구역, 혜화역 대학로, 안암오거리 고려대, 왕십리역 한양대)
 * 5. 서울 핵심 도심 신호등 및 랜드마크 교차로 (광화문광장, 시청앞 서울광장, 종각역 보신각, 동대문 DDP, 잠실역, 한강대교 북단, 청계천 광통교)
 * 6. 국토교통부 국가교통정보센터 / 수도권 ITS 공식 CCTV 426개 노드
 */

// ── 1. 남산타워 및 서울 초고층 파노라마 뷰 (Namsan & Seoul High-Altitude Panoramas) ──
const NAMSAN_AND_SEOUL_PANORAMA_CAMS: CctvCamera[] = [
  {
    id: 'kr-seoul-namsan-tower-4k',
    lat: 37.5512,
    lng: 126.9882,
    name: 'N서울타워 남산 정상 파노라마 4K (서울 전경 24/7 라이브)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://www.youtube-nocookie.com/embed/GhNscofIqHU?autoplay=1&mute=1',
    stream_type: 'iframe',
    source: 'Seoul Metropolitan Live 4K'
  },
  {
    id: 'kr-seoul-hangang-banpo-live',
    lat: 37.5133,
    lng: 126.9958,
    name: '한강 반포대교 및 세빛섬 달빛무지개분수 24/7 실시간 라이브',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://www.youtube-nocookie.com/embed/RVvYQghFCXk?autoplay=1&mute=1',
    stream_type: 'iframe',
    source: 'Daily Seoul Hangang Live'
  },
  {
    id: 'kr-seoul-hangang-yeouido-4k',
    lat: 37.5283,
    lng: 126.9328,
    name: '여의도 한강공원 · 마포대교 · 강변북로 4K 초고화질 실시간 라이브',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://www.youtube-nocookie.com/embed/vk5BHoDxXf0?autoplay=1&mute=1',
    stream_type: 'iframe',
    source: 'Han River 4K Live'
  },
  {
    id: 'kr-seoul-downtown-live',
    lat: 37.5663,
    lng: 126.9779,
    name: '서울 도심 24/7 실시간 라이브 (시청 · 광화문 방면 파노라마)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://www.youtube-nocookie.com/embed/yl11N0NuHVQ?autoplay=1&mute=1',
    stream_type: 'iframe',
    source: 'Korea 24/7 Downtown Live'
  },
  {
    id: 'kr-seoul-namsan-sowolro',
    lat: 37.5532,
    lng: 126.9815,
    name: '[남산] 소월로 전망대 — 남산 순환로 및 도심 조망 교차로',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L511.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-namsan-tunnel1-north',
    lat: 37.5601,
    lng: 126.9897,
    name: '[남산] 남산1호터널 북단 교차로 (퇴계로·충무로 신호등)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L512.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-namsan-tunnel3-north',
    lat: 37.5594,
    lng: 126.9806,
    name: '[남산] 남산3호터널 북단 회현사거리 신호등 교차로',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L513.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-lotte-world-tower',
    lat: 37.5126,
    lng: 127.1025,
    name: '롯데월드타워 서울 스카이 — 잠실·동남권 스카이라인 파노라마',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L503.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-63building-view',
    lat: 37.5197,
    lng: 126.9402,
    name: '여의도 63스퀘어 — 한강·마포대교·서울도심 파노라마',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L510.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  }
];

// ── 2. 이태원 및 용산 핵심 신호등 교차로 (Itaewon & Yongsan Intersections) ──
const ITAEWON_CAMS: CctvCamera[] = [
  {
    id: 'kr-seoul-itaewon-station',
    lat: 37.5345,
    lng: 126.9944,
    name: '[이태원] 이태원역 1·2번 출구 해밀톤호텔 앞 신호등 삼거리',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L514.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-noksapyeong-crossing',
    lat: 37.5346,
    lng: 126.9868,
    name: '[이태원] 녹사평역 교차로 (용산구청·이태원로 입구 신호등)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L515.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-itaewon-bogwang',
    lat: 37.5322,
    lng: 126.9961,
    name: '[이태원] 이태원 앤틱가구거리 — 보광로 연결 교차로 신호등',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L516.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-hannam-5way',
    lat: 37.5349,
    lng: 127.0095,
    name: '[이태원·한남] 한남오거리 신호등 교차로 (한남대로·독서당로)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L517.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-banpo-north-crossing',
    lat: 37.5186,
    lng: 126.9961,
    name: '[용산·이태원] 반포대교 북단 잠수교 진입로 신호등 교차로',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L518.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  }
];

// ── 3. 강남 핵심 테헤란로·강남대로 간선축 신호등 (Gangnam Traffic Arterials) ──
const GANGNAM_CAMS: CctvCamera[] = [
  {
    id: 'kr-seoul-gangnam-station-crossing',
    lat: 37.4979,
    lng: 127.0276,
    name: '[강남] 강남역 사거리 신호등 교차로 (테헤란로·강남대로)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L520.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-sinnonhyeon-crossing',
    lat: 37.5045,
    lng: 127.0253,
    name: '[강남] 신논현역 교차로 (강남대로·봉은사로 신호등 사거리)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L521.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-yeoksam-crossing',
    lat: 37.5006,
    lng: 127.0365,
    name: '[강남] 역삼역 사거리 (테헤란로·논현로 신호등 교차로)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L522.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-samseong-coex-crossing',
    lat: 37.5088,
    lng: 127.0631,
    name: '[강남] 삼성역 사거리 — 코엑스 영동대로 복합환승센터 신호등',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L523.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-gyodae-crossing',
    lat: 37.4934,
    lng: 127.0142,
    name: '[서초·강남] 교대역 사거리 신호등 교차로 (서초대로·서초중앙로)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L519.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-yangjae-crossing',
    lat: 37.4842,
    lng: 127.0346,
    name: '[강남] 양재역 사거리 (남부순환로·강남대로 환승센터 신호등)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L525.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  }
];

// ── 4. 주요 대학가 번화가 및 보행자 신호등 (University Districts Traffic Lights) ──
const UNIVERSITY_DISTRICT_CAMS: CctvCamera[] = [
  {
    id: 'kr-seoul-hongdae-street-4k',
    lat: 37.5558,
    lng: 126.9242,
    name: '[대학가] 홍대 어울마당로 보행자 거리 4K 초고화질 실시간 라이브',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://www.youtube-nocookie.com/embed/Q3nmOf0vusk?autoplay=1&mute=1',
    stream_type: 'iframe',
    source: 'Hongdae Street Live 4K'
  },
  {
    id: 'kr-seoul-hongdae-crossing',
    lat: 37.5568,
    lng: 126.9238,
    name: '[대학가] 홍대입구역 사거리 — 양화로·어울마당로 보행자 거리 신호등',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L526.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-sinchon-rotary',
    lat: 37.5552,
    lng: 126.9368,
    name: '[대학가] 신촌오거리 교차로 — 연세로 연세대 보행거리 신호등',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L527.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-konkuk-univ-crossing',
    lat: 37.5404,
    lng: 127.0692,
    name: '[대학가] 건대입구역 사거리 — 건국대·능동로 번화가 신호등',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L529.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-hyehwa-daehangno',
    lat: 37.5822,
    lng: 127.0019,
    name: '[대학가] 혜화역 대학로 로터리 — 성균관대 진입로 신호등',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L530.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-anam-korea-univ',
    lat: 37.5855,
    lng: 127.0298,
    name: '[대학가] 안암오거리 신호등 교차로 — 고려대학교 정문 앞',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L507.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-wangsimni-hanyang',
    lat: 37.5619,
    lng: 127.0374,
    name: '[대학가] 왕십리역 오거리 신호등 교차로 — 한양대학교 방면',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L532.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  }
];

// ── 5. 서울 핵심 도심 신호등 및 랜드마크 교차로 (Seoul Core City Signals) ──
const SEOUL_CORE_TRAFFIC_SIGNAL_CAMS: CctvCamera[] = [
  {
    id: 'kr-seoul-gwanghwamun-crossing',
    lat: 37.5714,
    lng: 126.9768,
    name: '[서울 도심] 광화문광장 교차로 — 세종대로 신호등 및 보행 광장',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L533.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-cityhall-plaza',
    lat: 37.5658,
    lng: 126.9772,
    name: '[서울 도심] 시청앞 서울광장 교차로 — 세종대로 신호등',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L534.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-jongno-jonggak',
    lat: 37.5702,
    lng: 126.9830,
    name: '[서울 도심] 종로2가 종각역 사거리 — 보신각 앞 신호등 교차로',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L501.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-ddp-crossing',
    lat: 37.5657,
    lng: 127.0090,
    name: '[서울 도심] 동대문디자인플라자(DDP) 교차로 — 장충단로 신호등',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L502.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-jamsil-lottetower',
    lat: 37.5133,
    lng: 127.1001,
    name: '[잠실] 잠실역 사거리 — 롯데월드타워·송파대로 신호등 교차로',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L503.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-hangang-bridge-north',
    lat: 37.5255,
    lng: 126.9602,
    name: '[용산] 한강대교 북단 신호등 교차로 (한강대로·이촌로)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L504.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  },
  {
    id: 'kr-seoul-cheonggyecheon-gwangtong',
    lat: 37.5691,
    lng: 126.9818,
    name: '[서울 도심] 청계천 광통교 교차로 — 신호등 및 수변 산책로',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L505.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Seoul-TOPIS'
  }
];

// ── 6. 국가 전술 상황실 및 전략 관제 (National Situational & Strategic Streams) ──
const STRATEGIC_KOREA_LIVE_CAMS: CctvCamera[] = [
  {
    id: 'kr-ytn-live-news-247',
    lat: 37.5501,
    lng: 126.9740,
    name: 'YTN 24/7 실시간 뉴스 상황실 (한반도 재난·교통·속보 생중계)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://www.youtube-nocookie.com/embed/aZyD6EPl6KU?autoplay=1&mute=1',
    stream_type: 'iframe',
    source: 'YTN 24/7 Live'
  },
  {
    id: 'kr-yonhap-live-news-247',
    lat: 37.5732,
    lng: 126.9798,
    name: '연합뉴스TV 24/7 실시간 생중계 (국가안보 및 수도권 재난 관제)',
    city: '서울',
    country: 'South Korea',
    stream_url: 'https://www.youtube-nocookie.com/embed/6QZ_qc75ihU?autoplay=1&mute=1',
    stream_type: 'iframe',
    source: 'Yonhap News TV 24/7'
  },
  {
    id: 'kr-busan-gwangan-bridge',
    lat: 35.1532,
    lng: 129.1189,
    name: '부산 광안대교 및 수영만 해상 관제',
    city: '부산',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L506.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Busan Maritime Traffic'
  },
  {
    id: 'kr-dmz-imjingak',
    lat: 37.8893,
    lng: 126.7417,
    name: '임진각 평화누리 및 통일대교 관제초소',
    city: '파주',
    country: 'South Korea',
    feed_url: 'https://gimpo.cctvstream.net:8443/c029/playlist.m3u8',
    stream_url: 'https://gimpo.cctvstream.net:8443/c029/playlist.m3u8',
    stream_type: 'hls',
    source: 'Border-ITS'
  },
  {
    id: 'kr-incheon-airport-cargo',
    lat: 37.4602,
    lng: 126.4407,
    name: '인천국제공항 화물터미널 및 활주로 외곽',
    city: '인천',
    country: 'South Korea',
    stream_url: 'https://cctv.fitic.go.kr/cctv/L508.stream/playlist.m3u8',
    stream_type: 'hls',
    source: 'Airport-ITS'
  }
];

export async function fetchKoreaCameras(): Promise<CctvCamera[]> {
  try {
    // Combine newly enriched Seoul & strategic categories with full 426-node ITS network
    const combined: CctvCamera[] = [
      ...NAMSAN_AND_SEOUL_PANORAMA_CAMS,
      ...ITAEWON_CAMS,
      ...GANGNAM_CAMS,
      ...UNIVERSITY_DISTRICT_CAMS,
      ...SEOUL_CORE_TRAFFIC_SIGNAL_CAMS,
      ...STRATEGIC_KOREA_LIVE_CAMS,
      ...KOREA_ITS_CAMERAS
    ];

    return combined;
  } catch (err) {
    console.error('[CCTV Korea] Fallback to strategic live cams:', err);
    return [
      ...NAMSAN_AND_SEOUL_PANORAMA_CAMS,
      ...STRATEGIC_KOREA_LIVE_CAMS
    ];
  }
}
