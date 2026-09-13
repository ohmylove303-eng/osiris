'use client';

import React, { useState, useEffect } from 'react';
import { Eye, Image as ImageIcon, Sparkles, CheckCircle2, Zap, RefreshCw, Film, Play, Video, Send, Wand2, Compass, Layers, Cpu, ShieldCheck, ChevronRight, Sliders } from 'lucide-react';

interface OcrRegion {
  text: string;
  confidence: number;
  bbox: number[][];
}

interface DirectorPlan {
  title: string;
  scene_concept: string;
  stage1_ltx: string;
  stage2_cog: string;
  stage3_wan: string;
  diffusion_prompt: string;
  motion: string;
  fps?: number;
  duration_sec?: number;
}

const PRESET_PROMPTS = [
  '🛰️ 한반도 야간 상공 정찰위성 궤도 뷰',
  '🚢 서해 NLL 해역 초계 고속정 기동',
  '✈️ 독도 상공 공군 F-35A 초계 비행',
  '⚡ 사이버 작전사령부 양자 위협 추적',
  '🌊 동해 해저 잠수함 음향 탐지 기동',
  '🚀 우주 궤도 조기경보위성 적외선 스캔'
];

export default function BananaVisionStudio() {
  const [data, setData] = useState<{
    imageUrl: string | null;
    videoUrl: string | null;
    directorEngine?: string;
    pipelineStages?: { stage: number; name: string; role: string }[];
    ocrEngine: string;
    vlmModel: string;
    plan?: DirectorPlan | null;
    ocrResults: OcrRegion[];
  } | null>(null);

  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('/osiris_ai_generated.mp4');
  const [currentPlan, setCurrentPlan] = useState<DirectorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [renderingVideo, setRenderingVideo] = useState(false);
  const [mediaMode, setMediaMode] = useState<'video' | 'image'>('video');
  const [activeTab, setActiveTab] = useState<'director' | 'history'>('director');

  // Creation State
  const [prompt, setPrompt] = useState('한반도 야간 상공 정찰위성 궤도 뷰');
  const [motion, setMotion] = useState<'zoom' | 'orbit' | 'pan'>('orbit');
  const [history, setHistory] = useState<{ prompt: string; url: string; motion: string; plan?: DirectorPlan | null }[]>([
    {
      prompt: '한반도 야간 상공 정찰위성 궤도 뷰',
      url: '/osiris_ai_generated.mp4',
      motion: 'orbit',
      plan: {
        title: '정찰위성 우주 궤도 영상: 한반도 야간 상공',
        scene_concept: '저궤도(LEO 450km) 상공에서 한반도를 관측하며 지표면 야간 도시 광망 및 대기권 지평선을 적외선/광학 복합 센서로 추적',
        stage1_ltx: 'LTX-Video 0.9B: 초당 7.6km 궤도 속도감 및 카메라 롤각(Roll) 3차원 레이아웃 확정',
        stage2_cog: 'CogVideoX-2B: 대기 산란광(Rayleigh Scattering) 및 야간 도시 그리드 불빛의 3D Causal 시공간 연속성 합성',
        stage3_wan: 'Wan 2.1 1.3B: 해안선 지형 굴곡, 서해안 해무, 위성 메탈릭 프레임 질감 SOTA 디테일 마스터 렌더링',
        diffusion_prompt: 'Cinematic 4K satellite POV looking down at earth, glowing city lights, deep black space horizon with atmospheric glow, orbit camera movement, ultra-detailed, 24fps',
        motion: 'orbit'
      }
    }
  ]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/vision/banana');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.videoUrl) {
          setCurrentVideoUrl(json.videoUrl);
        }
        if (json.plan) {
          setCurrentPlan(json.plan);
        } else if (history[0]?.plan) {
          setCurrentPlan(history[0].plan);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || renderingVideo) return;

    setRenderingVideo(true);
    try {
      const res = await fetch('/api/vision/banana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), motion })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.videoUrl) {
          setCurrentVideoUrl(json.videoUrl);
          if (json.plan) {
            setCurrentPlan(json.plan);
          }
          setHistory(prev => [{ prompt: json.prompt, url: json.videoUrl, motion: json.motion, plan: json.plan }, ...prev]);
          setMediaMode('video');
          setActiveTab('director');
        }
      }
    } catch (err) {
      console.error('Video creation failed:', err);
    } finally {
      setRenderingVideo(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 overflow-hidden font-sans p-5 space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/40 rounded-xl text-amber-400">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              OSIRIS 로컬 AI 자율 영상 제작 스튜디오
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                3-STAGE PIPELINE
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Apple M5 Metal 가속 · 1~3순위 단계별 모델 협력 (LTX-Video → CogVideoX → Wan 2.1)
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-mono">
            <button
              onClick={() => setMediaMode('video')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                mediaMode === 'video' ? 'bg-amber-500 text-black font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-3.5 h-3.5" /> 🎬 자율 제작 영상
            </button>
            <button
              onClick={() => setMediaMode('image')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                mediaMode === 'image' ? 'bg-indigo-600 text-white font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" /> 🖼️ 정지 영상 & OCR
            </button>
          </div>

          <button
            onClick={fetchData}
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Interactive Creation Toolbar */}
      <form onSubmit={handleCreateNewVideo} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Wand2 className="w-4 h-4 text-amber-400" />
            </div>
            <input
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="추상적인 지시를 입력하면 로컬 AI 감독이 구체적인 3단계 설계 계획을 수립합니다 (예: 한반도 야간 상공 정찰위성...)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-all font-sans"
            />
          </div>

          {/* Camera Motion Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-xl shrink-0 text-xs font-mono">
            <span className="text-[11px] text-slate-500 px-2 flex items-center gap-1">
              <Compass className="w-3 h-3 text-amber-400" /> 카메라 앵글:
            </span>
            {(['orbit', 'zoom', 'pan'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMotion(m)}
                className={`px-2.5 py-1.5 rounded-lg uppercase transition-colors ${
                  motion === m ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'orbit' ? '궤도회전' : m === 'zoom' ? '줌인' : '패닝'}
              </button>
            ))}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={renderingVideo || !prompt.trim()}
            className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-cyan-500 hover:from-amber-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs md:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all shrink-0 font-mono"
          >
            {renderingVideo ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
                <span>AI 감독 자율 기획 & 렌더링...</span>
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                <span>자율 기획 및 제작 시작</span>
              </>
            )}
          </button>
        </div>

        {/* Preset Prompt Suggestions */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-800/60 text-[11px] font-mono">
          <span className="text-slate-500 mr-1">추천 작전 테마:</span>
          {PRESET_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPrompt(p)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 hover:border-amber-400/60 rounded-lg text-slate-400 hover:text-amber-300 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </form>

      {/* Main Studio Display Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-hidden">
        {/* Left: Media Player (Video or Image) */}
        <div className="lg:col-span-7 flex flex-col bg-slate-900/60 border border-slate-800 rounded-2xl p-4 overflow-hidden relative">
          <div className="flex items-center justify-between mb-2 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-amber-400">
              {mediaMode === 'video' ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
              {mediaMode === 'video' ? '실시간 렌더링 비디오 (24fps H.264)' : '정지 위성 영상'}
            </span>
            <span className="bg-cyan-500/10 text-cyan-400 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
              Apple Silicon M5 GPU 가속
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden relative group p-2 min-h-[280px]">
            {mediaMode === 'video' ? (
              currentVideoUrl ? (
                <video
                  key={currentVideoUrl}
                  src={currentVideoUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain rounded-lg shadow-2xl"
                />
              ) : (
                <div className="text-center p-8 text-slate-500 text-xs font-mono">
                  동영상을 생성해주세요.
                </div>
              )
            ) : (
              data?.imageUrl ? (
                <img
                  src={data.imageUrl}
                  alt="Satellite Visual"
                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="text-center p-8 text-slate-500 text-xs font-mono">
                  이미지 로딩 중...
                </div>
              )
            )}
          </div>

          {/* Video Metadata Tag Bar */}
          {mediaMode === 'video' && (
            <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="truncate max-w-[280px] text-amber-300 font-bold">
                ▶ {currentPlan?.title || prompt}
              </span>
              <span>120 프레임 (24fps · 5.0초)</span>
              <span>960×540 시네마틱</span>
            </div>
          )}
        </div>

        {/* Right: AI Director's Storyboard & Multi-Stage Spec */}
        <div className="lg:col-span-5 flex flex-col bg-slate-900/60 border border-slate-800 rounded-2xl p-4 overflow-hidden space-y-3">
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('director')}
              className={`text-xs font-mono font-bold flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${
                activeTab === 'director' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" /> 🎬 AI 감독 연출 기획서
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`text-xs font-mono font-bold flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${
                activeTab === 'history' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-3.5 h-3.5" /> 보관함 ({history.length})
            </button>
          </div>

          {activeTab === 'director' ? (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 styled-scrollbar text-xs font-mono">
              {/* Scene Concept Box */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[11px] text-amber-400 font-bold flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" /> 장면 연출 컨셉트
                </div>
                <p className="text-slate-300 leading-relaxed font-sans text-xs">
                  {currentPlan?.scene_concept || '추상적 지시를 기반으로 3D 지형 곡률과 광학 시뮬레이션 환경을 구축 중입니다.'}
                </p>
              </div>

              {/* 3-Stage Model Cooperation Strategy */}
              <div className="space-y-2">
                <div className="text-[11px] text-cyan-400 font-bold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> 1~3순위 단계별 모델 파이프라인
                </div>

                {/* Stage 1: LTX-Video */}
                <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-indigo-400 font-bold">
                    <span>1단계: LTX-Video 0.9B</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      고속 프리뷰 (20s)
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    {currentPlan?.stage1_ltx || '거시적 카메라 궤적 및 속도감 초벌 레이아웃 확정'}
                  </p>
                </div>

                {/* Stage 2: CogVideoX */}
                <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold">
                    <span>2단계: CogVideoX-2B</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      3D Causal VAE
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    {currentPlan?.stage2_cog || '대기 산란광 및 도시 그리드 불빛의 시공간 연속성 합성'}
                  </p>
                </div>

                {/* Stage 3: Wan 2.1 */}
                <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold">
                    <span>3단계: Wan 2.1 1.3B</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Flow Matching DiT
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-sans">
                    {currentPlan?.stage3_wan || '지표면 텍스처, 해무, 메탈릭 프레임 질감 SOTA 디테일 마스터링'}
                  </p>
                </div>
              </div>

              {/* Diffusion Prompt */}
              {currentPlan?.diffusion_prompt && (
                <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                    AI 감독 생성 영문 디퓨전 프롬프트:
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono leading-tight">
                    {currentPlan.diffusion_prompt}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Section: Video History */
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 styled-scrollbar">
              {history.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentVideoUrl(item.url);
                    setPrompt(item.prompt);
                    if (item.plan) setCurrentPlan(item.plan);
                    setMediaMode('video');
                  }}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    currentVideoUrl === item.url
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-200'
                      : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-400">
                      <Play className="w-3 h-3 fill-current" />
                    </div>
                    <span className="text-xs font-medium truncate">{item.prompt}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 px-2 py-0.5 bg-slate-900 rounded shrink-0">
                    {item.motion.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Engine Specs Status Bar */}
          <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Apple Silicon M5 (32GB) 로컬 추론 파이프라인 가동</span>
            </div>
            <div className="text-slate-500 text-[10px]">
              엔진: MLX-LM AI Director + PyTorch MPS + 3-Stage Video Harness
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

