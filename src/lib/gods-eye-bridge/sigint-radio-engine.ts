/**
 * OSIRIS × GOD'S EYE BRIDGE — 실시간 전술 무전 및 SIGINT 주파수 수신 엔진
 * Source Architecture: /Volumes/SAMSUNG/AI-Tools/gods-eye-view/src/layers/radio/
 * (Radio Browser API + Live ATC Broadcast Channels)
 *
 * 수도권 및 전선 거점(인천공항, 김포공항, 평택기지, 오산공군기지, 해상 조난망)의
 * 실시간 항공 관제(ATC), 전술 주파수 교신 스트림을 제공합니다.
 */

export interface RadioStation {
  id: string;
  name: string;
  freq: string; // e.g. "118.1 MHz", "121.5 MHz (비상 주파수)"
  category: 'ATC_TOWER' | 'TACTICAL_MIL' | 'MARITIME_GUARD' | 'WEATHER_METAR';
  country: string;
  location: string;
  lat: number;
  lng: number;
  streamUrl: string;
  bitrate: number;
  codec: string;
  description: string;
}

export const TACTICAL_RADIO_STATIONS: RadioStation[] = [
  {
    id: 'kr-incheon-tower',
    name: '인천국제공항 관제탑 (Incheon Tower / Departure)',
    freq: '118.200 MHz',
    category: 'ATC_TOWER',
    country: 'KR',
    location: '인천 중구 영종도',
    lat: 37.4600,
    lng: 126.4400,
    streamUrl: 'https://relay.radioreference.com/live/RKSI', // fallback open atc stream
    bitrate: 64,
    codec: 'MP3',
    description: '서해안 및 수도권 상공 군용기/민항기 실시간 이착륙 관제 교신',
  },
  {
    id: 'kr-gimpo-tower',
    name: '김포공항 관제탑 및 접근관제 (Gimpo Approach / Tower)',
    freq: '118.050 MHz',
    category: 'ATC_TOWER',
    country: 'KR',
    location: '서울 강서구 공항동',
    lat: 37.5580,
    lng: 126.7900,
    streamUrl: 'https://relay.radioreference.com/live/RKSS',
    bitrate: 64,
    codec: 'MP3',
    description: '한강 하구 및 김포·강화 인근 초계 비행 관제 교신',
  },
  {
    id: 'kr-guard-emergency',
    name: '군·민 공용 국제 항공 비상 주파수 (International Guard VHF)',
    freq: '121.500 MHz',
    category: 'TACTICAL_MIL',
    country: 'INTL',
    location: '한반도 전역 상공 수신망',
    lat: 37.5665,
    lng: 126.9780,
    streamUrl: 'https://icecast.liveatc.net/zla_guard',
    bitrate: 32,
    codec: 'MP3',
    description: '적성 공역 진입 경고 및 우발적 영공 침범 시 비상 호출 주파수',
  },
  {
    id: 'kr-yellow-sea-guard',
    name: '서해 NLL 해상 조난 및 전술 경비망 (VHF Ch.16)',
    freq: '156.800 MHz',
    category: 'MARITIME_GUARD',
    country: 'KR',
    location: '인천 연평도/백령도 해상',
    lat: 37.6600,
    lng: 125.7000,
    streamUrl: 'https://relay.broadcastify.com/maritime_ch16',
    bitrate: 32,
    codec: 'AAC',
    description: '서해 5도 해상 전술 경비함정 및 해경 국제 조난·호출 주파수',
  },
];

/**
 * 모든 전술 무전국 목록 및 현재 수신 상태 반환
 */
export function getTacticalRadioChannels() {
  return {
    stations: TACTICAL_RADIO_STATIONS,
    total: TACTICAL_RADIO_STATIONS.length,
    activeScan: true,
    guardMonitoringFreq: '121.500 MHz',
    timestamp: new Date().toISOString(),
  };
}
