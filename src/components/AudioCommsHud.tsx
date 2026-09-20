'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Radio, Volume2, VolumeX, AlertTriangle, Activity, X, ShieldAlert, Wifi } from 'lucide-react';

interface AudioChannel {
  id: string;
  name: string;
  frequency: string;
  category: 'AVIATION' | 'MARITIME' | 'EMERGENCY';
  location: string;
  streamUrl?: string;
  status: 'ACTIVE' | 'STANDBY' | 'TRANSMITTING';
}

const FREQUENCY_CHANNELS: AudioChannel[] = [
  {
    id: 'RKSI_APP',
    name: '인천 접근관제 (Incheon Approach)',
    frequency: '119.75 MHz',
    category: 'AVIATION',
    location: '인천/김포 광역 관제공역',
    status: 'ACTIVE',
  },
  {
    id: 'RKSS_TWR',
    name: '김포 타워 관제 (Gimpo Tower)',
    frequency: '118.10 MHz',
    category: 'AVIATION',
    location: '김포공항 활주로 32L/14R',
    status: 'ACTIVE',
  },
  {
    id: 'EMERGENCY_GUARD',
    name: '국제 항공 비상 가드 (Guard Emergency)',
    frequency: '121.50 MHz',
    category: 'EMERGENCY',
    location: '전 국제공역 비상 청취',
    status: 'STANDBY',
  },
  {
    id: 'VHF_CH16',
    name: '국제 해상 조난/통신 (Marine Ch.16)',
    frequency: '156.80 MHz',
    category: 'MARITIME',
    location: '서해 영해 및 NLL 해역',
    status: 'ACTIVE',
  }
];

export default function AudioCommsHud({ onClose, emergencyFlights = [] }: { onClose?: () => void; emergencyFlights?: any[] }) {
  const [selectedChannel, setSelectedChannel] = useState<AudioChannel>(FREQUENCY_CHANNELS[0]);
  const [isLiveAudio, setIsLiveAudio] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Active Squawk emergency detection from live flights
  const activeSquawkEmergency = emergencyFlights.find(f => f.squawk === '7700' || f.squawk === '7600');

  // Simulated synthetic RF waveform via Web Audio Oscillator / Math function
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const w = 350;
    const h = 70;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    let phase = 0;

    const renderWaveform = () => {
      ctx.clearRect(0, 0, w, h);

      // Grid Lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Waveform Line
      ctx.strokeStyle = isLiveAudio ? '#00E5FF' : 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = isLiveAudio ? 2 : 1.5;
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = isLiveAudio ? 8 : 2;

      ctx.beginPath();
      const midY = h / 2;
      const amplitude = isLiveAudio ? 22 : 7;

      for (let x = 0; x < w; x++) {
        const freqMultiplier = isLiveAudio ? 0.08 : 0.03;
        const noise = isLiveAudio ? (Math.random() - 0.5) * 6 : (Math.random() - 0.5) * 2;
        const y = midY + Math.sin(x * freqMultiplier + phase) * amplitude * Math.sin(x * 0.02) + noise;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      phase += isLiveAudio ? 0.15 : 0.04;
      animationFrameRef.current = requestAnimationFrame(renderWaveform);
    };

    renderWaveform();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isLiveAudio]);

  const toggleAudio = () => {
    setIsLiveAudio(!isLiveAudio);
  };

  return (
    <div className="rounded-2xl border border-[#00E5FF]/30 bg-[#060814]/95 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] p-4 w-80 md:w-96 text-white font-mono z-40 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#00E5FF] animate-pulse" />
          <span className="text-xs font-bold tracking-wider text-[#00E5FF]">
            SIGINT RF · LIVE COMMS HUD
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400">
            1090MHz/VHF
          </span>
          {onClose && (
            <button onClick={onClose} className="text-neutral-400 hover:text-white transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Selected Frequency Banner */}
      <div className="flex items-center justify-between bg-black/60 p-2.5 rounded-xl border border-white/10 mb-3">
        <div>
          <div className="text-[10px] text-neutral-400">{selectedChannel.name}</div>
          <div className="text-lg font-bold text-[#D4AF37] tracking-wider mt-0.5">
            {selectedChannel.frequency}
          </div>
          <div className="text-[9px] text-neutral-500 mt-0.5">{selectedChannel.location}</div>
        </div>

        <button
          onClick={toggleAudio}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            isLiveAudio
              ? 'bg-[#00E5FF] text-black shadow-[0_0_12px_rgba(0,229,255,0.6)]'
              : 'bg-white/10 text-neutral-300 hover:bg-white/20 border border-white/10'
          }`}
        >
          {isLiveAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span>{isLiveAudio ? '수신 중' : '수신 대기'}</span>
        </button>
      </div>

      {/* Realtime RF Oscilloscope */}
      <div className="relative rounded-xl overflow-hidden border border-[#00E5FF]/20 bg-black/80 mb-3">
        <canvas ref={canvasRef} width={350} height={70} className="w-full h-[70px] block" />
        <div className="absolute top-1.5 left-2 text-[8px] text-[#00E5FF]/70 tracking-widest">
          RF SPECTRUM · DISCRETE FOURIER TRANSFORM
        </div>
        <div className="absolute bottom-1.5 right-2 text-[9px] text-neutral-400 flex items-center gap-1">
          <Activity className="w-3 h-3 text-[#00E5FF]" />
          <span>SNR: {isLiveAudio ? '+24.2 dB' : '+6.1 dB'}</span>
        </div>
      </div>

      {/* Frequency Channel Selector */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {FREQUENCY_CHANNELS.map(ch => (
          <button
            key={ch.id}
            onClick={() => setSelectedChannel(ch)}
            className={`text-left p-2 rounded-lg border text-[10px] transition-all cursor-pointer ${
              selectedChannel.id === ch.id
                ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-white shadow-[0_0_8px_rgba(0,229,255,0.2)]'
                : 'bg-black/40 border-white/5 text-neutral-400 hover:border-white/20 hover:text-neutral-200'
            }`}
          >
            <div className="font-bold truncate">{ch.frequency}</div>
            <div className="text-[9px] truncate opacity-70">{ch.id}</div>
          </button>
        ))}
      </div>

      {/* Squawk Emergency Monitor */}
      <div className={`p-2 rounded-xl border flex items-center justify-between ${
        activeSquawkEmergency 
          ? 'bg-red-900/80 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse' 
          : 'bg-red-950/30 border-red-500/30'
      }`}>
        <div className="flex items-center gap-1.5">
          <ShieldAlert className={`w-3.5 h-3.5 ${activeSquawkEmergency ? 'text-white' : 'text-red-400'}`} />
          <span className={`text-[10px] font-bold ${activeSquawkEmergency ? 'text-white' : 'text-red-200'}`}>비상 스쿼크(Squawk) 감시</span>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
          activeSquawkEmergency
            ? 'bg-red-600 text-white font-bold border-red-400'
            : 'bg-red-900/60 text-red-300 border-red-500/40'
        }`}>
          {activeSquawkEmergency ? `🚨 SQUAWK ${activeSquawkEmergency.squawk} (${activeSquawkEmergency.callsign || activeSquawkEmergency.icao24})` : '7700/7600 NORMAL'}
        </span>
      </div>
    </div>
  );
}
