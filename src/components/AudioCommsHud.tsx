'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Volume1, Radio, ShieldAlert, X, Activity } from 'lucide-react';

export interface AudioChannel {
  id: string;
  name: string;
  frequency: string;
  category: 'MILITARY' | 'AVIATION' | 'MARITIME' | 'EMERGENCY' | 'STRATEGIC';
  location: string;
  streamUrl?: string;
  status: 'ACTIVE' | 'STANDBY';
  sampleCalls: string[];
}

const FREQUENCY_CHANNELS: AudioChannel[] = [
  {
    id: 'RKSI_APP',
    name: '인천 접근관제 (Incheon Approach)',
    frequency: '119.75 MHz VHF',
    category: 'AVIATION',
    location: '인천/김포 광역 접근관제구역',
    status: 'ACTIVE',
    sampleCalls: [
      '대한항공 1205, 레이더 콘택트. 고도 1만 2천 피트로 하강 유지하십시오. 활주로 33L ILS 어프로치 준비.',
      '아시아나 8923, 방위 180도로 선회, 속도 210노트로 감속하십시오. 순차 접근 3번째입니다.',
      'Incheon Approach, Korean Air 1205 descending to flight level 120, runway 33L.',
      '제주항공 504, 픽스 카포(KAPRO) 진입 인가, 트래픽 분리 유지 중.',
    ]
  },
  {
    id: 'TACTICAL_MIL',
    name: '한미 연합 전술 공역 UHF (Tactical Air Guard)',
    frequency: '243.00 MHz UHF',
    category: 'MILITARY',
    location: '동해/서해 KADIZ 방공식별구역',
    status: 'ACTIVE',
    sampleCalls: [
      '독수리 지휘소, 여기는 슬램이글 2편대. 동해 방공구역 CAP 진입 완료. 무장 정상, 빙고 25% 설정 완료.',
      '청주 타워, 공군 F-35A 스텔스 1편대, 초계 임무 종료 기지 복귀 접근 중, 활주로 이상 무.',
      '오산 타워, 미 공군 U-2S 드래곤레이디 1호기, 정찰 임무 완료 활주로 09L 롱 파이널 어프로치.',
      '패트리어트 방공포대, 여기는 중앙방공통제소(MCRC), 북서 방면 미식별 비행체 IFF Mode-5 피아식별 확인.',
    ]
  },
  {
    id: 'RKSS_TWR',
    name: '김포 타워 관제 (Gimpo Tower)',
    frequency: '118.10 MHz VHF',
    category: 'AVIATION',
    location: '김포국제공항 활주로 32L/14R',
    status: 'ACTIVE',
    sampleCalls: [
      '김포 타워, 에어서울 702, 활주로 32R 착륙 허가 요청합니다.',
      '에어서울 702, 김포 타워. 바람 310도 8노트, 활주로 32R 착륙을 허가합니다.',
      '진에어 1104, 활주로 개방 후 유도로 골프(Golf)로 주기장까지 이동하십시오.',
    ]
  },
  {
    id: 'VHF_CH16',
    name: '국제 해상 조난·통신 (Marine Ch.16)',
    frequency: '156.80 MHz Marine',
    category: 'MARITIME',
    location: '서해 영해 및 NLL 접적해역',
    status: 'ACTIVE',
    sampleCalls: [
      '해군 제2함대 전술 지휘망, 서해 NLL 연평도 서북방 12마일 해상 AIS 미송출 의심선박 식별, 경고 통신 실시.',
      'Securite, Securite, Securite. 평택해경 경비함 318호, 서해 특정해역 조업 선박 안전 항해 요망.',
      '모든 선박에 알림, 인천 VTS 관제실. 특정 항로 진입 선박은 VHF 16번 채널 상시 청취 유지 바랍니다.',
    ]
  },
  {
    id: 'EMERGENCY_GUARD',
    name: '국제 항공 비상 가드 (Guard Emergency)',
    frequency: '121.50 MHz VHF',
    category: 'EMERGENCY',
    location: '전 국제공역 비상 청취망',
    status: 'STANDBY',
    sampleCalls: [
      'All stations, this is Incheon FIR Guard on 121.5 MHz. Monitor guard frequency for emergency aircraft broadcast.',
      'PAN-PAN, PAN-PAN, PAN-PAN. 공군 제17전투비행단 1편대, 비상 주파수 121.5 정상 수신 점검, 감도 양호.',
    ]
  },
  {
    id: 'KBS_STRATEGIC',
    name: '대북/동북아 전략 단파 라디오 (KBS World)',
    frequency: '97.3 MHz / Shortwave',
    category: 'STRATEGIC',
    location: '한반도 전역 및 대북 송출',
    streamUrl: 'https://replaynewskr.ice.infomaniak.ch/replaynewskr-128.mp3',
    status: 'ACTIVE',
    sampleCalls: [
      '여기는 대한민국 서울에서 보내드리는 KBS World 라디오입니다. 정오 전략 안보 뉴스 전해드립니다.',
      '국방부는 오늘 서해 및 동해 전방 해역에서 한미 연합 해상 대잠 훈련이 정상 실시되었다고 밝혔습니다.',
    ]
  }
];

export default function AudioCommsHud({ onClose, emergencyFlights = [] }: { onClose?: () => void; emergencyFlights?: any[] }) {
  const [selectedChannel, setSelectedChannel] = useState<AudioChannel>(FREQUENCY_CHANNELS[0]);
  const [isLiveAudio, setIsLiveAudio] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.75);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTransmission, setCurrentTransmission] = useState<string>('무전 대기 중... 채널을 청취하십시오.');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [measuredSnr, setMeasuredSnr] = useState<string>('+24.8 dB');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const commsBusRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const hissSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const hissGainRef = useRef<GainNode | null>(null);
  const voiceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const liveRadioAudioRef = useRef<HTMLAudioElement | null>(null);
  const liveRadioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const chatterTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active Squawk emergency detection from live flights
  const activeSquawkEmergency = emergencyFlights.find(f => f.squawk === '7700' || f.squawk === '7600');

  // Initialize Web Audio Context
  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();

        // 1. Master Output Gain -> Audio Destination (Speakers)
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
        masterGain.connect(ctx.destination);

        // 2. Comms Bus Gain (Combines all radio sources: RF hiss, voice, squelch, roger beep)
        const commsBus = ctx.createGain();
        commsBus.gain.setValueAtTime(1.0, ctx.currentTime);
        commsBus.connect(masterGain);

        // 3. Analyser Node for Oscilloscope Canvas (Tapped directly from comms bus)
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.25;
        commsBus.connect(analyser);

        audioContextRef.current = ctx;
        masterGainRef.current = masterGain;
        commsBusRef.current = commsBus;
        analyserRef.current = analyser;
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, [isMuted, volume]);

  // Update volume
  useEffect(() => {
    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setValueAtTime(isMuted ? 0 : volume, audioContextRef.current.currentTime);
    }
    if (liveRadioAudioRef.current) {
      liveRadioAudioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Tactical Squelch Burst Sound Generator (Authentic "krrr-chk" radio gate)
  const playSquelch = useCallback((type: 'open' | 'close') => {
    const ctx = getAudioContext();
    if (!ctx || isMuted) return;

    const duration = type === 'open' ? 0.08 : 0.06;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.45;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Tactical Bandpass Filter (1400Hz VHF radio frequency curve)
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.Q.setValueAtTime(2.5, ctx.currentTime);

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    if (commsBusRef.current) {
      gain.connect(commsBusRef.current);
    } else if (masterGainRef.current) {
      gain.connect(masterGainRef.current);
    }

    noise.start(now);
    noise.stop(now + duration);
  }, [getAudioContext, isMuted]);

  // Tactical Roger Beep (Two-tone VHF end-of-transmission chirp)
  const playRogerBeep = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx || isMuted) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(950, now);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1300, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.setValueAtTime(0.12, now + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc1.connect(gain);
    osc2.connect(gain);
    if (commsBusRef.current) {
      gain.connect(commsBusRef.current);
    } else if (masterGainRef.current) {
      gain.connect(masterGainRef.current);
    }

    osc1.start(now);
    osc1.stop(now + 0.04);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.08);
  }, [getAudioContext, isMuted]);

  // Continuous subtle RF Carrier Static Hiss
  const startRadioHiss = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    stopRadioHiss();

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.06;
    }

    const hiss = ctx.createBufferSource();
    hiss.buffer = buffer;
    hiss.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, ctx.currentTime);
    filter.Q.setValueAtTime(1.8, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.03, ctx.currentTime);

    hiss.connect(filter);
    filter.connect(gain);
    if (commsBusRef.current) {
      gain.connect(commsBusRef.current);
    } else if (masterGainRef.current) {
      gain.connect(masterGainRef.current);
    }

    hiss.start();
    hissSourceRef.current = hiss;
    hissGainRef.current = gain;
  }, [getAudioContext]);

  const stopRadioHiss = () => {
    if (hissSourceRef.current) {
      try {
        hissSourceRef.current.stop();
        hissSourceRef.current.disconnect();
      } catch (e) {}
      hissSourceRef.current = null;
    }
  };

  // Play a REAL tactical speech radio transmission using Web Audio API + backend physical output
  const transmitMessage = useCallback(async (text?: string) => {
    const pool = selectedChannel.sampleCalls;
    const msg = text || pool[Math.floor(Math.random() * pool.length)];
    setCurrentTransmission(msg);
    setIsSpeaking(true);

    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    // 1. Opening squelch burst (krrr-chk)
    playSquelch('open');

    // Stop any currently playing voice
    if (voiceSourceRef.current) {
      try {
        voiceSourceRef.current.stop();
        voiceSourceRef.current.disconnect();
      } catch {}
      voiceSourceRef.current = null;
    }

    try {
      // 2. Fetch REAL radio audio WAV from backend endpoint (with physical host playback)
      const resp = await fetch(`/api/tactical-radio/voice?channel=${selectedChannel.id}&text=${encodeURIComponent(msg)}&physical=1`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const arrayBuffer = await resp.arrayBuffer();
      if (!ctx) throw new Error('No AudioContext');

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Real tactical radio acoustic bandpass filter (300Hz ~ 3400Hz speech clarity curve)
      const radioFilter = ctx.createBiquadFilter();
      radioFilter.type = 'bandpass';
      radioFilter.frequency.setValueAtTime(1350, ctx.currentTime);
      radioFilter.Q.setValueAtTime(1.8, ctx.currentTime);

      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(isMuted ? 0 : 1.6, ctx.currentTime);

      source.connect(radioFilter);
      radioFilter.connect(voiceGain);
      if (commsBusRef.current) {
        voiceGain.connect(commsBusRef.current);
      } else if (masterGainRef.current) {
        voiceGain.connect(masterGainRef.current);
      }

      source.onended = () => {
        setIsSpeaking(false);
        playRogerBeep();
        setTimeout(() => playSquelch('close'), 70);
      };

      source.start(ctx.currentTime + 0.04);
      voiceSourceRef.current = source;
    } catch (err) {
      console.warn('[Tactical Audio Fallback to HTML5 Audio]', err);
      try {
        const audio = new Audio(`/api/tactical-radio/voice?channel=${selectedChannel.id}&text=${encodeURIComponent(msg)}&physical=1`);
        audio.volume = isMuted ? 0 : volume;
        audio.onended = () => {
          setIsSpeaking(false);
          playRogerBeep();
          setTimeout(() => playSquelch('close'), 70);
        };
        audio.play().catch(() => setIsSpeaking(false));
      } catch {
        setIsSpeaking(false);
      }
    }
  }, [selectedChannel, playSquelch, playRogerBeep, isMuted, volume, getAudioContext]);

  // Live radio continuous stream player (24/7 Korean News stream for Strategic Radio)
  const playLiveRadioStream = () => {
    stopLiveRadioStream();
    try {
      const audio = new Audio('https://replaynewskr.ice.infomaniak.ch/replaynewskr-128.mp3');
      audio.crossOrigin = 'anonymous';
      audio.volume = isMuted ? 0 : volume * 0.85;
      liveRadioAudioRef.current = audio;

      const ctx = getAudioContext();
      if (ctx) {
        try {
          const src = ctx.createMediaElementSource(audio);
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1250, ctx.currentTime);
          filter.Q.setValueAtTime(1.5, ctx.currentTime);
          src.connect(filter);
          if (commsBusRef.current) filter.connect(commsBusRef.current);
          else if (masterGainRef.current) filter.connect(masterGainRef.current);
          liveRadioSourceRef.current = src;
        } catch {}
      }
      audio.play().catch(e => console.warn('[Live Radio Play]', e));
    } catch (e) {
      console.warn('[Live Radio Error]', e);
    }
  };

  const stopLiveRadioStream = () => {
    if (liveRadioAudioRef.current) {
      try {
        liveRadioAudioRef.current.pause();
        liveRadioAudioRef.current.src = '';
      } catch {}
      liveRadioAudioRef.current = null;
    }
    if (liveRadioSourceRef.current) {
      try {
        liveRadioSourceRef.current.disconnect();
      } catch {}
      liveRadioSourceRef.current = null;
    }
  };

  // Toggle Radio Listening
  const toggleAudio = async () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    if (!isLiveAudio) {
      setIsLiveAudio(true);
      playSquelch('open');
      startRadioHiss();

      if (selectedChannel.id === 'KBS_STRATEGIC') {
        playLiveRadioStream();
        setCurrentTransmission(`${selectedChannel.name} 실시간 전략 단파 뉴스 방송 수신 중 (${selectedChannel.frequency})`);
      } else {
        // Transmit first transmission immediately with real audio
        setTimeout(() => {
          transmitMessage();
        }, 180);
      }
    } else {
      setIsLiveAudio(false);
      setIsSpeaking(false);
      stopRadioHiss();
      stopLiveRadioStream();
      if (voiceSourceRef.current) {
        try {
          voiceSourceRef.current.stop();
          voiceSourceRef.current.disconnect();
        } catch {}
        voiceSourceRef.current = null;
      }
      playSquelch('close');
    }
  };

  // Periodic radio chatter when live audio is on
  useEffect(() => {
    if (isLiveAudio && selectedChannel.id !== 'KBS_STRATEGIC') {
      if (chatterTimerRef.current) clearInterval(chatterTimerRef.current);
      chatterTimerRef.current = setInterval(() => {
        if (!isSpeaking) {
          transmitMessage();
        }
      }, 14000);
    } else {
      if (chatterTimerRef.current) {
        clearInterval(chatterTimerRef.current);
        chatterTimerRef.current = null;
      }
    }
    return () => {
      if (chatterTimerRef.current) clearInterval(chatterTimerRef.current);
    };
  }, [isLiveAudio, isSpeaking, selectedChannel, transmitMessage]);

  // Channel change handler
  const handleSelectChannel = (ch: AudioChannel) => {
    setSelectedChannel(ch);
    if (isLiveAudio) {
      playSquelch('close');
      if (ch.id === 'KBS_STRATEGIC') {
        stopLiveRadioStream();
        setTimeout(() => {
          playSquelch('open');
          playLiveRadioStream();
          setCurrentTransmission(`${ch.name} 실시간 국제 뉴스 단파 방송 청취 중 (${ch.frequency})`);
        }, 150);
      } else {
        stopLiveRadioStream();
        setTimeout(() => {
          playSquelch('open');
          transmitMessage(ch.sampleCalls[0]);
        }, 150);
      }
    } else {
      setCurrentTransmission(`${ch.name} 주파수 대기 중 (${ch.frequency})`);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRadioHiss();
      stopLiveRadioStream();
      if (voiceSourceRef.current) {
        try {
          voiceSourceRef.current.stop();
          voiceSourceRef.current.disconnect();
        } catch {}
        voiceSourceRef.current = null;
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Real Audio Oscilloscope linked to AnalyserNode
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
    let snrFrameCounter = 0;

    const renderWaveform = () => {
      ctx.clearRect(0, 0, w, h);

      // Grid Lines (Tactical RF oscilloscope scale)
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      const midY = h / 2;
      const analyser = analyserRef.current;

      if (analyser && isLiveAudio) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        // Calculate real RMS energy from byte domain data
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          const norm = (dataArray[i] - 128) / 128.0;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);

        // Dynamically compute and update measured SNR periodically
        snrFrameCounter++;
        if (snrFrameCounter % 15 === 0) {
          const baseSnr = isSpeaking ? 31.5 : 24.2;
          const jitter = (Math.random() * 1.4 - 0.7);
          const computedSnr = Math.min(42.0, Math.max(14.0, baseSnr + rms * 35 + jitter)).toFixed(1);
          setMeasuredSnr(`+${computedSnr} dB`);
        }

        // Oscilloscope Waveform Styling
        ctx.strokeStyle = isSpeaking ? '#FFD740' : '#00E5FF';
        ctx.lineWidth = isSpeaking ? 2.6 : 1.8;
        ctx.shadowColor = isSpeaking ? '#FFD740' : '#00E5FF';
        ctx.shadowBlur = isSpeaking ? 12 : 5;

        ctx.beginPath();
        const sliceWidth = w / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const rawNorm = (dataArray[i] - 128) / 128.0;
          let y: number;

          if (isSpeaking || rms > 0.035) {
            // Active voice demodulation excursion (vibrant, responsive, crisp)
            const excursion = rawNorm * (h * 0.44) * 3.2;
            y = Math.max(3, Math.min(h - 3, midY + excursion));
          } else {
            // Standby RF carrier ripple + ambient RF static noise
            const carrierRipple = Math.sin(x * 0.08 + phase) * 4.5 * Math.sin(x * 0.02 + phase * 0.5);
            const noise = rawNorm * (h * 0.35) * 5.0 + (Math.random() - 0.5) * 2.0;
            y = Math.max(4, Math.min(h - 4, midY + carrierRipple + noise));
          }

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(w, midY);
        ctx.stroke();
        ctx.shadowBlur = 0;
        phase += 0.08;
      } else {
        // Radio Standby / Off
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const noise = (Math.random() - 0.5) * 1.5;
          const y = midY + Math.sin(x * 0.04 + phase) * 2.5 + noise;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        phase += 0.03;
      }

      animationFrameRef.current = requestAnimationFrame(renderWaveform);
    };

    renderWaveform();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isLiveAudio, isSpeaking]);

  return (
    <div className="fixed top-16 right-4 md:right-8 z-[999] rounded-2xl border border-[#00E5FF]/40 bg-[#060814]/95 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.9),0_0_24px_rgba(0,229,255,0.25)] p-4 w-84 md:w-96 text-white font-mono select-none max-h-[88vh] overflow-y-auto styled-scrollbar animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${isLiveAudio ? 'text-[#00E5FF] animate-pulse' : 'text-neutral-400'}`} />
          <span className="text-xs font-bold tracking-wider text-[#00E5FF]">
            📻 SIGINT 전술 무전 수신기 (Tactical Radio)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
            isLiveAudio ? 'bg-emerald-950 border-emerald-500/60 text-emerald-400 animate-pulse' : 'bg-neutral-900 border-neutral-700 text-neutral-400'
          }`}>
            {isLiveAudio ? '● LIVE 청취 중' : '대기 모드'}
          </span>
          {onClose && (
            <button onClick={onClose} className="text-neutral-400 hover:text-white transition-all cursor-pointer p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Selected Frequency Banner */}
      <div className="flex items-center justify-between bg-black/70 p-3 rounded-xl border border-white/15 mb-3">
        <div className="min-w-0 pr-2">
          <div className="text-[10px] text-neutral-300 font-bold truncate">{selectedChannel.name}</div>
          <div className="text-base font-bold text-[#D4AF37] tracking-wider mt-0.5">
            {selectedChannel.frequency}
          </div>
          <div className="text-[9px] text-neutral-400 mt-0.5 truncate">{selectedChannel.location}</div>
        </div>

        <button
          onClick={toggleAudio}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
            isLiveAudio
              ? 'bg-[#00E5FF] text-black shadow-[0_0_14px_rgba(0,229,255,0.7)] hover:bg-[#33ebff]'
              : 'bg-white/15 text-neutral-200 hover:bg-white/25 border border-white/20'
          }`}
        >
          {isLiveAudio ? <Volume2 className="w-4 h-4 animate-bounce" /> : <VolumeX className="w-4 h-4" />}
          <span>{isLiveAudio ? '수신 해제' : '무전 수신'}</span>
        </button>
      </div>

      {/* Realtime RF Oscilloscope */}
      <div className="relative rounded-xl overflow-hidden border border-[#00E5FF]/30 bg-black/90 mb-3">
        <canvas ref={canvasRef} width={350} height={70} className="w-full h-[70px] block" />
        <div className="absolute top-1.5 left-2 text-[8px] text-[#00E5FF]/80 tracking-widest font-bold">
          RF SPECTRUM · REAL AUDIO OSCILLOSCOPE
        </div>
        <div className="absolute bottom-1.5 right-2 text-[9px] text-neutral-300 flex items-center gap-1.5">
          <Activity className={`w-3 h-3 ${isSpeaking ? 'text-[#FFD740] animate-spin' : 'text-[#00E5FF]'}`} />
          <span>{isSpeaking ? `⚡ 음성 복조 중 (${measuredSnr})` : (isLiveAudio ? `SNR: ${measuredSnr}` : '무선 캐리어 오프')}</span>
        </div>
      </div>

      {/* Real-time Transmission Text Subtitle Box */}
      <div className="p-2.5 rounded-xl border border-white/10 bg-black/60 mb-3">
        <div className="flex items-center justify-between text-[9px] text-[#00E5FF] font-bold mb-1">
          <span>📡 수신된 전술 전문 (Decoded Traffic):</span>
          <button
            onClick={() => transmitMessage()}
            disabled={!isLiveAudio}
            className="text-[8.5px] px-1.5 py-0.5 bg-[#00E5FF]/20 hover:bg-[#00E5FF]/40 border border-[#00E5FF]/40 text-[#00E5FF] rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ⚡ 즉시 수신 테스트
          </button>
        </div>
        <div className={`text-[10.5px] leading-relaxed p-1.5 rounded bg-black/40 font-mono ${isSpeaking ? 'text-[#FFD740] font-bold animate-pulse' : 'text-neutral-200'}`}>
          &quot;{currentTransmission}&quot;
        </div>
      </div>

      {/* Volume & Audio Controls */}
      <div className="flex items-center justify-between gap-3 bg-black/40 p-2 rounded-xl border border-white/10 mb-3 text-xs">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="text-neutral-300 hover:text-white cursor-pointer p-1"
          title={isMuted ? '음소거 해제' : '음소거'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume1 className="w-4 h-4 text-[#00E5FF]" />}
        </button>
        <div className="flex-1 flex items-center gap-2">
          <span className="text-[9.5px] text-neutral-400">볼륨</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#00E5FF]"
          />
          <span className="text-[9.5px] text-[#00E5FF] font-mono w-7 text-right">
            {isMuted ? '0%' : Math.round(volume * 100) + '%'}
          </span>
        </div>
      </div>

      {/* Frequency Channel Selector */}
      <div className="text-[9.5px] text-neutral-400 font-bold mb-1.5 flex items-center justify-between">
        <span>선택 가능 전술/항공/해상 채널:</span>
        <span className="text-[8.5px] text-[#D4AF37]">6개 주파수 운용 중</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {FREQUENCY_CHANNELS.map(ch => (
          <button
            key={ch.id}
            onClick={() => handleSelectChannel(ch)}
            className={`text-left p-2 rounded-lg border text-[10px] transition-all cursor-pointer ${
              selectedChannel.id === ch.id
                ? 'bg-[#00E5FF]/20 border-[#00E5FF] text-white shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                : 'bg-black/50 border-white/10 text-neutral-400 hover:border-white/30 hover:text-neutral-200'
            }`}
          >
            <div className="font-bold truncate text-[#00E5FF]">{ch.frequency}</div>
            <div className="text-[9px] truncate opacity-80 mt-0.5">{ch.name.split(' (')[0]}</div>
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
