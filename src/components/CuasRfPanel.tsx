'use client';

import { useState, useEffect, useRef } from 'react';
import { Radio, ShieldAlert, Navigation, Cpu, Wifi, Activity, MapPin, AlertCircle, X, Search, Target, Compass, Layers, Binary, ShieldCheck, AlertTriangle, Building2, Anchor, Shield } from 'lucide-react';

interface CuasRfPanelProps {
  initialLat?: number;
  initialLng?: number;
  initialName?: string;
  onClose?: () => void;
}

export default function CuasRfPanel({ initialLat, initialLng, initialName, onClose }: CuasRfPanelProps) {
  const [regionMode, setRegionMode] = useState<'preset' | 'custom'>('preset');
  const [presetRegion, setPresetRegion] = useState<string>('gimpo_incheon');

  const [customLat, setCustomLat] = useState<string>(initialLat ? String(initialLat) : '37.5600');
  const [customLng, setCustomLng] = useState<string>(initialLng ? String(initialLng) : '126.6200');
  const [customName, setCustomName] = useState<string>(initialName || '김포시 & 인천광역시 전지역 통합 감시망');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      let url = `/api/cuas/rf-surveillance?region=${presetRegion}&lat=${customLat}&lng=${customLng}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch C-UAS RF data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [presetRegion, customLat, customLng]);

  const targets = data?.targets || [];

  // Canvas FFT Spectrum animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let step = 0;

    const render = () => {
      step += 0.05;
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#050B14';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Waveform: Flat noise floor if no target, dynamic peaks if targets exist
      ctx.beginPath();
      ctx.strokeStyle = targets.length > 0 ? '#00E5FF' : '#00E5FF88';
      ctx.lineWidth = 1.8;

      const hasTargets = targets.length > 0;

      for (let x = 0; x < width; x++) {
        let noise = Math.sin(x * 0.05 + step) * 3 + Math.random() * 3 - 105;

        if (hasTargets) {
          targets.forEach((t: any, idx: number) => {
            const freqPos = (t.rf_freq?.includes('5.8') ? 0.8 : t.rf_freq?.includes('433') ? 0.5 : 0.35) + (idx * 0.1);
            const targetX = width * Math.min(0.9, Math.max(0.1, freqPos));
            const widthSpan = 25;
            if (Math.abs(x - targetX) < widthSpan) {
              noise += (1 - Math.abs(x - targetX) / widthSpan) * 80;
            }
          });
        }

        const y = height - ((noise + 120) / 140) * height;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // If no targets, draw clear Noise Floor Status Label
      if (!hasTargets) {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText('🟢 RF Ambient Noise Floor Baseline (-105 dBm) — No Active Emitter Detected', 15, 20);
      } else {
        ctx.fillStyle = '#FF1744';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText(`🚨 ACTIVE RF EMITTER DETECTED (${targets.length} Target Units)`, 15, 20);
      }

      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, hasTargets ? 'rgba(0, 229, 255, 0.25)' : 'rgba(0, 229, 255, 0.08)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [data, targets]);

  const applyCustomPreset = (name: string, lat: number, lng: number, regKey = 'custom') => {
    setPresetRegion(regKey);
    setCustomName(name);
    setCustomLat(String(lat));
    setCustomLng(String(lng));
  };

  const getTargetBadgeStyle = (classification: string) => {
    switch (classification) {
      case 'COOPERATIVE':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'PARTIAL_COOPERATIVE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'NON_COOPERATIVE':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'SPOOFED_DISCREPANT':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      case 'GROUND_EMITTER_ONLY':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      default:
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[#090D16] border border-[#00E5FF]/40 rounded-xl shadow-[0_0_35px_rgba(0,229,255,0.25)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* HEADER */}
        <div className="px-5 py-3.5 bg-[#0D1526] border-b border-[#00E5FF]/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00E5FF]/10 rounded-lg border border-[#00E5FF]/40 text-[#00E5FF]">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>🛡️ 김포시 & 인천광역시 전지역 광역 C-UAS 무선 정밀 감시망</span>
                <span className="px-2 py-0.5 bg-[#00E5FF]/20 text-[#00E5FF] text-[9.5px] rounded border border-[#00E5FF]/40 font-mono font-bold">GIMPO-INCHEON GRID</span>
              </h2>
              <p className="text-[10.5px] text-white/60 font-mono mt-0.5">
                Gimpo Airport | Incheon Int'l Airport | Yeongjongdo | Songdo | Ganghwado NLL Multi-Sensor Defense
              </p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* REGIONAL PRESET & SENSOR NODES BAR */}
        <div className="px-5 py-2.5 bg-black/50 border-b border-white/10 flex items-center justify-between gap-3 text-[10.5px] font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[var(--gold-primary)] font-bold flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> 권역별 감시망:
            </span>
            <button
              onClick={() => applyCustomPreset('김포시 & 인천광역시 전지역 통합 감시망', 37.5600, 126.6200, 'gimpo_incheon')}
              className={`px-3 py-1 rounded text-[11px] font-mono font-bold transition-all ${
                presetRegion === 'gimpo_incheon' ? 'bg-[#00E5FF] text-black shadow-[0_0_12px_rgba(0,229,255,0.4)]' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              🛡️ 김포시 & 인천광역시 전지역 (5개소 어레이)
            </button>
            <button
              onClick={() => applyCustomPreset('서울 용산 방희구역', 37.5326, 126.9810, 'yongsan')}
              className={`px-2.5 py-1 rounded text-[10.5px] font-mono font-bold transition-all ${
                presetRegion === 'yongsan' ? 'bg-amber-400 text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              🏢 서울 용산
            </button>
            <button
              onClick={() => applyCustomPreset('파주 DMZ 최전방', 37.9500, 126.7500, 'dmz')}
              className={`px-2.5 py-1 rounded text-[10.5px] font-mono font-bold transition-all ${
                presetRegion === 'dmz' ? 'bg-red-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              🛡️ 파주 DMZ
            </button>
          </div>

          <div className="flex items-center gap-1 text-white/50 text-[10px]">
            <span>커버리지: 김포공항·한강하구 ~ 영종도·강화도 NLL (약 45km 반경)</span>
          </div>
        </div>

        {/* CONTENT BODY */}
        <div className="p-5 overflow-y-auto space-y-4">
          {loading && !data ? (
            <div className="py-16 text-center text-white/60 font-mono text-sm flex items-center justify-center gap-2">
              <Activity className="w-5 h-5 animate-spin text-[#00E5FF]" />
              <span>김포-인천 권역 5개소 SDR 수신 노드 신호 융합 중...</span>
            </div>
          ) : (
            <>
              {/* DISTRIBUTED 5 SENSOR NODES OF GIMPO & INCHEON */}
              <div className="bg-black/60 border border-[#00E5FF]/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#00E5FF]">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" /> 김포시 & 인천광역시 전지역 분산형 5대 SDR 감시 노드
                  </span>
                  <span className="text-[10px] text-white/50">OpenDroneID BLE 5.x / Wi-Fi NAN / AoA/TDoA Wideband RF</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[10px] font-mono">
                  {data?.architecture?.sensor_nodes?.map((node: any) => (
                    <div key={node.id} className="p-2 bg-white/5 border border-white/10 rounded flex flex-col justify-between">
                      <div className="font-bold text-white mb-1 truncate" title={node.name}>{node.name}</div>
                      <div className="text-white/50 text-[9px]">{node.lat.toFixed(4)}°N, {node.lng.toFixed(4)}°E</div>
                      <div className="text-[var(--gold-primary)] font-bold text-[9px] mt-1">반경 {node.radius_km}km 감시</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FFT SPECTRUM */}
              <div className="bg-black/60 border border-white/10 rounded-lg p-3 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold text-[#00E5FF] flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5" /> 2.4GHz / 5.8GHz / 433MHz 광대역 RF 방향탐지 스펙트럼 (Gimpo-Incheon Spectrum)
                  </span>
                  <span className="text-[10px] font-mono text-white/50">Span: 100MHz - 6GHz</span>
                </div>
                <canvas ref={canvasRef} width={600} height={90} className="w-full h-20 rounded border border-white/10" />
                <div className="flex items-center justify-between text-[9.5px] font-mono text-white/60 mt-1.5 px-1">
                  <span>BLE 4.x/5.x (2.40 GHz)</span>
                  <span>Wi-Fi NAN (2.44 GHz)</span>
                  <span className="text-[#FF1744] font-bold">C2 UHF (433 MHz)</span>
                  <span className="text-[#00E5FF] font-bold">FPV Video Downlink (5.80 GHz)</span>
                </div>
              </div>

              {/* DETECTED UNIFIED TARGETS */}
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold text-white flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#00E5FF]" />
                    <span>김포-인천 권역 실시간 탐지 표적 목록 ({data?.targets?.length || 0}건)</span>
                  </span>
                  <span className="text-[10px] font-mono text-white/50">EKF IMM-KF Kalman Fusion & 95% Error Ellipse</span>
                </div>

                {data?.targets?.map((tgt: any) => (
                  <div key={tgt.track_id} className="p-3.5 bg-black/60 border border-white/15 rounded-lg space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[9.5px] font-bold font-mono rounded border ${getTargetBadgeStyle(tgt.classification)}`}>
                            {tgt.classification_label}
                          </span>
                          <span className="text-sm font-bold text-white font-mono">{tgt.model_name}</span>
                        </div>
                        <div className="text-[11px] font-mono text-white/70 mt-1 flex items-center gap-4">
                          <span>위치 구역: <strong className="text-white">{tgt.zone_name}</strong></span>
                          <span>트랙 ID: <strong className="text-[#00E5FF]">{tgt.track_id}</strong></span>
                          <span>수신 주파수: <strong className="text-[var(--gold-primary)]">{tgt.rf_df.freq_mhz} MHz</strong></span>
                          <span>신호 세기: <strong className="text-emerald-400">{tgt.rf_df.rssi_dbm} dBm</strong></span>
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px]">
                        <div className="text-white/50">비행 고도 / 속력</div>
                        <div className="text-sm font-bold text-[#00E5FF]">{tgt.fused_alt_m} m / {tgt.fused_speed_kts} kts</div>
                      </div>
                    </div>

                    {/* DETAILS GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/10 text-[10.5px] font-mono">
                      <div className="p-2.5 bg-white/5 border border-white/10 rounded">
                        <div className="text-[#00E5FF] font-bold flex items-center gap-1 mb-1.5">
                          <MapPin className="w-3.5 h-3.5" /> 1. 표적 정밀 좌표 & NATO 군사 좌표 (MGRS)
                        </div>
                        <div className="space-y-1 text-white/80 text-[10px]">
                          <div>MGRS 군사 좌표: <strong className="text-[var(--gold-primary)] font-bold">{tgt.fused_mgrs || '52S DG 74120 48150'}</strong></div>
                          <div>위경도 좌표: <strong className="text-white">{tgt.fused_lat.toFixed(4)}°N, {tgt.fused_lng.toFixed(4)}°E</strong></div>
                          {tgt.android_rid_record ? (
                            <>
                              <div>UAS ID: <strong className="text-white">{tgt.android_rid_record.uas_id}</strong> ({tgt.android_rid_record.transport})</div>
                              <div>인증 상태: <strong className="text-emerald-400">{tgt.android_rid_record.authentication_status}</strong></div>
                            </>
                          ) : (
                            <div className="text-red-400 text-[10px]">⚠️ Remote ID 미방송 비협조 표적 (RF DF 센서 추정)</div>
                          )}
                        </div>
                      </div>

                      <div className="p-2.5 bg-white/5 border border-white/10 rounded">
                        <div className="text-[var(--gold-primary)] font-bold flex items-center gap-1 mb-1.5">
                          <Compass className="w-3.5 h-3.5" /> 2. 95% 신뢰 오차 타원 & 조종자(GCS) MGRS 좌표
                        </div>
                        <div className="space-y-1 text-white/80 text-[10px]">
                          <div>조종자(GCS) MGRS: <strong className="text-red-400 font-bold">{tgt.estimated_gcs_mgrs || '52S DG 72500 46200'}</strong></div>
                          <div>GCS 위경도: <strong className="text-white">{tgt.estimated_gcs_lat.toFixed(6)}°N, {tgt.estimated_gcs_lng.toFixed(6)}°E</strong></div>
                          <div>오차 타원: 장축 a = <strong className="text-white">{tgt.error_ellipse_95.semi_major_axis_a_m}m</strong>, 단축 b = <strong className="text-white">{tgt.error_ellipse_95.semi_minor_axis_b_m}m</strong></div>
                          <div>마할라노비스 d²: <strong className={tgt.kalman_state.gating_passed ? 'text-emerald-400' : 'text-red-400 font-bold'}>{tgt.kalman_state.mahalanobis_d2}</strong> ({tgt.kalman_state.gating_passed ? '정상 통과' : '⚠️ 게이팅 실패'})</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-2.5 bg-[#0D1526] border-t border-[#00E5FF]/30 flex items-center justify-between text-[10.5px] font-mono text-white/60">
          <span>김포시 & 인천광역시 전지역 광역 C-UAS 무선 정밀 감시망 v4.2</span>
          <span className="text-[#00E5FF] font-bold">5개소 분산 SDR 수신 노드 및 EKF 칼만 센서 융합 인가 완결</span>
        </div>
      </div>
    </div>
  );
}
