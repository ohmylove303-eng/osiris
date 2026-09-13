'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, HelpCircle, FileText, MapPin, Database, ExternalLink, RefreshCw, Compass, Radio } from 'lucide-react';
import { AirspaceCheckResult } from '@/lib/airspace-rules-engine';

interface AirspaceAnalyzerPanelProps {
  onClose: () => void;
  onFlyTo?: (lat: number, lng: number) => void;
}

export default function AirspaceAnalyzerPanel({ onClose, onFlyTo }: AirspaceAnalyzerPanelProps) {
  const [lat, setLat] = useState<number>(37.5326);
  const [lng, setLng] = useState<number>(126.9810);
  const [altM, setAltM] = useState<number>(50);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AirspaceCheckResult | null>(null);
  const [activeTab, setActiveTab] = useState<'check' | 'checklist' | 'evidence' | 'companies' | 'national_rf'>('check');
  const [rfHeatmapData, setRfHeatmapData] = useState<any[]>([]);
  const [gpsJammingData, setGpsJammingData] = useState<any[]>([]);
  const [kcLookupQuery, setKcLookupQuery] = useState<string>('1581E4829A019283');
  const [kcLookupResult, setKcLookupResult] = useState<any>(null);

  const fetchNationalRfData = async () => {
    try {
      const [heatmapRes, jammingRes] = await Promise.all([
        fetch('/api/v1/rf-spectrum-heatmap'),
        fetch('/api/v1/gps-jamming-alerts'),
      ]);
      if (heatmapRes.ok) {
        const d = await heatmapRes.json();
        setRfHeatmapData(d.grids || []);
      }
      if (jammingRes.ok) {
        const d = await jammingRes.json();
        setGpsJammingData(d.alerts || []);
      }
    } catch (e) {
      console.warn('Failed to fetch national RF data', e);
    }
  };

  const handleKcLookup = async () => {
    try {
      const res = await fetch(`/api/v1/drone-unified-lookup?query=${encodeURIComponent(kcLookupQuery)}&lat=${lat}&lng=${lng}&alt_m=${altM}`);
      if (res.ok) {
        const json = await res.json();
        setKcLookupResult(json.data);
      }
    } catch (e) {
      console.warn('KC lookup failed', e);
    }
  };

  useEffect(() => {
    fetchNationalRfData();
  }, []);

  const [statsData, setStatsData] = useState<any>(null);
  const [companiesData, setCompaniesData] = useState<any[]>([]);
  const [powerPlantLogs, setPowerPlantLogs] = useState<any[]>([]);

  // Presets
  const applyPreset = (name: string, pLat: number, pLng: number, pAlt: number) => {
    setLat(pLat);
    setLng(pLng);
    setAltM(pAlt);
    if (onFlyTo) onFlyTo(pLat, pLng);
  };

  const handleCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/airspace/check?lat=${lat}&lng=${lng}&alt_m=${altM}`);
      if (res.ok) {
        const json = await res.json();
        setResult(json);
      }
    } catch (e) {
      console.warn('Airspace check failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleCheck();
  }, []);

  // Fetch Public Datasets
  useEffect(() => {
    fetch('/api/v1/datasets/drone-statistics')
      .then(r => r.json())
      .then(d => { if (d.statistics) setStatsData(d); })
      .catch(() => {});

    fetch('/api/v1/datasets/drone-companies')
      .then(r => r.json())
      .then(d => { if (d.companies) setCompaniesData(d.companies); })
      .catch(() => {});

    fetch('/api/v1/datasets/power-plant-drone-logs')
      .then(r => r.json())
      .then(d => { if (d.logs) setPowerPlantLogs(d.logs); })
      .catch(() => {});
  }, []);

  const getBadgeStyle = (code: string) => {
    if (code === 'RED') return 'bg-red-500/20 text-red-400 border-red-500/50';
    if (code === 'YELLOW') return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
    if (code === 'GREEN') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#090C15]/95 backdrop-blur-xl border-l border-cyan-500/30 text-white z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
      
      {/* HEADER */}
      <div className="p-4 border-b border-cyan-500/30 bg-[#0D1322] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/40 text-cyan-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-mono tracking-wide text-white">
              한국 공공 API 기반 드론 공역 분석 OS
            </h2>
            <p className="text-[10px] text-white/50 font-mono">
              Korea Public Data & Evidence-Grounded Drone Airspace OS
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-white/10 bg-[#080B14] px-4 font-mono text-[11px]">
        <button
          onClick={() => setActiveTab('check')}
          className={`py-2.5 px-3 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'check' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Compass className="w-3.5 h-3.5" /> 1. 공역 가능성 분석
        </button>
        <button
          onClick={() => setActiveTab('checklist')}
          className={`py-2.5 px-3 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'checklist' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> 2. 비행승인 준비도
        </button>
        <button
          onClick={() => setActiveTab('evidence')}
          className={`py-2.5 px-3 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'evidence' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5" /> 3. 출처 근거 (Evidence)
        </button>
        <button
          onClick={() => setActiveTab('companies')}
          className={`py-2.5 px-3 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'companies' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" /> 4. 공공 DB
        </button>
        <button
          onClick={() => { setActiveTab('national_rf'); if (!kcLookupResult) handleKcLookup(); }}
          className={`py-2.5 px-3 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'national_rf' ? 'border-[#76FF03] text-[#76FF03]' : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          <Radio className="w-3.5 h-3.5" /> 5. 국가 전파 4대 방안
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* TAB 1: AIRSPACE CHECK */}
        {activeTab === 'check' && (
          <div className="space-y-4">
            
            {/* INPUT FORM */}
            <div className="p-3.5 bg-black/50 border border-white/10 rounded-lg space-y-3 font-mono">
              <div className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> 비행 예정 좌표 & 고도 설정
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <label className="text-white/50 block mb-1">위도 (Latitude)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white/5 border border-white/15 rounded px-2 py-1 text-white text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-white/50 block mb-1">경도 (Longitude)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white/5 border border-white/15 rounded px-2 py-1 text-white text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-white/50 block mb-1">비행고도 (AGL m)</label>
                  <input
                    type="number"
                    value={altM}
                    onChange={(e) => setAltM(parseInt(e.target.value) || 0)}
                    className="w-full bg-white/5 border border-white/15 rounded px-2 py-1 text-white text-[11px]"
                  />
                </div>
              </div>

              {/* PRESETS */}
              <div className="flex items-center gap-1.5 text-[9.5px]">
                <span className="text-white/40">주요 프리셋:</span>
                <button
                  onClick={() => applyPreset('용산 P-73', 37.5326, 126.9810, 50)}
                  className="px-2 py-0.5 bg-red-500/20 text-red-300 border border-red-500/40 rounded hover:bg-red-500/30"
                >
                  🔴 서울 용산 (P-73)
                </button>
                <button
                  onClick={() => applyPreset('인천공항 CTR', 37.4600, 126.4400, 50)}
                  className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded hover:bg-amber-500/30"
                >
                  🟡 인천공항 (CTR)
                </button>
                <button
                  onClick={() => applyPreset('고리원전 P-518', 35.3180, 129.2940, 50)}
                  className="px-2 py-0.5 bg-red-500/20 text-red-300 border border-red-500/40 rounded hover:bg-red-500/30"
                >
                  🔴 고리원전 (P-518)
                </button>
              </div>

              <button
                onClick={handleCheck}
                disabled={loading}
                className="w-full py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-300 rounded font-bold text-xs hover:bg-cyan-500/30 transition-all flex items-center justify-center gap-1.5"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                <span>공역 가능성 및 규제 교차 판정 실행</span>
              </button>
            </div>

            {/* DECISION RESULT DISPLAY */}
            {result && (
              <div className="space-y-3 font-mono">
                <div className={`p-4 rounded-lg border ${getBadgeStyle(result.color_code)} flex items-start gap-3`}>
                  {result.color_code === 'RED' && <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />}
                  {result.color_code === 'YELLOW' && <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />}
                  {result.color_code === 'GREEN' && <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />}
                  {result.color_code === 'GRAY' && <HelpCircle className="w-6 h-6 shrink-0 mt-0.5" />}

                  <div className="space-y-1">
                    <div className="text-xs font-bold tracking-wider">{result.decision_label}</div>
                    <div className="text-[10px] opacity-80">
                      MGRS 군사 좌표: <strong className="text-white">{result.coordinates.mgrs}</strong> ({result.coordinates.lat.toFixed(4)}°N, {result.coordinates.lng.toFixed(4)}°E)
                    </div>
                  </div>
                </div>

                {/* REASONS */}
                <div className="p-3 bg-black/40 border border-white/10 rounded-lg space-y-1.5 text-[11px]">
                  <div className="text-xs font-bold text-white mb-1">📋 판정 사유 및 근거</div>
                  {result.reasons.map((r, i) => (
                    <div key={i} className="text-white/80 leading-relaxed text-[10.5px]">• {r}</div>
                  ))}
                </div>

                {/* PERMIT REQUIREMENTS */}
                {result.permit_requirements.length > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1 text-[11px] text-amber-200">
                    <div className="text-xs font-bold mb-1 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> 드론원스톱 필수 승인 준비사항
                    </div>
                    {result.permit_requirements.map((p, i) => (
                      <div key={i} className="text-[10.5px]">• {p}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CHECKLIST */}
        {activeTab === 'checklist' && (
          <div className="space-y-3 font-mono text-[11px]">
            <div className="p-3.5 bg-black/50 border border-white/10 rounded-lg space-y-2">
              <div className="text-xs font-bold text-cyan-400">📝 국토교통부 드론원스톱 비행승인 준비 체크리스트</div>
              <div className="text-[10px] text-white/60">최대이륙중량 25kg 이하 / 150m 미만 일반 비행 기준</div>
            </div>

            <div className="space-y-2">
              <div className="p-3 bg-white/5 border border-white/10 rounded space-y-1">
                <div className="font-bold text-white text-[11.5px]">1. 기체 신고 대상 여부</div>
                <div className="text-[10px] text-white/70">
                  • 최대이륙중량 2kg 초과 또는 모든 사용사업용 드론은 국토부 기체신고 필수<br/>
                  • 기체에 신고번호를 물리적으로 표기해야 함
                </div>
              </div>

              <div className="p-3 bg-white/5 border border-white/10 rounded space-y-1">
                <div className="font-bold text-white text-[11.5px]">2. 비행승인 신청 준비 서류 (드론원스톱)</div>
                <div className="text-[10px] text-white/70">
                  • 신청인 정보 및 비행 목적<br/>
                  • 비행 장소 위경도 좌표 및 비행 일시/경로<br/>
                  • 기체 모델/제원 사진 및 조종자 자격 증명서<br/>
                  • 필요 시 안전관리계획서 및 제3자 배상책임 보험 증권
                </div>
              </div>

              <div className="p-3 bg-white/5 border border-white/10 rounded space-y-1">
                <div className="font-bold text-white text-[11.5px]">3. 긴급 신고 기관 안내 (미승인 비행 발견 시)</div>
                <div className="text-[10px] text-amber-300">
                  • 국가정보원: 111 | 경찰청: 112 | 군 부대: 1338
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PROVENANCE EVIDENCE */}
        {activeTab === 'evidence' && (
          <div className="space-y-3 font-mono text-[10.5px]">
            <div className="p-3.5 bg-black/50 border border-white/10 rounded-lg space-y-1">
              <div className="text-xs font-bold text-cyan-400">🛡️ 환각 방지 데이터 근거 (Provenance Records)</div>
              <div className="text-[10px] text-white/60">모든 정보는 검증된 공공 API 데이터셋 메타데이터와 SHA-256 해시를 동반합니다.</div>
            </div>

            {result?.sources?.map((src, i) => (
              <div key={i} className="p-3 bg-white/5 border border-white/10 rounded space-y-1">
                <div className="flex items-center justify-between text-cyan-300 font-bold">
                  <span>{src.provider}</span>
                  <span className="text-emerald-400">신뢰도: {(src.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="text-white/50 text-[9.5px]">Source ID: <span className="text-white">{src.source_id}</span></div>
                <div className="text-white/50 text-[9.5px] truncate">URL: <a href={src.source_url} target="_blank" rel="noreferrer" className="text-cyan-400 underline">{src.source_url}</a></div>
                <div className="text-white/50 text-[9.5px]">수집시각: <span className="text-white">{src.retrieved_at}</span></div>
                <div className="text-white/50 text-[9.5px] truncate">Hash: <span className="text-amber-300 font-mono">{src.raw_hash}</span></div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: PUBLIC DATASETS */}
        {activeTab === 'companies' && (
          <div className="space-y-3 font-mono text-[10.5px]">
            <div className="p-3.5 bg-black/50 border border-white/10 rounded-lg space-y-1">
              <div className="text-xs font-bold text-cyan-400">🏢 항공안전기술원(RIAK) 공인 대한민국 드론 기업 DB</div>
              <div className="text-[10px] text-white/60">공공데이터포털(data.go.kr) 15127775 연동 데이터</div>
            </div>

            <div className="space-y-2">
              {companiesData.map((comp) => (
                <div key={comp.id} className="p-3 bg-white/5 border border-white/10 rounded space-y-1">
                  <div className="font-bold text-white text-xs">{comp.company_name}</div>
                  <div className="text-cyan-300 text-[10px]">{comp.business_type}</div>
                  <div className="text-white/60 text-[9.5px]">주요 기체/제품: {comp.main_product}</div>
                  <div className="text-white/40 text-[9px]">{comp.region} | {comp.cert_status}</div>
                </div>
              ))}
            </div>

            <div className="pt-3 space-y-2">
              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg space-y-1">
                <div className="text-xs font-bold text-amber-400">⚡ [국가중요시설] 한국동서발전(주) 드론 탐지 로그 (Public Data ID: 15151019)</div>
                <div className="text-[10px] text-white/60">당진·울산·일산 발전본부 C-UAS 탐지 센서(RF/Radar/EO-IR) 실시간 결합 로그</div>
              </div>

              {powerPlantLogs.map((log) => (
                <div key={log.detection_id} className="p-3 bg-black/60 border border-amber-500/20 rounded space-y-1 text-[9.5px]">
                  <div className="flex justify-between items-center text-white font-bold">
                    <span className="text-amber-300">🏭 {log.power_plant_name}</span>
                    <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 text-[8.5px] rounded">{log.threat_assessment}</span>
                  </div>
                  <div className="text-cyan-300">탐지기체: {log.drone_model} (ID: {log.hardware_id})</div>
                  <div className="text-white/60">센서방식: {log.detection_sensor_type} | 노드: {log.sensor_node_id} | 수신강도: {log.signal_strength_dbm} dBm</div>
                  <div className="text-emerald-300/90 text-[9px] bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20 mt-1">
                    🛡️ 신속 조치: {log.action_taken}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: NATIONAL RF & AIRSPACE 4-PILLAR SYSTEM */}
        {activeTab === 'national_rf' && (
          <div className="space-y-4 font-mono text-[10.5px]">
            
            {/* 1. GPS JAMMING EARLY WARNING ALERTS */}
            <div className="p-3.5 bg-red-950/30 border border-red-500/40 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 animate-pulse" /> 1. 서해 NLL / 접경지역 GPS 전파 교란(Jamming) 조기경보
                </div>
                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 text-[9px] rounded font-bold">LIVE CRITICAL</span>
              </div>
              
              {gpsJammingData.map((alert) => (
                <div key={alert.id} className="p-2.5 bg-black/60 border border-red-500/30 rounded space-y-1">
                  <div className="flex items-center justify-between text-white font-bold text-[11px]">
                    <span className="text-red-300">🚨 {alert.zone_name}</span>
                    <span className="text-amber-400 text-[9.5px]">방위각: {alert.estimated_bearing_deg}°</span>
                  </div>
                  <div className="text-cyan-300 text-[9.5px]">MGRS 좌표: {alert.mgrs_10digit} | 반경: {alert.affected_radius_km}km</div>
                  <div className="text-white/60 text-[9px]">교란 대역: {alert.jammed_frequencies?.join(', ')}</div>
                  <div className="text-white/50 text-[9px]">출처: {alert.source_origin}</div>
                  <div className="text-amber-200/90 text-[9px] bg-amber-500/10 p-1.5 rounded border border-amber-500/20 leading-relaxed mt-1">
                    ⚠️ {alert.advisory_notice}
                  </div>
                </div>
              ))}
            </div>

            {/* 2. UNIFIED KC CERT & MOLIT PERMIT LOOKUP */}
            <div className="p-3.5 bg-black/50 border border-cyan-500/30 rounded-lg space-y-3">
              <div className="text-xs font-bold text-cyan-400">2. KC 전파인증 + 국토부 비행승인 융합 조회</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={kcLookupQuery}
                  onChange={(e) => setKcLookupQuery(e.target.value)}
                  placeholder="RemoteID MAC 또는 기체 시리얼"
                  className="flex-1 px-3 py-1.5 bg-black border border-white/20 rounded text-xs text-white"
                />
                <button
                  onClick={handleKcLookup}
                  className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 font-bold rounded text-xs"
                >
                  통합 검증
                </button>
              </div>

              {kcLookupResult && (
                <div className="p-3 bg-white/5 border border-white/10 rounded space-y-2 text-[10px]">
                  <div className="flex justify-between items-center border-b border-white/10 pb-1">
                    <span className="text-white/60">과기정통부 KC 전파인증:</span>
                    <span className="text-emerald-400 font-bold">✅ {kcLookupResult.kc_certification?.certified ? '정상 인증 기체' : '미인증'} ({kcLookupResult.kc_certification?.kc_cert_num})</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-1">
                    <span className="text-white/60">국토부 드론원스톱 비행승인:</span>
                    <span className="text-emerald-400 font-bold">✅ {kcLookupResult.molit_permit_history?.registration_num}</span>
                  </div>
                  <div className="text-amber-300 font-bold text-[9.5px] bg-black/40 p-2 rounded border border-amber-500/30">
                    🔒 보안 종합 판정: {kcLookupResult.security_verdict?.verdict_summary}
                  </div>
                </div>
              )}
            </div>

            {/* 3. 1KM X 1KM RF SPECTRUM HEATMAP */}
            <div className="p-3.5 bg-black/50 border border-white/10 rounded-lg space-y-2">
              <div className="text-xs font-bold text-emerald-400">3. 1km × 1km 국가 전파 스펙트럼 히트맵 (RF Congestion)</div>
              <div className="space-y-1.5">
                {rfHeatmapData.map((grid) => (
                  <div key={grid.id} className="p-2 bg-white/5 border border-white/10 rounded flex items-center justify-between text-[9.5px]">
                    <div>
                      <div className="font-bold text-white">{grid.region}</div>
                      <div className="text-white/50">{grid.id} | 대역: {grid.active_freq_bands?.join(', ')}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${grid.noise_floor_dbm > -70 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {grid.noise_floor_dbm} dBm
                      </div>
                      <div className="text-[8.5px] text-white/60">{grid.congestion_level}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* FOOTER NOTICE */}
      <div className="p-3 bg-[#080B14] border-t border-cyan-500/20 font-mono text-[9.5px] text-white/50 text-center">
        본 시스템은 대한민국 공공데이터포털 및 국토교통부 행정법령 기반 근거 OS입니다.
      </div>

    </div>
  );
}
