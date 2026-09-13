/**
 * ⚡ OSIRIS Web Speech Synthesis (TTS) Engine
 * 
 * 브라우저 네이티브 Web Speech API 기반의 지연시간 없는 전술 음성 브리핑 엔진:
 * 1. 마크다운 기호(**, ###, [[wikilinks]], URL) 정제(Normalization)
 * 2. 한국어 음성 자동 탐지 (Google 한국어, Apple Yuna, System ko-KR)
 * 3. 재생, 일시정지, 중지, 속도(0.8x~1.5x) 및 피치 제어
 */

export interface TtsState {
  isPlaying: boolean;
  isPaused: boolean;
  currentText: string;
  voiceName: string | null;
}

/**
 * 마크다운 텍스트를 음성 청취 친화적인 일반 문장으로 정제
 */
export function cleanMarkdownForSpeech(md: string): string {
  if (!md) return '';

  return md
    // 1. 위키링크 [[문서명|표시명]] -> 표시명 or 문서명
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    // 2. 마크다운 링크 [링크텍스트](url) -> 링크텍스트
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 3. 이미지 태그 ![대체텍스트](url) -> 제거
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // 4. 인용구 태그 [인용 #1] 등 -> 제1인용
    .replace(/\[인용\s*#?(\d+)\]/g, '제$1인용 ')
    // 5. 제목 헤더 (#, ##, ###)
    .replace(/^#{1,6}\s+/gm, '')
    // 6. 굵은 글씨, 기울임 (**, *, __, _)
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // 7. 코드 블록 및 인라인 코드 (`...`)
    .replace(/```[\s\S]*?```/g, '코드 블록 생략')
    .replace(/`([^`]+)`/g, '$1')
    // 8. 불릿 포인트 (- , * , 1. )
    .replace(/^[\s*-]+(?=[^\s])/gm, '')
    // 9. 구분선 (---)
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // 10. URL 제거
    .replace(/https?:\/\/[^\s]+/g, '웹사이트 링크')
    // 11. 중복 공백 및 줄바꿈 정리
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * 사용 가능한 한국어 음성 탐지
 */
export function getKoreanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices();
  // 1순위: Google 한국어 또는 Apple Yuna (한국어 네이티브)
  const preferredKo = voices.find(v => 
    v.lang.includes('ko') && (v.name.includes('Google') || v.name.includes('Yuna') || v.name.includes('Sora'))
  );
  if (preferredKo) return preferredKo;

  // 2순위: ko-KR 또는 ko 언어 코드
  const anyKo = voices.find(v => v.lang.startsWith('ko'));
  if (anyKo) return anyKo;

  return voices[0] || null;
}

export class TacticalSpeechController {
  private currentAudio: HTMLAudioElement | null = null;
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private onStateChangeCallback: ((state: TtsState) => void) | null = null;
  private isProcessing = false;

  constructor(onStateChange?: (state: TtsState) => void) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
    if (onStateChange) {
      this.onStateChangeCallback = onStateChange;
    }
  }

  private notify(isPlaying: boolean, isPaused: boolean, currentText = '', voiceName: string | null = null) {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({
        isPlaying,
        isPaused,
        currentText,
        voiceName,
      });
    }
  }

  /**
   * 초고음질 신경망 TTS 음성 합성 및 스트리밍 재생
   */
  public async speak(rawText: string, voiceOrRate: string | number = 'ko-KR-SunHiNeural') {
    this.stop();

    const textToSpeak = cleanMarkdownForSpeech(rawText);
    if (!textToSpeak) return;

    const voice = typeof voiceOrRate === 'string' ? voiceOrRate : 'ko-KR-SunHiNeural';

    // 브라우저 User Activation 유지를 위해 Audio 객체 사전 생성
    const audio = new Audio();
    this.currentAudio = audio;
    this.isProcessing = true;
    this.notify(true, false, textToSpeak, `${voice} (SOTA 신경망)`);

    try {
      // 1순위: 초고음질 원어민 신경망 스트림 수신 (인간과 구별 불가 24kHz HD 아나운서)
      const res = await fetch('/api/local-ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, voice }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        audio.src = audioUrl;

        const engineName = res.headers.get('X-TTS-Engine') || `${voice} (SOTA 신경망)`;
        this.notify(true, false, textToSpeak, engineName);
        this.isProcessing = false;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (this.currentAudio === audio) this.currentAudio = null;
          this.notify(false, false, '', null);
        };

        audio.onerror = (e) => {
          console.error('[TTS] Audio playback error:', e);
          URL.revokeObjectURL(audioUrl);
          if (this.currentAudio === audio) this.currentAudio = null;
          this.isProcessing = false;
          this.notify(false, false, '', null);
        };

        await audio.play().catch(playErr => {
          console.error('[TTS] Audio play error (User interaction required):', playErr);
          this.isProcessing = false;
          this.notify(false, false, '', null);
        });
        return;
      }
    } catch (err) {
      console.error('[TTS] Neural endpoint fetch failed:', err);
    }

    this.isProcessing = false;
    this.notify(false, false, '', null);
  }

  private fallbackSpeak(textToSpeak: string) {
    if (!this.synth) {
      this.notify(false, false, '', null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const voice = getKoreanVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'ko-KR';
    }

    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.notify(true, false, textToSpeak, voice?.name || 'Local Synth');
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      this.notify(false, false, '', null);
    };

    utterance.onerror = (e) => {
      console.warn('[TTS] Fallback synthesis error:', e);
      this.currentUtterance = null;
      this.notify(false, false, '', null);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  public pause() {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.notify(true, true);
    } else if (this.synth && this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
      this.notify(true, true);
    }
  }

  public resume() {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play();
      this.notify(true, false);
    } else if (this.synth && this.synth.paused) {
      this.synth.resume();
      this.notify(true, false);
    }
  }

  public stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
    this.isProcessing = false;
    this.notify(false, false, '', null);
  }

  public isSpeaking(): boolean {
    return this.isProcessing ||
      !!(this.currentAudio && !this.currentAudio.paused) ||
      !!(this.synth && this.synth.speaking);
  }
}
