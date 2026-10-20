'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, ExternalLink, X, Loader2, ShieldCheck } from 'lucide-react';
import {
  DONBOT_ORIGIN, DONBOT_ANALYZER, DONBOT_CHAINS, DONBOT_SANDBOX,
  cleanQuery, donbotFrameUrl, parseDonbotMessage, type DonbotResult,
} from '@/lib/donbot';

/**
 * DonBot, in Markets → Crypto and in RECON: DigitalDon's token analyzer,
 * embedded without its script. See lib/donbot for what crosses the boundary and why.
 */

const ACCENT = '#F7931A';
const INITIAL_HEIGHT = 420;

export default function DonBotScan({ initial = null, onScan }: {
  /** A scan to open on — how a host that remounts this keeps the token it was showing. */
  initial?: string | null;
  /** Told of every scan run and every close, so a host can hand it back as `initial`. */
  onScan?: (query: string | null) => void;
} = {}) {
  const [input, setInput] = useState(initial ?? '');
  /** What the frame is showing; null means no frame at all. */
  const [query, setQuery] = useState<string | null>(initial);
  const [height, setHeight] = useState(INITIAL_HEIGHT);
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<DonbotResult | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!query) return;
    const onMessage = (event: MessageEvent) => {
      // Their origin, and our own frame — not some other page's.
      if (event.origin !== DONBOT_ORIGIN || event.source !== frame.current?.contentWindow) return;
      const message = parseDonbotMessage(event.data);
      if (!message) return;
      if (message.type === 'resize') setHeight(message.height);
      else setResult(message);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [query]);

  const scan = () => {
    const q = cleanQuery(input);
    if (!q) return;
    setResult(null);
    setLoaded(false);
    setHeight(INITIAL_HEIGHT);
    setQuery(q);
    onScan?.(q);
  };

  const close = () => {
    setQuery(null);
    setResult(null);
    onScan?.(null);
  };

  return (
    <div className="space-y-2">
      <form onSubmit={e => { e.preventDefault(); scan(); }} className="flex gap-1.5">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)]" />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="티커 심볼, 코인명 또는 계약 주소 입력"
            aria-label="분석할 토큰"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg pl-7 pr-2 py-2 text-[10px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none"
            style={{ borderColor: input ? `${ACCENT}55` : undefined }}
          />
        </div>
        <button
          type="submit"
          disabled={!cleanQuery(input)}
          className="px-3 rounded-lg text-[9px] font-mono font-bold tracking-wider disabled:opacity-30 transition-colors"
          style={{ background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, color: ACCENT }}
        >
          정밀 분석
        </button>
      </form>

      <div className="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
        지원 체인: {DONBOT_CHAINS.join(' · ')}
      </div>

      {!query && (
        <div className="p-2.5 rounded-lg border border-[var(--border-primary)] bg-white/[0.02] space-y-1.5">
          <div className="text-[10px] font-mono text-[var(--text-secondary)] leading-relaxed">
            100점 만점 시그널 스코어, 진입/청산 구역 분석, 토큰 홀더 클러스터 맵(탑 지갑, 자금 연계 지갑, 스나이퍼 및 신규 지갑 감지)을 제공합니다.
          </div>
          <div className="flex items-start gap-1.5 text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
            <ShieldCheck className="w-3 h-3 mt-px shrink-0" style={{ color: ACCENT }} />
            <span>
              분석 실행 전까지 어떠한 외부 스크립트도 로드되지 않으며, 독립된 격리 샌드박스 프레임 내부에서 안전하게 실행됩니다.
            </span>
          </div>
        </div>
      )}

      {query && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-[10px] font-mono truncate">
              {result ? (
                <span title={result.thesis}>
                  <span className="font-bold" style={{ color: ACCENT }}>${result.symbol}</span>
                  <span className="text-[var(--text-muted)]"> · 시그널 </span>
                  <span className="font-bold text-[var(--text-primary)]">{result.score}/100</span>
                  {result.thesis && <span className="text-[var(--text-secondary)]"> · {result.thesis}</span>}
                </span>
              ) : (
                <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                  {!loaded && <Loader2 className="w-3 h-3 animate-spin" />}
                  {loaded ? `“${query}” 온체인 데이터 분석 중…` : 'DonBot 엔진 로딩 중…'}
                </span>
              )}
            </div>
            <button onClick={close} title="DonBot 닫기" aria-label="DonBot 닫기" className="p-1 rounded text-[var(--text-muted)] hover:text-white hover:bg-white/10 shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>

          <iframe
            key={query}
            ref={frame}
            src={donbotFrameUrl(query)}
            title="DonBot 온체인 토큰 분석"
            sandbox={DONBOT_SANDBOX}
            referrerPolicy="no-referrer"
            allow="fullscreen"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            className="block w-full border-0 rounded-lg bg-transparent"
            style={{ height }}
          />

          <div className="flex items-center justify-between text-[9px] font-mono text-[var(--text-muted)]">
            <span>{result ? '본 분석 결과는 투자 권유가 아닙니다.' : ' '}</span>
            <a href={DONBOT_ANALYZER} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[var(--text-secondary)]">
              DigitalDon 제공 <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
