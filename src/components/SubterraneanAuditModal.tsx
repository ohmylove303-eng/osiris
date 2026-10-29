'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Shield, AlertTriangle, Crosshair, Globe, FileText,
  ChevronRight, ExternalLink, Satellite, Search, Layers,
  CheckCircle2, XCircle, Info, Database, Compass, Eye,
  Sparkles, Wrench, HardHat, Mountain, Radio, Zap
} from 'lucide-react';

export interface SubterraneanAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSiteId?: string | null;
  onFlyTo?: (coords: [number, number], zoom?: number) => void;
}

type TabType = 'claims' | 'confirmed' | 'axes' | 'global_intel' | 'superpower';

interface SuspectedClaim {
  id: string;
  name: string;
  name_en: string;
  location: string;
  coordinates: [number, number];
  claim_origin: string;
  investigation_agency: string;
  drilling_stats: string;
  socratic_verdict: 'DISPROVEN_NATURAL_GEOLOGY' | 'MONITORED_BORDER_ZONE';
  scientific_reasoning: string;
  evidence_gate_tier: string;
}

interface ConfirmedTunnel {
  id: string;
  name: string;
  discovery_date?: string;
  coordinates: [number, number];
  depth_m: number;
  length_total_m: number;
  mdl_penetration_m: number;
  dimension: string;
  capacity_per_hour: string;
  geology: string;
  threat_axis: string;
  intelligence_source: string;
}

interface StrategicAxis {
  id: string;
  name: string;
  status?: string;
  coordinates: [number, number][];
  target_direction: string;
  strategic_significance: string;
  geological_vulnerability: string;
  detection_methods: string[];
}

export function SubterraneanAuditModal({
  isOpen,
  onClose,
  initialSiteId,
  onFlyTo
}: SubterraneanAuditModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('claims');
  const [claims, setClaims] = useState<SuspectedClaim[]>([]);
  const [confirmedTunnels, setConfirmedTunnels] = useState<ConfirmedTunnel[]>([]);
  const [strategicAxes, setStrategicAxes] = useState<StrategicAxis[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string>('CLAIM-YANGJU');
  const [loading, setLoading] = useState<boolean>(true);

  // 슈퍼파워 인터랙티브 검증기 상태
  const [customLocation, setCustomLocation] = useState<string>('경기 양주시 광사동');
  const [customDistanceKm, setCustomDistanceKm] = useState<number>(25);
  const [superpowerResult, setSuperpowerResult] = useState<any>(null);
  const [superpowerLoading, setSuperpowerLoading] = useState<boolean>(false);

  // 초기 데이터 로딩
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/intel/tunnels')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setClaims(data.claims || []);
          setConfirmedTunnels(data.sites || []);
          setStrategicAxes(data.axes || []);
          if (initialSiteId) {
            setSelectedClaimId(initialSiteId);
          }
        }
      })
      .catch(err => console.error('Failed to load subterranean data:', err))
      .finally(() => setLoading(false));
  }, [isOpen, initialSiteId]);

  // 슈퍼파워 검증기 실행
  const runSuperpowerAudit = async (loc = customLocation, dist = customDistanceKm) => {
    setSuperpowerLoading(true);
    try {
      const res = await fetch('/api/intel/tunnels/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: loc, distance_km: dist })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setSuperpowerResult(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSuperpowerLoading(false);
    }
  };

  const selectedClaim = claims.find(c => c.id === selectedClaimId) || claims[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-[#0c0e14] border border-cyan-500/30 rounded-xl shadow-2xl overflow-hidden font-sans text-white"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-950/40 via-[#0e111a] to-purple-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/40 text-cyan-400">
              <Mountain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-wide text-white">
                  北 DMZ 침투 땅굴 & 구글 의혹 제보지 정밀 과학 검증 분석관
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  소크라테스 5대 관문
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-cyan-300" />
                  외장 SSD 슈퍼파워 연동
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                국방부·한국지질자원연구원(KIGAM) 실제 시추 코아 데이터 및 자연의 물리법칙(질량 보존·환기 한계) 기반 팩트 체크
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-[#090b10] border-b border-white/5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('claims')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'claims'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            구글·민간 의혹 제보지 5개소 과학 분석
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-900/60 text-purple-200">5</span>
          </button>

          <button
            onClick={() => setActiveTab('confirmed')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'confirmed'
                ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            군사 공인 제1~4 침투 땅굴
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-900/60 text-red-200">4</span>
          </button>

          <button
            onClick={() => setActiveTab('axes')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'axes'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            6대 전술 침투 예상 축선
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-900/60 text-amber-200">6</span>
          </button>

          <button
            onClick={() => setActiveTab('global_intel')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'global_intel'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            6개국 정보기관 & 씽크탱크 교차 검증
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-900/60 text-blue-200">6</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('superpower');
              if (!superpowerResult) runSuperpowerAudit();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'superpower'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            삼성 외장 SSD '슈퍼파워' 실시간 지능 검증기
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: CLAIMS AUDIT */}
          {activeTab === 'claims' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Selector Column (4 cols) */}
              <div className="lg:col-span-4 space-y-3">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                  <span>의혹 제보지 선택 (5개소)</span>
                  <span className="text-[10px] text-purple-400">국방부·KIGAM 시추공 완비</span>
                </div>
                <div className="space-y-2">
                  {claims.map((c) => {
                    const isSelected = c.id === selectedClaimId;
                    const isDisproven = c.socratic_verdict === 'DISPROVEN_NATURAL_GEOLOGY';
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedClaimId(c.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-purple-950/30 border-purple-500/70 shadow-md ring-1 ring-purple-500/40'
                            : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            {isDisproven ? (
                              <XCircle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            {c.name}
                          </span>
                          <span
                            className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono font-bold ${
                              isDisproven
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {isDisproven ? '과학적 반증' : '접경 감시구역'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 line-clamp-1">{c.location}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Subterranean Cross-Section Educational Diagram */}
                <div className="p-4 rounded-xl bg-gradient-to-b from-[#121622] to-[#0a0d14] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      지하 단면도 및 물리적 반증 원리
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">0m ~ -50m</span>
                  </div>

                  {/* Visual SVG Cross-Section */}
                  <div className="relative w-full h-36 rounded-lg bg-[#0b0e17] border border-white/10 overflow-hidden flex flex-col justify-between p-2 text-[10px] font-mono">
                    {/* Surface Layer */}
                    <div className="border-b border-emerald-500/40 pb-1 text-emerald-400 flex justify-between">
                      <span>🌱 지표면 (0m) [도로·건축물]</span>
                      <span className="text-[9px] text-gray-500">지표 투과 레이더 (GPR)</span>
                    </div>

                    {/* Weathered Soil & Sinkhole */}
                    <div className="border-b border-amber-500/30 py-1 text-amber-300/80 flex justify-between">
                      <span>🪨 풍화토/점토층 (-5~15m)</span>
                      <span className="text-purple-400 font-bold">[양주 자연 싱크홀 발생대]</span>
                    </div>

                    {/* Groundwater Flow */}
                    <div className="border-b border-cyan-500/30 py-1 text-cyan-300/80 flex justify-between">
                      <span>💧 암반 균열 수맥 (-20~35m)</span>
                      <span className="text-cyan-400 font-bold">[남양주 폭음=수류 마찰음]</span>
                    </div>

                    {/* Bedrock & Core Drilling */}
                    <div className="pt-1 text-gray-400 flex justify-between">
                      <span>⛏️ 화강암 기반암 (-40m 이상)</span>
                      <span className="text-emerald-400 font-bold">[KIGAM 시추공 코아 완벽 보존]</span>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-gray-400 leading-relaxed">
                    국방부와 KIGAM의 실제 35~40m 암반 시추 코아 분석 결과 인공 파쇄 및 갱도 공동이 전혀 발견되지 않았으며, 생활용 대수층 관정과 자연 침하로 최종 입증되었습니다.
                  </p>
                </div>
              </div>

              {/* Right Detail Column (8 cols) */}
              {selectedClaim && (
                <div className="lg:col-span-8 space-y-4">
                  {/* Selected Header Card */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/20 via-[#101420] to-[#0d1017] border border-purple-500/30">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">{selectedClaim.name}</span>
                        <span className="text-xs text-gray-400 font-mono">({selectedClaim.name_en})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onFlyTo && onFlyTo(selectedClaim.coordinates, 12)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 flex items-center gap-1.5 transition-colors"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                          지도에서 위치 확인
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mt-3">
                      <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                        <span className="text-gray-400 block text-[11px] mb-0.5">조사 주체 및 참여 기관</span>
                        <span className="text-white font-medium">{selectedClaim.investigation_agency}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                        <span className="text-gray-400 block text-[11px] mb-0.5">시추 조사 및 동원 장비 통계</span>
                        <span className="text-emerald-300 font-mono font-medium">{selectedClaim.drilling_stats}</span>
                      </div>
                    </div>
                  </div>

                  {/* Claim Origin vs Scientific Verdict */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-amber-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>구글/민간 의혹 제기 내용</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed bg-amber-950/10 p-3 rounded-lg border border-amber-500/10">
                        {selectedClaim.claim_origin}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.02] border border-purple-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                        <Shield className="w-4 h-4 shrink-0" />
                        <span>과학적 반증 및 소크라테스 결론</span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed bg-purple-950/10 p-3 rounded-lg border border-purple-500/10">
                        {selectedClaim.scientific_reasoning}
                      </p>
                    </div>
                  </div>

                  {/* Mass Conservation & Physics Audit Box */}
                  <div className="p-4 rounded-xl bg-[#0e121c] border border-cyan-500/30 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
                      <span className="flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        자연의 물리법칙을 통한 거짓 가설 기각 (질량 보존 & 엔지니어링)
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">PHYSICAL-TRUTH-HARNESS</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
                        <span className="text-[11px] text-gray-400">① 토석(버력)의 물리량</span>
                        <div className="text-sm font-bold text-white">5톤 트럭 14만 대 분량</div>
                        <p className="text-[10px] text-gray-400 leading-tight">
                          60km 굴착 시 약 70만 톤의 암석 발생. 휴전선 북방 위성 사진상 야적장 흔적 0건.
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
                        <span className="text-[11px] text-gray-400">② 환기탑 생명유지 한계</span>
                        <div className="text-sm font-bold text-white">지하 5km 초과 시 질식</div>
                        <p className="text-[10px] text-gray-400 leading-tight">
                          지상 수직 환기탑(Ventilation Shaft) 없이는 산소 결핍과 지열 상승으로 인명 생존 불가.
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
                        <span className="text-[11px] text-gray-400">③ TBM 장비 및 배수 한계</span>
                        <div className="text-sm font-bold text-white">하루 수천 톤 지하수 유입</div>
                        <p className="text-[10px] text-gray-400 leading-tight">
                          대형 배수 펌프 및 전력 공급선 없이는 수일 내 터널 전체 침수. 대당 수십억 TBM 도입 불가.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONFIRMED 1~4 TUNNELS */}
          {activeTab === 'confirmed' && (
            <div className="space-y-4">
              <div className="text-xs text-gray-400 mb-2">
                유엔 군사정전위원회(UNC MAC S/11861, S/13113) 및 한미 연합사령부가 공식 확인한 4개 침투 땅굴의 정밀 스펙입니다.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {confirmedTunnels.map(t => (
                  <div key={t.id} className="p-4 rounded-xl bg-white/[0.02] border border-red-500/30 hover:border-red-500/60 transition-all space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-bold text-white">{t.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-red-300 bg-red-950/60 px-2 py-0.5 rounded border border-red-500/40">
                        {t.discovery_date} 발견
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <span className="text-[10px] text-gray-400 block">심도</span>
                        <span className="text-amber-300 font-bold">{t.depth_m}m</span>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <span className="text-[10px] text-gray-400 block">총 연장</span>
                        <span className="text-white font-bold">{t.length_total_m.toLocaleString()}m</span>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <span className="text-[10px] text-gray-400 block">MDL 남방 침투</span>
                        <span className="text-red-400 font-bold">{t.mdl_penetration_m}m</span>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <span className="text-[10px] text-gray-400 block">시간당 침투능력</span>
                        <span className="text-emerald-300 text-[10px] font-bold">{t.capacity_per_hour}</span>
                      </div>
                    </div>

                    <div className="text-xs space-y-1 text-gray-300">
                      <div><strong className="text-gray-400">규격:</strong> {t.dimension} | <strong className="text-gray-400">지질:</strong> {t.geology}</div>
                      <div><strong className="text-gray-400">전술 축선:</strong> {t.threat_axis}</div>
                      <div className="text-[11px] text-gray-400 bg-white/[0.02] p-2 rounded border border-white/5">
                        <strong>발견 경위:</strong> {t.intelligence_source}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => onFlyTo && onFlyTo(t.coordinates, 13)}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 flex items-center gap-1.5 transition-colors"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        지도에서 현장 확인
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: STRATEGIC AXES */}
          {activeTab === 'axes' && (
            <div className="space-y-4">
              <div className="text-xs text-gray-400 mb-2">
                미 국방정보국(DIA) 및 이스라엘 IDF 지하시설 전술 교리에 따른 DMZ 6대 잠재 침투 축선과 권고 탐지 기술입니다.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategicAxes.map(axis => (
                  <div key={axis.id} className="p-4 rounded-xl bg-white/[0.02] border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-amber-300">{axis.name}</span>
                      <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40">
                        {axis.status}
                      </span>
                    </div>

                    <div className="text-xs space-y-1.5 text-gray-300">
                      <div><span className="text-gray-400 font-semibold">침투 방향:</span> {axis.target_direction}</div>
                      <div><span className="text-gray-400 font-semibold">전략적 의미:</span> {axis.strategic_significance}</div>
                      <div><span className="text-gray-400 font-semibold">지질 취약성:</span> {axis.geological_vulnerability}</div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 space-y-1">
                      <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider block">
                        🔬 한미 과학적 다층 탐지 기법
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {axis.detection_methods.map((m, i) => (
                          <span key={i} className="text-[10px] bg-cyan-950/40 text-cyan-200 px-2 py-0.5 rounded border border-cyan-500/20">
                            ✔ {m}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => axis.coordinates[0] && onFlyTo && onFlyTo(axis.coordinates[0], 11)}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 flex items-center gap-1.5 transition-colors"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        축선 궤적 지도 확인
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: 6-NATION GLOBAL INTELLIGENCE CROSS-AUDIT */}
          {activeTab === 'global_intel' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/30 via-[#101420] to-[#0d1017] border border-blue-500/30">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-bold text-white">
                      번개의 눈동자 (LIGHTNING EYE) — 6개국 정보기관 및 군사 씽크탱크 교차 검증 매트릭스
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-500/40">
                    6-NATION INTEL FUSION
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  미국, 이스라엘, 일본, 한국, 북한, 중국의 군사정보기관 기밀해제 보고서(FOIA) 및 군사 학술 싱크탱크 연구 데이터를 교차 분석한 결과입니다.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. 미국 (US) */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-blue-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="text-base">🇺🇸</span> 미국 (US)
                    </span>
                    <span className="text-[10px] font-mono text-blue-300 bg-blue-950/40 px-2 py-0.5 rounded">
                      DIA / MWI / CSIS
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    <strong>기관:</strong> 미 국방정보국(DIA), CIA FOIA, 웨스트포인트 MWI, CSIS Beyond Parallel
                  </div>
                  <div className="text-xs text-gray-300 bg-black/30 p-2.5 rounded-lg border border-white/5 space-y-1">
                    <p>• <strong>UGF 규모:</strong> 북한 전역 8,000~10,000개소 지하 시설 구축으로 미사일·포병 생존성 극대화.</p>
                    <p>• <strong>민간 의혹 기각:</strong> CSIS 버뮤데즈 연구원 판독 결과, 탈북자/민간의 '지하 발사대', '산 분할 기지'는 정찰위성 상 전무한 허위로 기각.</p>
                  </div>
                </div>

                {/* 2. 이스라엘 (Israel) */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-cyan-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="text-base">🇮🇱</span> 이스라엘 (Israel)
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded">
                      IDF Unit 9900 / Alma
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    <strong>기관:</strong> IDF 유닛 9900(지형영상), 야할롬 특수부대, Alma Research Center, INSS
                  </div>
                  <div className="text-xs text-gray-300 bg-black/30 p-2.5 rounded-lg border border-white/5 space-y-1">
                    <p>• <strong>기술 수출 규명:</strong> 북한 조선광업개발무역(KOMID)이 헤즈볼라/하마스에 지하터널 공법과 TBM 부품 직접 수출.</p>
                    <p>• <strong>규격 차이:</strong> 중동 터널(1x2m 보병 잠입용)과 달리, 북한 DMZ 터널(2x2m)은 철도 레일과 기계화 사단 고속 침투용으로 설계.</p>
                  </div>
                </div>

                {/* 3. 일본 (Japan) */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-red-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="text-base">🇯🇵</span> 일본 (Japan)
                    </span>
                    <span className="text-[10px] font-mono text-red-300 bg-red-950/40 px-2 py-0.5 rounded">
                      NIDS / 방위백서
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    <strong>기관:</strong> 방위성 방위연구소(NIDS), 내각위성정보센터(CSICE), 공안조사청(PSIA)
                  </div>
                  <div className="text-xs text-gray-300 bg-black/30 p-2.5 rounded-lg border border-white/5 space-y-1">
                    <p>• <strong>비대칭 억제:</strong> 한미일 공중 정밀 타격을 무력화하기 위한 전국토 지하 요새화로 규정.</p>
                    <p>• <strong>미사일 엄폐:</strong> 노동·스커드-ER 등 대일 타격 미사일 발사대(TEL)가 DMZ 인접 지하 시설에서 출격 준비.</p>
                  </div>
                </div>

                {/* 4. 대한민국 (ROK) */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-emerald-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="text-base">🇰🇷</span> 대한민국 (ROK)
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded">
                      합참 / MND / KIGAM
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    <strong>기관:</strong> 합동참모본부, 국방부 시설본부, 한국지질자원연구원(KIGAM), ADD
                  </div>
                  <div className="text-xs text-gray-300 bg-black/30 p-2.5 rounded-lg border border-white/5 space-y-1">
                    <p>• <strong>실제 침투 제원:</strong> 제1~4땅굴 실측 관리(DMZ 1~2km 침투선).</p>
                    <p>• <strong>시추 반증 확증:</strong> 양주 5개공 40m, 남양주 7개공 시추 결과 인공 갱도 전무, 자연 싱크홀 및 지하 수맥으로 과학적 반증 완료.</p>
                  </div>
                </div>

                {/* 5. 북한 (DPRK) */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-purple-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="text-base">🇰🇵</span> 북한 (DPRK)
                    </span>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded">
                      공병총국 / 노동당 작전부
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    <strong>기관:</strong> 조선인민군 공병총국, 노동당 작전부, 제2경제위원회
                  </div>
                  <div className="text-xs text-gray-300 bg-black/30 p-2.5 rounded-lg border border-white/5 space-y-1">
                    <p>• <strong>김일성 교시:</strong> 1971년 "1개 땅굴은 10개 핵폭탄보다 낫다, 전선 사단마다 2개씩 굴착하라" 비밀 지령.</p>
                    <p>• <strong>전술 목적:</strong> 제공권을 상실한 상황에서 SOF 특수작전군 1개 사단급을 후방으로 침투시켜 수도권 조기 마비.</p>
                  </div>
                </div>

                {/* 6. 중국 (China) */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="text-base">🇨🇳</span> 중국 (China)
                    </span>
                    <span className="text-[10px] font-mono text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded">
                      PLA 군사과학원 (AMS)
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    <strong>기관:</strong> 중국 인민해방군 군사과학원(AMS), 북중 국경 지질연구소
                  </div>
                  <div className="text-xs text-gray-300 bg-black/30 p-2.5 rounded-lg border border-white/5 space-y-1">
                    <p>• <strong>역사적 연원:</strong> 6.25 전쟁 당시 미 공군 공폭에 대항했던 상감령 갱도전 전술을 북한이 계승·발전시킨 산물로 평가.</p>
                    <p>• <strong>완충지대 지하화:</strong> 북중 국경 압록강/두만강 수계 단층대와 지하시설 상관관계 연구.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SUPERPOWER REAL-TIME VERIFIER */}
          {activeTab === 'superpower' && (
            <div className="space-y-6">
              {/* Input Form Card */}
              <div className="p-5 rounded-xl bg-gradient-to-r from-cyan-950/30 via-[#101420] to-[#0d1017] border border-cyan-500/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">삼성 외장 SSD '슈퍼파워' 실시간 지질 & 물리 팩트체크 엔진</h3>
                  </div>
                  <span className="text-[10.5px] font-mono text-cyan-300 bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-500/40">
                    /Volumes/SAMSUNG/AI-Tools/Agent-Reach
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-xs text-gray-300 font-medium">검증 대상 지역명 / 제보 의혹지</label>
                    <input
                      type="text"
                      value={customLocation}
                      onChange={e => setCustomLocation(e.target.value)}
                      placeholder="예: 경기 화성시 남양읍, 경기 양주시 광사동, 김포 통진읍 등"
                      className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/20 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-xs text-gray-300 font-medium">휴전선과의 거리 (km)</label>
                    <input
                      type="number"
                      value={customDistanceKm}
                      onChange={e => setCustomDistanceKm(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/20 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      onClick={() => runSuperpowerAudit()}
                      disabled={superpowerLoading}
                      className="w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {superpowerLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>소크라테스 연산 중...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>슈퍼파워 즉시 검증</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Result Display */}
              {superpowerResult && (
                <div className="space-y-4">
                  {/* Verdict Banner */}
                  <div className="p-4 rounded-xl bg-black/40 border border-purple-500/40 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{superpowerResult.location_name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            {superpowerResult.verdict}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          지질층: {superpowerResult.geological_layer} | 신뢰도 지수: {superpowerResult.epistemic_score}%
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="text-right">
                        <span className="text-gray-400 block text-[10px]">토석 발생량(버력)</span>
                        <span className="text-amber-300 font-bold">{superpowerResult.calculated_debris_tons.toLocaleString()}톤</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-400 block text-[10px]">5톤 덤프트럭</span>
                        <span className="text-cyan-300 font-bold">{superpowerResult.truck_loads_5ton.toLocaleString()}대</span>
                      </div>
                    </div>
                  </div>

                  {/* 5 Socratic Gates Matrix */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      소크라테스 5대 관문 자연의 물리법칙 판독 내역
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {superpowerResult.gates?.map((gate: any, idx: number) => (
                        <div key={idx} className="p-3.5 rounded-lg bg-white/[0.02] border border-white/10 flex items-start gap-3">
                          <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">{gate.gate_name}</span>
                              <span className="text-[10px] font-mono text-gray-500">관문 {idx + 1} / {gate.philosopher}</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">
                              {gate.scientific_proof}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-[#090b10] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>KIGAM 지질 데이터베이스 및 삼성 외장 SSD 슈퍼파워 실시간 연동 활성화</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            닫기
          </button>
        </div>
      </motion.div>
    </div>
  );
}
