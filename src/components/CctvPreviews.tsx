'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Radio, Crosshair, ChevronDown, ChevronUp, X, Video, RefreshCw, ZoomIn, Columns, Grid, User, Car, Target, Navigation } from 'lucide-react';
import { freshen, previewMedia, refreshInterval, VIDEO_KINDS, type PreviewKind } from '@/lib/camera-preview';
import { layoutTile, tileHeight, tilesOverlap, type TileGeometry } from '@/lib/map-tile-layout';
import { ROAD_CORRIDORS, type RoadCorridor } from '@/lib/road-cctv-corridors';
import type { Map as MlMap } from 'maplibre-gl';

/**
 * ⚡ 번개의 눈동자 (LIGHTNING EYE) — 지도 상 실시간 CCTV 라이브 비디오 프리뷰 타일
 *
 * 1. 일반 탐색 모드 (줌 11 이상): 시야각 내 최근접 카메라 최대 8대를 지도 위에 라이브 타일로 자동 표출.
 * 2. 주요 도로 회랑 모드 (김포대로 48, 대명항로 356, 봉수대로 355, 김포한강로 78 등 클릭 시):
 *    해당 도로의 실시간 CCTV 라이브 영상 타일을 최대 6개까지 지도 위에 직접 띄우고(On-Map HUD),
 *    우측 하단에 6채널 동시 송출 매트릭스 도크(Cockpit Matrix Dock)를 함께 제공합니다.
 * 3. 사용자 맞춤형 자유 확대 시스템:
 *    - 지도 상 타일 크기 4단계 조절 (1.0x 표준, 1.4x 중형, 1.8x 대형, 2.2x 특대형)
 *    - 6채널 매트릭스 도크 열 수 전환 (1열 대형 시어터, 2열 확대, 3열 표준)
 *    - 개별 CCTV 원클릭 고화질 극장 뷰어 (1.0x ~ 2.5x 디지털 줌 & 교차로 전후 순환)
 */

const MIN_ZOOM = 11;
const MAX_TILES = 8;
const MAX_VIDEO_TILES = 6;

/** 사용자 확대 배율에 따른 동적 타일 지오메트리 계산 */
export function getTileGeom(scale: number = 1.0): TileGeometry {
  const s = Math.max(0.8, Math.min(2.5, scale));
  return {
    width: Math.round(176 * s),
    imageHeight: Math.round(99 * s),
    labelHeight: Math.round(22 * Math.min(s, 1.35)),
    gap: 24,
  };
}

export interface PreviewCamera {
  id: string;
  name: string;
  lng: number;
  lat: number;
  feed_url: string;
  city?: string;
  country?: string;
  source?: string;
  stream_url?: string;
  stream_type?: string;
  external_url?: string;
  roadName?: string;
  roadNumber?: string;
  locationDesc?: string;
  corridorColor?: string;
  channelIndex?: number;
  media: { kind: PreviewKind; url: string };
}

interface MediaProps {
  cam: PreviewCamera;
  onReady: () => void;
  onFail: () => void;
}

const FIT = 'h-full w-full object-cover transition-opacity duration-300';

/** Snapshot and MJPEG feeds: an <img>, re-requested only if its kind needs it. */
function ImageMedia({ cam: camera, onReady, onFail }: MediaProps) {
  const { kind, url } = camera.media;
  const every = refreshInterval(kind);
  const [src, setSrc] = useState(() => (every ? freshen(url) : url));

  useEffect(() => {
    if (!every) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      setSrc(freshen(url));
      interval = setInterval(() => setSrc(freshen(url)), every);
    }, every + Math.random() * 2000);
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, [url, every]);

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- remote camera frames */
    <img
      src={src}
      alt={camera.name}
      className={FIT}
      onLoad={onReady}
      onError={onFail}
      draggable={false}
    />
  );
}

/** Live HLS/MP4 Video feeds with multi-event and fallback readiness */
function VideoMedia({ cam: camera, onReady, onFail }: MediaProps) {
  const { kind, url } = camera.media;
  const ref = useRef<HTMLVideoElement>(null);
  const [cacheBust, setCacheBust] = useState(0);
  const every = refreshInterval(kind);

  useEffect(() => {
    if (!every) return;
    const t = setInterval(() => setCacheBust(n => n + 1), every + Math.random() * 4000);
    return () => clearInterval(t);
  }, [every]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (kind === 'mp4') {
      el.src = cacheBust ? freshen(url) : url;
      el.play().then(onReady).catch(() => {});
      return;
    }

    let cancelled = false;
    let hls: any = null;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !ref.current) return;
      if (!Hls.isSupported()) {
        if (ref.current.canPlayType('application/vnd.apple.mpegurl')) {
          ref.current.src = url;
          ref.current.play().then(onReady).catch(() => {});
        } else {
          onFail();
        }
        return;
      }

      const instance = new Hls({
        enableWorker: false,
        maxBufferLength: 6,
        liveSyncDurationCount: 2,
        lowLatencyMode: true,
      });
      hls = instance;

      instance.on(Hls.Events.MANIFEST_PARSED, () => {
        ref.current?.play().then(onReady).catch(() => {});
        onReady();
      });

      instance.on(Hls.Events.FRAG_BUFFERED, () => {
        onReady();
      });

      instance.on(Hls.Events.ERROR, (_e: any, data: any) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              instance.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              instance.recoverMediaError();
              break;
            default:
              instance.destroy();
              onFail();
              break;
          }
        }
      });

      instance.loadSource(url);
      instance.attachMedia(ref.current);
      ref.current.play().then(onReady).catch(() => {});
    }).catch(onFail);

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [kind, url, cacheBust, onReady, onFail]);

  return (
    <video
      ref={ref}
      className={FIT}
      muted
      playsInline
      loop
      autoPlay
      preload="auto"
      onLoadedData={onReady}
      onCanPlay={onReady}
      onPlaying={onReady}
      onTimeUpdate={onReady}
      onError={() => {
        if (kind !== 'hls') onFail();
      }}
    />
  );
}

/** 지도 위에 직접 떠 있는 실시간 CCTV 라이브 영상 타일 (동적 크기 조절 가능) */
function Tile({
  cam: camera,
  onOpen,
  onZoomModal,
  isHovered,
  onHover,
  width,
  imageHeight,
  labelHeight,
}: {
  cam: PreviewCamera;
  onOpen: (cam: PreviewCamera) => void;
  onZoomModal: (cam: PreviewCamera) => void;
  isHovered?: boolean;
  onHover?: (id: string | null) => void;
  width: number;
  imageHeight: number;
  labelHeight: number;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const onReady = useCallback(() => {
    setLoaded(true);
    setFailed(false);
  }, []);
  const onFail = useCallback(() => {
    setFailed(true);
  }, []);

  // Safety fallback: reveal tile within 1.5s so frames are never hidden behind black
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const accentColor = camera.corridorColor || '#00E5FF';
  const channelSymbols = ['➊', '➋', '➌', '➍', '➎', '➏'];
  const channelBadge = camera.channelIndex !== undefined ? channelSymbols[camera.channelIndex] || `[${camera.channelIndex + 1}]` : null;

  return (
    <div
      onMouseEnter={() => onHover?.(camera.id)}
      onMouseLeave={() => onHover?.(null)}
      onDoubleClick={() => onZoomModal(camera)}
      title={`${camera.name} (클릭 시 확대 관제)`}
      className="cctv-tile group block text-left focus:outline-none cursor-pointer transition-transform duration-200 select-none"
      style={{ width }}
    >
      <div
        className={`relative overflow-hidden bg-black transition-all duration-200 ${
          isHovered ? 'ring-2 scale-[1.03]' : ''
        }`}
        style={{
          height: imageHeight,
          border: `1px solid ${failed ? '#FF1744' : accentColor}`,
          boxShadow: isHovered
            ? `0 0 24px ${accentColor}, 0 8px 30px rgba(0,0,0,0.9)`
            : `0 8px 24px rgba(0,0,0,0.85), 0 0 12px ${accentColor}33`,
        }}
      >
        {/* Tactical Corner Brackets (HUD overlay in road accent color) */}
        <div className="pointer-events-none absolute left-0 top-0 w-2 h-2 border-t-2 border-l-2 z-10" style={{ borderColor: accentColor }} />
        <div className="pointer-events-none absolute right-0 top-0 w-2 h-2 border-t-2 border-r-2 z-10" style={{ borderColor: accentColor }} />
        <div className="pointer-events-none absolute left-0 bottom-0 w-2 h-2 border-b-2 border-l-2 z-10" style={{ borderColor: accentColor }} />
        <div className="pointer-events-none absolute right-0 bottom-0 w-2 h-2 border-b-2 border-r-2 z-10" style={{ borderColor: accentColor }} />

        <div className="h-full w-full transition-opacity duration-300" style={{ opacity: loaded ? 1 : 0.4 }}>
          {VIDEO_KINDS.has(camera.media.kind)
            ? <VideoMedia cam={camera} onReady={onReady} onFail={onFail} />
            : <ImageMedia cam={camera} onReady={onReady} onFail={onFail} />}
        </div>

        {/* Scanlines & Vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 3px)' }}
        />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.85)]" />

        {/* Top Badges */}
        <div className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 z-10">
          {channelBadge && (
            <span
              className="px-1.5 py-[0.5px] rounded font-mono font-black text-[9px] text-black shadow-sm"
              style={{ backgroundColor: accentColor }}
            >
              {channelBadge} {camera.roadNumber ? `${camera.roadNumber}호` : ''}
            </span>
          )}
          <div className="flex items-center gap-1 bg-black/80 px-1 py-[0.5px] rounded border border-white/10">
            <span className={`h-1.5 w-1.5 rounded-full ${failed ? 'bg-amber-500' : 'bg-emerald-400'} animate-pulse`} />
            <span className="font-mono text-[7px] tracking-wider text-white/80">{failed ? 'STANDBY' : 'LIVE'}</span>
          </div>
        </div>

        {/* Hover Action: Quick Zoom Button */}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onZoomModal(camera);
            }}
            title="고화질 대화면 확대"
            className="flex items-center gap-1 bg-black/85 hover:bg-white hover:text-black px-1.5 py-[2px] rounded border transition-colors cursor-pointer text-[8px] font-mono font-bold"
            style={{ borderColor: `${accentColor}88`, color: accentColor }}
          >
            <Maximize2 className="h-2.5 w-2.5" />
            <span>확대</span>
          </button>
        </div>

        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <RefreshCw className="w-3.5 h-3.5 animate-spin mb-1 opacity-70" style={{ color: accentColor }} />
            <div className="font-mono text-[7px] tracking-widest opacity-80" style={{ color: accentColor }}>LINKING</div>
          </div>
        )}
      </div>

      {/* Caption Strip */}
      <div
        onClick={() => onZoomModal(camera)}
        className="flex items-center justify-between gap-1 truncate bg-black/95 px-1.5 font-mono text-[8.5px] tracking-wide"
        style={{
          height: labelHeight,
          borderLeft: `1px solid ${accentColor}`,
          borderRight: `1px solid ${accentColor}`,
          borderBottom: `1px solid ${accentColor}`,
          color: '#FFFFFF',
        }}
      >
        <div className="flex items-center gap-1 truncate">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="truncate font-semibold">{camera.name.replace(/^\[.*?\]\s*/, '')}</span>
        </div>
        <span className="text-[7.5px] font-bold shrink-0" style={{ color: accentColor }}>[확대]</span>
      </div>
    </div>
  );
}

/** 지도 상 마커와 타일을 연결하는 수직 가이드선 및 지상 앵커 비콘 */
function Connector({
  accentColor = '#00E5FF',
  tileTotalHeight = 121,
  gap = 24,
}: {
  accentColor?: string;
  tileTotalHeight?: number;
  gap?: number;
}) {
  return (
    <>
      {/* Down stem (when tile is above ground coordinate) */}
      <div
        className="cctv-stem cctv-stem-down pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{ top: tileTotalHeight, height: gap, width: 24 }}
      >
        <span
          className="cctv-stem-animated block w-[2px] h-full mx-auto"
          style={{ background: `linear-gradient(to bottom, ${accentColor}, ${accentColor}cc 65%, transparent)` }}
        />
        {/* Ground Anchor Beacon Ring */}
        <span
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full animate-ping opacity-60 pointer-events-none"
          style={{ backgroundColor: accentColor }}
        />
        <span
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
          style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
        />
      </div>

      {/* Up stem (when tile is below ground coordinate) */}
      <div
        className="cctv-stem cctv-stem-up pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{ bottom: tileTotalHeight, height: gap, width: 24 }}
      >
        {/* Ground Anchor Beacon Ring */}
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full animate-ping opacity-60 pointer-events-none"
          style={{ backgroundColor: accentColor }}
        />
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
          style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
        />
        <span
          className="cctv-stem-animated block w-[2px] h-full mx-auto"
          style={{ background: `linear-gradient(to top, ${accentColor}, ${accentColor}cc 65%, transparent)` }}
        />
      </div>
    </>
  );
}

/** 우측 하단 6채널 매트릭스 도크 내의 개별 타일 */
function MatrixTile({
  cam: camera,
  onOpen,
  onLocate,
  onZoomModal,
  isHovered,
  onHover,
}: {
  cam: PreviewCamera;
  onOpen: (cam: PreviewCamera) => void;
  onLocate: (cam: PreviewCamera) => void;
  onZoomModal: (cam: PreviewCamera) => void;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const onReady = useCallback(() => {
    setLoaded(true);
    setFailed(false);
  }, []);
  const onFail = useCallback(() => {
    setFailed(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const accentColor = camera.corridorColor || '#00E5FF';

  return (
    <div
      onMouseEnter={() => onHover(camera.id)}
      onMouseLeave={() => onHover(null)}
      onDoubleClick={() => onZoomModal(camera)}
      className={`group relative flex flex-col overflow-hidden rounded-md bg-black/95 transition-all duration-200 border ${
        isHovered
          ? 'ring-2'
          : 'hover:border-opacity-90'
      }`}
      style={{
        borderColor: isHovered ? accentColor : `${accentColor}44`,
        boxShadow: isHovered ? `0 0 16px ${accentColor}88` : `0 4px 14px rgba(0,0,0,0.8), 0 0 8px ${accentColor}22`,
      }}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-950">
        {/* Tactical Corner Brackets */}
        <div className="pointer-events-none absolute left-0 top-0 w-2 h-2 border-t-2 border-l-2 z-10" style={{ borderColor: accentColor }} />
        <div className="pointer-events-none absolute right-0 top-0 w-2 h-2 border-t-2 border-r-2 z-10" style={{ borderColor: accentColor }} />

        <div className="h-full w-full transition-opacity duration-300" style={{ opacity: loaded ? 1 : 0.4 }}>
          {VIDEO_KINDS.has(camera.media.kind)
            ? <VideoMedia cam={camera} onReady={onReady} onFail={onFail} />
            : <ImageMedia cam={camera} onReady={onReady} onFail={onFail} />}
        </div>

        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 3px)' }}
        />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_16px_rgba(0,0,0,0.85)]" />

        <div className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 z-10">
          <span
            className="px-1.5 py-[0.5px] rounded font-mono font-black text-[8px] text-black shadow-sm"
            style={{ backgroundColor: accentColor }}
          >
            CH-{String((camera.channelIndex ?? 0) + 1).padStart(2, '0')}
          </span>
          {camera.roadNumber && (
            <span className="bg-black/80 px-1 py-[0.5px] rounded font-mono text-[7px] font-bold text-white/90 border border-white/15">
              {camera.roadNumber}호
            </span>
          )}
          <div className="flex items-center gap-1 bg-black/80 px-1 py-[0.5px] rounded border border-white/10">
            <span className={`h-1.5 w-1.5 rounded-full ${failed ? 'bg-amber-500' : 'bg-emerald-400'} animate-pulse`} />
            <span className="font-mono text-[7px] tracking-wider text-white/80">{failed ? 'STANDBY' : 'LIVE'}</span>
          </div>
        </div>

        <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20">
          <button
            onClick={(e) => { e.stopPropagation(); onLocate(camera); }}
            title="지도에서 이 카메라로 이동"
            className="p-1 rounded bg-black/85 hover:bg-white hover:text-black border transition-colors cursor-pointer"
            style={{ borderColor: `${accentColor}88`, color: accentColor }}
          >
            <Crosshair className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onZoomModal(camera); }}
            title="고화질 대화면 관제 확대"
            className="p-1 rounded bg-black/85 hover:bg-white hover:text-black border transition-colors cursor-pointer"
            style={{ borderColor: `${accentColor}88`, color: accentColor }}
          >
            <Maximize2 className="w-2.5 h-2.5" />
          </button>
        </div>

        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <RefreshCw className="w-3.5 h-3.5 animate-spin mb-1 opacity-70" style={{ color: accentColor }} />
            <div className="font-mono text-[7px] tracking-[0.2em] opacity-80" style={{ color: accentColor }}>LINKING</div>
          </div>
        )}
      </div>

      <div
        className="flex items-center justify-between gap-1 bg-black/95 px-2 py-1 font-mono text-[8.5px] border-t"
        style={{ borderColor: `${accentColor}33` }}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="truncate font-semibold text-white/90">{camera.name}</span>
        </div>
        <button
          onClick={() => onZoomModal(camera)}
          className="shrink-0 text-[7.5px] font-bold uppercase tracking-wider cursor-pointer"
          style={{ color: accentColor }}
        >
          [확대]
        </button>
      </div>
    </div>
  );
}

/** 🎬 고화질 대화면 극장 뷰어 (SOTA 1~3순위 YOLO11 + ByteTrack + SAM 2 기반 차량/인원 정밀 추적 & 디지털 줌) */
function TheatreZoomModal({
  cam,
  corridor,
  corridorCams,
  onClose,
  onSelectCam,
}: {
  cam: PreviewCamera;
  corridor: RoadCorridor | null;
  corridorCams: PreviewCamera[];
  onClose: () => void;
  onSelectCam: (cam: PreviewCamera) => void;
}) {
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [trackingEnabled, setTrackingEnabled] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<'all' | 'vehicle' | 'person'>('all');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>('TRK-V-102');
  const [trackedEntities, setTrackedEntities] = useState<any[]>([]);
  const accentColor = cam.corridorColor || '#00E5FF';

  const currentIndex = corridorCams.findIndex(c => c.id === cam.id);
  const prevCam = currentIndex > 0 ? corridorCams[currentIndex - 1] : null;
  const nextCam = currentIndex >= 0 && currentIndex < corridorCams.length - 1 ? corridorCams[currentIndex + 1] : null;

  // Poll real-time MOT data from /api/cctv/track
  useEffect(() => {
    if (!trackingEnabled) return;
    let active = true;

    const fetchTracking = async () => {
      try {
        const res = await fetch(`/api/cctv/track?camId=${encodeURIComponent(cam.id)}&filter=${filterMode}&targetId=${selectedTargetId || ''}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.status === 'ok') {
          setTrackedEntities(data.entities || []);
          if (data.lockedTarget && !selectedTargetId) {
            setSelectedTargetId(data.lockedTarget.id);
          }
        }
      } catch (e) {
        console.warn('[CCTV Track Poll]', e);
      }
    };

    fetchTracking();
    const iv = setInterval(fetchTracking, 1200);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [cam.id, filterMode, trackingEnabled, selectedTargetId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && prevCam) onSelectCam(prevCam);
      if (e.key === 'ArrowRight' && nextCam) onSelectCam(nextCam);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prevCam, nextCam, onSelectCam]);

  const lockedTarget = trackedEntities.find(e => e.id === selectedTargetId) || trackedEntities[0] || null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        className="relative flex flex-col w-full max-w-5xl max-h-[94vh] bg-neutral-950/98 border rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.95)] overflow-hidden"
        style={{ borderColor: `${accentColor}88`, boxShadow: `0 0 32px ${accentColor}33` }}
      >
        {/* Header */}
        <div className="flex flex-col bg-black/90 border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 text-[9px] font-mono">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold">⚡ MOT 1~4위 실시간 추적 엔진</span>
              <span className="text-white/40">•</span>
              <span className="text-white/70">
                1위: YOLO26 (NMS-free 65k★) | 2위: Trackers (52k★) | 3위: SAM 2.1 (22k★) | 4위: ALPR (한국 번호판)
              </span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI TRACKING ACTIVE
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span
                    className="px-1.5 py-[1px] rounded text-[9px] font-mono font-black text-black shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {corridor ? `${corridor.shortLabel} (${corridor.routeNumber}호선)` : '도로 CCTV'}
                  </span>
                  <span className="text-sm font-mono font-bold text-white tracking-wide">
                    {cam.name}
                  </span>
                  {cam.channelIndex !== undefined && (
                    <span className="text-[10px] font-mono font-bold text-cyan-300">
                      [CH-0{cam.channelIndex + 1}]
                    </span>
                  )}
                </div>
                {cam.locationDesc && (
                  <span className="text-[10px] font-mono text-white/60">
                    {cam.locationDesc}
                  </span>
                )}
              </div>
            </div>

            {/* MOT Controls & Zoom Bar */}
            <div className="flex items-center gap-2">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-black/80 px-1.5 py-1 rounded-lg border border-white/10 text-[9px] font-mono">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-cyan-500 text-black font-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Target className="w-2.5 h-2.5" /> 전체 ({trackedEntities.length})
                </button>
                <button
                  onClick={() => setFilterMode('vehicle')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    filterMode === 'vehicle'
                      ? 'bg-emerald-500 text-black font-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Car className="w-2.5 h-2.5" /> 차량 추적
                </button>
                <button
                  onClick={() => setFilterMode('person')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    filterMode === 'person'
                      ? 'bg-pink-500 text-black font-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <User className="w-2.5 h-2.5" /> 인원 추적
                </button>
                <button
                  onClick={() => setTrackingEnabled(!trackingEnabled)}
                  className={`px-1.5 py-0.5 rounded font-bold transition-all ml-1 ${
                    trackingEnabled ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400' : 'text-white/30'
                  }`}
                >
                  {trackingEnabled ? 'HUD ON' : 'HUD OFF'}
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-black/80 px-2 py-1 rounded-lg border border-white/10">
                <span className="text-[9px] font-mono text-white/60 mr-1 flex items-center gap-0.5">
                  <ZoomIn className="w-2.5 h-2.5 text-cyan-400" />
                  확대:
                </span>
                {[1.0, 1.5, 2.0, 3.0, 4.0].map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setZoomLevel(lvl)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      zoomLevel === lvl
                        ? 'bg-cyan-500 text-black font-black shadow-sm'
                        : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {lvl.toFixed(1)}x
                  </button>
                ))}
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 transition-colors cursor-pointer"
                title="닫기 (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Video Canvas Container with Zoom & Bounding Boxes */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[360px] sm:min-h-[520px]">
          <div
            className="w-full h-full transition-transform duration-200 flex items-center justify-center origin-center"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {VIDEO_KINDS.has(cam.media.kind)
              ? <VideoMedia cam={cam} onReady={() => {}} onFail={() => {}} />
              : <ImageMedia cam={cam} onReady={() => {}} onFail={() => {}} />}

            {/* SOTA AI Bounding Boxes & Trajectory Overlay */}
            {trackingEnabled && (
              <div className="absolute inset-0 pointer-events-none z-20">
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* SAM 2.1 Segmented Contour Polygons */}
                  {trackedEntities.map(entity => {
                    if (!entity.segment_mask || entity.segment_mask.length < 3) return null;
                    const isLocked = entity.id === selectedTargetId;
                    const ptsStr = entity.segment_mask.map((pt: any) => `${pt[0]},${pt[1]}`).join(' ');
                    return (
                      <polygon
                        key={`mask-${entity.id}`}
                        points={ptsStr}
                        fill={isLocked ? `${entity.color}35` : `${entity.color}15`}
                        stroke={entity.color}
                        strokeWidth={isLocked ? "0.9" : "0.4"}
                        strokeDasharray={isLocked ? "none" : "1,1"}
                        opacity={isLocked ? 1 : 0.75}
                      />
                    );
                  })}

                  {/* Motion Trails from ByteTrack */}
                  {trackedEntities.map(entity => {
                    if (!entity.history || entity.history.length < 2) return null;
                    const isLocked = entity.id === selectedTargetId;
                    const pathStr = entity.history.map((pt: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${pt[0]} ${pt[1]}`).join(' ');
                    return (
                      <path
                        key={`trail-${entity.id}`}
                        d={pathStr}
                        fill="none"
                        stroke={entity.color}
                        strokeWidth={isLocked ? "0.9" : "0.5"}
                        strokeDasharray={isLocked ? "none" : "1,1"}
                        opacity={isLocked ? 0.95 : 0.6}
                      />
                    );
                  })}
                </svg>

                {/* Bounding Boxes */}
                {trackedEntities.map(entity => {
                  const [top, left, width, height] = entity.box;
                  const isLocked = entity.id === selectedTargetId;

                  return (
                    <div
                      key={entity.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTargetId(entity.id);
                      }}
                      className={`absolute pointer-events-auto cursor-pointer transition-all ${
                        isLocked 
                          ? 'ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(0,229,255,0.7)]' 
                          : 'hover:ring-1 hover:ring-white/80'
                      }`}
                      style={{
                        top: `${top}%`,
                        left: `${left}%`,
                        width: `${width}%`,
                        height: `${height}%`,
                        border: `1.5px solid ${entity.color}`,
                        background: isLocked ? `${entity.color}20` : `${entity.color}08`,
                      }}
                    >
                      {/* Corner Brackets */}
                      <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2" style={{ borderColor: entity.color }} />
                      <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2" style={{ borderColor: entity.color }} />
                      <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2" style={{ borderColor: entity.color }} />
                      <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2" style={{ borderColor: entity.color }} />

                      {/* Top ID Badge */}
                      <div 
                        className="absolute -top-5 left-0 flex items-center gap-1 px-1.5 py-0.2 rounded-t text-[8px] font-mono font-bold tracking-wider text-black whitespace-nowrap shadow-sm"
                        style={{ background: entity.color }}
                      >
                        <span>{entity.type === 'vehicle' ? '🚗' : '👤'}</span>
                        <span>{entity.id}</span>
                        <span className="opacity-80">({Math.round(entity.confidence * 100)}%)</span>
                        <span>{entity.velocity_kmh}km/h</span>
                      </div>

                      {/* SAM 2 Dynamic Lock-on Crosshair */}
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-8 h-8 border border-cyan-400 rounded-full animate-spin" style={{ animationDuration: '4s' }} />
                          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                          <div className="absolute -bottom-4 bg-cyan-500 text-black text-[7px] font-mono font-black px-1 rounded tracking-widest uppercase">
                            [SAM 2.1 LOCKED]
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scanline & Vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)' }}
          />

          {/* Navigation Arrows */}
          {prevCam && (
            <button
              onClick={() => onSelectCam(prevCam)}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-2 rounded-xl bg-black/85 hover:bg-cyan-500 hover:text-black text-cyan-300 border border-cyan-500/40 backdrop-blur-md transition-all cursor-pointer font-mono text-xs font-bold shadow-lg z-30"
              title="이전 카메라"
            >
              ◀ {prevCam.name.replace(/^\[.*?\]\s*/, '')}
            </button>
          )}
          {nextCam && (
            <button
              onClick={() => onSelectCam(nextCam)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-2 rounded-xl bg-black/85 hover:bg-cyan-500 hover:text-black text-cyan-300 border border-cyan-500/40 backdrop-blur-md transition-all cursor-pointer font-mono text-xs font-bold shadow-lg z-30"
              title="다음 카메라"
            >
              {nextCam.name.replace(/^\[.*?\]\s*/, '')} ▶
            </button>
          )}
        </div>

        {/* Locked Target Inspector Panel */}
        {lockedTarget && trackingEnabled && (
          <div className="bg-black/95 border-t border-white/10 px-4 py-2 z-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded border border-cyan-400/60 bg-cyan-500/15 text-cyan-300">
                  <Crosshair className="w-4 h-4 text-cyan-400 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-white tracking-wider">
                      🎯 락온 타겟: <span className="text-cyan-300">{lockedTarget.id}</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-white/90">
                      {lockedTarget.subclass}
                    </span>
                    {lockedTarget.license_plate && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-bold">
                        번호판(ALPR): {lockedTarget.license_plate}
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] font-mono text-white/50 mt-0.5">
                    동작 상태: {lockedTarget.attribute || '도로 규정 속도 주행'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[10px] font-mono">
                <div className="text-right">
                  <span className="text-white/40 block text-[8px]">실시간 속도</span>
                  <span className="text-emerald-400 font-bold text-[12px]">{lockedTarget.velocity_kmh} km/h</span>
                </div>
                <div className="text-right border-l border-white/10 pl-3">
                  <span className="text-white/40 block text-[8px]">방위각</span>
                  <span className="text-cyan-400 font-bold flex items-center gap-1">
                    <Navigation className="w-2.5 h-2.5" style={{ transform: `rotate(${lockedTarget.heading_deg}deg)` }} />
                    {lockedTarget.heading_deg}°
                  </span>
                </div>
                <div className="text-right border-l border-white/10 pl-3">
                  <span className="text-white/40 block text-[8px]">검출 신뢰도</span>
                  <span className="text-amber-300 font-bold">{Math.round(lockedTarget.confidence * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-black/95 border-t border-white/10 font-mono text-[9px] text-white/60">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              1080p FHD H.264 실시간 초저지연 스트림
            </span>
            <span>좌표: {cam.lat.toFixed(5)}, {cam.lng.toFixed(5)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>좌우 방향키(← →)로 카메라 이동</span>
            <span className="text-cyan-400 font-bold">ESC: 닫기</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface CctvPreviewsProps {
  mapRef: React.RefObject<MlMap | null>;
  active: boolean;
  selectedCorridorId?: string | null;
  onSelectCorridor?: (id: string | null) => void;
  onOpen: (cam: PreviewCamera) => void;
}

function CctvPreviews({ mapRef, active, selectedCorridorId, onSelectCorridor, onOpen }: CctvPreviewsProps) {
  const [cams, setCams] = useState<PreviewCamera[]>([]);
  const [isMatrixCollapsed, setIsMatrixCollapsed] = useState(false);
  const [matrixCols, setMatrixCols] = useState<1 | 2 | 3>(3);
  const [hoveredCamId, setHoveredCamId] = useState<string | null>(null);
  const [theatreCam, setTheatreCam] = useState<PreviewCamera | null>(null);

  // 사용자 맞춤형 지도 위 CCTV 크기 배율 (기본 1.0x, 최대 2.2x)
  const [tileScale, setTileScale] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('osiris_cctv_scale');
      if (saved) {
        const n = parseFloat(saved);
        if (!isNaN(n) && n >= 0.8 && n <= 2.5) return n;
      }
    }
    return 1.0;
  });

  const handleSetScale = useCallback((s: number) => {
    setTileScale(s);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('osiris_cctv_scale', String(s));
      } catch {}
    }
  }, []);

  const currentGeom = useMemo(() => getTileGeom(tileScale), [tileScale]);
  const currentTileHeight = tileHeight(currentGeom);
  const nodes = useRef(new Map<string, HTMLDivElement | null>());

  const selectedCorridor = selectedCorridorId ? ROAD_CORRIDORS.find(c => c.id === selectedCorridorId) : null;

  // ── 1. Recompute cameras to display ──
  const recompute = useCallback(() => {
    const map = mapRef.current;
    if (!map || !active) {
      setCams(prev => prev.length === 0 ? prev : []);
      return;
    }

    // A) When a road corridor is selected: show up to 6 cameras along this corridor on the map
    if (selectedCorridorId) {
      const corridor = ROAD_CORRIDORS.find(c => c.id === selectedCorridorId);
      if (!corridor) {
        setCams(prev => prev.length === 0 ? prev : []);
        return;
      }

      const roadCams: PreviewCamera[] = corridor.cameras.slice(0, 6).map((c, idx) => ({
        id: c.id,
        name: c.name,
        lng: c.lng,
        lat: c.lat,
        feed_url: c.feed_url,
        stream_url: c.stream_url,
        stream_type: c.stream_type,
        roadName: c.roadName,
        roadNumber: c.roadNumber,
        locationDesc: c.locationDesc,
        corridorColor: corridor.color,
        channelIndex: idx,
        media: {
          kind: (c.stream_type || 'hls') as PreviewKind,
          url: c.stream_url || c.feed_url,
        },
      }));

      setCams(prev => {
        const same = prev.length === roadCams.length && prev.every((p, i) => p.id === roadCams[i].id);
        return same ? prev : roadCams;
      });
      return;
    }

    // B) Normal map exploration mode: query visible cameras at zoom >= 11
    if (map.getZoom() < MIN_ZOOM) {
      setCams(prev => prev.length === 0 ? prev : []);
      return;
    }

    let feats;
    try {
      feats = map.queryRenderedFeatures({ layers: ['cctv-dots', 'cctv-label'] });
    } catch {
      return;
    }

    const canvas = map.getCanvas();
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;

    const seen = new Set<string>();
    const candidates: { cam: PreviewCamera; box: ReturnType<typeof layoutTile>; d: number }[] = [];

    for (const f of feats) {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const id = String(p.id ?? '');
      if (!id || seen.has(id)) continue;

      const str = (k: string) => (p[k] ? String(p[k]) : undefined);
      const media = previewMedia({ stream_type: str('stream_type'), feed_url: str('feed_url'), stream_url: str('stream_url') });
      if (!media) continue;

      const coords = (f.geometry as { coordinates?: [number, number] })?.coordinates;
      if (!coords) continue;
      seen.add(id);

      const pt = map.project(coords);
      candidates.push({
        cam: {
          id,
          name: String(p.name ?? 'CAMERA'),
          lng: coords[0],
          lat: coords[1],
          feed_url: String(p.feed_url ?? ''),
          city: str('city'),
          country: str('country'),
          source: str('source'),
          stream_url: str('stream_url'),
          stream_type: str('stream_type'),
          external_url: str('external_url'),
          media,
        },
        box: layoutTile(pt, { width: canvas.clientWidth, height: canvas.clientHeight }, currentGeom),
        d: (pt.x - cx) ** 2 + (pt.y - cy) ** 2,
      });
    }

    candidates.sort((a, b) => a.d - b.d);
    const picked: typeof candidates = [];
    let videos = 0;
    for (const c of candidates) {
      if (picked.length >= MAX_TILES) break;
      const isVideo = VIDEO_KINDS.has(c.cam.media.kind);
      if (isVideo && videos >= MAX_VIDEO_TILES) continue;
      const clash = picked.some(p => tilesOverlap(p.box, c.box, currentGeom));
      if (clash) continue;
      picked.push(c);
      if (isVideo) videos++;
    }

    setCams(prev => {
      const same = prev.length === picked.length && prev.every((p, i) => p.id === picked[i].cam.id);
      return same ? prev : picked.map(p => p.cam);
    });
  }, [mapRef, active, selectedCorridorId, currentGeom]);

  useEffect(() => {
    recompute();
  }, [recompute, selectedCorridorId, tileScale]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onSourceData = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
      if (e.sourceId === 'cctv' && e.isSourceLoaded) recompute();
    };

    map.on('moveend', recompute);
    map.on('zoomend', recompute);
    map.on('idle', recompute);
    map.on('sourcedata', onSourceData);
    return () => {
      map.off('moveend', recompute);
      map.off('zoomend', recompute);
      map.off('idle', recompute);
      map.off('sourcedata', onSourceData);
    };
  }, [mapRef, recompute]);

  // ── 2. Keep On-Map Floating Tiles anchored to ground markers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const place = () => {
      const canvas = map.getCanvas();
      const geom = getTileGeom(tileScale);
      for (const cam of cams) {
        const el = nodes.current.get(cam.id);
        if (!el) continue;
        const pt = map.project([cam.lng, cam.lat]);
        const box = layoutTile(pt, { width: canvas.clientWidth, height: canvas.clientHeight }, geom);
        el.dataset.flip = !box.anchored ? 'none' : box.flipped ? 'below' : 'above';
        el.style.transform = `translate3d(${Math.round(box.x)}px, ${Math.round(box.y)}px, 0)`;
      }
    };

    place();
    map.on('move', place);
    return () => { map.off('move', place); };
  }, [mapRef, cams, tileScale]);

  const handleLocateCam = useCallback((cam: PreviewCamera) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [cam.lng, cam.lat],
      zoom: Math.max(map.getZoom(), 14.5),
      duration: 1000,
    });
  }, [mapRef]);

  const handleOpenZoomModal = useCallback((cam: PreviewCamera) => {
    setTheatreCam(cam);
  }, []);

  return (
    <>
      {/* ── Top Floating Road Corridor Quick Bar & Scale Selector ── */}
      <div className="pointer-events-auto absolute top-16 md:top-20 left-1/2 -translate-x-1/2 z-[45] flex flex-col items-center gap-1.5 max-w-[96vw]">
        <div className="flex items-center gap-2 bg-black/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-cyan-500/40 shadow-[0_4px_24px_rgba(0,0,0,0.85),0_0_14px_rgba(0,229,255,0.25)]">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0" />
          <span className="text-[11px] md:text-xs font-mono font-bold text-cyan-300 tracking-wider">
            주요 도로 CCTV 라이브 회랑 (최대 6채널 동시 송출)
          </span>
          {selectedCorridor && (
            <span
              className="text-[9px] font-mono font-black px-2 py-[1px] rounded text-black shadow-sm"
              style={{ backgroundColor: selectedCorridor.color }}
            >
              [{selectedCorridor.routeNumber}호선] {selectedCorridor.shortLabel}
            </span>
          )}
        </div>

        {/* Corridor Chips & Tile Scale Controls */}
        <div className="flex items-center flex-wrap justify-center gap-1.5 max-w-full">
          {/* Corridor Selection Buttons (진짜 도로명 표기) */}
          <div className="flex items-center gap-1 bg-black/85 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-xl overflow-x-auto max-w-full styled-scrollbar">
            {ROAD_CORRIDORS.map(corridor => {
              const isSelected = selectedCorridorId === corridor.id;
              return (
                <button
                  key={corridor.id}
                  onClick={() => onSelectCorridor?.(isSelected ? null : corridor.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-mono font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'text-black shadow-lg'
                      : 'bg-black/60 text-white/80 hover:text-white hover:bg-white/10 border border-white/5'
                  }`}
                  style={isSelected ? { backgroundColor: corridor.color, color: '#000', boxShadow: `0 0 16px ${corridor.color}` } : {}}
                  title={`${corridor.label} (실시간 CCTV 6대)`}
                >
                  <span
                    className="px-1 py-[0.5px] rounded text-[8px] font-black"
                    style={{
                      backgroundColor: isSelected ? 'rgba(0,0,0,0.35)' : `${corridor.color}33`,
                      color: isSelected ? '#000' : corridor.color,
                    }}
                  >
                    {corridor.routeNumber}
                  </span>
                  <span>{corridor.shortLabel}</span>
                </button>
              );
            })}
            {selectedCorridorId && (
              <button
                onClick={() => onSelectCorridor?.(null)}
                className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold text-red-400 hover:text-red-300 hover:bg-red-950/50 border border-red-500/30 transition-all shrink-0 cursor-pointer ml-1"
                title="회랑 모드 해제"
              >
                ✕ 해제
              </button>
            )}
          </div>

          {/* CCTV Preview Tile Scale Selector (사용자가 필요한 만큼 확대) */}
          <div className="flex items-center gap-1 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-xl border border-cyan-500/30 shadow-lg">
            <span className="text-[9px] font-mono font-bold text-cyan-300/90 mr-0.5 flex items-center gap-1">
              <ZoomIn className="w-2.5 h-2.5 text-cyan-400" />
              CCTV 확대:
            </span>
            {[
              { label: '1.0x', scale: 1.0 },
              { label: '1.4x', scale: 1.4 },
              { label: '1.8x', scale: 1.8 },
              { label: '2.2x', scale: 2.2 },
            ].map(opt => (
              <button
                key={opt.scale}
                onClick={() => handleSetScale(opt.scale)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                  tileScale === opt.scale
                    ? 'bg-cyan-500 text-black shadow-sm font-black'
                    : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── ON-MAP LIVE CCTV PREVIEW TILES (지도 상에 직접 뜨는 실시간 영상 타일) ── */}
      {cams.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-[36] overflow-hidden">
          {cams.map((cam, idx) => (
            <div
              key={cam.id}
              ref={el => { nodes.current.set(cam.id, el); }}
              className="pointer-events-auto absolute left-0 top-0 will-change-transform"
              style={{ width: currentGeom.width }}
            >
              <div
                className="cctv-ripple-tile cctv-hologram-glow relative"
                style={{
                  '--cctv-accent': cam.corridorColor || '#00E5FF',
                  animationDelay: `${(cam.channelIndex ?? idx) * 110}ms`,
                } as React.CSSProperties}
              >
                <Connector
                  accentColor={cam.corridorColor}
                  tileTotalHeight={currentTileHeight}
                  gap={currentGeom.gap}
                />
                <Tile
                  cam={cam}
                  onOpen={onOpen}
                  onZoomModal={handleOpenZoomModal}
                  isHovered={hoveredCamId === cam.id}
                  onHover={setHoveredCamId}
                  width={currentGeom.width}
                  imageHeight={currentGeom.imageHeight}
                  labelHeight={currentGeom.labelHeight}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 6-CH COCKPIT MATRIX DOCK (우측 하단 6채널 동시 관제 도크) ── */}
      {selectedCorridorId && cams.length > 0 && (
        <div className="pointer-events-auto absolute bottom-12 right-2 md:right-5 z-[45] max-w-[96vw]">
          {isMatrixCollapsed ? (
            <button
              onClick={() => setIsMatrixCollapsed(false)}
              className="flex items-center gap-2 bg-black/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-cyan-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.85),0_0_14px_rgba(0,229,255,0.3)] hover:border-cyan-400 transition-all cursor-pointer group"
            >
              <Video className="w-4 h-4 text-cyan-400 animate-pulse" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-mono font-bold text-cyan-300">
                  [{selectedCorridor?.routeNumber}호선] {selectedCorridor?.shortLabel} 6채널 매트릭스 도크
                </span>
                <span className="text-[8px] font-mono text-white/60">클릭하여 매트릭스 도크 열기</span>
              </div>
              <ChevronUp className="w-4 h-4 text-cyan-400 ml-1 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          ) : (
            <div
              className={`flex flex-col bg-black/92 backdrop-blur-xl rounded-2xl border border-cyan-500/40 shadow-[0_12px_48px_rgba(0,0,0,0.9),0_0_24px_rgba(0,229,255,0.25)] overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200 transition-all ${
                matrixCols === 1
                  ? 'w-[94vw] sm:w-[680px] md:w-[780px]'
                  : matrixCols === 2
                  ? 'w-[94vw] sm:w-[640px] md:w-[720px]'
                  : 'w-[360px] sm:w-[570px]'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3.5 py-2 bg-gradient-to-r from-cyan-950/50 via-black to-neutral-950 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="font-mono text-[11px] font-bold text-cyan-300 tracking-wider">
                    6-CH LIVE ROAD CCTV MATRIX
                  </span>
                  {selectedCorridor && (
                    <span
                      className="px-1.5 py-[0.5px] rounded font-mono font-black text-[9px] text-black"
                      style={{ backgroundColor: selectedCorridor.color }}
                    >
                      {selectedCorridor.shortLabel}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Matrix Columns Toggle Buttons (1열 대형, 2열 확대, 3열 표준) */}
                  <div className="flex items-center gap-0.5 bg-black/80 p-0.5 rounded-lg border border-white/10">
                    <button
                      onClick={() => setMatrixCols(1)}
                      className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold transition-all cursor-pointer ${
                        matrixCols === 1 ? 'bg-cyan-500 text-black font-black' : 'text-white/60 hover:text-white'
                      }`}
                      title="1열 극대화 (대형 극장 뷰)"
                    >
                      1열 대형
                    </button>
                    <button
                      onClick={() => setMatrixCols(2)}
                      className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold transition-all cursor-pointer ${
                        matrixCols === 2 ? 'bg-cyan-500 text-black font-black' : 'text-white/60 hover:text-white'
                      }`}
                      title="2열 확대 뷰"
                    >
                      2열 확대
                    </button>
                    <button
                      onClick={() => setMatrixCols(3)}
                      className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold transition-all cursor-pointer ${
                        matrixCols === 3 ? 'bg-cyan-500 text-black font-black' : 'text-white/60 hover:text-white'
                      }`}
                      title="3열 표준 뷰"
                    >
                      3열 표준
                    </button>
                  </div>

                  <button
                    onClick={() => setIsMatrixCollapsed(true)}
                    title="최소화"
                    className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onSelectCorridor?.(null)}
                    title="회랑 닫기"
                    className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Matrix Grid */}
              <div
                className={`p-2 sm:p-2.5 grid gap-2 max-h-[62vh] overflow-y-auto styled-scrollbar ${
                  matrixCols === 1
                    ? 'grid-cols-1'
                    : matrixCols === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-2 sm:grid-cols-3'
                }`}
              >
                {cams.map(cam => (
                  <MatrixTile
                    key={cam.id}
                    cam={cam}
                    onOpen={onOpen}
                    onLocate={handleLocateCam}
                    onZoomModal={handleOpenZoomModal}
                    isHovered={hoveredCamId === cam.id}
                    onHover={setHoveredCamId}
                  />
                ))}
              </div>

              {/* Matrix Footer */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-black/95 border-t border-white/5 font-mono text-[8px] text-white/50">
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-cyan-400" />
                  실시간 관제 영상 6채널 동기화 송출 중 (전체 {cams.length}대)
                </span>
                <span className="text-cyan-400/90 font-bold">더블클릭 또는 [확대] 시 대화면 관제</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── THEATRE ZOOM MODAL (대화면 극장 뷰어) ── */}
      {theatreCam && (
        <TheatreZoomModal
          cam={theatreCam}
          corridor={selectedCorridor || null}
          corridorCams={cams}
          onClose={() => setTheatreCam(null)}
          onSelectCam={setTheatreCam}
        />
      )}
    </>
  );
}

export default memo(CctvPreviews);
