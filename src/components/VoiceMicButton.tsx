'use client';

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react';
import { TacticalVoiceAgent, type VoiceAgentState } from '@/lib/voice-agent';
import { type VoiceActionResult } from '@/lib/voice-tools';

interface VoiceMicButtonProps {
  onAction: (action: VoiceActionResult) => void;
  className?: string;
}

function VoiceMicButtonInner({ onAction, className = '' }: VoiceMicButtonProps) {
  const [state, setState] = useState<VoiceAgentState>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const agentRef = useRef<TacticalVoiceAgent | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const agent = new TacticalVoiceAgent({
      onStateChange: (s) => setState(s),
      onTranscript: (text) => {
        setTranscript(text);
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        clearTimerRef.current = setTimeout(() => setTranscript(''), 4000);
      },
      onAction: (act) => {
        setLastFeedback(act.feedback);
        onAction(act);
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        clearTimerRef.current = setTimeout(() => setLastFeedback(null), 5000);
      },
      onError: (err) => {
        setErrorMsg(err);
        setTimeout(() => setErrorMsg(null), 4000);
      },
      autoSpeakFeedback: true,
    });

    agentRef.current = agent;

    // Keyboard shortcut 'V' to toggle voice mic
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName)) return;
      if (e.key === 'v' || e.key === 'V') {
        if (e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        agent.toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      agent.destroy();
    };
  }, [onAction]);

  const handleToggle = useCallback(() => {
    agentRef.current?.toggle();
  }, []);

  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Mic toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`relative flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-200 shadow-md ${
          isListening
            ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]'
            : isSpeaking
            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
            : 'bg-black/60 border-[var(--gold-primary)]/40 text-[var(--gold-primary)] hover:border-[var(--gold-primary)] hover:bg-black/80'
        }`}
        title="전술 음성 AI 제어 (단축키: V) — '도쿄로 이동', '야간투시 켜', '콕핏 켜', '탐지 토글'"
      >
        {isListening ? (
          <Mic className="w-4 h-4" />
        ) : isSpeaking ? (
          <Volume2 className="w-4 h-4" />
        ) : (
          <MicOff className="w-4 h-4 opacity-75" />
        )}

        {/* Pulse ring when active */}
        {isListening && (
          <span className="absolute inset-0 rounded-full border border-red-400/80 animate-ping pointer-events-none" />
        )}
      </button>

      {/* Transcript or feedback HUD popover */}
      {(transcript || lastFeedback || errorMsg) && (
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-black/90 backdrop-blur-md border border-[var(--gold-primary)]/40 rounded shadow-xl text-[11px] font-mono whitespace-nowrap z-[100] flex items-center gap-2">
          {errorMsg ? (
            <div className="text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMsg}</span>
            </div>
          ) : lastFeedback ? (
            <div className="text-emerald-400 flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{lastFeedback}</span>
            </div>
          ) : (
            <div className="text-[var(--gold-primary)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <span className="opacity-80">&quot;{transcript}&quot;</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const VoiceMicButton = memo(VoiceMicButtonInner);
export default VoiceMicButton;
