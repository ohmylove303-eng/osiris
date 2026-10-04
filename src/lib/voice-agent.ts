/**
 * OSIRIS Tactical Voice Agent
 * Handles real-time speech recognition, command parsing, and tactical action dispatch.
 */

import { parseLocalVoiceCommand, type VoiceActionResult } from './voice-tools';

export type VoiceAgentState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceAgentConfig {
  onStateChange?: (state: VoiceAgentState) => void;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onAction?: (action: VoiceActionResult) => void;
  onError?: (error: string) => void;
  autoSpeakFeedback?: boolean;
}

export class TacticalVoiceAgent {
  private state: VoiceAgentState = 'idle';
  private recognition: any = null;
  private config: VoiceAgentConfig;
  private isDestroyed = false;

  constructor(config: VoiceAgentConfig = {}) {
    this.config = config;
    this.initRecognition();
  }

  private setState(next: VoiceAgentState) {
    if (this.state === next) return;
    this.state = next;
    this.config.onStateChange?.(next);
  }

  public getState(): VoiceAgentState {
    return this.state;
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'ko-KR'; // Default to Korean, also understands English terms

      rec.onstart = () => {
        this.setState('listening');
      };

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += trans;
          } else {
            interim += trans;
          }
        }

        const currentText = final || interim;
        if (currentText) {
          this.config.onTranscript?.(currentText, !!final);
        }

        if (final) {
          this.handleFinalTranscript(final);
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === 'no-speech') return;
        this.config.onError?.(e.error || 'Speech recognition error');
        this.setState('error');
      };

      rec.onend = () => {
        if (this.state === 'listening' && !this.isDestroyed) {
          // Restart if still intended to be listening
          try {
            rec.start();
          } catch {
            this.setState('idle');
          }
        } else {
          this.setState('idle');
        }
      };

      this.recognition = rec;
    } catch (e: any) {
      this.config.onError?.(e.message);
    }
  }

  public async start(): Promise<boolean> {
    if (this.state === 'listening') return true;

    // Check if SpeechRecognition is available
    if (this.recognition) {
      try {
        this.recognition.start();
        this.setState('listening');
        return true;
      } catch (e: any) {
        this.config.onError?.(e.message);
        this.setState('error');
        return false;
      }
    }

    this.config.onError?.('브라우저 음성 인식을 지원하지 않습니다. Chrome/Edge/Safari를 권장합니다.');
    return false;
  }

  public stop() {
    this.setState('idle');
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  public toggle(): boolean {
    if (this.state === 'listening') {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public handleFinalTranscript(text: string) {
    this.setState('processing');
    const action = parseLocalVoiceCommand(text);

    if (action) {
      this.config.onAction?.(action);

      if (this.config.autoSpeakFeedback && typeof window !== 'undefined' && window.speechSynthesis) {
        this.speak(action.feedback);
      } else {
        this.setState('listening');
      }
    } else {
      // Unrecognized command
      this.setState('listening');
    }
  }

  public speak(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.1;
      u.pitch = 0.95;
      u.lang = 'ko-KR';

      u.onstart = () => this.setState('speaking');
      u.onend = () => this.setState('listening');
      u.onerror = () => this.setState('listening');

      window.speechSynthesis.speak(u);
    } catch {
      this.setState('listening');
    }
  }

  public destroy() {
    this.isDestroyed = true;
    this.stop();
    this.recognition = null;
  }
}
