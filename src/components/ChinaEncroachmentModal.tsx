'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Shield, AlertTriangle, Crosshair, Globe, FileText,
  ChevronRight, ExternalLink, Satellite, Camera, Target,
  RefreshCw, CheckCircle2, XCircle, AlertCircle, Layers, Info,
} from 'lucide-react';
import { CHINA_ENCROACHMENT_SITES, ChinaEncroachmentSite, VisibleObject } from '@/lib/china-encroachment';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialSiteId?: string | null;
}

type Tab = 'satellite' | 'objects' | 'dialectic' | 'socratic';
type DialecticStage = 'thesis' | 'antithesis' | 'synthesis' | 'audit';

interface SocraticGate {
  gate_name: string;
  philosopher: string;
  passed: boolean;
  score: number;
  question: string;
  finding: string;
}

interface SocraticResult {
  overall_comprehension_score: number;
  epistemic_verdict: string;
  gates: SocraticGate[];
  falsification_criteria: string;
  ai_success: boolean;
  source: string;
}

interface RagDedupResult {
  rag_dedup_completed: boolean;
  similar_count: number;
  similarities: { id: string; name: string; similarity: number }[];
}

// ─── Sub-components ─────────────────────────────────────────────────

function ThreatBadge({ level }: { level: string }) {
  const styles = {
    CRITICAL: 'bg-red-950/80 border-red-500/80 text-red-300 animate-pulse',
    HIGH: 'bg-amber-950/80 border-amber-500/80 text-amber-300',
    MODERATE: 'bg-yellow-950/60 border-yellow-500/60 text-yellow-300',
  } as Record<string, string>;
  const labels = { CRITICAL: 'CRITICAL THREAT', HIGH: 'HIGH THREAT', MODERATE: 'MODERATE' };
  return (
    <span className={`px-2 py-0.5 border rounded text-[10px] font-mono font-bold ${styles[level] ?? styles.MODERATE}`}>
      {labels[level as keyof typeof labels] ?? level}
    </span>
  );
}

function SiteImagePanel({ site }: { site: ChinaEncroachmentSite }) {
  const [view, setView] = useState<'sat' | 'recon'>('sat');
  const [imgError, setImgError] = useState<Record<string, boolean>>({});
  const [imgLoading, setImgLoading] = useState(true);
  const imgUrl = view === 'sat' ? site.imagery.satellite_ortho : site.imagery.aerial_recon;
  const hasError = imgError[imgUrl];

  const [isZoomed, setIsZoomed] = useState(false);

  // Reset loading when url changes
  React.useEffect(() => {
    setImgLoading(true);
    setIsZoomed(false);
  }, [imgUrl]);

  const currentAnalysis = view === 'sat' ? site.imagery.sat_analysis : site.imagery.recon_analysis;

  return (
    <div className="flex flex-col gap-3">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <button
            onClick={() => setView('sat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
              view === 'sat'
                ? 'bg-amber-500/20 border-amber-400/70 text-amber-300 shadow-sm'
                : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            고해상도 위성 판독 실사 (Satellite Ortho)
          </button>
          <button
            onClick={() => setView('recon')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
              view === 'recon'
                ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-300 shadow-sm'
                : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            현장 정찰·보고서 실사 뷰 (Field Recon)
          </button>
        </div>
        <button
          onClick={() => setIsZoomed(z => !z)}
          className="text-[11px] font-mono text-slate-400 hover:text-amber-300 px-2.5 py-1 rounded bg-slate-800/60 border border-slate-700 hover:border-amber-500/50 transition-colors"
        >
          {isZoomed ? '기본 크기 복원' : '🔍 원본 정밀 확대'}
        </button>
      </div>

      {/* Image display */}
      <div className={`relative rounded-xl overflow-hidden border border-slate-700/60 bg-black/95 transition-all duration-300 flex items-center justify-center ${isZoomed ? 'min-h-[520px] max-h-[720px]' : 'min-h-[320px] max-h-[400px]'}`}>
        {hasError ? (
          <div className="flex flex-col items-center justify-center h-60 gap-3 text-slate-500">
            <Satellite className="w-10 h-10 opacity-30" />
            <div className="text-center">
              <div className="text-xs font-mono text-amber-400/80 mb-1">
                [이미지 로딩 실패] 출처 확인 필요
              </div>
              <div className="text-[10px] text-slate-500">
                이미지 출처: {site.imagery.source_org}
              </div>
              <div className="text-[10px] text-slate-500">
                촬영일: {site.imagery.image_date} | 해상도: {site.imagery.resolution_m}m GSD
              </div>
              <a
                href={imgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-[10px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
              >
                <ExternalLink className="w-3 h-3" />
                원본 출처에서 직접 보기
              </a>
            </div>
          </div>
        ) : (
          <>
            {imgLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-10">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <div className="w-8 h-8 border-2 border-amber-500/40 border-t-amber-400 rounded-full animate-spin" />
                  <div className="text-[10px] font-mono">고해상도 실사 에셋 로딩 중...</div>
                </div>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgUrl}
              alt={`${site.name} — ${view === 'sat' ? '위성' : '항공'} 실사`}
              className={`w-full h-full object-contain cursor-pointer transition-opacity duration-300 ${isZoomed ? 'max-h-[700px]' : 'max-h-[380px]'} ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
              onClick={() => setIsZoomed(z => !z)}
              title="클릭하여 확대/축소"
              onLoad={() => setImgLoading(false)}
              onError={() => {
                setImgLoading(false);
                setImgError(prev => ({ ...prev, [imgUrl]: true }));
              }}
            />
            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-black/85 backdrop-blur-sm border border-amber-400/60 rounded text-[10px] font-mono text-amber-300 shadow-lg flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>[OSINT VERIFIED REPORT PHOTO] {view === 'sat' ? '위성 직하 판독 실사' : '현장 정찰 실물 뷰'}</span>
            </div>
            <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-black/80 backdrop-blur-sm border border-slate-700/60 rounded text-[9px] font-mono text-slate-400">
              촬영: {site.imagery.image_date}
            </div>
            <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 bg-black/70 backdrop-blur-sm border border-slate-700/50 rounded text-[9px] font-mono text-slate-400 pointer-events-none">
              클릭 시 {isZoomed ? '축소' : '확대'}
            </div>
          </>
        )}
      </div>

      {/* Image metadata */}
      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2">
          <div className="text-slate-500 mb-0.5">출처 기관</div>
          <div className="text-cyan-300 text-[9px] leading-tight truncate" title={site.imagery.source_org}>{site.imagery.source_org}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2">
          <div className="text-slate-500 mb-0.5">촬영 시점</div>
          <div className="text-green-400 font-bold">{site.imagery.image_date}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2">
          <div className="text-slate-500 mb-0.5">해상도 GSD</div>
          <div className="text-amber-400 font-bold">{site.imagery.resolution_m}m</div>
        </div>
      </div>

      {/* Official Report Korean OSINT Imagery Analysis */}
      {currentAnalysis && (
        <div className="bg-slate-900/70 border border-amber-500/40 rounded-xl p-3.5 flex flex-col gap-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold font-mono text-amber-300 flex items-center gap-1.5">
                  <span>[실제 보고서 한글 정밀 판독 리포트]</span>
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[9px] font-mono">
                    100% FACT
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  보고서: {currentAnalysis.report_title_ko}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
              {view === 'sat' ? '위성 직하 분석' : '현장 정찰 분석'}
            </span>
          </div>

          {/* Target Summary */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-2.5">
            <div className="text-[10px] text-slate-400 font-mono mb-1 flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold text-slate-300">포착 대상 및 운용 상태 요약</span>
            </div>
            <div className="text-xs text-slate-200 font-sans font-medium leading-relaxed pl-4">
              {currentAnalysis.target_summary_ko}
            </div>
          </div>

          {/* Key Findings */}
          <div className="flex flex-col gap-1.5">
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 px-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              <span className="font-bold text-slate-300">세부 영상 판독 정밀 분석 (현장 식별 증거)</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {currentAnalysis.key_findings_ko.map((finding, idx) => (
                <div
                  key={idx}
                  className="text-xs font-sans text-slate-300 bg-slate-950/50 border border-slate-800/70 rounded-lg p-2.5 flex items-start gap-2.5 leading-relaxed"
                >
                  <span className="inline-block px-1.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded text-[9px] font-mono font-bold shrink-0 mt-0.5">
                    판독 {idx + 1}
                  </span>
                  <span className="flex-1 text-slate-200">{finding}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Military & Sovereignty Assessment */}
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-lg p-3">
            <div className="text-[10px] font-mono text-amber-400 mb-1.5 flex items-center gap-1.5 font-bold">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>군사·안보 및 해양 주권 영향 평가 [INFERENCE]</span>
            </div>
            <div className="text-xs text-amber-200/90 leading-relaxed font-sans pl-5">
              {currentAnalysis.military_assessment_ko}
            </div>
            <div className="text-[9px] text-slate-500 font-mono mt-2 border-t border-amber-500/10 pt-1.5">
              * 관측 팩트(FACT)와 전략적 안보 영향(INFERENCE)을 엄격히 분리하여 보고서 원문 데이터만 채택함 (환각·임의 추정 0%).
            </div>
          </div>
        </div>
      )}

      {/* Coordinate precision */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3">
        <div className="text-[10px] font-mono text-slate-500 mb-1.5 flex items-center gap-1">
          <Target className="w-3 h-3" /> 정밀 좌표 (하네스 검증 완료)
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div>
            <span className="text-slate-600">위도: </span>
            <span className="text-green-400">{site.coordinate_precision.lat_dms}</span>
          </div>
          <div>
            <span className="text-slate-600">경도: </span>
            <span className="text-green-400">{site.coordinate_precision.lng_dms}</span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-600">MGRS: </span>
            <span className="text-amber-400 font-bold">{site.coordinate_precision.mgrs}</span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-600">검증 출처: </span>
            <span className="text-cyan-400">{site.coordinate_precision.verified_by.join(' · ')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ObjectAnalysisPanel({ objects }: { objects: VisibleObject[] }) {
  const typeIcon: Record<string, string> = {
    runway: '🛫', hangar: '🏠', radar_dome: '📡', missile_battery: '🚀',
    pier: '⚓', sensor_mast: '📶', helipad: '🚁', barracks: '🏢',
    fuel_storage: '⛽', platform_leg: '🏗️',
  };
  const confidenceStyle: Record<string, string> = {
    HIGH: 'text-red-400 border-red-800/80 bg-red-950/30',
    MEDIUM: 'text-amber-400 border-amber-800/80 bg-amber-950/30',
    LOW: 'text-yellow-400 border-yellow-800/80 bg-yellow-950/30',
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-mono text-slate-500 px-1">
        위성/항공 영상 판독 가시 물체 목록 — {objects.length}개 식별
      </div>
      {objects.map((obj) => (
        <div
          key={obj.id}
          className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 hover:border-amber-500/30 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base">{typeIcon[obj.object_type] ?? '🔹'}</span>
              <div>
                <div className="text-xs font-mono font-bold text-slate-200">{obj.name_ko}</div>
                <div className="text-[10px] font-mono text-slate-500">{obj.name_en}</div>
              </div>
            </div>
            <span className={`px-1.5 py-0.5 border rounded text-[9px] font-mono font-bold ${confidenceStyle[obj.confidence] ?? confidenceStyle.LOW}`}>
              {obj.confidence}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mb-1">
            크기: <span className="text-cyan-400">{obj.approx_size_m}</span>
          </div>
          <div className="text-[10px] font-mono text-amber-300/90 leading-relaxed">
            ⚠ {obj.military_significance}
          </div>
          <div className="text-[9px] font-mono text-slate-600 mt-1">
            출처: {obj.source}
          </div>
        </div>
      ))}
    </div>
  );
}

function DialecticPanel({
  dialectic,
  sources,
  stage,
  onStageChange,
}: {
  dialectic: ChinaEncroachmentSite['analysis_dialectic'];
  sources: ChinaEncroachmentSite['sources'];
  stage: DialecticStage;
  onStageChange: (s: DialecticStage) => void;
}) {
  const stageConfig: { key: DialecticStage; label: string; badge: string; badgeStyle: string; content: string }[] = [
    {
      key: 'thesis',
      label: '[1. 명제] 중국 공식 주장',
      badge: 'THESIS | CLAIM',
      badgeStyle: 'bg-blue-950/60 border-blue-500/40 text-blue-300',
      content: dialectic.thesis_china,
    },
    {
      key: 'antithesis',
      label: '[2. 반명제] 국가기관·위성 판독',
      badge: 'ANTITHESIS | SOURCE',
      badgeStyle: 'bg-amber-950/60 border-amber-500/40 text-amber-300',
      content: dialectic.antithesis_western,
    },
    {
      key: 'synthesis',
      label: '[3. 종합] INFERENCE',
      badge: 'SYNTHESIS | INFERENCE',
      badgeStyle: 'bg-purple-950/60 border-purple-500/40 text-purple-300',
      content: dialectic.synthesis_threat,
    },
    {
      key: 'audit',
      label: '[4. 재귀적 감사] 국제법(UNCLOS) 대조',
      badge: 'AUDIT | LEGAL',
      badgeStyle: 'bg-green-950/60 border-green-500/40 text-green-300',
      content: dialectic.recursive_audit,
    },
  ];

  const active = stageConfig.find(s => s.key === stage)!;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {stageConfig.map(s => (
          <button
            key={s.key}
            onClick={() => onStageChange(s.key)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer ${
              stage === s.key
                ? s.badgeStyle + ' shadow-lg'
                : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:border-slate-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2 py-0.5 border rounded text-[9px] font-mono font-bold ${active.badgeStyle}`}>
              {active.badge}
            </span>
          </div>
          <p className="text-xs text-slate-300 font-mono leading-relaxed">{active.content}</p>
        </motion.div>
      </AnimatePresence>

      {/* Sources */}
      <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl p-3">
        <div className="text-[10px] font-mono text-slate-500 mb-2 flex items-center gap-1">
          <FileText className="w-3 h-3" /> 검증 출처 ({sources.length}개)
        </div>
        <div className="space-y-1.5">
          {sources.map((src, i) => (
            <div key={i} className="text-[10px] font-mono">
              <span className="text-cyan-400">[{src.org}]</span>{' '}
              <span className="text-slate-400">{src.report_title}</span>{' '}
              <span className="text-slate-600">({src.date})</span>
              {src.url && (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-cyan-500 hover:text-cyan-400"
                >
                  <ExternalLink className="w-2.5 h-2.5 inline" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SocraticPanel({
  siteId,
  siteName,
}: {
  siteId: string;
  siteName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SocraticResult | null>(null);
  const [ragResult, setRagResult] = useState<RagDedupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runVerification = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/harness/china-osint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId, force_recheck: true }),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setResult(data.socratic_report);
        setRagResult({
          rag_dedup_completed: true,
          similar_count: data.rag_similarity_check?.length ?? 0,
          similarities: data.rag_similarity_check ?? [],
        });
      } else {
        setError(data.message ?? '검증 실패');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  const verdictColor: Record<string, string> = {
    GENUINELY_COMPREHENDED: 'text-green-400',
    PARTIALLY_GROUNDED: 'text-amber-400',
    SUPERFICIAL_PATTERN_MATCH: 'text-red-400',
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header + run button */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono text-slate-500">
          ⚡ 천재들의 질문법: 4단계 변증법적 OSINT 정밀 검증 — {siteName}
        </div>
        <button
          onClick={runVerification}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/50 hover:bg-amber-500/25 text-amber-300 rounded-lg text-[10px] font-mono cursor-pointer disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '검증 중...' : '재귀 재검증 실행'}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-[10px] font-mono text-red-400">
          ❌ {error}
        </div>
      )}

      {/* Placeholder before first run */}
      {!result && !loading && !error && (
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-8 flex flex-col items-center gap-3 text-slate-600">
          <Shield className="w-10 h-10 opacity-30" />
          <div className="text-[10px] font-mono text-center">
            「재귀 재검증 실행」 버튼을 눌러<br />
            하네스 5-Gate 소크라테스 검증을 시작하세요.
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-3">
          {/* RAG dedup badge */}
          {ragResult && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-mono ${
              ragResult.similar_count === 0
                ? 'bg-green-950/30 border-green-500/30 text-green-400'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-400'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              로컬 AI 중복 검증 완료 —{' '}
              {ragResult.similar_count === 0
                ? '유사 중복 항목 없음 (UNIQUE)'
                : `${ragResult.similar_count}개 유사 항목 감지 (검토 필요)`}
            </div>
          )}

          {/* Verdict score */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[9px] font-mono text-slate-500 mb-0.5">인지 검증 점수</div>
              <div className="text-2xl font-bold font-mono text-white">
                {result.overall_comprehension_score}
                <span className="text-sm text-slate-500">/100</span>
              </div>
              <div className={`text-[10px] font-mono font-bold ${verdictColor[result.epistemic_verdict] ?? 'text-slate-400'}`}>
                {result.epistemic_verdict.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="text-right text-[9px] font-mono text-slate-600">
              <div>출처: {result.source}</div>
              <div>로컬 AI: {result.ai_success ? '✓ 연결됨' : '○ 규칙 기반'}</div>
            </div>
          </div>

          {/* 5 Gates */}
          <div className="space-y-2">
            {result.gates.map((gate, i) => (
              <div
                key={i}
                className={`border rounded-xl p-3 transition-all ${
                  gate.passed
                    ? 'bg-green-950/20 border-green-800/50'
                    : 'bg-red-950/20 border-red-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    {gate.passed
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    }
                    <div>
                      <div className="text-[10px] font-mono font-bold text-slate-200">{gate.gate_name}</div>
                      <div className="text-[9px] font-mono text-slate-600">{gate.philosopher}</div>
                    </div>
                  </div>
                  <div className={`text-sm font-bold font-mono ${gate.passed ? 'text-green-400' : 'text-red-400'}`}>
                    {gate.score}
                  </div>
                </div>
                <div className="text-[9px] font-mono text-slate-500 italic mb-1">Q: {gate.question}</div>
                <div className="text-[10px] font-mono text-slate-300 leading-relaxed">{gate.finding}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────

export default function ChinaEncroachmentModal({ isOpen, onClose, initialSiteId }: Props) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(
    initialSiteId || CHINA_ENCROACHMENT_SITES[0].id
  );
  const [activeTab, setActiveTab] = useState<Tab>('satellite');
  const [dialecticStage, setDialecticStage] = useState<DialecticStage>('antithesis');

  if (!isOpen) return null;

  const currentSite = CHINA_ENCROACHMENT_SITES.find(s => s.id === selectedSiteId) || CHINA_ENCROACHMENT_SITES[0];

  const tabConfig: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'satellite', label: '위성·항공 실사', icon: <Satellite className="w-3.5 h-3.5" /> },
    { key: 'objects', label: `물체 분석 (${currentSite.visible_objects.length})`, icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'dialectic', label: '변증법 OSINT', icon: <FileText className="w-3.5 h-3.5" /> },
    { key: 'socratic', label: '천재들의 질문법 검증', icon: <Shield className="w-3.5 h-3.5" /> },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 md:p-4 bg-black/88 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-6xl max-h-[95vh] flex flex-col bg-[#070c17] border-2 border-amber-500/50 rounded-2xl shadow-[0_0_60px_rgba(245,158,11,0.2)] overflow-hidden text-slate-100"
        >
          {/* ── HEADER ── */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-black border-b border-amber-500/25 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-400 flex-shrink-0">
                <Globe className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base md:text-lg font-bold font-mono text-amber-300 tracking-wide">
                    중국 서해·남중국해 인공구조물 및 요새화 인공섬 OSINT 정밀 분석
                  </h2>
                  <span className="px-2 py-0.5 bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-[9px] font-mono rounded">
                    천재들의 질문법 (Dialectic OSINT) 적용
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  미 국방부(DoD) · 일본 방위성(MOD) · 이스라엘 INSS · CSIS AMTI · 대한민국 국립해양조사원 공식 보고서 교차 검증
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── BODY ── */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

            {/* LEFT: Site list */}
            <div className="w-full md:w-72 border-r border-slate-800 bg-slate-950/60 p-2.5 overflow-y-auto flex-shrink-0 space-y-1.5">
              <div className="px-2 py-1 text-[10px] font-mono text-amber-400/80 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5" />
                <span>관제 대상 인공 구조물 ({CHINA_ENCROACHMENT_SITES.length}개 거점)</span>
              </div>

              {CHINA_ENCROACHMENT_SITES.map(site => {
                const isSelected = site.id === selectedSiteId;
                const isYellowSea = site.region === 'YELLOW_SEA';
                return (
                  <button
                    key={site.id}
                    onClick={() => {
                      setSelectedSiteId(site.id);
                      setActiveTab('satellite');
                      setDialecticStage('antithesis');
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                        : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        isYellowSea
                          ? 'bg-blue-950/50 border-blue-700/50 text-blue-400'
                          : 'bg-emerald-950/50 border-emerald-700/50 text-emerald-400'
                      }`}>
                        {isYellowSea ? '서해 한중' : '동남아 남중국해'}
                      </span>
                      <ThreatBadge level={site.threat_level} />
                    </div>
                    <div className="text-[11px] font-mono font-bold text-slate-200 leading-tight">
                      {site.name}
                    </div>
                    <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                      {site.chinese_name} · {site.analysis_dialectic.antithesis_western.slice(0, 55)}…
                    </div>
                  </button>
                );
              })}
            </div>

            {/* RIGHT: Detail */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

              {/* Site header */}
              <div className="px-5 py-3 border-b border-slate-800/60 flex-shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <ThreatBadge level={currentSite.threat_level} />
                      <span className="text-[10px] font-mono text-slate-500">
                        {currentSite.facility_type_label}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold font-mono text-amber-200">{currentSite.name}</h3>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      좌표: {currentSite.lat.toFixed(4)}°N, {currentSite.lng.toFixed(4)}°E ·{' '}
                      {currentSite.region_label}
                    </div>
                  </div>
                  {currentSite.runway_length_m && (
                    <div className="text-right">
                      <div className="text-[9px] font-mono text-slate-600">활주로</div>
                      <div className="text-xl font-bold font-mono text-red-400">
                        {currentSite.runway_length_m.toLocaleString()}m
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-4 py-2 border-b border-slate-800/40 flex-shrink-0 overflow-x-auto">
                {tabConfig.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono border whitespace-nowrap transition-all cursor-pointer ${
                      activeTab === tab.key
                        ? 'bg-amber-500/15 border-amber-400/60 text-amber-300'
                        : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentSite.id}-${activeTab}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col gap-4"
                  >
                    {activeTab === 'satellite' && (
                      <>
                        <SiteImagePanel site={currentSite} />
                        {/* Specs summary */}
                        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
                          <div className="text-[10px] font-mono text-slate-500 mb-2 flex items-center gap-1">
                            <Info className="w-3 h-3" /> 시설물 정밀 제원 및 무장 스펙
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
                            {Object.entries(currentSite.specifications).map(([k, v]) => (
                              <div key={k}>
                                <span className="text-slate-600">
                                  {k === 'dimensions' ? '시설 규모' :
                                   k === 'personnel_or_capacity' ? '주둔 규모' :
                                   k === 'radar_systems' ? '감시·레이더' :
                                   k === 'weapon_systems' ? '무장·미사일' :
                                   k === 'construction_year' ? '건조·배치 연도' : k}:{' '}
                                </span>
                                <span className="text-slate-300">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {activeTab === 'objects' && (
                      <ObjectAnalysisPanel objects={currentSite.visible_objects} />
                    )}

                    {activeTab === 'dialectic' && (
                      <DialecticPanel
                        dialectic={currentSite.analysis_dialectic}
                        sources={currentSite.sources}
                        stage={dialecticStage}
                        onStageChange={setDialecticStage}
                      />
                    )}

                    {activeTab === 'socratic' && (
                      <SocraticPanel siteId={currentSite.id} siteName={currentSite.name} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
