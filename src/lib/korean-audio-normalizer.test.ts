import { describe, it, expect } from 'vitest';
import { normalizeKoreanTacticalSpeech } from './korean-audio-normalizer';

describe('normalizeKoreanTacticalSpeech (First Principles Speech Normalizer)', () => {
  it('converts technical acronyms to natural Korean phonemes', () => {
    const input = 'OSINT 위협 분석: MMSI 413000000 선박과 ADS-B 항공기, CCTV 피드를 실시간 AI RAG 모델로 추적합니다.';
    const output = normalizeKoreanTacticalSpeech(input);

    expect(output).toContain('오신트');
    expect(output).toContain('선박 식별번호');
    expect(output).toContain('에이디에스비');
    expect(output).toContain('씨씨티비');
    expect(output).toContain('인공지능');
    expect(output).toContain('래그');
    expect(output).not.toContain('OSINT');
    expect(output).not.toContain('MMSI');
    expect(output).not.toContain('ADS-B');
    expect(output).not.toContain('CCTV');
  });

  it('normalizes units, numbers, and counters', () => {
    const input = '선란 1호는 2500m 수심과 13기 부표망, 8대 설비를 14B Qwen 모델로 관제합니다. 신뢰도는 99%입니다.';
    const output = normalizeKoreanTacticalSpeech(input);

    expect(output).toContain('선란 일 호');
    expect(output).toContain('2500 미터');
    expect(output).toContain('열세 기');
    expect(output).toContain('여덟 대');
    expect(output).toContain('십사 비');
    expect(output).toContain('큐웬');
    expect(output).toContain('99 퍼센트');
  });

  it('cleans markdown brackets, links, and code blocks', () => {
    const input = '### [서해 현황](https://osiris.live)\n- **주의**: [[선란 1호|선란 1호 심층]] `status: ok` 확인.';
    const output = normalizeKoreanTacticalSpeech(input);

    expect(output).not.toContain('###');
    expect(output).not.toContain('**');
    expect(output).not.toContain('[[');
    expect(output).not.toContain('https://');
    expect(output).toContain('서해 현황');
    expect(output).toContain('선란 일 호 심층');
  });
});
