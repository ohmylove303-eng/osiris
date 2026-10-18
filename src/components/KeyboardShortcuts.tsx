'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

const SHORTCUTS = [
  { key: 'C', desc: '✈️ 3D 항공뷰 콕핏 추적 (비행체 락온 후 탑승)' },
  { key: 'D', desc: '🎯 AI 표적 탐지 락온 (사각 조준경 및 고도/속도)' },
  { key: '1–7', desc: '🎨 광학 센서 렌즈 (일반/CRT/야간/열화상/흑백/설한)' },
  { key: 'H', desc: '🛩️ 군사 전술 헤드업 디스플레이 (나침반/피치/MGRS)' },
  { key: 'T', desc: '📻 반경 250km 표적 레이더 명부 (주변 항공기/함정)' },
  { key: 'V', desc: '🎙️ AI 전술 음성 관제관 마이크' },
  { key: 'R', desc: '🌐 전 세계 글로벌 뷰 중심 리셋' },
  { key: 'F', desc: '🖥️ 전체 화면 (Full Screen) 토글' },
  { key: 'S', desc: '📤 현재 전술 상황 공유 / 내보내기' },
  { key: 'L', desc: '📑 좌측 인텔리전스 레이어 관제 패널' },
  { key: 'M', desc: '📊 글로벌 방산/금융 자산 지표' },
  { key: 'I', desc: '⚡ 실시간 인텔리전스 속보 피드' },
  { key: '?', desc: '❓ 전술 키보드 단축키 도움말 (본 창)' },
  { key: 'ESC', desc: '🚪 항공뷰 종료 / 열린 창 닫기' },
];

export default function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName)) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        setIsOpen(p => !p);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);

    window.addEventListener('keydown', handleKey);
    window.addEventListener('osiris-open-shortcuts', handleOpen);
    window.addEventListener('osiris-close-shortcuts', handleClose);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('osiris-open-shortcuts', handleOpen);
      window.removeEventListener('osiris-close-shortcuts', handleClose);
    };
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
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div
            onClick={e => e.stopPropagation()}
            className="relative glass-panel p-6 w-[400px] max-w-[95vw] osiris-glow border border-amber-500/40 shadow-2xl rounded-2xl bg-[#070b14]/95 text-white"
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[var(--gold-primary)]" />
                <span className="text-xs font-mono font-bold text-[var(--text-heading)] tracking-wider">⚡ 번개의 눈동자 전술 단축키</span>
              </div>
              <button 
                type="button"
                onClick={() => setIsOpen(false)} 
                className="text-[var(--text-muted)] hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                title="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-white/5 transition-colors">
                  <span className="text-[11px] font-mono text-[var(--text-secondary)]">{s.desc}</span>
                  <kbd className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-[var(--gold-primary)] bg-[var(--bg-void)] border border-[var(--gold-primary)]/40 shadow-sm shrink-0">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
              <span>하단 바에서 직접 클릭도 가능합니다</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">[?] / [ESC]</kbd>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
