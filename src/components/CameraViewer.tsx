'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ExternalLink, RefreshCw, MapPin, Camera, CameraOff, Maximize2, PlayCircle,
  ZoomIn, ZoomOut, Crosshair, User, Car, Sparkles, Navigation, RotateCcw, Target
} from 'lucide-react';
import Hls from 'hls.js';
import { isHostedOffPlatform, liveFeedAtSource, localEmbed, needsResolution, offPlatformView } from '@/lib/camera-feed';

interface CameraViewerProps {
  camera: any | null;
  onClose: () => void;
  onLocate?: (lat: number, lng: number) => void;
}

interface TrackedEntity {
  id: string;
  type: 'vehicle' | 'person';
  label: string;
  subclass: string;
  confidence: number;
  box: [number, number, number, number]; // [top, left, width, height] percentage
  velocity_kmh: number;
  heading_deg: number;
  status: 'moving' | 'stationary' | 'accelerating' | 'turning';
  history: [number, number][];
  color: string;
  license_plate?: string;
  attribute?: string;
  segment_mask?: [number, number][]; // SAM 2.1 contour polygon
}

export default function CameraViewer({ camera, onClose, onLocate }: CameraViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  // ── Tactical Digital Zoom & Pan State ──
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── AI Vision Tracking State (YOLO11 + ByteTrack + SAM 2) ──
  const [trackingEnabled, setTrackingEnabled] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<'all' | 'vehicle' | 'person'>('all');
  const [trackedEntities, setTrackedEntities] = useState<TrackedEntity[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [trackingEngines, setTrackingEngines] = useState<any>(null);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toISOString().split('T')[1].slice(0, 8) + 'Z');
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const camId = camera ? `CAM-${Math.abs(camera.lat * 10000).toFixed(0).padStart(4, '0').slice(-4)}-${Math.abs(camera.lng * 10000).toFixed(0).padStart(4, '0').slice(-4)}` : 'UNKNOWN';

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const externalFeedUrl = camera?.external_url || camera?.feed_url;
  const hostedOffPlatform = isHostedOffPlatform(camera);

  const directEmbed = localEmbed(camera);
  const resolveKey: string | null =
    (needsResolution(camera) ? camera.external_url : null) ?? liveFeedAtSource(camera);
  const [resolution, setResolution] = useState<{ key: string; embed: string | null; offline: boolean; kind?: string } | null>(null);
  const resolvedEmbed = directEmbed ?? (resolution && resolution.key === resolveKey ? resolution.embed : null);
  const resolving = Boolean(resolveKey) && resolution?.key !== resolveKey;
  const offline = resolution?.key === resolveKey && resolution.offline;
  const gone = resolution?.key === resolveKey && resolution.kind === 'missing';

  const watchLiveUrl = liveFeedAtSource(camera);

  useEffect(() => {
    if (!resolveKey) return;
    let live = true;
    fetch(`/api/cctv/resolve?url=${encodeURIComponent(resolveKey)}`)
      .then(r => r.json())
      .then(d => { if (live) setResolution({ key: resolveKey, embed: d?.embeddable ? d.embedUrl : null, offline: d?.kind === 'offline' || d?.kind === 'missing', kind: d?.kind }); })
      .catch(() => { if (live) setResolution({ key: resolveKey, embed: null, offline: false }); });
    return () => { live = false; };
  }, [resolveKey]);

  const streamType = resolvedEmbed ? 'iframe' : (camera?.stream_type || 'jpg');
  const streamUrl: string | undefined = resolvedEmbed || camera?.stream_url;
  const view = offPlatformView({ hostedOffPlatform, resolving, resolvedEmbed, offline });
  const externalOnly = view !== 'inline';

  // ── Real-time AI Vision Tracking (YOLO26 + ByteTrackTracker + SAM 2.1 + ALPR) ──
  useEffect(() => {
    if (!trackingEnabled || !camera) return;
    let active = true;
    let ws: WebSocket | null = null;
    let pollInterval: any = null;

    const setupPolling = () => {
      let isFetching = false;
      const fetchTracking = async () => {
        if (isFetching) return;
        isFetching = true;
        try {
          // 1. Capture real frame from video or image if rendered
          let frameBase64: string | null = null;
          try {
            const video = videoRef.current;
            if (video && video.readyState >= 2 && video.videoWidth > 0) {
              const canvas = document.createElement('canvas');
              canvas.width = 640;
              canvas.height = 360;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(video, 0, 0, 640, 360);
                frameBase64 = canvas.toDataURL('image/jpeg', 0.65);
              }
            } else {
              const img = document.querySelector<HTMLImageElement>('#cctv-live-feed-img');
              if (img && img.naturalWidth > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 360;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0, 640, 360);
                  frameBase64 = canvas.toDataURL('image/jpeg', 0.65);
                }
              }
            }
          } catch {
            // Tainted canvas or cross-origin - will pass streamUrl fallback
          }

          const res = await fetch('/api/cctv/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              camId,
              frame: frameBase64,
              streamUrl: camera?.stream_url || camera?.feed_url || streamUrl,
              filter: filterMode,
              targetId: selectedTargetId || null,
            }),
          });
          if (!res.ok) return;
          const data = await res.json();
          if (active) {
            setTrackedEntities(data.entities || []);
            if (data.engines) setTrackingEngines(data.engines);
            if (data.lockedTarget && !selectedTargetId) {
              setSelectedTargetId(data.lockedTarget.id);
            }
          }
        } catch (err) {
          console.warn('[AI Vision Tracking] Stream poll error suppressed:', err);
        } finally {
          isFetching = false;
        }
      };
      fetchTracking();
      if (!pollInterval) {
        pollInterval = setInterval(fetchTracking, 600); // 1.6 FPS real AI inference
      }
    };

    // Try WebSocket connection to Python Vision Server for 30fps streaming
    try {
      const wsUrl = `ws://${window.location.hostname}:8100/ws/track/${encodeURIComponent(camId)}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!active) return;
        ws?.send(JSON.stringify({ filter: filterMode, targetId: selectedTargetId }));
      };

      ws.onmessage = (event) => {
        if (!active) return;
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'ok') {
            setTrackedEntities(data.entities || []);
            if (data.engines) setTrackingEngines(data.engines);
            if (data.locked_target && !selectedTargetId) {
              setSelectedTargetId(data.locked_target.id);
            }
          }
        } catch {
          // parse fallback
        }
      };

      ws.onerror = () => {
        if (active && !pollInterval) setupPolling();
      };

      ws.onclose = () => {
        if (active && !pollInterval) setupPolling();
      };
    } catch {
      setupPolling();
    }

    return () => {
      active = false;
      if (ws) {
        ws.close();
        ws = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  }, [trackingEnabled, camera, camId, filterMode, selectedTargetId]);

  useEffect(() => {
    if (!camera) return;
    setLoading(true);
    setError(false);
    setImageUrl(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (externalOnly) {
      setLoading(false);
      return;
    }

    if (streamType === 'hls' && camera.stream_url) {
      if (Hls.isSupported() && videoRef.current) {
        const hls = new Hls({ enableWorker: false });
        hlsRef.current = hls;
        hls.loadSource(camera.stream_url);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          videoRef.current?.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                setError(true);
                break;
            }
          }
        });
      } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = camera.stream_url;
        videoRef.current.addEventListener('loadedmetadata', () => {
          setLoading(false);
          videoRef.current?.play().catch(() => {});
        });
      }
      return;
    }

    if (streamType === 'mjpeg' && camera.stream_url) {
      setLoading(false);
      return;
    }

    if ((streamType === 'iframe' || streamType === 'mp4') && streamUrl) {
      setLoading(false);
      return;
    }

    // JPG fallback
    const targetUrl = camera.feed_url || camera.stream_url;
    if (targetUrl) {
      const url = targetUrl.includes('?') ? `${targetUrl}&_t=${Date.now()}` : `${targetUrl}?_t=${Date.now()}`;
      setImageUrl(url);
    } else {
      setError(true);
      setLoading(false);
    }
  }, [camera, streamType, streamUrl, externalOnly, retryCount]);

  // Auto-refresh for JPGs
  useEffect(() => {
    if (streamType !== 'jpg' || (!camera?.feed_url && !camera?.stream_url)) return;
    const targetUrl = camera.feed_url || camera.stream_url;
    if (!targetUrl) return;

    const iv = setInterval(() => {
      const url = targetUrl.includes('?') ? `${targetUrl}&_t=${Date.now()}` : `${targetUrl}?_t=${Date.now()}`;
      setImageUrl(url);
    }, 5000);
    return () => clearInterval(iv);
  }, [camera, streamType]);

  // ── Mouse Drag & Wheel Handlers for Digital Zoom/Pan ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoom(prev => {
      const next = Math.min(4.5, Math.max(1.0, Number((prev + delta).toFixed(2))));
      if (next === 1.0) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1.0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1.0) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    // Bound pan range based on current zoom
    const maxPan = (zoom - 1) * 160;
    setPan({
      x: Math.min(maxPan, Math.max(-maxPan, panStartRef.current.x + dx)),
      y: Math.min(maxPan, Math.max(-maxPan, panStartRef.current.y + dy)),
    });
  }, [isDragging, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);

  if (!camera) return null;

  const currentLockedTarget = trackedEntities.find(e => e.id === selectedTargetId) || trackedEntities[0] || null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, type: "spring", bounce: 0 }}
        className={`fixed z-[500] ${
          fullscreen 
            ? 'inset-2 md:inset-4' 
            : 'bottom-[65px] left-2 right-2 md:bottom-5 md:right-6 md:left-auto md:w-[620px]'
        }`}
      >
        <div className="overflow-hidden h-full flex flex-col bg-black/90 backdrop-blur-2xl border border-[var(--border-primary)] shadow-[0_25px_60px_rgba(0,0,0,0.95),inset_0_0_35px_rgba(0,0,0,0.85)] rounded-lg">
          
          {/* Tactical Background Grid */}
          <div className="absolute inset-0 pointer-events-none opacity-20" style={{
            backgroundImage: 'linear-gradient(var(--border-secondary) 1px, transparent 1px), linear-gradient(90deg, var(--border-secondary) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }} />

          {/* ══ 1. Tactical Header with SOTA AI Tracking Badge ══ */}
          <div className="flex flex-col border-b border-[var(--border-primary)] bg-black/75 relative z-10">
            {/* Top Meta Bar */}
            <div className="flex items-center justify-between px-3 py-1 border-b border-white/5 text-[9px] font-mono tracking-[0.18em] text-[var(--text-muted)] bg-[var(--hover-accent)]">
              <div className="flex items-center gap-3">
                <span className="text-[var(--gold-primary)] font-bold">{camId}</span>
                <span>{camera.lat?.toFixed(4)}, {camera.lng?.toFixed(4)}</span>
                <span className="text-cyan-400 font-semibold hidden sm:inline">
                  ⚡ MOT SOTA 1~3순위 연동 검증
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span>{currentTime}</span>
                <span className="text-[var(--gold-primary)] flex items-center gap-1 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </span>
              </div>
            </div>

            {/* Main Title Bar */}
            <div className="flex items-center justify-between px-3 md:px-4 py-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative flex items-center justify-center w-7 h-7 border border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 rounded-sm">
                  <Camera className="w-4 h-4 text-[var(--gold-primary)]" />
                  <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-[var(--gold-primary)]" />
                  <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-[var(--gold-primary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[12px] md:text-[13px] font-mono font-bold tracking-wider truncate text-white uppercase" style={{ textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
                    {camera.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[9px] font-mono text-[var(--gold-primary)] uppercase tracking-wider opacity-90">
                    <span>{camera.city || 'KOREA'} • {camera.source}</span>
                    <span className="text-white/40">|</span>
                    <span className="text-cyan-300 font-bold">
                      YOLO26(65k★) + Trackers(52k★) + SAM2.1(22k★) + ALPR
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Header Right Controls */}
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                {streamType === 'jpg' && (
                  <button 
                    onClick={() => {
                      const targetUrl = camera.feed_url || camera.stream_url;
                      if (targetUrl) {
                        const url = targetUrl.includes('?') ? `${targetUrl}&_t=${Date.now()}` : `${targetUrl}?_t=${Date.now()}`;
                        setImageUrl(url);
                      }
                    }} 
                    className="p-1.5 rounded-sm bg-white/5 border border-white/10 hover:bg-[var(--gold-primary)]/20 hover:border-[var(--gold-primary)] transition-all" title="Refresh feed"
                  >
                    <RefreshCw className="w-3 h-3 text-[var(--text-secondary)] hover:text-[var(--gold-primary)]" />
                  </button>
                )}
                {camera.lat && camera.lng && (
                  <button onClick={() => onLocate?.(camera.lat, camera.lng)} className="p-1.5 rounded-sm bg-white/5 border border-white/10 hover:bg-[var(--gold-primary)]/20 hover:border-[var(--gold-primary)] transition-all" title="Fly to location">
                    <MapPin className="w-3 h-3 text-[var(--text-secondary)] hover:text-[var(--gold-primary)]" />
                  </button>
                )}
                <button onClick={() => setFullscreen(!fullscreen)} className="hidden md:block p-1.5 rounded-sm bg-white/5 border border-white/10 hover:bg-[var(--text-primary)]/20 hover:border-[var(--text-primary)] transition-all" title="Toggle fullscreen">
                  <Maximize2 className="w-3 h-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
                </button>
                <button onClick={onClose} className="p-1.5 rounded-sm bg-red-900/30 border border-red-500/30 hover:bg-red-500/30 hover:border-red-500 transition-all ml-1">
                  <X className="w-4 h-4 md:w-3.5 md:h-3.5 text-red-400 hover:text-red-200" />
                </button>
              </div>
            </div>

            {/* ══ 2. Tactical Digital Zoom & MOT Filter Toolbar ══ */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-black/90 border-t border-white/[0.08] text-[10px] font-mono">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--gold-primary)] font-bold tracking-wider mr-1 flex items-center gap-1">
                  <ZoomIn className="w-3 h-3 text-[var(--gold-primary)]" /> 줌:
                </span>
                {[1.0, 1.5, 2.0, 3.0, 4.0].map(z => (
                  <button
                    key={z}
                    onClick={() => { setZoom(z); if (z === 1.0) setPan({ x: 0, y: 0 }); }}
                    className={`px-2 py-0.5 rounded border transition-all cursor-pointer font-bold ${
                      zoom === z 
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_8px_rgba(0,229,255,0.4)]' 
                        : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {z.toFixed(1)}x
                  </button>
                ))}
                {zoom > 1.0 && (
                  <button
                    onClick={handleResetZoom}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 text-white/40 hover:text-white hover:border-white/30 ml-1 transition-all"
                    title="초기 배율 복귀"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> 리셋
                  </button>
                )}
                {zoom > 1.0 && (
                  <span className="text-[9px] text-cyan-400/80 ml-1 animate-pulse">
                    (드래그로 화면 이동)
                  </span>
                )}
              </div>

              {/* Target Filtering Modes (All / Vehicle / Person) */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded border font-bold transition-all ${
                    filterMode === 'all'
                      ? 'bg-[var(--gold-primary)]/20 border-[var(--gold-primary)] text-[var(--gold-primary)] shadow-sm'
                      : 'border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  <Target className="w-2.5 h-2.5" /> 전체 객체 ({trackedEntities.length})
                </button>
                <button
                  onClick={() => setFilterMode('vehicle')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded border font-bold transition-all ${
                    filterMode === 'vehicle'
                      ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_8px_rgba(56,239,125,0.3)]'
                      : 'border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  <Car className="w-2.5 h-2.5" /> 차량 추적
                </button>
                <button
                  onClick={() => setFilterMode('person')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded border font-bold transition-all ${
                    filterMode === 'person'
                      ? 'bg-pink-500/25 border-pink-400 text-pink-300 shadow-[0_0_8px_rgba(255,0,85,0.3)]'
                      : 'border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  <User className="w-2.5 h-2.5" /> 인원 추적
                </button>
                <button
                  onClick={() => setTrackingEnabled(!trackingEnabled)}
                  className={`px-2 py-0.5 rounded border font-bold transition-all ml-1 ${
                    trackingEnabled
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-white/40'
                  }`}
                >
                  {trackingEnabled ? 'HUD ON' : 'HUD OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* ══ 3. Video Feed Canvas with Digital Zoom & MOT Overlays ══ */}
          <div 
            ref={viewportRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`relative bg-[#020202] overflow-hidden select-none ${
              fullscreen ? 'flex-1' : 'aspect-video max-h-[42vh] md:max-h-[380px]'
            } ${zoom > 1.0 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'}`}
          >
            {/* Video Container with Smooth Dynamic CSS Zoom & Pan Transform */}
            <div 
              className="absolute inset-0 w-full h-full transition-transform duration-75 ease-out"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: 'center center'
              }}
            >
              {loading && !error && !externalOnly && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-30 backdrop-blur-sm">
                  <div className="text-center">
                    <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--gold-dim)', borderTopColor: 'transparent' }} />
                    <span className="text-[10px] font-mono tracking-[0.25em]" style={{ color: 'var(--gold-primary)' }}>DECRYPTING CCTV STREAM...</span>
                  </div>
                </div>
              )}

              {streamType === 'hls' ? (
                <video
                  ref={videoRef}
                  className={`w-full h-full ${fullscreen ? 'object-contain' : 'object-cover'}`}
                  autoPlay
                  muted
                  playsInline
                  crossOrigin="anonymous"
                />
              ) : streamType === 'mjpeg' && camera.stream_url ? (
                <img
                  id="cctv-live-feed-img"
                  src={camera.stream_url}
                  alt={camera.name}
                  className={`w-full h-full ${fullscreen ? 'object-contain' : 'object-cover'}`}
                  crossOrigin="anonymous"
                  onLoad={() => setLoading(false)}
                  onError={() => { setLoading(false); setError(true); }}
                />
              ) : streamType === 'mp4' && camera.stream_url ? (
                <video
                  src={camera.stream_url}
                  className={`w-full h-full ${fullscreen ? 'object-contain' : 'object-cover'}`}
                  autoPlay
                  muted
                  playsInline
                  loop
                  crossOrigin="anonymous"
                />
              ) : streamType === 'iframe' && streamUrl ? (
                <iframe
                  src={streamUrl}
                  className="w-full h-full border-0 pointer-events-none"
                  allow="autoplay; fullscreen"
                />
              ) : imageUrl ? (
                <img
                  id="cctv-live-feed-img"
                  src={imageUrl}
                  alt={camera.name}
                  className={`w-full h-full ${fullscreen ? 'object-contain' : 'object-cover'}`}
                  crossOrigin="anonymous"
                  onLoad={() => setLoading(false)}
                  onError={() => { setLoading(false); setError(true); }}
                />
              ) : null}

              {/* ── SOTA SENSOR LAYER: YOLO11 + ByteTrack Trajectories + SAM2 BBoxes ── */}
              {trackingEnabled && !error && !loading && (
                <div className="absolute inset-0 pointer-events-none z-20">
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* SAM 2.1 Segmented Contour Polygons */}
                    {trackedEntities.map(entity => {
                      if (!entity.segment_mask || entity.segment_mask.length < 3) return null;
                      const isLocked = entity.id === selectedTargetId;
                      const ptsStr = entity.segment_mask.map(pt => `${pt[0]},${pt[1]}`).join(' ');
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

                    {/* ByteTrackTracker Motion History Trails */}
                    {trackedEntities.map(entity => {
                      if (!entity.history || entity.history.length < 2) return null;
                      const isLocked = entity.id === selectedTargetId;
                      const pathStr = entity.history.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt[0]} ${pt[1]}`).join(' ');
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

                  {/* Render Bounding Boxes & Lock-on Reticles */}
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
                        {/* Tactical Corner Brackets */}
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
                            <div className="w-7 h-7 border border-cyan-400 rounded-full animate-spin" style={{ animationDuration: '4s' }} />
                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
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

            {/* Tactical CRT Overlay & Scanlines */}
            <div className="absolute inset-0 pointer-events-none z-20" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 2px)',
              backgroundSize: '100% 4px',
            }} />
            <div className="absolute inset-0 pointer-events-none z-20 shadow-[inset_0_0_50px_rgba(0,0,0,0.85)]" />

            {/* Live Indicator */}
            {!error && !loading && !externalOnly && (
              <div className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-black/85 border border-[var(--gold-primary)]/60 px-2.5 py-1 rounded-sm shadow-[0_0_12px_rgba(0,0,0,0.9)]">
                <div className={`w-2 h-2 rounded-full ${trackedEntities.length > 0 ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-amber-500'}`} />
                <span className="text-[9px] font-mono text-white tracking-[0.2em] font-bold">
                  {trackedEntities.length > 0 ? `LIVE AI TRACKING (${trackedEntities.length})` : 'REAL-TIME AI SCANNING'}
                </span>
                <span className="text-[9px] font-mono text-cyan-300 font-bold ml-1 pl-1.5 border-l border-white/20">
                  {zoom.toFixed(1)}x ZOOM
                </span>
              </div>
            )}

            {/* Tactical Center Aim Reticle */}
            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center opacity-40">
              <div className="w-[60%] h-[1px] bg-white/10 absolute top-1/2 -translate-y-1/2" />
              <div className="h-[60%] w-[1px] bg-white/10 absolute left-1/2 -translate-x-1/2" />
              <div className="w-14 h-14 border border-white/15 rounded-full" />
              <div className="w-1 h-1 bg-cyan-400 absolute" />
            </div>
          </div>

          {/* ══ 4. Locked Target Telemetry Inspector Panel (SAM 2 & ByteTrack) ══ */}
          {currentLockedTarget && trackingEnabled && (
            <div className="bg-black/95 border-t border-[var(--border-primary)] px-3 py-2 z-20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded border border-cyan-400/60 bg-cyan-500/10 text-cyan-300 font-bold">
                    <Crosshair className="w-4 h-4 text-cyan-400 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-white tracking-wider">
                        락온 타겟: <span className="text-cyan-300">{currentLockedTarget.id}</span>
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-white/80">
                        {currentLockedTarget.subclass}
                      </span>
                      {currentLockedTarget.license_plate && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-bold">
                          ALPR: {currentLockedTarget.license_plate}
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] font-mono text-white/50 mt-0.5">
                      특징: {currentLockedTarget.attribute || '정규 이동 경로 관측'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[10px] font-mono">
                  <div className="text-right">
                    <span className="text-white/40 block text-[8px]">실시간 속도</span>
                    <span className="text-emerald-400 font-bold text-[12px]">{currentLockedTarget.velocity_kmh} km/h</span>
                  </div>
                  <div className="text-right border-l border-white/10 pl-3">
                    <span className="text-white/40 block text-[8px]">이동 방위각</span>
                    <span className="text-cyan-400 font-bold flex items-center gap-1">
                      <Navigation className="w-2.5 h-2.5" style={{ transform: `rotate(${currentLockedTarget.heading_deg}deg)` }} />
                      {currentLockedTarget.heading_deg}°
                    </span>
                  </div>
                  <div className="text-right border-l border-white/10 pl-3">
                    <span className="text-white/40 block text-[8px]">탐지 신뢰도</span>
                    <span className="text-[var(--gold-primary)] font-bold">{Math.round(currentLockedTarget.confidence * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ 5. Advanced Tactical Footer & Raw Feeds ══ */}
          <div className="bg-black border-t border-[var(--border-primary)] relative z-10">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-[var(--text-muted)] font-mono tracking-widest">FEED TYPE</span>
                  <span className="text-[9px] text-white font-mono tracking-widest uppercase">
                    {streamType} (AI VISION TRACKED)
                  </span>
                </div>
                <div className="flex flex-col border-l border-white/10 pl-4">
                  <span className="text-[9px] text-[var(--text-muted)] font-mono tracking-widest">추적 알고리즘</span>
                  <span className="text-[9px] font-mono tracking-widest text-[var(--alert-green)]">
                    YOLO26 + ByteTrackTracker + SAM 2.1 + ALPR ACTIVE
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {!gone && (camera.feed_url || camera.external_url || (streamType === 'iframe' && camera.stream_url)) && (
                  <a href={camera.external_url || camera.feed_url || (streamType === 'iframe' ? camera.stream_url : undefined)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-[9px] font-mono text-[var(--gold-primary)] tracking-widest">
                    <ExternalLink className="w-2.5 h-2.5" /> RAW FEED
                  </a>
                )}
                <a href={`https://www.google.com/maps/@${camera.lat},${camera.lng},17z`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-[9px] font-mono text-[var(--cyan-primary)] tracking-widest">
                  <MapPin className="w-2.5 h-2.5" /> MAP TARGET
                </a>
              </div>
            </div>
            {/* Animated data stream bar */}
            <div className="h-[2px] w-full bg-[var(--border-primary)] overflow-hidden relative">
              <div className="absolute top-0 bottom-0 left-0 bg-[var(--gold-primary)] shadow-[0_0_8px_var(--gold-primary)] w-1/3 animate-pulse" style={{ animation: 'progress-glow-slide 2s cubic-bezier(0.4, 0, 0.2, 1) infinite' }} />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
