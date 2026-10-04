'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

const SHORTCUTS = [
  { key: '1–7', desc: '광학 센서 필터 (일반/CRT/야간/열화상/흑백/설한)' },
  { key: 'C', desc: '3D 조종석 (Cockpit) 비행 추적 모드' },
  { key: 'D', desc: 'AI 객체 탐지 (God\'s Eye) 오버레이' },
  { key: 'H', desc: '밀리터리 전술 헤드업 디스플레이 (HUD)' },
  { key: 'V', desc: 'AI 전술 음성 관제관 마이크' },
  { key: 'T', desc: '250km 반경 실시간 접촉 실체 명부' },
  { key: 'F', desc: '전체 화면 토글' },
  { key: 'S', desc: '현재 전술 상황 공유/내보내기' },
  { key: 'L', desc: '좌측 레이어 관제 패널 토글' },
  { key: 'M', desc: '글로벌 방산/금융 자산 지표' },
  { key: 'I', desc: '실시간 인텔리전스 피드' },
  { key: 'R', desc: '전 세계 글로벌 뷰 중심 리셋' },
  { key: '?', desc: '키보드 전술 단축키 도움말' },
  { key: 'ESC', desc: '열린 창 및 팝업 닫기' },
];

export default function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName)) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) setIsOpen(p => !p);
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          data-shortcuts-modal="true"
          className="fixed inset-0 z-[500] flex items-center justify-center pointer-events-auto"
          onClick={() => setIsOpen(false)}
        >
          <div className="absolute inset-0 bg-[var(--bg-void)]/80 backdrop-blur-sm" />
          <motion.div
            onClick={e => e.stopPropagation()}
            className="relative glass-panel p-6 w-[340px] osiris-glow border border-amber-500/30"
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-[var(--gold-primary)]" />
                <span className="text-xs font-mono font-bold text-[var(--text-heading)] tracking-wider">⚡ 전술 키보드 단축키</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-[var(--text-secondary)]">{s.desc}</span>
                  <kbd className="px-2 py-0.5 rounded text-[9px] font-mono font-bold text-[var(--gold-primary)] bg-[var(--bg-void)] border border-[var(--border-primary)] shrink-0">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-2 border-t border-white/5 text-center text-[9px] font-mono text-[var(--text-muted)] tracking-widest">
              [?] 또는 [ESC] 키를 누르면 닫힙니다
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
