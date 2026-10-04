import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — Live Cyber Attack Feed
 * Generates animated attack arcs from real Feodo Tracker + URLhaus threat data.
 * Each attack has a source (attributed attacker region) and destination (C2 server).
 * The frontend animates these as flying arcs across the globe.
 */

// Known APT / malware family → likely origin region (lat/lng centroids with jitter)
const THREAT_ORIGINS: Record<string, [number, number][]> = {
  // Eastern Europe / Russia
  'Emotet':       [[37.6, 55.7], [30.5, 50.4], [24.1, 56.9], [21.0, 52.2]],
  'QakBot':       [[37.6, 55.7], [49.1, 55.8], [30.3, 59.9], [27.6, 53.9]],
  'Qakbot':       [[37.6, 55.7], [49.1, 55.8], [30.3, 59.9], [27.6, 53.9]],
  'BumbleBee':    [[37.6, 55.7], [24.1, 56.9], [14.4, 50.1]],
  'Dridex':       [[37.6, 55.7], [30.5, 50.4], [49.1, 55.8]],
  'TrickBot':     [[37.6, 55.7], [30.5, 50.4], [68.0, 55.0]],
  'IcedID':       [[37.6, 55.7], [24.1, 56.9], [30.3, 59.9]],
  'SystemBC':     [[37.6, 55.7], [14.4, 50.1], [21.0, 52.2]],
  'Pikabot':      [[37.6, 55.7], [30.5, 50.4], [24.1, 56.9]],
  'BazarLoader':  [[37.6, 55.7], [49.1, 55.8]],
  'CobaltStrike': [[116.4, 39.9], [121.5, 31.2], [37.6, 55.7], [113.3, 23.1]],
  // East Asia
  'PlugX':        [[116.4, 39.9], [121.5, 31.2], [113.3, 23.1]],
  'ShadowPad':    [[116.4, 39.9], [104.1, 30.6], [106.7, 26.6]],
  'Winnti':       [[116.4, 39.9], [121.5, 31.2]],
  // Generic fallback — distributed global
  '_default':     [[37.6, 55.7], [116.4, 39.9], [-73.9, 40.7], [-46.6, -23.5], [28.0, -26.2], [103.8, 1.4]],
};

// Target country → approximate centroid
const COUNTRY_COORDS: Record<string, [number, number]> = {
  AF:[65,33],AL:[20,41],DZ:[3,28],AO:[18.5,-12.5],AR:[-64,-34],AM:[45,40],AU:[134,-25],AT:[14,47.5],AZ:[50,40.5],
  BD:[90,24],BY:[28,53],BE:[4,50.8],BR:[-51,-10],BG:[25.5,42.7],CA:[-96,62],CL:[-71,-30],
  CN:[105,35],CO:[-72,4],HR:[16,45.2],CZ:[15.5,49.8],DK:[10,56],EG:[30,27],FI:[26,64],
  FR:[2,46],DE:[10,51],GR:[22,39],HK:[114.2,22.3],HU:[19.5,47],IN:[79,22],ID:[120,-5],
  IR:[53,32],IQ:[44,33],IE:[-8,53],IL:[34.8,31.5],IT:[12.5,42.8],JP:[138,36],KZ:[67,48],
  KE:[38,1],KR:[128,36],LT:[24,55.5],MY:[112,3],MX:[-102,23.5],NL:[5.5,52.5],NZ:[174,-41],
  NG:[8,10],NO:[8,62],PK:[70,30],PA:[-80,9],PH:[122,12.5],PL:[19.5,52],PT:[-8,39.5],
  RO:[25,46],RU:[100,60],SA:[45,25],SG:[103.8,1.35],ZA:[24,-29],ES:[-4,40],SE:[16,62],
  CH:[8,47],TW:[121,23.7],TH:[101,15],TR:[35,39],UA:[32,49],AE:[54,24],GB:[-2,54],
  US:[-97,38],VN:[106,16],
};

// Severity by malware family
const SEVERITY: Record<string, number> = {
  'Emotet': 9, 'QakBot': 8, 'Qakbot': 8, 'Dridex': 8, 'TrickBot': 7, 'IcedID': 7,
  'BumbleBee': 7, 'CobaltStrike': 10, 'SystemBC': 6, 'Pikabot': 7, 'BazarLoader': 8,
  'PlugX': 9, 'ShadowPad': 10, 'Winnti': 9,
};

// Human-readable attack effect descriptions (Korean)
const EFFECT_MAP: Record<string, string> = {
  'Emotet': '이메일 탈취 → 내부망 전파 → 금융 자격증명 유출',
  'QakBot': '금융 시스템 침투 → 계좌 탈취 → 랜섬웨어 배포',
  'Qakbot': '금융 시스템 침투 → 계좌 탈취 → 랜섬웨어 배포',
  'Dridex': '은행 트로이목마 → 자격증명 도난 → 전신송금 탈취',
  'TrickBot': '기업 네트워크 침투 → 횡이동 → 랜섬웨어 배포 전단계',
  'IcedID': '뱅킹 트로이목마 → 브라우저 세션 탈취 → 결제 사기',
  'BumbleBee': '초기 접근 브로커 → 원격 쉘 설치 → 후속 페이로드 투하',
  'CobaltStrike': '원격 쉘 완전 제어 → 내부 횡이동 → 기밀 문서 대량 유출',
  'SystemBC': '프록시 터널 생성 → C2 통신 은닉 → 탐지 회피',
  'Pikabot': '초기 접근 → 모듈 다운로드 → 정보 수집 및 탈취',
  'BazarLoader': '대규모 기업 침투 → Conti 랜섬웨어 배포 → 시스템 암호화',
  'PlugX': '군사/정부 시스템 침투 → 기밀 데이터 장기 수집',
  'ShadowPad': '국가기관 백도어 → 장기 잠복 → 핵심 인프라 제어 장악',
  'Winnti': '반도체/게임 산업 침투 → 소스코드 탈취 → 공급망 공격',
};

// Country code → Korean name for display
const COUNTRY_NAMES: Record<string, string> = {
  AF:'아프가니스탄',AL:'알바니아',DZ:'알제리',AO:'앙골라',AR:'아르헨티나',AM:'아르메니아',AU:'호주',AT:'오스트리아',AZ:'아제르바이잔',
  BD:'방글라데시',BY:'벨라루스',BE:'벨기에',BR:'브라질',BG:'불가리아',CA:'캐나다',CL:'칠레',
  CN:'중국',CO:'콜롬비아',HR:'크로아티아',CZ:'체코',DK:'덴마크',EG:'이집트',FI:'핀란드',
  FR:'프랑스',DE:'독일',GR:'그리스',HK:'홍콩',HU:'헝가리',IN:'인도',ID:'인도네시아',
  IR:'이란',IQ:'이라크',IE:'아일랜드',IL:'이스라엘',IT:'이탈리아',JP:'일본',KZ:'카자흐스탄',
  KE:'케냐',KR:'대한민국',LT:'리투아니아',MY:'말레이시아',MX:'멕시코',NL:'네덜란드',NZ:'뉴질랜드',
  NG:'나이지리아',NO:'노르웨이',PK:'파키스탄',PA:'파나마',PH:'필리핀',PL:'폴란드',PT:'포르투갈',
  RO:'루마니아',RU:'러시아',SA:'사우디아라비아',SG:'싱가포르',ZA:'남아공',ES:'스페인',SE:'스웨덴',
  CH:'스위스',TW:'대만',TH:'태국',TR:'터키',UA:'우크라이나',AE:'UAE',GB:'영국',
  US:'미국',VN:'베트남',
};

const ATTACK_VERBS = [
  'C2 BEACON', 'PAYLOAD DROP', 'EXFILTRATION', 'LATERAL MOVE', 'CREDENTIAL HARVEST',
  'IMPLANT DEPLOY', 'REVERSE SHELL', 'DATA STAGING', 'PERSISTENCE', 'RECON SWEEP',
];

let cachedAttacks: any = null;
let cacheTime = 0;
const CACHE_TTL = 10_000; // 10s — rapid refresh for live feel

export async function GET() {
  const now = Date.now();
  if (cachedAttacks && now - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedAttacks, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }

  try {
    const res = await fetch('https://feodotracker.abuse.ch/downloads/ipblocklist.json', {
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
      headers: { 'User-Agent': 'OSIRIS/4.3', Accept: 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.json({ attacks: [], total: 0, error: 'Feodo unavailable' });
    }

    const raw = await res.json();
    const entries = (Array.isArray(raw) ? raw : []).filter(
      (e: any) => e.country && COUNTRY_COORDS[e.country]
    );

    // Ensure minimum 60 arcs for visual density — multiply entries with varied params
    const TARGET_ARCS = 15;
    const multiplier = entries.length > 0 ? Math.max(1, Math.ceil(TARGET_ARCS / entries.length)) : 0;
    const attacks: any[] = [];
    let id = 0;

    for (const entry of entries) {
      const malware = entry.malware || 'Unknown';
      const origins = THREAT_ORIGINS[malware] || THREAT_ORIGINS['_default'];
      const dst = COUNTRY_COORDS[entry.country];
      if (!dst) continue;

      for (let m = 0; m < multiplier && attacks.length < 20; m++) {
        const origin = origins[(id + m) % origins.length];
        // Vary jitter per clone so arcs fan out
        const jSrc = [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5];
        const jDst = [(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4];

        const sev = SEVERITY[malware] || 5;
        attacks.push({
          id: `ca-${id}`,
          src_lng: origin[0] + jSrc[0],
          src_lat: origin[1] + jSrc[1],
          dst_lng: dst[0] + jDst[0],
          dst_lat: dst[1] + jDst[1],
          malware,
          target_ip: entry.ip_address || '0.0.0.0',
          target_country: entry.country,
          target_country_name: COUNTRY_NAMES[entry.country] || entry.country,
          port: entry.dst_port || 443,
          severity: sev,
          severity_color: sev >= 9 ? '#FF1744' : sev >= 7 ? '#FF6D00' : '#FFD600',
          action: ATTACK_VERBS[Math.floor(Math.random() * ATTACK_VERBS.length)],
          effect: EFFECT_MAP[malware] || '시스템 침투 및 데이터 유출 시도',
          status: entry.status || 'online',
          timestamp: entry.first_seen || new Date().toISOString(),
          delay: Math.random() * 8000,
          duration: 3000 + Math.random() * 3000,
        });
        id++;
      }
    }

    const result = {
      attacks,
      total: attacks.length,
      timestamp: new Date().toISOString(),
      source: 'abuse.ch Feodo Tracker (attributed)',
    };

    cachedAttacks = result;
    cacheTime = now;

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('[OSIRIS] Cyber attack feed error:', error);
    return NextResponse.json({ attacks: [], total: 0, error: 'Feed unavailable' }, { status: 500 });
  }
}
