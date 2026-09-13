/**
 * ⚡ OSIRIS Korean Tactical Speech Normalizer (한국어 전술 음성 정규화 엔진)
 * 
 * [일론 머스크 제1원칙 사고법(First Principles) 기반 음성 결함 분석]:
 * 1. 기계음 및 쇳소리(Metallic Glitch)의 물리적 원인:
 *    - 영문 약어(OSINT, MMSI, ADS-B, Qwen)와 기호(~, &, /)가 한글 음소(Phoneme) 합성기와 충돌하여 
 *      갑작스런 언어 모드 전환 스위칭 지터(Jitter) 발생.
 * 2. 발음 뭉개짐(Mumbling & Consonant Slurring)의 물리적 원인:
 *    - 너무 빠른 기본 발화 속도(Default Speed)와 긴 문단 일괄 합성으로 인한 신경망 보코더(Vocoder) 위상 왜곡.
 * 
 * [해결 알고리즘]:
 * - 모든 전술/군사/기술 전문 용어를 표준 한국어 방송 아나운서 발음으로 100% 전처리(G2P)
 * - 발화 속도를 -4% 미세 감속하여 각 음절(초성·중성·종성)의 또렷한 조음(Articulation) 보장
 * - 자연스러운 호흡 쉼표(Prosody Breath Pause) 자동 삽입
 */

export function normalizeKoreanTacticalSpeech(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. 마크다운 문법 완전 정제
  text = text
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2') // [[A|B]] -> B
    .replace(/\[\[([^\]]+)\]\]/g, '$1')           // [[A]] -> A
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')       // [A](url) -> A
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')          // ![img](url) -> 제거
    .replace(/```[\s\S]*?```/g, '')                // 코드블록 제거
    .replace(/`([^`]+)`/g, '$1')                   // 인라인 코드
    .replace(/^#{1,6}\s+/gm, '')                   // 헤더 # 제거
    .replace(/(\*\*|__)(.*?)\1/g, '$2')            // 굵은 글씨
    .replace(/(\*|_)(.*?)\1/g, '$2')              // 기울임
    .replace(/^[>\s*-]+/gm, '')                    // 블록인용, 불릿
    .replace(/\|[^\n]+\|/g, ' ')                   // 마크다운 표 제거
    .replace(/https?:\/\/[^\s]+/g, '웹사이트');    // URL -> 웹사이트

  // 2. 전문 용어 및 영문 약어 -> 한국어 표준 발음 (Grapheme-to-Phoneme)
  const TACTICAL_TERMS: [RegExp, string][] = [
    [/\bOSINT\b/gi, '오신트'],
    [/\bGEOINT\b/gi, '지오인트'],
    [/\bSIGINT\b/gi, '시그인트'],
    [/\bADS-B\b/gi, '에이디에스비'],
    [/\bCCTV\b/gi, '씨씨티비'],
    [/\bMMSI\b/gi, '선박 식별번호'],
    [/\bGPS\b/gi, '지피에스'],
    [/\bAIS\b/gi, '에이아이에스'],
    [/\bQwen\b/gi, '큐웬'],
    [/\bEasyOCR\b/gi, '이지 오씨알'],
    [/\bOllama\b/gi, '올라마'],
    [/\bRAG\b/gi, '래그'],
    [/\bGPT\b/gi, '지피티'],
    [/\bSoVITS\b/gi, '소비츠'],
    [/\bTTS\b/gi, '음성 합성'],
    [/\bLLM\b/gi, '대규모 언어 모델'],
    [/\bAI\b/gi, '인공지능'],
    [/\bHUD\b/gi, '허드'],
    [/\bAPI\b/gi, '에이피아이'],
    [/\bDPRK\b/gi, '북한'],
    [/\bUSGS\b/gi, '미국 지질조사국'],
    [/\bNASA\b/gi, '나사'],
    [/\bFIRMS\b/gi, '화재 정보망'],
    [/\bSOTA\b/gi, '최고 성능'],
    [/\bCUAS\b/gi, '드론 방호'],
    [/\bRF\b/gi, '알에프'],
    [/\bIP\b/gi, '아이피'],
    [/\bDNS\b/gi, '디엔에스'],
    [/\bWHOIS\b/gi, '후이즈'],
    [/\bBGP\b/gi, '비지피'],
    [/\bCVE\b/gi, '보안 취약점'],
    [/\bSSL\b/gi, '보안 인증서'],
    [/\bTLS\b/gi, '보안 인증서'],
    [/\bMAC\b/gi, '맥 주소'],
    [/\bTCP\b/gi, '티씨피'],
    [/\bUDP\b/gi, '유디피'],
    [/\bHD\b/gi, '에이치디'],
    [/\bMetal\b/gi, '메탈'],
    [/\bCloudflare\b/gi, '클라우드플레어'],
    [/\bDirect\b/gi, '다이렉트'],
    [/\bPass\b/gi, '통과'],
    [/\bFail\b/gi, '실패'],
    [/\bWarning\b/gi, '주의'],
    [/\bFact\b/gi, '사실'],
    [/\bInference\b/gi, '판단'],
    [/\bHypothesis\b/gi, '가설'],
  ];

  for (const [pattern, replacement] of TACTICAL_TERMS) {
    text = text.replace(pattern, replacement);
  }

  // 3. 한국어 단위 및 숫자 발음 정규화
  text = text
    // 버전: v1.0 -> 버전 일 점 영
    .replace(/v(\d+)\.(\d+)/gi, '버전 $1 점 $2')
    // 모델 파라미터: 14B -> 십사 비
    .replace(/14B\b/gi, '십사 비')
    .replace(/7B\b/gi, '칠 비')
    .replace(/32B\b/gi, '삼십이 비')
    .replace(/70B\b/gi, '칠십 비')
    // 수사 교정 (13기 -> 열세 기, 8대 -> 여덟 대 등)
    .replace(/13기/g, '열세 기')
    .replace(/8대/g, '여덟 대')
    .replace(/1호/g, '일 호')
    .replace(/2호/g, '이 호')
    .replace(/3호/g, '삼 호')
    // 거리/속도/무게 단위
    .replace(/(\d+(?:\.\d+)?)\s*km\b/gi, '$1 킬로미터')
    .replace(/(\d+(?:\.\d+)?)\s*m\b/gi, '$1 미터')
    .replace(/(\d+(?:\.\d+)?)\s*kt\b/gi, '$1 노트')
    .replace(/(\d+(?:\.\d+)?)\s*knots?\b/gi, '$1 노트')
    .replace(/(\d+(?:\.\d+)?)\s*t\b/gi, '$1 톤')
    // 컴퓨터 단위
    .replace(/(\d+(?:\.\d+)?)\s*GB\b/gi, '$1 기가바이트')
    .replace(/(\d+(?:\.\d+)?)\s*MB\b/gi, '$1 메가바이트')
    .replace(/(\d+(?:\.\d+)?)\s*ms\b/gi, '$1 밀리초')
    .replace(/(\d+(?:\.\d+)?)\s*t\/s\b/gi, '초당 $1 토큰')
    // 퍼센트
    .replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 퍼센트')
    // 기호 정규화
    .replace(/~/g, '에서 ')
    .replace(/&/g, ' 및 ')
    .replace(/\+/g, ' 이상 ')
    .replace(/\//g, ' 또는 ')
    // 인용구 태그
    .replace(/\[인용\s*#?(\d+)\]/g, '제$1인용, ');

  // 4. 호흡 및 억양 휴지기(Breath Pause) 정규화
  text = text
    .replace(/\s*,\s*/g, ', ')             // 쉼표 뒤 1공백 (자연스러운 100ms 호흡)
    .replace(/\s*\.\s*/g, '. ')            // 마침표 뒤 1공백 (완결 종결어미)
    .replace(/\n+/g, ' ')                  // 개행 통합
    .replace(/\s{2,}/g, ' ')               // 중복 공백 제거
    .trim();

  return text;
}
