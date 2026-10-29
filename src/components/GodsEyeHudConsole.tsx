'use client';

import { useState, useEffect, useRef } from 'react';
import { Eye, Radio, Flame, Orbit, Volume2, VolumeX, X, Shield, Navigation } from 'lucide-react';
import type { PropagatedSatelliteState } from '@/lib/gods-eye-bridge/satellite-orbit-engine';
import type { RadioStation } from '@/lib/gods-eye-bridge/sigint-radio-engine';

interface GodsEyeHudConsoleProps {
  visible: boolean;
  onClose: () => void;
  onSelectSatellite: (sat: PropagatedSatelliteState) => void;
  onFlyToOrbit: () => void;
  onFlyToTactical: () => void;
}

export function GodsEyeHudConsole({
  visible,
  onClose,
  onSelectSatellite,
  onFlyToOrbit,
  onFlyToTactical,
}: GodsEyeHudConsoleProps) {
  const [satellites, setSatellites] = useState<PropagatedSatelliteState[]>([]);
  const [radioStations, setRadioStations] = useState<RadioStation[]>([]);
  const [activeStation, setActiveStation] = useState<RadioStation | null>(null);
  const [isPlayingRadio, setIsPlayingRadio] = useState(false);
  const [firmsCount, setFirmsCount] = useState(0);
  const [selectedSatId, setSelectedSatId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 실시간 위성 궤도 텔레메트리 갱신 (10초 주기)
  useEffect(() => {
    if (!visible) return;

    const fetchSatellites = async () => {
      try {
        const res = await fetch('/api/intel/gods-eye/satellites');
        if (res.ok) {
          const data = await res.json();
          setSatellites(data.satellites || []);
          if (!selectedSatId && data.satellites?.length > 0) {
            setSelectedSatId(data.satellites[0].id);
          }
        }
      } catch (err) {
        console.error('[GodsEye] Satellites fetch error:', err);
      }
    };

    const fetchFirms = async () => {
      try {
        const res = await fetch('/api/intel/gods-eye/firms');
        if (res.ok) {
          const data = await res.json();
          setFirmsCount(data.totalCount || 0);
        }
      } catch (err) {
        console.error('[GodsEye] FIRMS fetch error:', err);
      }
    };

    const fetchRadio = async () => {
      try {
        const res = await fetch('/api/intel/gods-eye/radio');
        if (res.ok) {
          const data = await res.json();
          setRadioStations(data.stations || []);
          if (data.stations?.length > 0) {
            setActiveStation(data.stations[0]);
          }
        }
      } catch (err) {
        console.error('[GodsEye] Radio fetch error:', err);
      }
    };

    fetchSatellites();
    fetchFirms();
    fetchRadio();

    const interval = setInterval(fetchSatellites, 10000);
    return () => clearInterval(interval);
  }, [visible, selectedSatId]);

  // 오디오 스트림 제어
  const togglePlayRadio = () => {
    if (!audioRef.current && activeStation) {
      audioRef.current = new Audio(activeStation.streamUrl);
      audioRef.current.volume = 0.5;
    }

    if (isPlayingRadio) {
      audioRef.current?.pause();
      setIsPlayingRadio(false);
    } else {
      if (audioRef.current && activeStation) {
        audioRef.current.src = activeStation.streamUrl;
        audioRef.current.play().then(() => {
          setIsPlayingRadio(true);
        }).catch((e) => {
          console.warn('[GodsEye] Radio play failed (CORS/Gesture):', e);
          setIsPlayingRadio(false);
        });
      }
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-20 right-4 z-[999] w-[340px] max-w-[90vw] bg-black/85 backdrop-blur-md border border-[#D4AF37]/50 rounded-xl shadow-[0_0_30px_rgba(212,175,55,0.3)] font-mono text-white text-xs overflow-hidden select-none animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-[#D4AF37]/20 via-black to-[#00E5FF]/20 border-b border-[#D4AF37]/40">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#D4AF37] animate-pulse" />
          <span className="font-bold tracking-wider text-white">신의 눈 (GOD&apos;S EYE)</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#D4AF37]/30 text-[#D4AF37] font-semibold">
            LIVE ORBIT
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-white transition-colors cursor-pointer p-0.5"
          title="콘솔 닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Camera View Switcher */}
      <div className="p-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between gap-1.5">
        <button
          onClick={onFlyToOrbit}
          className="flex-1 py-1 px-2 rounded bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] border border-[#D4AF37]/40 text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
        >
          <Orbit className="w-3 h-3" />
          <span>우주 궤도 뷰</span>
        </button>
        <button
          onClick={onFlyToTactical}
          className="flex-1 py-1 px-2 rounded bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 text-[#00E5FF] border border-[#00E5FF]/40 text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
        >
          <Navigation className="w-3 h-3" />
          <span>전술 지상 뷰</span>
        </button>
      </div>

      {/* Satellites List */}
      <div className="p-2.5 space-y-1.5 max-h-[160px] overflow-y-auto">
        <div className="text-[9px] text-[#D4AF37] font-bold flex items-center justify-between uppercase">
          <span>📡 실시간 궤도 전파 위성 ({satellites.length})</span>
          <span className="text-white/40">SGP4 PROPAGATOR</span>
        </div>
        {satellites.map((sat) => {
          const isSelected = selectedSatId === sat.id;
          return (
            <div
              key={sat.id}
              onClick={() => {
                setSelectedSatId(sat.id);
                onSelectSatellite(sat);
              }}
              className={`p-1.5 rounded border transition-all cursor-pointer flex flex-col gap-0.5 ${
                isSelected
                  ? 'bg-[#D4AF37]/20 border-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.4)]'
                  : 'bg-black/40 border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-[10px]">
                <span className="truncate max-w-[180px]" style={{ color: sat.color }}>
                  {sat.name}
                </span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-white/80">
                  {sat.mission}
                </span>
              </div>
              <div className="flex items-center justify-between text-[9px] text-white/60">
                <span>고도 {sat.altKm} km · 속도 {sat.velocityKms} km/s</span>
                <span>{sat.lat > 0 ? `${sat.lat}°N` : `${Math.abs(sat.lat)}°S`}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* NASA FIRMS Thermal Summary */}
      <div className="px-2.5 py-2 bg-black/60 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px]">
          <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          <span className="text-white/80">NASA FIRMS 적외선 열원</span>
        </div>
        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-bold">
          {firmsCount}개 감지 중
        </span>
      </div>

      {/* SIGINT Tactical Radio Player */}
      <div className="p-2.5 bg-black/80 border-t border-white/10 space-y-1.5">
        <div className="flex items-center justify-between text-[9px] text-[#00E5FF] font-bold uppercase">
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-[#00E5FF]" />
            <span>전술 무전 (SIGINT RADIO)</span>
          </span>
          <span className="text-white/40">{activeStation?.freq || '118.2 MHz'}</span>
        </div>
        
        <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-black/60 border border-white/15">
          <div className="truncate text-[9px]">
            <div className="text-white font-bold truncate">{activeStation?.name || '인천공항 관제탑'}</div>
            <div className="text-white/50 text-[8px] truncate">{activeStation?.description}</div>
          </div>
          <button
            onClick={togglePlayRadio}
            className={`p-1.5 rounded-full transition-all shrink-0 cursor-pointer ${
              isPlayingRadio
                ? 'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse'
                : 'bg-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF]/40 border border-[#00E5FF]/40'
            }`}
            title={isPlayingRadio ? '무전 수신 중지' : '실시간 전술 무전 수신 시작'}
          >
            {isPlayingRadio ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-black text-[8px] text-white/40 flex items-center justify-between border-t border-white/5">
        <span className="flex items-center gap-1">
          <Shield className="w-2.5 h-2.5 text-[#D4AF37]" />
          <span>bilawalsidhu/gods-eye-view v0.2.1 융합</span>
        </span>
        <span className="text-emerald-400">● TELEMETRY SYNCED</span>
      </div>
    </div>
  );
}
