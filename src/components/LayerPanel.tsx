'use client';

import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Satellite, Sun, AlertTriangle, Camera,
  CloudLightning, Ship, Network, Database, Ghost,
  Flame, Tv, Radio, Mountain, Anchor, Megaphone, SlidersHorizontal, Crosshair, Sparkles
} from 'lucide-react';
import StyleStudio from './StyleStudio';
import FeynmanTooltip from './FeynmanTooltip';
import { getFeynmanExplanation } from '@/lib/feynman-dictionary';
import { TERRAIN_MIN_ZOOM, type TerrainStatus } from '@/lib/map-terrain';

interface LayerPanelProps {
  data: any;
  activeLayers: any;
  setActiveLayers: React.Dispatch<React.SetStateAction<any>>;
  isMobile?: boolean;
  theme?: 'core' | 'ghost';
  setTheme?: (theme: 'core' | 'ghost') => void;
  /** Server-side capabilities, e.g. { cloudflare: true }. Layers declaring a
   *  `requires` key stay hidden until the matching capability is present. */
  capabilities?: Record<string, boolean>;
  terrainStatus?: TerrainStatus;
  onTerrainRetry?: () => void;
  onTerrainFocus?: () => void;
  on3DModeSelected?: () => void;
  sensorMode?: string;
  onSetSensorMode?: (mode: any) => void;
  cockpitMode?: boolean;
  onToggleCockpitMode?: () => void;
  detectionOverlay?: boolean;
  onToggleDetectionOverlay?: () => void;
  militaryHud?: boolean;
  onToggleMilitaryHud?: () => void;
  contactsVisible?: boolean;
  onToggleContacts?: () => void;
}

interface LayerDef {
  key: string;
  label: string;
  dataKey: string;
  description?: string;
  /** Reads a bucket out of data.category_counts instead of a top-level array. */
  catKey?: string;
  /** Capability that must be configured server-side for this layer to appear. */
  requires?: string;
  /** Key of the layer this one modifies. Renders indented beneath it, and reads
   *  as inert while that parent is off — it has nothing to act on. */
  parent?: string;
}

interface LayerGroupDef {
  label: string;
  fullLabel: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  layers: LayerDef[];
}

export interface PresetMode {
  id: string;
  label: string;
  icon: string;
  desc: string;
  layers: string[] | null;
}

export const PRESET_MODES: PresetMode[] = [
  { id: 'standard', label: '기본 관제', icon: '🌍', desc: '항공·해상·CCTV·자연재해 기본 상황판', layers: ['flights', 'maritime', 'cctv', 'fires', 'earthquakes', 'day_night'] },
  { id: 'tactical', label: '군사 전술', icon: '⚔️', desc: '피아식별·GPS교란·북한위협·NLL분계선', layers: ['military', 'dprk_sites', 'gps_jamming', 'military_demarcation', 'dark_fleet', 'notam_hazards'] },
  { id: 'cyber', label: '사이버·인프라', icon: '🌐', desc: '사이버공격·해저광케이블·원전·통신망', layers: ['cyber_attacks', 'submarine_cables', 'malware', 'infrastructure'] },
  { id: 'space', label: '우주·저위도위성', icon: '📡', desc: '정찰위성·GPS항법·지구관측 저위도 궤도', layers: ['sat_military', 'sat_navigation', 'sat_earth'] },
  { id: 'all', label: '전체 레이어', icon: '🔎', desc: '모든 레이어 세부 제어', layers: null },
];

const LAYER_GROUPS: LayerGroupDef[] = [
  {
    label: 'AVIATION',
    fullLabel: '공중 전술 항공 관제 (AVIATION)',
    icon: Plane,
    layers: [
      { key: 'flights', label: '민간 정기 항공편 (Commercial)', description: '전 세계 실시간 여객기 항로 및 고도 실측', dataKey: 'commercial_flights' },
      { key: 'private', label: '일반 민간 비행기 (Private)', description: '소형 레저용 비행기 및 일반 경비행기', dataKey: 'private_flights' },
      { key: 'jets', label: 'VIP 비즈니스 제트 (Private Jets)', description: '국제 비즈니스/요인 전용 제트기 항적', dataKey: 'private_jets' },
      { key: 'military', label: '전술 군용기 피아식별 (Military / ROKAF / DPRK / USAF)', description: '한·미·북·러 전술기 피아식별 및 정찰기', dataKey: 'military_flights' },
      { key: 'notam_hazards', label: '🔴 NOTAM 미사일/발사체 위험 공역 (Missile Hazard Airspace)', description: '미사일 발사 및 군사훈련 고시 위험 공역', dataKey: 'notam_hazards' },
      { key: 'military_demarcation', label: '군사분계선 및 방공식별구역 (NLL · KADIZ · CADIZ · DMZ)', description: '휴전선(DMZ), 서해 NLL, 한국 방공식별구역', dataKey: '' },
    ],
  },
  {
    label: 'MARITIME',
    fullLabel: '해상 전술 함정 관제 (MARITIME)',
    icon: Ship,
    layers: [
      { key: 'maritime', label: '해군 군함 및 상선 (Naval Warships / AIS)', description: '한국 영해 및 국제 주요 항로 군함/상선 위치', dataKey: 'maritime_ships,maritime_ports,maritime_chokepoints' },
      { key: 'dark_fleet', label: '🟠 AIS 암흑 선박 키네틱 버블 (Dark Fleet Kinetic Bubble)', description: '위치 신호(AIS) 끄고 잠적한 의심 선박 탐지', dataKey: 'dark_fleet' },
    ],
  },
  {
    label: 'SPACE',
    fullLabel: '저위도 실시간 위성 (SPACE)',
    icon: Satellite,
    layers: [
      { key: 'satellites', label: '전체 저위도 위성 (All Low-Lat Satellites)', description: '위도 60도 이하 저위도 상공 실시간 운용 위성', dataKey: 'satellites' },
      { key: 'sat_comms', label: '스타링크 통신위성 (Starlink / Comms)', description: '스페이스X 초고속 저궤도 통신망', dataKey: 'satellites', catKey: 'comms' },
      { key: 'sat_military', label: '정찰 / 군사위성 (Military / Intel)', description: '미·중·러 군사 첩보/정찰 및 조기경보 위성', dataKey: 'satellites', catKey: 'military' },
      { key: 'sat_navigation', label: 'GPS / 항법위성 (GPS / Navigation)', description: 'GPS, GLONASS, Galileo 전 세계 항법위성', dataKey: 'satellites', catKey: 'navigation' },
      { key: 'sat_earth', label: '지구관측위성 (Earth Observation)', description: '기상청·환경부 등 지표/대기 관측 위성', dataKey: 'satellites', catKey: 'earth_obs' },
      { key: 'sat_science', label: '우주정거장 ISS (Stations / Telescopes)', description: '국제우주정거장 및 과학 탐사 위성', dataKey: 'satellites', catKey: 'science' },
    ],
  },
  {
    label: 'THREAT',
    fullLabel: '위협 및 전파교란 인텔리전스 (THREATS & GPS)',
    icon: AlertTriangle,
    layers: [
      { key: 'gps_jamming', label: '🚨 GPS 전파 교란 실시간 경보 (GPS Jamming / Spoofing)', description: '북한 옹진반도·개풍군 발원지 및 서해·수도권 피격권', dataKey: 'gps_jamming' },
      { key: 'dprk_sites', label: '북한 전력 / 핵·미사일·무인기·포병 갱도 진지 (HARTS)', description: '북한 핵심 군사기지 및 갱도 포병 진지 8,000곳', dataKey: 'dprk_sites' },
      { key: 'dprk_activity', label: '🔴 글로벌 14개 국방 씽크탱크 수집 브릿지 (DPRK Intel)', description: 'CSIS, 38North 등 국방 싱크탱크 위성 정밀 판독', dataKey: 'dprk_activities' },
      { key: 'china_encroachment', label: '🇨🇳 중국 서해·남중국해 인공구조물 / 인공섬', description: '선란 1·2호 해상 플랫폼 및 인공 기지 감시', dataKey: '' },
      { key: 'seismic_watch', label: '🟣 지진/충격파 핵실험 감시 (Seismic Nuclear Watch)', description: '풍계리 등 핵실험 및 인공 충격파 자동 판독', dataKey: 'seismic_events' },
      { key: 'infrastructure', label: '원자력 발전소 및 주요 에너지 인프라', description: '국내외 원전, 변전소, 주요 국가 중요 시설', dataKey: 'infrastructure' },
      { key: 'global_incidents', label: '글로벌 분쟁 / 사건 (GDELT Live Incidents)', description: '전 세계 100개국 실시간 물리적 충돌 및 시위', dataKey: 'gdelt' },
      { key: 'gdelt_events', label: 'GDELT 상세 이벤트', description: '글로벌 뉴스 미디어 교차 검증 이벤트', dataKey: 'gdelt_events' },
    ],
  },
  {
    label: 'NETWORK',
    fullLabel: '사이버 공격 및 해저 인프라 (CYBER & CABLES)',
    icon: Network,
    layers: [
      { key: 'cyber_attacks', label: '⚡ 실시간 사이버 침투 공격 (Live Cyber Attacks)', description: '글로벌 악성 C2 침투 공격선 및 피격 대상국 실시간 추적', dataKey: 'cyber_attacks' },
      { key: 'submarine_cables', label: '🌐 해저 광케이블 & 상륙국 (Submarine Cables & CLS)', description: '부산/거제/제주 해저 광케이블 기간망 및 사보타주 감시', dataKey: 'cables_hazards' },
      { key: 'malware', label: 'Live 악성 봇넷 노드 (Malware Nodes)', description: '전 세계 활성 C2 서버 및 봇넷 감염 IP', dataKey: 'malware_threats' },
    ],
  },
  {
    label: 'SURVEIL',
    fullLabel: '실시간 감시 및 미디어 (SURVEILLANCE)',
    icon: Camera,
    layers: [
      { key: 'cctv', label: 'CCTV 실시간 감시 카메라', description: '전국 주요 고속도로·국도·항만 실시간 영상', dataKey: 'cameras' },
      { key: 'cctv_previews', label: '지도 상 실시간 비디오 프리뷰', description: '줌 13+ 최근접 카메라 팝업 영상', dataKey: '', parent: 'cctv' },
      { key: 'live_news', label: '실시간 뉴스 피드', description: '연합뉴스·BBC·로이터 주요 속보 피드', dataKey: 'live_feeds' },
      { key: 'radio', label: '전략 라디오 방송국 스트림 (Radio)', description: '대북 방송 및 긴급 재난 라디오 주파수', dataKey: 'radio_stations' },
      { key: 'alpr', label: 'ALPR 차량 번호판 감시국 & 보안 검문소', description: '주요 간선도로 및 접경지 차량 판독소', dataKey: 'alpr_checkpoints' },
    ],
  },
  {
    label: 'HAZARD',
    fullLabel: '자연재해 및 기상 (HAZARDS)',
    icon: Flame,
    layers: [
      { key: 'earthquakes', label: '실시간 지진 (Earthquakes)', description: 'USGS 실시간 전 세계 지진 진앙 및 규모', dataKey: 'earthquakes' },
      { key: 'fires', label: '열원 / 산불 (Active Fires)', description: 'NASA 위성 탐지 실시간 산불 및 고열원', dataKey: 'fires' },
      { key: 'weather', label: '기상 특보 (Severe Weather)', description: '태풍·폭설·한파 등 실시간 기상 재난', dataKey: 'weather_events' },
    ],
  },
  {
    label: 'DISPLAY',
    fullLabel: '화면 디스플레이 설정 (DISPLAY)',
    icon: Sun,
    layers: [
      { key: 'day_night', label: '주야간 명암선 (Day / Night)', description: '실시간 태양 위치에 따른 지구 밤/낮 그림자', dataKey: '' },
      { key: 'terrain_3d', label: '3D 입체 건물 (Buildings)', description: '도심지 3D 입체 건물군 · zoom 14.5+', dataKey: '' },
      { key: 'terrain_elevation', label: '3D 입체 지형 (Terrain DEM)', description: '산악·고도 입체 표고 · zoom 10+', dataKey: '' },
    ],
  },
  {
    label: "GOD'S EYE",
    fullLabel: "신의 눈 전술 시스템 (GOD'S EYE VIEW)",
    icon: Crosshair,
    layers: [
      { key: 'cockpit_view', label: '3인칭 콕핏 추적 모드 ([C])', description: '선택한 항공기/함정 시점 3D 추적 비행', dataKey: '' },
      { key: 'detection_overlay', label: '전술 표적 탐지 오버레이 ([D])', description: '접경지 및 요충지 표적 식별 HUD', dataKey: '' },
      { key: 'military_hud', label: 'MGRS 군사 텔레메트리 HUD ([H])', description: '군사 좌표계(MGRS) 실시간 조준선', dataKey: '' },
      { key: 'contacts_roster', label: '250km 컨택츠 로스터 ([T])', description: '주변 반경 250km 이내 모든 객체 리스트', dataKey: '' },
    ],
  },
];

/* ── Minimal Toggle Switch ── */
/**
 * Presentational only. The row around it is the button, and a button inside a
 * button is invalid HTML — the browser reparents it, which breaks hydration and
 * silently drops the click handler on the inner control.
 */
function ToggleSwitch({ active }: { active: boolean }) {
  return (
    <span
      role="presentation"
      className="relative flex-shrink-0 block"
      style={{ width: 28, height: 14 }}
    >
      <div
        className="absolute inset-0 rounded-full transition-all duration-300"
        style={{
          background: active ? 'rgba(0, 229, 255, 0.35)' : 'rgba(255,255,255,0.05)',
          border: active ? '1px solid rgba(0, 229, 255, 0.8)' : '1px solid rgba(255,255,255,0.15)',
          boxShadow: active ? '0 0 10px rgba(0, 229, 255, 0.4)' : 'none',
        }}
      />
      <motion.div
        className="absolute top-[2px] rounded-full"
        style={{
          width: 10,
          height: 10,
          background: active ? '#FFFFFF' : 'rgba(255,255,255,0.3)',
          boxShadow: active ? '0 0 8px #00E5FF' : 'none',
        }}
        animate={{ left: active ? 16 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </span>
  );
}

/**
 * The elbow that ties a sub-layer row to the layer above it. Indentation alone
 * reads as a typo at this size; the line is what says "this belongs to that".
 */
function SubLayerStem() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-[6px] top-0 h-1/2 w-[8px] rounded-bl-[3px] border-b border-l border-white/[0.14]"
    />
  );
}

function LayerPanel({
  data,
  activeLayers,
  setActiveLayers,
  isMobile,
  theme = 'core',
  setTheme,
  capabilities = {},
  terrainStatus = 'idle',
  onTerrainRetry,
  onTerrainFocus,
  on3DModeSelected,
  sensorMode,
  onSetSensorMode,
  cockpitMode,
  onToggleCockpitMode,
  detectionOverlay,
  onToggleDetectionOverlay,
  militaryHud,
  onToggleMilitaryHud,
  contactsVisible,
  onToggleContacts,
}: LayerPanelProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  /**
   * A pinned group stays open when the pointer leaves. Hover-only flyouts are
   * fine to glance at and impossible to work in — reaching for a toggle at the
   * far edge closes the thing you were reaching for.
   */
  const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('standard');
  const [presetFlyoutOpen, setPresetFlyoutOpen] = useState(false);

  const applyPreset = (preset: PresetMode) => {
    setSelectedPresetId(preset.id);
    if (!preset.layers) {
      setPresetFlyoutOpen(false);
      return;
    }
    setActiveLayers((prev: any) => {
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(prev)) {
        next[k] = false;
      }
      for (const k of preset.layers!) {
        next[k] = true;
      }
      return next;
    });
    setPresetFlyoutOpen(false);
  };

  useEffect(() => {
    if (!pinnedGroup) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinnedGroup(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinnedGroup]);

  const checkLayerActive = (key: string): boolean => {
    if (key === 'cockpit_view') return !!cockpitMode;
    if (key === 'detection_overlay') return !!detectionOverlay;
    if (key === 'military_hud') return !!militaryHud;
    if (key === 'contacts_roster') return !!contactsVisible;
    return Boolean(activeLayers[key]);
  };

  const toggle = (key: string) => {
    if (key === 'cockpit_view') { onToggleCockpitMode?.(); return; }
    if (key === 'detection_overlay') { onToggleDetectionOverlay?.(); return; }
    if (key === 'military_hud') { onToggleMilitaryHud?.(); return; }
    if (key === 'contacts_roster') { onToggleContacts?.(); return; }
    if ((key === 'terrain_elevation' || key === 'terrain_3d') && !activeLayers[key]) on3DModeSelected?.();
    setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };
  const terrainDetails = activeLayers.terrain_elevation ? (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[10px] text-white/60">
      <p role="status">{terrainStatus === 'idle' ? `Terrain at zoom ${TERRAIN_MIN_ZOOM}+ · zoom in` : terrainStatus === 'waiting' ? 'Terrain starts when you stop moving' : terrainStatus === 'loading' ? 'Loading nearby terrain…' : terrainStatus === 'error' ? 'Terrain unavailable; the map is still usable.' : 'Terrain on'}</p>
      {terrainStatus === 'idle' && <button type="button" onClick={onTerrainFocus} className="mt-2 min-h-8 rounded border border-white/15 px-2 text-[var(--gold-primary)] hover:bg-white/10">Zoom to terrain</button>}
      {terrainStatus === 'error' && <button type="button" onClick={onTerrainRetry} className="mt-2 min-h-8 rounded border border-white/15 px-2 text-[var(--gold-primary)] hover:bg-white/10">Retry terrain</button>}
      <p className="mt-2 text-white/35">Nearby detail only · cached tiles</p>
      <a className="mt-1 inline-block underline underline-offset-2" href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">Terrain credits</a>
    </div>
  ) : null;

  /** Switch a whole group at once — off if any are on, otherwise all on. */
  const toggleGroup = (layers: LayerDef[]) => {
    const anyOn = layers.some(l => checkLayerActive(l.key));
    if (!anyOn && layers.some(l => l.key === 'terrain_elevation' || l.key === 'terrain_3d')) on3DModeSelected?.();

    for (const l of layers) {
      if (l.key === 'cockpit_view' && ((anyOn && cockpitMode) || (!anyOn && !cockpitMode))) onToggleCockpitMode?.();
      if (l.key === 'detection_overlay' && ((anyOn && detectionOverlay) || (!anyOn && !detectionOverlay))) onToggleDetectionOverlay?.();
      if (l.key === 'military_hud' && ((anyOn && militaryHud) || (!anyOn && !militaryHud))) onToggleMilitaryHud?.();
      if (l.key === 'contacts_roster' && ((anyOn && contactsVisible) || (!anyOn && !contactsVisible))) onToggleContacts?.();
    }

    setActiveLayers((prev: any) => {
      const next = { ...prev };
      for (const l of layers) {
        if (!['cockpit_view', 'detection_overlay', 'military_hud', 'contacts_roster'].includes(l.key)) {
          next[l.key] = !anyOn;
        }
      }
      return next;
    });
  };

  /* Drop layers whose backing capability is not configured, then drop any group
     left with nothing to show. */
  const visibleGroups = LAYER_GROUPS.map(g => ({
    ...g,
    layers: g.layers.filter(l => !l.requires || capabilities[l.requires]),
  })).filter(g => g.layers.length > 0);

  const getCount = (dk: string, catKey?: string): number | null => {
    if (!dk) return null;
    if (catKey && data.category_counts) {
      return data.category_counts[catKey] || 0;
    }
    let total = 0;
    let found = false;
    for (const k of dk.split(',')) {
      if (data[k] && Array.isArray(data[k])) {
        total += data[k].length;
        found = true;
      }
    }
    return found ? total : null;
  };

  /* ── MOBILE ── */
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 py-2">
        {/* PRESET CHIPS BAR */}
        <div className="flex flex-col gap-1.5 pb-3 border-b border-white/[0.08]">
          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-cyan-400 font-bold">
            ⚡ 초보자 퀵 프리셋 모드
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {PRESET_MODES.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                      : 'bg-white/[0.04] border border-white/10 text-white/60 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  <span>{preset.icon}</span>
                  <span className="font-bold">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {visibleGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30 border-b border-white/[0.06] pb-1.5">
              {group.fullLabel}
            </div>
            <div className="flex flex-col gap-1">
              {group.layers.map((layer) => {
                const isLayerActive = checkLayerActive(layer.key);
                const count = getCount(layer.dataKey, layer.catKey);
                const dormant = !!layer.parent && !checkLayerActive(layer.parent);
                return (
                  <button
                    key={layer.key}
                    onClick={() => toggle(layer.key)}
                    aria-pressed={!!isLayerActive}
                    aria-label={layer.label}
                    className={`relative w-full flex items-center gap-3 py-2 rounded-md text-left hover:bg-white/[0.04] transition-colors ${layer.parent ? 'pl-[22px] pr-1' : 'px-1'} ${dormant ? 'opacity-40' : ''}`}
                  >
                    {layer.parent && <SubLayerStem />}
                    <ToggleSwitch active={!!isLayerActive} />
                    <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 transition-colors ${isLayerActive ? 'text-white/80' : 'text-white/40'}`}>
                      {layer.label}
                      {layer.description && <span className="block mt-0.5 text-[9px] normal-case tracking-normal text-white/35">{layer.description}</span>}
                    </span>
                    {count !== null && (
                      <span className="text-[10px] font-mono tabular-nums text-white/25">
                        {count.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
              {group.label === 'DISPLAY' && terrainDetails}
              {group.label === "GOD'S EYE" && onSetSensorMode && (
                <div className="mt-2.5 pt-2 border-t border-white/[0.08]">
                  <div className="text-[9px] font-mono text-[var(--gold-primary)] font-bold mb-1.5 tracking-wider flex items-center justify-between">
                    <span>광학 센서 필터 (1-7)</span>
                    <span className="text-[8px] text-white/40">{sensorMode || 'NORMAL'}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['NORMAL', 'CRT', 'NVG', 'FLIR_WHITE', 'FLIR_IRONBOW', 'NOIR', 'SNOW'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onSetSensorMode(m)}
                        className={`px-1 py-1 text-[8px] font-mono font-bold rounded border transition-all cursor-pointer ${
                          sensorMode === m
                            ? 'bg-[var(--gold-primary)]/20 border-[var(--gold-primary)] text-[var(--gold-primary)] shadow-sm'
                            : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
                        }`}
                      >
                        {m.replace('FLIR_', '')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* MOBILE STYLE STUDIO */}
        <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/[0.06] px-1">
          <span className="text-[10px] font-mono tracking-[0.2em] text-white/25 uppercase">Style Studio</span>
          <button
            onClick={() => setStudioOpen(o => !o)}
            aria-pressed={studioOpen}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{
              background: studioOpen ? 'var(--hover-accent)' : 'transparent',
              boxShadow: studioOpen ? '0 0 6px var(--gold-glow)' : 'none',
            }}
          >
            <SlidersHorizontal className="w-4 h-4" style={{ color: studioOpen ? 'var(--gold-primary)' : 'rgba(255,255,255,0.25)' }} />
          </button>
        </div>
        <AnimatePresence>
          {studioOpen && <StyleStudio isMobile onClose={() => setStudioOpen(false)} />}
        </AnimatePresence>

        {/* MOBILE GHOST TOGGLE */}
        {setTheme && (
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] px-1">
            <span className="text-[10px] font-mono tracking-[0.2em] text-white/25 uppercase">Ghost Protocol</span>
            <button
              onClick={() => setTheme(theme === 'core' ? 'ghost' : 'core')}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: theme === 'ghost' ? 'rgba(179, 136, 255, 0.15)' : 'transparent',
                boxShadow: theme === 'ghost' ? '0 0 6px rgba(179, 136, 255, 0.2)' : 'none',
              }}
            >
              <Ghost className="w-4 h-4" style={{ color: theme === 'ghost' ? '#B388FF' : 'rgba(255,255,255,0.25)' }} />
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── DESKTOP ── */
  return (
    <motion.div
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 30, stiffness: 200, delay: 2.8 }}
      className="absolute top-0 left-0 h-full w-[48px] flex flex-col items-center pt-24 pb-6 z-50 pointer-events-auto"
      style={{
        background: 'rgba(0,0,0,0.15)',
        backdropFilter: 'blur(24px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
      }}
    >
      <div className="flex-1 flex flex-col items-center gap-1">
        {/* ── PRESET QUICK MODE BUTTON ── */}
        <div
          className="relative flex items-center justify-center mb-1 pb-1 border-b border-white/[0.08]"
          onMouseEnter={() => setPresetFlyoutOpen(true)}
          onMouseLeave={() => setPresetFlyoutOpen(false)}
        >
          <button
            onClick={() => setPresetFlyoutOpen(!presetFlyoutOpen)}
            aria-expanded={presetFlyoutOpen}
            aria-label="초보자 관제 프리셋 모드"
            title="초보자 퀵 프리셋 (모드 전환)"
            className="relative w-10 h-10 flex items-center justify-center cursor-pointer rounded-lg transition-all duration-300 focus:outline-none"
            style={{
              background: presetFlyoutOpen
                ? 'rgba(0, 229, 255, 0.25)'
                : 'rgba(0, 229, 255, 0.1)',
              border: '1px solid rgba(0, 229, 255, 0.4)',
              boxShadow: '0 0 10px rgba(0, 229, 255, 0.2)',
            }}
          >
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          </button>

          {/* Preset Flyout */}
          <AnimatePresence>
            {presetFlyoutOpen && (
              <motion.div
                initial={{ opacity: 0, x: -8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -4, filter: 'blur(2px)' }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="absolute left-[52px] top-0 min-w-[260px] rounded-xl p-3 z-[110] pointer-events-auto shadow-2xl"
                style={{
                  background: 'rgba(6, 12, 20, 0.95)',
                  backdropFilter: 'blur(40px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                  boxShadow: '0 0 25px rgba(0, 229, 255, 0.15)',
                }}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                  <span className="text-[11px] font-mono tracking-wider font-bold text-cyan-400">
                    ⚡ 원클릭 관제 프리셋
                  </span>
                  <span className="text-[8.5px] font-mono text-white/40">초보자 맞춤</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {PRESET_MODES.map((p) => {
                    const isSel = selectedPresetId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => applyPreset(p)}
                        className={`w-full text-left p-2 rounded-lg transition-all border ${
                          isSel
                            ? 'bg-cyan-500/20 border-cyan-400/80 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                            : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{p.icon}</span>
                          <span className={`text-[11px] font-mono font-bold ${isSel ? 'text-cyan-300' : 'text-white/90'}`}>
                            {p.label}
                          </span>
                          {isSel && (
                            <span className="ml-auto text-[8px] bg-cyan-400/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-400/50">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-white/50 mt-1 pl-6">
                          {p.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {visibleGroups.map((group) => {
          /* Sub-layers modify a parent rather than draw anything of their own,
             so they do not count towards the rail's reading. */
          const counted = group.layers.filter(l => !l.parent);
          const groupActive = counted.some(l => checkLayerActive(l.key));
          const isHovered = hoveredGroup === group.label;
          const Icon = group.icon;

          const activeCount = counted.filter(l => checkLayerActive(l.key)).length;
          const isPinned = pinnedGroup === group.label;
          const isOpen = isHovered || isPinned;

          return (
            <div
              key={group.label}
              className="relative flex items-center justify-center"
              onMouseEnter={() => setHoveredGroup(group.label)}
              onMouseLeave={() => setHoveredGroup(null)}
            >
              {/* A real button, not a div: this is keyboard reachable, focusable
                  and announced. Clicking pins the flyout open so it can be
                  worked in rather than only glanced at. */}
              <button
                onClick={() => setPinnedGroup(isPinned ? null : group.label)}
                aria-expanded={isOpen}
                aria-label={`${group.fullLabel}${activeCount ? ` — ${activeCount} active` : ''}`}
                title={group.fullLabel}
                className="relative w-10 h-10 flex items-center justify-center cursor-pointer rounded-lg transition-all duration-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                style={{
                  background: isPinned
                    ? 'rgba(255,255,255,0.10)'
                    : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                }}
              >
                <Icon
                  className="transition-all duration-300"
                  style={{
                    width: 16,
                    height: 16,
                    color: groupActive
                      ? 'rgba(255,255,255,0.75)'
                      : isOpen
                        ? 'rgba(255,255,255,0.45)'
                        : 'rgba(255,255,255,0.22)',
                    filter: groupActive ? 'drop-shadow(0 0 2px rgba(255,255,255,0.15))' : 'none',
                  }}
                />

                {/* How many layers in this group are live. Without it the rail
                    gives no reading at all until each icon is hovered in turn. */}
                {activeCount > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-[13px] h-[13px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-mono tabular-nums leading-none"
                    style={{
                      background: 'rgba(0,229,255,0.9)',
                      color: '#04040A',
                      boxShadow: '0 0 4px var(--cyan-glow)',
                    }}
                  >
                    {activeCount}
                  </span>
                )}
              </button>

              {/* Flyout (LEFT side) */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: -8, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: -4, filter: 'blur(2px)' }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="absolute left-[52px] top-1/2 -translate-y-1/2 min-w-[220px] rounded-xl p-3 z-[100] pointer-events-auto"
                    style={{
                      background: 'rgba(0,0,0,0.6)',
                      backdropFilter: 'blur(40px) saturate(1.5)',
                      WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/[0.04]">
                      <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/40 flex-1">
                        {group.fullLabel}
                      </span>
                      {/* Switching eight satellite layers one at a time is the
                          kind of thing that makes a panel feel unfinished. */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleGroup(group.layers); }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        {activeCount > 0 ? 'NONE' : 'ALL'}
                      </button>
                      {isPinned && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPinnedGroup(null); }}
                          aria-label="Close"
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* ⚡ 파인만 기법 직관 해설 배너 */}
                    {(() => {
                      const feynman = getFeynmanExplanation(`group_${group.label}`, group.fullLabel);
                      return (
                        <div className="mb-2.5 px-2.5 py-2 rounded-lg bg-[var(--cyan-primary)]/8 border border-[var(--cyan-primary)]/20 shadow-sm">
                          <div className="text-[9.5px] font-bold text-[var(--gold-primary)] font-mono flex items-center gap-1 mb-1">
                            <Sparkles className="w-2.5 h-2.5 text-[var(--gold-primary)] shrink-0" />
                            <span>{feynman.category}</span>
                          </div>
                          <p className="text-[10px] leading-relaxed text-neutral-200">
                            {feynman.explanation}
                          </p>
                        </div>
                      );
                    })()}

                    <div className="flex flex-col gap-0.5">
                      {group.layers.map((layer) => {
                        const isLayerActive = checkLayerActive(layer.key);
                        const count = getCount(layer.dataKey, layer.catKey);
                        const dormant = !!layer.parent && !checkLayerActive(layer.parent);

                        return (
                          <button
                            key={layer.key}
                            onClick={() => toggle(layer.key)}
                            aria-pressed={!!isLayerActive}
                            aria-label={layer.label}
                            title={dormant ? 'Turn the layer above on to use this' : undefined}
                            className={`relative w-full flex items-center gap-3 py-1.5 rounded-md hover:bg-white/[0.05] transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${layer.parent ? 'pl-[22px] pr-1' : 'px-1'} ${dormant ? 'opacity-40' : ''}`}
                          >
                            {layer.parent && <SubLayerStem />}
                            <ToggleSwitch active={!!isLayerActive} />
                            <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 transition-colors duration-200 ${isLayerActive ? 'text-white/70' : 'text-white/35'}`}>
                              {layer.label}
                              {layer.description && <span className="block mt-0.5 text-[9px] normal-case tracking-normal text-white/35">{layer.description}</span>}
                            </span>
                            {count !== null && (
                              <span className={`text-[10px] font-mono tabular-nums transition-colors ${isLayerActive ? 'text-white/45' : 'text-white/20'}`}>
                                {count.toLocaleString()}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {group.label === 'DISPLAY' && terrainDetails}
                      {group.label === "GOD'S EYE" && onSetSensorMode && (
                        <div className="mt-2.5 pt-2 border-t border-white/[0.08]">
                          <div className="text-[9px] font-mono text-[var(--gold-primary)] font-bold mb-1.5 tracking-wider flex items-center justify-between">
                            <span>광학 센서 필터 (1-7)</span>
                            <span className="text-[8px] text-white/40">{sensorMode || 'NORMAL'}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {(['NORMAL', 'CRT', 'NVG', 'FLIR_WHITE', 'FLIR_IRONBOW', 'NOIR', 'SNOW'] as const).map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => onSetSensorMode(m)}
                                className={`px-1 py-1 text-[8px] font-mono font-bold rounded border transition-all cursor-pointer ${
                                  sensorMode === m
                                    ? 'bg-[var(--gold-primary)]/20 border-[var(--gold-primary)] text-[var(--gold-primary)] shadow-sm'
                                    : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
                                }`}
                              >
                                {m.replace('FLIR_', '')}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Subtle separator */}
      <div className="w-5 h-px bg-white/[0.06] my-2" />

      {/* Style Studio */}
      <FeynmanTooltip dictKey="tool_style_studio" position="right">
        <button
          onClick={() => setStudioOpen(o => !o)}
          aria-pressed={studioOpen}
          className="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-500 cursor-pointer"
          style={{ background: studioOpen ? 'var(--hover-accent)' : 'transparent' }}
          aria-label="Style Studio"
        >
          <SlidersHorizontal
            className="transition-all duration-500"
            style={{
              width: 15,
              height: 15,
              color: studioOpen ? 'var(--gold-primary)' : 'rgba(255,255,255,0.15)',
              filter: studioOpen ? 'drop-shadow(0 0 3px var(--gold-glow))' : 'none',
            }}
          />
        </button>
      </FeynmanTooltip>
      <AnimatePresence>
        {studioOpen && <StyleStudio onClose={() => setStudioOpen(false)} />}
      </AnimatePresence>

      {/* Ghost Protocol Toggle */}
      {setTheme && (
        <FeynmanTooltip dictKey="tool_ghost" position="right">
          <button
            onClick={() => setTheme(theme === 'core' ? 'ghost' : 'core')}
            className="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-500 cursor-pointer"
            style={{
              background: theme === 'ghost' ? 'rgba(179, 136, 255, 0.1)' : 'transparent',
            }}
            aria-label="Ghost Protocol"
          >
            <Ghost
              className="transition-all duration-500"
              style={{
                width: 15,
                height: 15,
                color: theme === 'ghost' ? '#B388FF' : 'rgba(255,255,255,0.15)',
                filter: theme === 'ghost' ? 'drop-shadow(0 0 3px rgba(179, 136, 255, 0.3))' : 'none',
              }}
            />
          </button>
        </FeynmanTooltip>
      )}
    </motion.div>
  );
}

export default memo(LayerPanel);
