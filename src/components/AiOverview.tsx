'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, RefreshCw, X, Activity, ArrowLeftRight, CircleDot } from 'lucide-react';
import { BLOCS, BLOC_ORDER, timeAgo, type AlertBrief, type AlertThread } from '@/lib/alert-digest';
import {
  normalizeBriefingSourceFields,
  briefingSourceBadgeStyle,
  type BriefingSource,
} from '@/lib/judgment-ui';

/**
 * 번개의 눈동자 (OSIRIS) — 원클릭 AI 전술 요약 브리핑
 * 피드와 경보 데이터를 실시간으로 수집 분석하여 요약 브리핑을 제공합니다.
 * 백엔드 /api/ai/overview를 호출하며 Gemini 클라우드 및 로컬 규칙 기반 분석관 폴백을 지원합니다.
 */

interface AiOverviewProps {
  mode: 'alerts' | 'markets';
  payload: unknown;
  accent?: string;
  /** Changes when the underlying feed changes, so a stale read-out can say so. */
  signature?: string;
  activeThreadId?: string | null;
  onThreadSelect?: (id: string | null) => void;
  onOpenChange?: (open: boolean) => void;
}

interface OverviewResult {
  overview: string;
  highlights: string[];
  generatedBy: 'gemini' | 'analyst';
  generatedAt: string;
  /** From overview API — gemini_cloud | local_ai */
  briefingSource?: BriefingSource;
  /** Legacy provider alias from API */
  provider?: 'gemini' | 'local_ai';
  brief?: AlertBrief;
}

const PERSPECTIVE: Record<AlertThread['perspective'], { label: string; color: string; title: string }> = {
  cross: { label: '양측 교차확인', color: '#00E676', title: '서방 및 친러시아/다양한 진영 채널 양쪽 모두에서 교차 확인된 보도' },
  single: { label: '단일 출처', color: '#FF9500', title: '단일 진영의 채널에서만 보도됨 (추가 검증 권장)' },
  mixed: { label: '복합 출처', color: '#8A8880', title: '여러 채널에서 보고되었으나 양 진영 교차 보도는 아님' },
};

function LeanBar({ blocs }: { blocs: AlertThread['blocs'] }) {
  const total = BLOC_ORDER.reduce((n, b) => n + (blocs[b] || 0), 0);
  if (!total) return null;
  return (
    <div className="flex h-1 w-full overflow-hidden rounded-full bg-white/5" aria-hidden="true">
      {BLOC_ORDER.map(b => blocs[b] ? (
        <div key={b} style={{ width: `${(blocs[b]! / total) * 100}%`, background: BLOCS[b].color }} />
      ) : null)}
    </div>
  );
}

function ThreadRow({ thread, active, accent, onSelect }: {
  thread: AlertThread; active: boolean; accent: string; onSelect?: (id: string | null) => void;
}) {
  const p = PERSPECTIVE[thread.perspective];
  const blocSummary = BLOC_ORDER.filter(b => thread.blocs[b]).map(b => `${BLOCS[b].label}: ${thread.blocs[b]}`).join(' · ');
  return (
    <button
      type="button"
      onClick={() => onSelect?.(active ? null : thread.id)}
      disabled={!onSelect}
      aria-pressed={active}
      className="w-full text-left rounded-md border px-2 py-1.5 transition-colors disabled:cursor-default"
      style={{
        borderColor: active ? `${accent}88` : 'rgba(255,255,255,0.06)',
        background: active ? `${accent}14` : 'rgba(255,255,255,0.02)',
      }}
      title={onSelect ? (active ? '전체 경보 보기' : '이 스레드만 필터링') : undefined}
    >
      <div className="flex items-center gap-1.5">
        <span className="flex-1 min-w-0 truncate text-[11px] font-semibold text-[var(--text-primary)]">{thread.label}</span>
        <span className="text-[8.5px] font-mono tracking-wider px-1 rounded" style={{ color: p.color, background: `${p.color}14` }} title={p.title}>
          {p.label}
        </span>
        <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: accent }}>{thread.count}</span>
      </div>
      <div className="mt-1" title={blocSummary}><LeanBar blocs={thread.blocs} /></div>
      <div className="mt-1 flex items-center gap-1.5 text-[9px] font-mono text-[var(--text-muted)]">
        <span className="truncate">{thread.sources.length}개 채널{thread.topics.length ? ` · ${thread.topics.join(' · ')}` : ''}</span>
        {thread.breaking > 0 && <span className="text-[#FF5A5A] flex-shrink-0">· {thread.breaking} 속보</span>}
        {thread.latest && <span className="ml-auto flex-shrink-0">{timeAgo(thread.latest)}</span>}
      </div>
      {thread.lead && (
        <div className="mt-1 text-[10px] leading-snug text-[var(--text-secondary)] line-clamp-2">
          {thread.lead.title} <span className="text-[var(--text-muted)]">— {thread.lead.source}</span>
        </div>
      )}
    </button>
  );
}

function AlertsBrief({ result, accent, activeThreadId, onThreadSelect }: {
  result: OverviewResult & { brief: AlertBrief }; accent: string;
  activeThreadId?: string | null; onThreadSelect?: (id: string | null) => void;
}) {
  const { brief } = result;
  const prose = result.generatedBy === 'gemini' ? result.overview : brief.bottomLine;
  const quake = brief.seismic?.strongest;
  return (
    <>
      <p className="font-sans text-[12px] leading-relaxed text-[var(--text-primary)] whitespace-pre-line">{prose}</p>

      {brief.threads.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 flex items-center gap-1 text-[8.5px] font-mono tracking-widest text-[var(--text-muted)]">
            <Activity className="w-2.5 h-2.5" /> 주요 이슈 스레드{onThreadSelect ? ' · 클릭하여 필터' : ''}
          </div>
          <div className="space-y-1">
            {brief.threads.map(t => (
              <ThreadRow key={t.id} thread={t} accent={accent} active={activeThreadId === t.id} onSelect={onThreadSelect} />
            ))}
          </div>
        </div>
      )}

      {quake && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5 text-[10px]">
          <CircleDot className="w-3 h-3 flex-shrink-0" style={{ color: quake.magnitude >= 6 ? '#FF3D3D' : quake.magnitude >= 5 ? '#FF9500' : '#FFD700' }} />
          <span className="flex-1 min-w-0 truncate text-[var(--text-secondary)]">
            최대 진도 지진 <b className="text-[var(--text-primary)]">M{quake.magnitude.toFixed(1)}</b> {quake.place}
          </span>
          {quake.tsunami && <span className="text-[8.5px] font-mono text-[#448AFF]">쓰나미 주의보</span>}
          <span className="font-mono text-[9px] text-[var(--text-muted)] flex-shrink-0">총 {brief.seismic!.count}건</span>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8.5px] font-mono text-[var(--text-muted)]">
        <span>{brief.coverage.reports}건 보고</span>
        <span>· {brief.coverage.channels}개 채널</span>
        {brief.coverage.corroborated > 0 && (
          <span className="inline-flex items-center gap-0.5"><ArrowLeftRight className="w-2 h-2" /> {brief.coverage.corroborated}건 교차 인용</span>
        )}
        {brief.coverage.newest && <span>· 최신 {timeAgo(brief.coverage.newest)} 전</span>}
      </div>
      <div className="mt-1 text-[8.5px] leading-snug text-[var(--text-muted)]">
        {result.generatedBy === 'gemini'
          ? 'Gemini 2.0 Flash AI 분석 엔진 분석 브리핑. 스레드 분류: '
          : '휴리스틱 전술 분석관 규칙 엔진. '}
        {brief.method}
      </div>
    </>
  );
}

export default function AiOverview({
  mode, payload, accent = '#7C4DFF', signature, activeThreadId, onThreadSelect, onOpenChange,
}: AiOverviewProps) {
  const [open, setOpenState] = useState(false);
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  }, [onOpenChange]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OverviewResult | null>(null);
  const [resultSignature, setResultSignature] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sig = signature;
    try {
      const res = await fetch('/api/ai/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, payload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
      setResultSignature(sig);
    } catch (e) {
      setError(e instanceof Error ? e.message : '전술 요약 생성 실패');
    } finally {
      setLoading(false);
    }
  }, [mode, payload, signature]);

  const handleClick = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next && !result && !loading) generate();
  }, [open, result, loading, generate, setOpen]);

  const stale = Boolean(result && signature && resultSignature && signature !== resultSignature);
  const brief = result?.brief;

  return (
    <div className="w-full">
      <button
        onClick={handleClick}
        aria-expanded={open}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono tracking-wider transition-all border hover:brightness-125"
        style={{
          color: accent,
          borderColor: `${accent}55`,
          background: `${accent}12`,
        }}
        title="수집된 전술 데이터와 인텔 피드를 AI 분석관이 실시간 종합 분석하여 요약합니다."
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        {loading ? '분석 중…' : open ? 'AI 요약 닫기' : '⚡ AI 전술 요약 브리핑'}
        {stale && !loading && (
          <span
            className="ml-1 w-1.5 h-1.5 rounded-full animate-osiris-pulse"
            style={{ background: accent }}
            title="마지막 요약 이후 새로운 피드가 수신되었습니다."
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 p-2.5 rounded-lg border text-[11px] leading-relaxed"
              style={{ borderColor: `${accent}33`, background: `${accent}08` }}
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono tracking-widest text-[9px]" style={{ color: accent }}>
                    {result ? `⚡ ${result.generatedBy === 'gemini' ? 'AI 군사지능 분석관' : '번개 눈동자 분석관'}` : '⚡ 번개 눈동자 AI 분석관'}
                    {result && <span className="text-[var(--text-muted)]"> · {timeAgo(result.generatedAt).toUpperCase()}</span>}
                  </span>
                  {result && (() => {
                    const src = normalizeBriefingSourceFields(result);
                    if (!src.show || !src.badgeLabel) return null;
                    const st = briefingSourceBadgeStyle(src.amber);
                    return (
                      <span
                        className="font-mono font-bold shrink-0"
                        style={{
                          color: st.color,
                          background: st.background,
                          border: st.border,
                          padding: '1px 4px',
                          borderRadius: '2px',
                          fontSize: '8px',
                        }}
                      >
                        {src.badgeLabel}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={generate} disabled={loading} className="hover:opacity-70 transition-opacity" title="새로고침" aria-label="요약 새로고침">
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} style={{ color: accent }} />
                  </button>
                  <button onClick={() => setOpen(false)} className="hover:opacity-70 transition-opacity" title="닫기" aria-label="요약 닫기">
                    <X className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>
                </div>
              </div>

              {stale && !loading && (
                <button
                  onClick={generate}
                  className="mb-2 w-full rounded border px-2 py-1 text-left text-[9.5px] font-mono tracking-wide transition-colors hover:bg-white/5"
                  style={{ borderColor: `${accent}44`, color: accent }}
                  title="새로운 피드가 수신되었습니다. 클릭하여 최신 분석으로 갱신합니다."
                >
                  ⚡ 새로운 인텔 피드 감지됨 — 클릭하여 최신 브리핑 재분석
                </button>
              )}

              {loading && !result && (
                <div className="flex items-center gap-2 py-2 text-[var(--text-muted)]">
                  <Loader2 className="w-3 h-3 animate-spin" /> 전술 인텔 피드 분석 중…
                </div>
              )}

              {error && <div className="text-[var(--alert-red)] py-1">⚠ {error}</div>}

              {result && brief && (
                <AlertsBrief
                  result={{ ...result, brief }}
                  accent={accent}
                  activeThreadId={activeThreadId}
                  onThreadSelect={onThreadSelect}
                />
              )}

              {result && !brief && (
                <>
                  <div className="text-[var(--text-primary)] whitespace-pre-line">{result.overview}</div>

                  {result.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {result.highlights.map((h, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                          style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }}
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 text-[9px] font-mono text-[var(--text-muted)] tracking-wide">
                    {result.generatedBy === 'gemini' ? 'GEMINI 2.0 FLASH AI' : '휴리스틱 전술 분석관'} ·{' '}
                    {new Date(result.generatedAt).toLocaleTimeString()}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
