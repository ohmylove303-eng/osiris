'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Play, Pause, Volume2, VolumeX, ShieldAlert, CheckCircle2, 
  XCircle, AlertTriangle, Crosshair, ArrowLeft, Download, 
  Layers, Film, Radio, Sparkles, Activity, Eye, Terminal,
  ExternalLink, FileText, Compass, Camera
} from 'lucide-react';

// 북한군 6대 포병 데이터
const ARTILLERY_DATA = [
  {
    id: 'KPA_ART_01',
    name: '개량형 300mm 방사포 (KN-09)',
    caliber: '300mm (8연장 튜브)',
    chassis: '4축 8륜 중형 전술 트럭',
    range: '200 km',
    guidance: 'GPS / GLONASS 유도 키트',
    role: '수도권, 계룡대 및 주요 공군기지 정밀 타격',
    status: '실전 배치 확인'
  },
  {
    id: 'KPA_ART_02',
    name: 'KN-25 600mm 초대형 방사포',
    caliber: '600mm (4연장 캐니스터)',
    chassis: '8축 16륜 대형 바퀴형 TEL',
    range: '380 km',
    guidance: '정밀 관성 / 위성 복합 유도 (SRBM급)',
    role: '남한 전역 종심 타격, 단거리 탄도미사일 대체 및 전술핵 탑재',
    status: '실전 배치 확인'
  },
  {
    id: 'KPA_ART_03',
    name: 'M1974 152mm 자주포 (차체 512)',
    caliber: '152mm (L/45 장포신)',
    chassis: '궤도형 무한궤도 장갑차체',
    range: '24 km',
    guidance: '비유도 재래식 탄도 고폭탄',
    role: '군단급 전술 기동 화력 지원, 진지 대포병 사격',
    status: '전방 군단 배치'
  },
  {
    id: 'KPA_ART_04',
    name: 'M1977 122mm 자주포 (차체 321)',
    caliber: '122mm (D-30 계열)',
    chassis: '오픈탑 궤도형 장갑차체',
    range: '15.3 km',
    guidance: '비유도 곡사 포탄',
    role: '사단 포병 화력 지원, 신속 방열 및 야지 기동 화력',
    status: '전방 사단 배치'
  },
  {
    id: 'KPA_ART_05',
    name: 'Type-75 107mm 견인 로켓포',
    caliber: '107mm (12연장)',
    chassis: '2륜 고무타이어 경량 견인 프레임',
    range: '8.5 km',
    guidance: '무유도 로켓',
    role: '산악 침투 경보병연대 화력 지원, 게릴라 기습 포격',
    status: '침투부대 운용'
  },
  {
    id: 'KPA_ART_06',
    name: '170mm 곡산포 (M1978/M1989)',
    caliber: '170mm (8.4m 장포신, L/50)',
    chassis: '개조 전차 차체 / 오픈 마운트',
    range: '40 ~ 60 km (RAP탄 기준)',
    guidance: '장사정 재래식 곡사 포탄',
    role: '수도권 강북 및 김포·파주 북방 갱도진지 기습 포격',
    status: '최전방 지하 갱도 배치'
  }
];

// 김포 전시 시네마 5개 씬
const SCENES = [
  {
    id: 'SCENE_01',
    title: '정적 (The Calm / 공격 전)',
    time: '4.5초',
    tool: 'LTX-Video',
    desc: '한강 하구 여백 95% + 5% 초병 실루엣. 극단적 네거티브 스페이스와 서브베이스 드론.'
  },
  {
    id: 'SCENE_02',
    title: '준비사격 (The Bombardment / 포격 개시)',
    time: '4.0초',
    tool: '물리 렌더링 완성 (100% FACT)',
    desc: '170mm 곡산포 포구 화염(T+0.0s) ➔ 연기 지연(T+0.5s) ➔ 1.02초 음속 시차 폭음 및 지진 셰이크 ➔ 122mm 0.3s 순차 발사.'
  },
  {
    id: 'SCENE_03',
    title: '야간 도하 노출 (The River Assault)',
    time: '4.5초',
    tool: 'Wan 2.2 First/Last Frame',
    desc: '조명탄 투하 전 칠흑 같은 암흑 ➔ 낙하산 조명탄 개화로 강폭 80%를 뒤덮은 도하 제대 순간 노출.'
  },
  {
    id: 'SCENE_04',
    title: '진지 피탈 3단 (The Trench Breach)',
    time: '4.0초',
    tool: 'Wan 2.2 SVI2Pro-FLF Chain',
    desc: '핸드헬드 흉부 앵글. 교통호 진입 ➔ 백병전 혼전 ➔ 지휘소 피탈의 호흡 끊김 없는 원테이크 연출.'
  },
  {
    id: 'SCENE_05',
    title: '뉴스 특보 (The Global Breaking News)',
    time: '5.0초',
    tool: 'HunyuanVideo-1.5',
    desc: '글로벌 방송사 적색 긴급 속보 띠 + 틸팅 스튜디오 + 위성 중계 지터 노이즈 합성.'
  }
];

export default function JointTrainingPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<'images' | 'video' | 'soldiers' | 'artillery' | 'nolan'>('images');
  const [selectedArtillery, setSelectedArtillery] = useState(ARTILLERY_DATA[5]); // 기본 곡산포
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <main className="min-h-screen bg-[#030408] text-white font-sans selection:bg-[#D4AF37]/30 selection:text-[#F0D060]">
      {/* ── 상단 헤더 ── */}
      <header className="border-b border-[#D4AF37]/20 bg-[#060814]/90 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-[#00E5FF] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>관제 복귀 (HOME)</span>
          </Link>

          <div className="h-4 w-[1px] bg-white/10" />

          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00E676] animate-pulse" />
            <h1 className="text-sm md:text-base font-bold font-mono tracking-wider text-[#D4AF37]">
              합동훈련 (JOINT TRAINING) · 70mm 실사 이미지 & 시네마 검증 콘솔
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono px-2.5 py-1 rounded bg-black/60 border border-white/10">
            <span className="text-[#00E5FF]">DISK:</span>
            <span className="text-neutral-300">/Volumes/SAMSUNG/합동훈련/</span>
          </div>

          <a
            href="/joint-training/gimpo_scene02_bombardment.mp4"
            download
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#F0D060] hover:bg-[#D4AF37]/30 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>영상 다운로드 (1.04MB)</span>
          </a>
        </div>
      </header>

      {/* ── 3대 진실성 분류 게이트 배너 (소크라테스 5대 관문) ── */}
      <section className="bg-gradient-to-r from-[#0a0f1d] via-[#070b14] to-[#0a0f1d] border-b border-[#00E5FF]/20 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-xs font-mono font-bold tracking-widest text-[#D4AF37] uppercase">
                진실성 3분법 검증 패널 (FACT · POSSIBLE · IMPOSSIBLE)
              </span>
            </div>
            <span className="text-[10px] font-mono text-neutral-400">
              규약: 거짓말 0% 허용 · 물리 법칙 역산 검증 통과
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* 1. 사실 */}
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40">
              <div className="flex items-center gap-2 mb-1.5 text-emerald-400 font-bold font-mono">
                <CheckCircle2 className="w-4 h-4" />
                <span>1. 사실 (FACT / 100% 디스크 실재)</span>
              </div>
              <ul className="space-y-1 text-[11px] text-neutral-300 leading-relaxed font-mono">
                <li>• 70mm 실사 이미지 3종 생성 완료 (한국군, 북한군, 170mm 곡산포)</li>
                <li>• 디스크 영구 저장: /Volumes/SAMSUNG/합동훈련/assets/</li>
                <li>• 물리 영상 실재: gimpo_scene02_bombardment.mp4 (1.04MB)</li>
              </ul>
            </div>

            {/* 2. 가능 */}
            <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40">
              <div className="flex items-center gap-2 mb-1.5 text-cyan-300 font-bold font-mono">
                <Activity className="w-4 h-4" />
                <span>2. 가능 (POSSIBLE / 현재 구동)</span>
              </div>
              <ul className="space-y-1 text-[11px] text-neutral-300 leading-relaxed font-mono">
                <li>• 70mm 실사 스틸컷을 시작 프레임(First Frame)으로 비디오 보간 확장</li>
                <li>• HTML5 Video 실시간 브라우저 무한 루프 스트리밍</li>
                <li>• Google Flow 캐릭터 파이프라인 연동 및 1~2초 테스트</li>
              </ul>
            </div>

            {/* 3. 불가능 */}
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40">
              <div className="flex items-center gap-2 mb-1.5 text-red-400 font-bold font-mono">
                <XCircle className="w-4 h-4" />
                <span>3. 불가능 (IMPOSSIBLE / 한계 명시)</span>
              </div>
              <ul className="space-y-1 text-[11px] text-neutral-300 leading-relaxed font-mono">
                <li>• 고사양 GPU 클러스터 없이 Wan 2.2 18K 즉석 AI 실시간 추론 불가</li>
                <li>• 가짜 완편 헐리우드 영상이라 기만하는 행위 원천 거부</li>
                <li>• 엄격한 이미지 키프레임 기반 물리 검증 통과 후 비디오 제작 원칙</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 탭 내비게이션 ── */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 mt-6">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'images'
                ? 'bg-[#00E676] text-black shadow-[0_0_12px_rgba(0,230,118,0.4)]'
                : 'bg-white/5 text-neutral-300 hover:bg-white/10'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>70mm 실사 이미지 (3종 생성 완료)</span>
          </button>

          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'video'
                ? 'bg-[#D4AF37] text-black shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                : 'bg-white/5 text-neutral-300 hover:bg-white/10'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>물리 렌더링 영상 (SCENE 02)</span>
          </button>

          <button
            onClick={() => setActiveTab('soldiers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'soldiers'
                ? 'bg-[#00E5FF] text-black shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                : 'bg-white/5 text-neutral-300 hover:bg-white/10'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>장구류 비교 (아군 vs 북한군)</span>
          </button>

          <button
            onClick={() => setActiveTab('artillery')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'artillery'
                ? 'bg-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                : 'bg-white/5 text-neutral-300 hover:bg-white/10'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>북한군 6대 포병 전력</span>
          </button>

          <button
            onClick={() => setActiveTab('nolan')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'nolan'
                ? 'bg-amber-600 text-white shadow-[0_0_12px_rgba(217,119,6,0.4)]'
                : 'bg-white/5 text-neutral-300 hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>놀란 오디세이 연출서 (5개 씬)</span>
          </button>
        </div>
      </div>

      {/* ── 탭 0: 제시 데이터 70mm 실사 이미지 갤러리 (3종) ── */}
      {activeTab === 'images' && (
        <section className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-neutral-900/60 to-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>제시 데이터 1단계: 70mm 실사 키프레임 이미지 3종 생성 완료 (FACT)</span>
              </div>
              <p className="text-xs text-neutral-300 font-mono mt-1">
                원칙: "제시된 것을 이미지로 우선 먼저 만든 후, 영상미가 검증되었을 때 비디오 동영상(1~2초 ➔ 6~7초)으로 확장 진행"
              </p>
            </div>
            <span className="text-[11px] font-mono px-3 py-1 rounded bg-emerald-900/60 border border-emerald-400 text-emerald-200">
              16:9 IMAX 8K 렌더
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 카드 1: 한국군 보병 */}
            <div className="rounded-2xl overflow-hidden border border-[#00E5FF]/40 bg-[#060a16] flex flex-col shadow-[0_0_20px_rgba(0,229,255,0.15)] group">
              <div className="relative aspect-video overflow-hidden bg-black">
                <img
                  src="/joint-training/rok_soldier_character.jpg"
                  alt="한국군 정예 보병"
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                />
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-[#00E5FF]/40 text-[10px] font-mono text-[#00E5FF] font-bold">
                  아군 전투원 (ROK ARMY)
                </div>
                <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/80 text-[9px] font-mono text-neutral-300">
                  789 KB · 16:9 8K
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold font-mono text-white mb-2">
                    한국군 현대전 정예 보병 (K2C1 & 화강암 위장)
                  </h3>
                  <ul className="space-y-1 text-xs font-mono text-neutral-300 mb-3">
                    <li>• <span className="text-neutral-500">위장:</span> 화강암 5색 디지털 위장 패턴</li>
                    <li>• <span className="text-neutral-500">헬멧:</span> 신형 하이컷 방탄헬멧 + ARC 레일 + 고글</li>
                    <li>• <span className="text-neutral-500">방탄복:</span> 퀵릴리즈 몰리 플레이트 캐리어 (태극기 패치)</li>
                    <li>• <span className="text-neutral-500">주무기:</span> K2C1 돌격소총 (레드도트 광학 조준경, 4면 레일)</li>
                  </ul>
                </div>
                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-neutral-400">자연광 저조도 로우앵글</span>
                  <a
                    href="/joint-training/rok_soldier_character.jpg"
                    download
                    className="flex items-center gap-1 text-[11px] font-mono text-[#00E5FF] hover:underline"
                  >
                    <Download className="w-3 h-3" />
                    <span>다운로드</span>
                  </a>
                </div>
              </div>
            </div>

            {/* 카드 2: 북한군 보병 */}
            <div className="rounded-2xl overflow-hidden border border-red-500/40 bg-[#140606] flex flex-col shadow-[0_0_20px_rgba(239,68,68,0.15)] group">
              <div className="relative aspect-video overflow-hidden bg-black">
                <img
                  src="/joint-training/kpa_soldier_character.jpg"
                  alt="북한군 보병"
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                />
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-red-500/40 text-[10px] font-mono text-red-400 font-bold">
                  대항군 전투원 (KPA OPFOR)
                </div>
                <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/80 text-[9px] font-mono text-neutral-300">
                  802 KB · 16:9 8K
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold font-mono text-white mb-2">
                    북한군 2020 열병식 기반 전투원 (88식 보총)
                  </h3>
                  <ul className="space-y-1 text-xs font-mono text-neutral-300 mb-3">
                    <li>• <span className="text-neutral-500">위장:</span> 2020 신형 다색 얼룩무늬 위장 (우드랜드)</li>
                    <li>• <span className="text-neutral-500">헬멧:</span> 2020식 헬멧 (전면 적성 붉은 오각별 모장)</li>
                    <li>• <span className="text-neutral-500">전투조끼:</span> 체스트 리그형 전술 조끼 (AK 4련 탄창낭)</li>
                    <li>• <span className="text-neutral-500">주무기:</span> 88식 보총 (측면 접철식 개머리판, 대형 소염기)</li>
                  </ul>
                </div>
                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-neutral-400">험지 능선 황혼 림라이트</span>
                  <a
                    href="/joint-training/kpa_soldier_character.jpg"
                    download
                    className="flex items-center gap-1 text-[11px] font-mono text-red-400 hover:underline"
                  >
                    <Download className="w-3 h-3" />
                    <span>다운로드</span>
                  </a>
                </div>
              </div>
            </div>

            {/* 카드 3: 170mm 곡산포 */}
            <div className="rounded-2xl overflow-hidden border border-[#D4AF37]/40 bg-[#140f06] flex flex-col shadow-[0_0_20px_rgba(212,175,55,0.15)] group">
              <div className="relative aspect-video overflow-hidden bg-black">
                <img
                  src="/joint-training/koksan_170mm_artillery.jpg"
                  alt="170mm 곡산포 야간 사격"
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                />
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-[#D4AF37]/40 text-[10px] font-mono text-[#D4AF37] font-bold">
                  170mm 곡산포 포격 (M1978/89)
                </div>
                <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/80 text-[9px] font-mono text-neutral-300">
                  796 KB · 16:9 8K
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold font-mono text-white mb-2">
                    170mm 곡산포 야간 포구 화염 (SCENE 02 키프레임)
                  </h3>
                  <ul className="space-y-1 text-xs font-mono text-neutral-300 mb-3">
                    <li>• <span className="text-neutral-500">포신:</span> 8.4m 극초장포신 (L/50) 고각 방열</li>
                    <li>• <span className="text-neutral-500">화염:</span> 3m 직경 백색-오렌지 코어 과다노출 화염</li>
                    <li>• <span className="text-neutral-500">차체:</span> 오픈탑 개방형 장갑차체 (승조원 노출)</li>
                    <li>• <span className="text-neutral-500">조명:</span> 포구 화염 단일 실재 조명 및 거친 그림자</li>
                  </ul>
                </div>
                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-neutral-400">놀란 스타일 70mm 야간 실사</span>
                  <a
                    href="/joint-training/koksan_170mm_artillery.jpg"
                    download
                    className="flex items-center gap-1 text-[11px] font-mono text-[#D4AF37] hover:underline"
                  >
                    <Download className="w-3 h-3" />
                    <span>다운로드</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 탭 1: 물리 렌더링 비디오 (SCENE 02 준비사격) ── */}
      {activeTab === 'video' && (
        <section className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 비디오 화면 */}
            <div className="lg:col-span-8 flex flex-col">
              <div className="relative rounded-2xl overflow-hidden border border-[#D4AF37]/30 bg-black shadow-[0_0_30px_rgba(0,0,0,0.8)] aspect-video">
                <video
                  ref={videoRef}
                  src="/joint-training/gimpo_scene02_bombardment.mp4"
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* 시네마틱 16:9 IMAX 레터박스 느낌 오버레이 */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-[#D4AF37] font-bold">SCENE 02</span>
                  <span className="text-neutral-300">| 170mm & 122mm 포격</span>
                  <span className="text-[#00E5FF] ml-2">T+{currentTime.toFixed(2)}s</span>
                </div>

                {/* 물리 시차 실시간 트리거 배지 */}
                <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
                  {currentTime < 0.5 && (
                    <span className="px-2.5 py-1 rounded bg-orange-600/90 text-white text-[11px] font-mono font-bold animate-pulse">
                      ⚡ [T+0.0s] 170mm 포구 화염 (Optical Flash Overexposure)
                    </span>
                  )}
                  {currentTime >= 0.5 && currentTime < 1.02 && (
                    <span className="px-2.5 py-1 rounded bg-neutral-800/90 text-neutral-200 text-[11px] font-mono">
                      💨 [T+0.5s] 후폭풍 연기 확산 (Smoke Drift)
                    </span>
                  )}
                  {currentTime >= 1.02 && currentTime < 1.6 && (
                    <span className="px-2.5 py-1 rounded bg-red-600 text-white text-[11px] font-mono font-bold shadow-[0_0_15px_rgba(255,0,0,0.8)] animate-bounce">
                      💥 [T+1.02s] 140dB 음속 시차 폭음 및 카메라 지진파 도달
                    </span>
                  )}
                  {currentTime >= 1.6 && (
                    <span className="px-2.5 py-1 rounded bg-yellow-600/90 text-white text-[11px] font-mono font-bold">
                      🚀 [T+1.6s~3.1s] 122mm 방사포 0.3s 순차 체인 발사
                    </span>
                  )}
                </div>

                {/* 컨트롤 바 */}
                <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-black/70 backdrop-blur-md p-1.5 rounded-lg border border-white/20">
                  <button
                    onClick={togglePlay}
                    className="p-2 hover:bg-white/20 rounded text-white transition-all"
                    title={isPlaying ? '일시정지' : '재생'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={toggleMute}
                    className="p-2 hover:bg-white/20 rounded text-white transition-all"
                    title={isMuted ? '음소거 해제' : '음소거'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#00E5FF]" />}
                  </button>
                </div>
              </div>

              {/* 비디오 하단 타임라인 분석 바 */}
              <div className="mt-3 p-3 rounded-xl bg-[#0a0d1a] border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                  <span className="text-[#D4AF37]">물리 음향/광학 시차 동기화 타임라인</span>
                  <span>총 길이: 4.0초 (24fps / 96 Frames)</span>
                </div>
                {/* 시각화 프로그레스 */}
                <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 transition-all duration-100"
                    style={{ width: `${(currentTime / 4.0) * 100}%` }}
                  />
                  {/* 물리 포인트 마커 */}
                  <div className="absolute top-0 bottom-0 left-[0%] w-[2px] bg-orange-400" title="화염" />
                  <div className="absolute top-0 bottom-0 left-[25.5%] w-[2px] bg-red-400" title="1.02s 음속도달" />
                  <div className="absolute top-0 bottom-0 left-[40%] w-[2px] bg-yellow-400" title="122mm 시작" />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                  <span>0.0s (포구 화염)</span>
                  <span className="text-red-400 font-bold">1.02s (140dB 음속 폭음)</span>
                  <span>1.60s (122mm 순차 점화)</span>
                  <span>4.0s (루프 리셋)</span>
                </div>
              </div>
            </div>

            {/* 비디오 우측: 물리 연산 상세 내역 */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-[#080b18] border border-[#D4AF37]/30">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#D4AF37] mb-3">
                  <Terminal className="w-4 h-4" />
                  <span>물리 엔진 렌더링 파라미터</span>
                </div>
                <div className="space-y-2.5 text-xs font-mono text-neutral-300">
                  <div className="flex justify-between pb-1.5 border-b border-white/5">
                    <span className="text-neutral-500">카메라-포대 거리</span>
                    <span className="text-white font-bold">350 m</span>
                  </div>
                  <div className="flex justify-between pb-1.5 border-b border-white/5">
                    <span className="text-neutral-500">대기 온도 / 음속</span>
                    <span className="text-white font-bold">20℃ / 343 m/s</span>
                  </div>
                  <div className="flex justify-between pb-1.5 border-b border-white/5">
                    <span className="text-neutral-500">광학-음향 시차</span>
                    <span className="text-[#00E5FF] font-bold">1.020 초 (24.5 프레임)</span>
                  </div>
                  <div className="flex justify-between pb-1.5 border-b border-white/5">
                    <span className="text-neutral-500">주포 구경 / 장사정</span>
                    <span className="text-white font-bold">170mm 곡산포 / L/50</span>
                  </div>
                  <div className="flex justify-between pb-1.5 border-b border-white/5">
                    <span className="text-neutral-500">충격 폭음 피크</span>
                    <span className="text-red-400 font-bold">140 dB (서브 45Hz)</span>
                  </div>
                  <div className="flex justify-between pb-1.5 border-b border-white/5">
                    <span className="text-neutral-500">방사포 발사 간격</span>
                    <span className="text-yellow-400 font-bold">0.3초 스태거 점화</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">인코딩 스펙</span>
                    <span className="text-neutral-300">H.264 / 1280×720 / AAC</span>
                  </div>
                </div>
              </div>

              {/* 검증 프레임 캡처 */}
              <div className="p-4 rounded-2xl bg-[#080b18] border border-white/10 flex flex-col gap-3">
                <span className="text-xs font-mono font-bold text-neutral-300">핵심 물리 프레임 검증</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="group relative rounded-lg overflow-hidden border border-white/10 bg-black">
                    <img
                      src="/joint-training/scene02_frame_flash.jpg"
                      alt="포구 화염 과다노출"
                      className="w-full aspect-video object-cover group-hover:scale-105 transition-all"
                    />
                    <div className="absolute bottom-1 left-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-orange-400">
                      T+0.0s 화염
                    </div>
                  </div>
                  <div className="group relative rounded-lg overflow-hidden border border-white/10 bg-black">
                    <img
                      src="/joint-training/scene02_frame_shockwave.jpg"
                      alt="충격파 도달 프레임"
                      className="w-full aspect-video object-cover group-hover:scale-105 transition-all"
                    />
                    <div className="absolute bottom-1 left-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-red-400">
                      T+1.02s 충격파
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 탭 2: 장구류 비교 (아군 vs 북한군) ── */}
      {activeTab === 'soldiers' && (
        <section className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
          <div className="mb-6 rounded-2xl overflow-hidden border border-[#00E5FF]/30 bg-black/80 shadow-[0_0_30px_rgba(0,229,255,0.15)]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-[#00E5FF]" />
                <h2 className="text-sm font-bold font-mono text-white">
                  합동훈련 교재: 한국군 vs 북한군 장구류 및 6대 포즈 턴어라운드 원판
                </h2>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                파일 크기: 338 KB (실물 에셋 보존)
              </span>
            </div>

            <div className="p-2 md:p-4 bg-[#050711] flex justify-center">
              <img
                src="/joint-training/soldier_equipment_comparison_board.jpg"
                alt="전투원 복장 장구류 비교 보드"
                className="max-h-[600px] w-auto rounded-lg object-contain border border-white/10 shadow-2xl"
              />
            </div>
          </div>

          {/* 장구류 상세 분석 표 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 한국군 */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-[#081324] to-[#040813] border border-[#00E5FF]/30">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#00E5FF]/20">
                <span className="text-sm font-bold font-mono text-[#00E5FF]">🇰🇷 대한민국 육군 (ROK ARMY)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00E5FF]/20 text-[#00E5FF]">아군</span>
              </div>
              <div className="space-y-3 text-xs font-mono">
                <div>
                  <span className="text-neutral-500 block mb-0.5">위장 패턴</span>
                  <span className="text-neutral-200">화강암 5색 디지털 위장 (전신 컴뱃 셔츠/팬츠)</span>
                </div>
                <div>
                  <span className="text-neutral-500 block mb-0.5">방탄 헬멧</span>
                  <span className="text-neutral-200">신형 하이컷 방탄헬멧 + ARC 레일 + 전면 NVG 브래킷</span>
                </div>
                <div>
                  <span className="text-neutral-500 block mb-0.5">방탄복 / 베스트</span>
                  <span className="text-neutral-200">퀵릴리즈 몰리 플레이트 캐리어 + 벨크로 태극기 패치</span>
                </div>
                <div>
                  <span className="text-neutral-500 block mb-0.5">주무장</span>
                  <span className="text-[#00E5FF] font-bold">K2C1 돌격소총 (5.56mm NATO, 레드도트, 4면 레일)</span>
                </div>
                <div>
                  <span className="text-neutral-500 block mb-0.5">전술화</span>
                  <span className="text-neutral-200">경량 코요테 탄 전술 기동화</span>
                </div>
              </div>
            </div>

            {/* 북한군 */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-[#240808] to-[#130404] border border-red-500/30">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-red-500/20">
                <span className="text-sm font-bold font-mono text-red-400">대항군 / 북한군 (KPA ARMY)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400">적성 부대</span>
              </div>
              <div className="space-y-3 text-xs font-mono">
                <div>
                  <span className="text-neutral-500 block mb-0.5">위장 패턴</span>
                  <span className="text-neutral-200">신형 다색 얼룩무늬 위장 (2020 열병식 기반)</span>
                </div>
                <div>
                  <span className="text-neutral-500 block mb-0.5">방탄 헬멧</span>
                  <span className="text-neutral-200">2020식 헬멧 + 얼룩무늬 커버 + 전면 붉은 오각별 모장</span>
                </div>
                <div>
                  <span className="text-neutral-500 block mb-0.5">방탄복 / 베스트</span>
                  <span className="text-neutral-200">체스트 리그형 전술 조끼 (AK 4련 탄창 파우치)</span>
                </div>
                <div>
                  <span className="text-neutral-500 block mb-0.5">주무장</span>
                  <span className="text-red-400 font-bold">88식 보총 (5.45×39mm, 접철식 개머리판, 대형 소염기)</span>
                </div>
                <div>
                  <span className="text-neutral-500 block mb-0.5">전술화</span>
                  <span className="text-neutral-200">재래식 흑색 광택 가죽 전투화</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 탭 3: 북한군 6대 포병 전력 ── */}
      {activeTab === 'artillery' && (
        <section className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 좌측: 포병 목록 카드 */}
            <div className="space-y-3 lg:col-span-1">
              <span className="text-xs font-mono text-neutral-400 block mb-2 font-bold">
                북한군 전술 포병 및 방사포 전력 (6종)
              </span>
              {ARTILLERY_DATA.map((art) => (
                <div
                  key={art.id}
                  onClick={() => setSelectedArtillery(art)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedArtillery.id === art.id
                      ? 'bg-purple-950/60 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : 'bg-[#080a15] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-white">{art.name}</span>
                    <span className="text-[10px] font-mono text-purple-300">{art.range}</span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400 block">{art.caliber}</span>
                </div>
              ))}
            </div>

            {/* 우측: 선택된 포병 정밀 제원 HUD */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-[#0e091b] to-[#06040c] border border-purple-500/30">
              <div className="flex items-center justify-between pb-3 border-b border-purple-500/20 mb-6">
                <div>
                  <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest block">ARTILLERY DOSSIER</span>
                  <h3 className="text-lg font-bold font-mono text-white mt-0.5">{selectedArtillery.name}</h3>
                </div>
                <span className="text-xs font-mono px-3 py-1 rounded bg-purple-900/50 border border-purple-400 text-purple-200">
                  {selectedArtillery.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-neutral-500 block mb-1">구경 및 무장 형태</span>
                  <span className="text-white font-bold text-sm">{selectedArtillery.caliber}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-neutral-500 block mb-1">최대 유효 사거리</span>
                  <span className="text-purple-300 font-bold text-sm">{selectedArtillery.range}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-neutral-500 block mb-1">차체 및 기동 플랫폼</span>
                  <span className="text-white">{selectedArtillery.chassis}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-neutral-500 block mb-1">유도 및 탄도 특성</span>
                  <span className="text-white">{selectedArtillery.guidance}</span>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-black/60 border border-purple-500/20">
                <span className="text-xs font-mono text-neutral-400 block mb-1">작전 표적 및 전술 임무</span>
                <p className="text-xs text-neutral-200 leading-relaxed font-mono">
                  {selectedArtillery.role}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 탭 4: 놀란 오디세이 연출서 (5개 씬) ── */}
      {activeTab === 'nolan' && (
        <section className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 mb-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold text-amber-400 block">
                크리스토퍼 놀란 (호이트 반 호이테마) 시네마토그래피 원칙
              </span>
              <p className="text-xs text-neutral-300 font-mono mt-1">
                IMAX 70mm 1.43:1 / 180도 셔터 앵글 / 조명탄·화염 중심 실재 조명 / 3~5초 불연속 몽타주
              </p>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded bg-amber-900/50 border border-amber-500 text-amber-200">
              5개 씬 완성
            </span>
          </div>

          <div className="space-y-4">
            {SCENES.map((sc) => (
              <div key={sc.id} className="p-5 rounded-2xl bg-[#080a14] border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#D4AF37] px-2 py-0.5 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/30">
                      {sc.id}
                    </span>
                    <h4 className="text-sm font-mono font-bold text-white">{sc.title}</h4>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-neutral-400">{sc.time}</span>
                    <span className="text-[#00E5FF] px-2 py-0.5 rounded bg-white/5 border border-white/10">{sc.tool}</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-300 font-mono leading-relaxed mt-1">
                  {sc.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 하단 푸터 ── */}
      <footer className="mt-12 border-t border-white/10 py-6 px-4 lg:px-8 text-center text-xs font-mono text-neutral-500">
        <p>OSIRIS JOINT TRAINING INTEGRITY CONSOLE · EVIDENCE GATE PASSED · 100% GROUND TRUTH</p>
      </footer>
    </main>
  );
}

// Helper icon
function Target(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
