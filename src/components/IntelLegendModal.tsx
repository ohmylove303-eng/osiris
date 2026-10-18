'use client';
import { motion } from 'framer-motion';
import { X, ShieldAlert, Plane, Ship, Satellite, AlertTriangle } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function IntelLegendModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-[#04080F] border border-[var(--cyan-primary)]/40 rounded-xl shadow-[0_0_40px_rgba(0,229,255,0.15)] flex flex-col"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[var(--cyan-primary)]/20 bg-[#04080F]/90 backdrop-blur">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-[var(--gold-primary)]" />
            <h2 className="text-sm font-mono font-bold tracking-wider text-white">⚡ 번개의 눈동자 (LIGHTNING EYE) — OSIRIS × 신의 눈 융합 가이드</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 text-sm text-white/80 space-y-8 font-sans">
          
          <section>
            <p className="text-white/60 mb-6 leading-relaxed">
              본 시스템은 <strong className="text-[var(--cyan-primary)] font-bold">OSIRIS 글로벌 실시간 관제</strong>와 <strong className="text-[var(--gold-primary)] font-bold">신의 눈(GOD&apos;S EYE) 전술 감시</strong>가 하나로 결합된 
              <strong className="text-white font-extrabold tracking-wide"> [번개의 눈동자 (LIGHTNING EYE)] 융합 프로젝트</strong>입니다. 
              일반 공개 데이터(OSINT)와 심층 네트워크망을 결합하여, 일반 지도나 관제 시스템에서는 
              <strong className="text-[var(--gold-primary)] font-bold"> 볼 수 없는 은닉 자산(다크플릿, 군용기 실기동, 전파교란 발원지)</strong> 등을 실시간으로 시각화합니다. 
              아래 범례를 통해 각 레이어의 의미와 활용 방법을 확인하세요.
            </p>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Aviation */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Plane className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-cyan-400 font-mono">항공 전술 감시 (Aviation)</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-3 h-3 mt-1 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]"></span>
                  <div>
                    <span className="block font-bold text-white">민간 여객 및 경비행기</span>
                    <span className="text-xs text-white/50">일반적인 ADS-B 신호를 송출하는 민항기 항적입니다.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-3 h-3 mt-1 rounded-full bg-[#FF1744] shadow-[0_0_8px_#FF1744]"></span>
                  <div>
                    <span className="block font-bold text-red-400">전술 군용기 및 정찰기</span>
                    <span className="text-xs text-white/50">피아식별 신호를 차단하거나 작전 중인 군용기(전투기, 조기경보기)의 실측 궤적입니다.</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* Maritime */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Ship className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-cyan-400 font-mono">해상 작전 통제 (Maritime)</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-3 h-3 mt-1 rounded-full bg-[#26C6DA] shadow-[0_0_8px_#26C6DA]"></span>
                  <div>
                    <span className="block font-bold text-white">민간 상선 및 어선</span>
                    <span className="text-xs text-white/50">AIS 신호를 정상 송출하는 해상 물류망 선박입니다.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-3 h-3 mt-1 rounded-full bg-[#D32F2F] shadow-[0_0_8px_#D32F2F]"></span>
                  <div>
                    <span className="block font-bold text-red-400">해군 함정 (Naval)</span>
                    <span className="text-xs text-white/50">항공모함, 구축함 등 전술 함정의 위치입니다.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-3 h-3 mt-1 rounded-full bg-[#FF9100] shadow-[0_0_8px_#FF9100] border-2 border-dashed border-[#FF9100]"></span>
                  <div>
                    <span className="block font-bold text-orange-400">다크 플릿 (Dark Fleet)</span>
                    <span className="text-xs text-white/50">AIS 신호를 고의로 끄고 밀수, 불법 환적 등을 시도하는 <strong className="text-white">은닉 의심 선박</strong>의 추정 위치입니다.</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* Space & Infra */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Satellite className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-cyan-400 font-mono">우주 및 핵심 인프라 (Space & Infra)</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-3 h-3 mt-1 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]"></span>
                  <div>
                    <span className="block font-bold text-[var(--gold-primary)]">정찰 위성 (Recon Satellites)</span>
                    <span className="text-xs text-white/50">지구 궤도를 돌며 군사 기밀, 전파, 기상을 수집하는 저위도/극궤도 위성망입니다. 클릭 시 국적과 임무 확인이 가능합니다.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-3 h-3 mt-1 rounded-full bg-[#FF1744] shadow-[0_0_8px_#FF1744]"></span>
                  <div>
                    <span className="block font-bold text-red-400">해저 광케이블 (국가 1급 시설)</span>
                    <span className="text-xs text-white/50">일반 인터넷망에 표출되지 않는 통신 기간망입니다. 사보타주 및 단선 위험 감시를 위해 <strong className="text-white">핵심 방어 티어(KOREA / CRITICAL)만 기본 표시</strong>됩니다.</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* Threat & DPRK */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="font-bold text-red-400 font-mono">비대칭 위협 (Threats)</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-0 h-0 mt-1 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]"></span>
                  <div>
                    <span className="block font-bold text-yellow-400">GPS 전파 교란 원점 (Jamming)</span>
                    <span className="text-xs text-white/50">북한 개풍군, 옹진반도 등에서 발사된 실시간 전파 교란(Jamming/Spoofing) 발원지 및 교란 방향(벡터)입니다.</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-3 h-3 mt-1 rounded-sm bg-[#B71C1C] border border-[#FF5252] shadow-[0_0_8px_#FF5252]"></span>
                  <div>
                    <span className="block font-bold text-red-400">북한 전략 시설 (Strategic Sites)</span>
                    <span className="text-xs text-white/50">일반 지도에서 위장되거나 삭제된 지하 갱도, 포병 진지, 미사일 사일로 등의 군사 타격 목표물입니다.</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-4 rounded-lg bg-[var(--cyan-primary)]/10 border border-[var(--cyan-primary)]/30">
            <h4 className="font-bold text-[var(--cyan-primary)] mb-2 font-mono">💡 실전 활용 팁 (Pro-Tips)</h4>
            <ul className="list-disc list-inside text-xs text-white/70 space-y-1.5">
              <li>좌측 하단의 <strong className="text-cyan-300">원클릭 프리셋 모드(⚡)</strong>를 사용하면 목적에 맞는 레이어들이 자동 세팅됩니다.</li>
              <li>키보드 <strong className="text-[var(--gold-primary)]">단축키 C</strong>를 누르면 3D 콕핏(Cockpit) 모드로 진입하여 타겟을 실시간 추적 비행할 수 있습니다.</li>
              <li>특정 객체(위성, 항공기, 함선)를 클릭하면 상세 제원과 실시간 텔레메트리(고도, 속도, 국적)를 팝업으로 분석합니다.</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
