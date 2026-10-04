import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export interface RadioStation {
  id: string;
  name: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  streamUrl: string;
  genre: string;
  frequency?: string;
}

export const STRATEGIC_RADIO_STATIONS: RadioStation[] = [
  {
    id: 'kbs-world',
    name: 'KBS World Radio',
    country: 'KR',
    city: 'Seoul',
    lat: 37.524,
    lng: 126.918,
    streamUrl: 'https://world.kbs.co.kr',
    genre: 'News / Strategic',
    frequency: '97.3 MHz',
  },
  {
    id: 'bbc-world-london',
    name: 'BBC World Service',
    country: 'GB',
    city: 'London',
    lat: 51.519,
    lng: -0.143,
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
    genre: 'Global News / Intel',
    frequency: '198 kHz',
  },
  {
    id: 'voa-washington',
    name: 'Voice of America (VOA)',
    country: 'US',
    city: 'Washington D.C.',
    lat: 38.887,
    lng: -77.016,
    streamUrl: 'https://voa-ingest.akacdn.net/hls/live/2034080/voa_audio_1/master.m3u8',
    genre: 'International News',
    frequency: 'Shortwave / MW',
  },
  {
    id: 'nhk-world-tokyo',
    name: 'NHK World Japan',
    country: 'JP',
    city: 'Tokyo',
    lat: 35.666,
    lng: 139.697,
    streamUrl: 'https://radio-stream.nhk.or.jp/hls/live/2023507/nhkradiruakr1/master.m3u8',
    genre: 'Public / Emergency News',
    frequency: '594 kHz',
  },
  {
    id: 'france-info-paris',
    name: 'France Info',
    country: 'FR',
    city: 'Paris',
    lat: 48.852,
    lng: 2.277,
    streamUrl: 'http://icecast.radiofrance.fr/franceinfo-midfi.mp3',
    genre: 'Continuous News',
    frequency: '105.5 MHz',
  },
  {
    id: 'rfa-asia',
    name: 'Radio Free Asia (RFA)',
    country: 'US',
    city: 'Washington D.C.',
    lat: 38.905,
    lng: -77.042,
    streamUrl: 'https://stream.rfaweb.org',
    genre: 'Regional OSINT / News',
    frequency: 'Shortwave',
  },
  {
    id: 'taipei-icrt',
    name: 'ICRT Taiwan International',
    country: 'TW',
    city: 'Taipei',
    lat: 25.136,
    lng: 121.543,
    streamUrl: 'https://icrt.leanstream.co/ICRTFM-MP3',
    genre: 'News / Broadcast',
    frequency: '100.7 MHz',
  },
  {
    id: 'dw-berlin',
    name: 'Deutsche Welle World',
    country: 'DE',
    city: 'Berlin',
    lat: 52.518,
    lng: 13.376,
    streamUrl: 'https://dwstream4-live.hls.adaptive.level3.net',
    genre: 'European Intel & News',
    frequency: 'Satellite / Internet',
  },
  // ── Tactical Open WebSDR & KiwiSDR Feeds ──
  {
    id: 'sdr-incheon-kiwi',
    name: 'HL2DDS 인천 광역 KiwiSDR (HF/VHF)',
    country: 'KR',
    city: 'Incheon',
    lat: 37.456,
    lng: 126.705,
    streamUrl: 'http://hl2dds.proxy.kiwisdr.com:8073',
    genre: 'Tactical SDR / HF Recon',
    frequency: '0 - 30 MHz Broad-band',
  },
  {
    id: 'sdr-seoul-tactical',
    name: 'HL1WA 서울 수도권 비상무선 SDR',
    country: 'KR',
    city: 'Seoul',
    lat: 37.566,
    lng: 126.978,
    streamUrl: 'http://kiwisdr.com',
    genre: 'Tactical SDR / Emergency Net',
    frequency: '3.5 - 14 MHz Military/Civil',
  },
  {
    id: 'sdr-tokyo-websdr',
    name: 'JA1GDE 도쿄만 해상항공 WebSDR',
    country: 'JP',
    city: 'Tokyo',
    lat: 35.620,
    lng: 139.770,
    streamUrl: 'http://websdr.ewi.utwente.nl:8901',
    genre: 'Maritime & Airband SDR',
    frequency: 'VHF Air / Marine AIS',
  },
  {
    id: 'sdr-twente-websdr',
    name: '트벤테 광역 전술 WebSDR (유럽 최대)',
    country: 'NL',
    city: 'Enschede',
    lat: 52.240,
    lng: 6.850,
    streamUrl: 'http://websdr.ewi.utwente.nl:8901',
    genre: 'Global SIGINT / HF SDR',
    frequency: '0 - 29.16 MHz Continuous',
  },
];

export async function GET() {
  const geojson = {
    type: 'FeatureCollection',
    features: STRATEGIC_RADIO_STATIONS.map((station) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [station.lng, station.lat],
      },
      properties: {
        id: station.id,
        name: station.name,
        country: station.country,
        city: station.city,
        streamUrl: station.streamUrl,
        genre: station.genre,
        frequency: station.frequency,
      },
    })),
  };

  return NextResponse.json(geojson, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
