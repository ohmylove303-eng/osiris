'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFeynmanExplanation, type FeynmanExplanation } from '@/lib/feynman-dictionary';
import { Sparkles, ArrowRight } from 'lucide-react';

export interface FeynmanTooltipProps {
  /** 사전 키 (FEYNMAN_DICTIONARY의 키, 예: 'group_AVIATION') */
  dictKey?: string;
  /** 직접 제목 지정 시 */
  title?: string;
  /** 직접 분류 태그 지정 시 */
  category?: string;
  /** 직접 파인만 설명 본문 지정 시 */
  explanation?: string;
  /** 조작 안내 힌트 */
  actionHint?: string;
  /** 툴팁이 뜰 위치 */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** 자식 요소 */
  children: React.ReactNode;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 가로 너비 100% 채움 여부 */
  fullWidth?: boolean;
  /** 추가 클래스 */
  className?: string;
}

export default function FeynmanTooltip({
  dictKey,
  title: propTitle,
  category: propCategory,
  explanation: propExplanation,
  actionHint: propActionHint,
  position = 'top',
  children,
  disabled = false,
  fullWidth = false,
  className = '',
}: FeynmanTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 사전 데이터와 props 결합
  const dictData: FeynmanExplanation | null = dictKey ? getFeynmanExplanation(dictKey, propTitle) : null;
  const title = propTitle || dictData?.title || '';
  const category = propCategory || dictData?.category || '파인만 핵심 해설';
  const explanation = propExplanation || dictData?.explanation || '';
  const actionHint = propActionHint || dictData?.actionHint;

  const handleMouseEnter = () => {
    if (disabled || !explanation) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 150); // 150ms 쾌적한 딜레이
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  const handleClick = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 위치별 CSS 클래스 및 애니메이션 방향
  const getPositionStyles = () => {
    switch (position) {
      case 'right':
        return {
          containerClass: 'left-full top-1/2 -translate-y-1/2 ml-3.5',
          initial: { opacity: 0, x: -8, scale: 0.95 },
          animate: { opacity: 1, x: 0, scale: 1 },
          exit: { opacity: 0, x: -6, scale: 0.95 },
          arrowClass: '-left-1.5 top-1/2 -translate-y-1/2 border-r-[6px] border-r-[#070b14]/95 border-y-[5px] border-y-transparent border-l-0',
        };
      case 'left':
        return {
          containerClass: 'right-full top-1/2 -translate-y-1/2 mr-3.5',
          initial: { opacity: 0, x: 8, scale: 0.95 },
          animate: { opacity: 1, x: 0, scale: 1 },
          exit: { opacity: 0, x: 6, scale: 0.95 },
          arrowClass: '-right-1.5 top-1/2 -translate-y-1/2 border-l-[6px] border-l-[#070b14]/95 border-y-[5px] border-y-transparent border-r-0',
        };
      case 'bottom':
        return {
          containerClass: 'top-full left-1/2 -translate-x-1/2 mt-2.5',
          initial: { opacity: 0, y: -8, scale: 0.95 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: -6, scale: 0.95 },
          arrowClass: '-top-1.5 left-1/2 -translate-x-1/2 border-b-[6px] border-b-[#070b14]/95 border-x-[5px] border-x-transparent border-t-0',
        };
      case 'top':
      default:
        return {
          containerClass: 'bottom-full left-1/2 -translate-x-1/2 mb-2.5',
          initial: { opacity: 0, y: 8, scale: 0.95 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: 6, scale: 0.95 },
          arrowClass: '-bottom-1.5 left-1/2 -translate-x-1/2 border-t-[6px] border-t-[#070b14]/95 border-x-[5px] border-x-transparent border-b-0',
        };
    }
  };

  const pos = getPositionStyles();

  return (
    <div
      className={`relative ${fullWidth ? 'w-full flex' : 'inline-flex'} items-center justify-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}

      <AnimatePresence>
        {isVisible && !disabled && (
          <motion.div
            role="tooltip"
            initial={pos.initial}
            animate={pos.animate}
            exit={pos.exit}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute ${pos.containerClass} z-[9999] pointer-events-none w-64 md:w-72 bg-[#070b14]/95 border border-[var(--cyan-primary)]/40 rounded-xl shadow-[0_16px_36px_rgba(0,0,0,0.85),0_0_16px_rgba(0,229,255,0.2)] backdrop-blur-xl p-3 text-left`}
          >
            {/* 삼각형 꼬리표 */}
            <div className={`absolute w-0 h-0 pointer-events-none ${pos.arrowClass}`} />

            {/* 헤더 행: 제목 & 파인만 배지 */}
            <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-white/10">
              <span className="text-[11px] font-bold font-mono text-[var(--gold-primary)] tracking-wide flex items-center gap-1 truncate">
                <Sparkles className="w-3 h-3 text-[var(--gold-primary)] shrink-0" />
                <span>{title}</span>
              </span>
              <span className="text-[8.5px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[var(--cyan-primary)]/15 border border-[var(--cyan-primary)]/30 text-[var(--cyan-primary)] shrink-0">
                {category}
              </span>
            </div>

            {/* 파인만 설명 본문 (쉬운 비유와 본질) */}
            <p className="text-[10.5px] leading-relaxed text-neutral-200 mt-2 font-sans tracking-tight">
              {explanation}
            </p>

            {/* 조작 안내 힌트 */}
            {actionHint && (
              <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center gap-1 text-[9.5px] font-mono text-[var(--cyan-primary)]/90">
                <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{actionHint}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
