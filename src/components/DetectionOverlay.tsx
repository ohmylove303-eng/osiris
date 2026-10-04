'use client';

import { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  type DetectionTarget,
  type ProjectedTarget,
  filterAndProjectTargets,
  formatTargetAlt,
  formatTargetSpeed,
  getTargetClassification,
} from '@/lib/detection-overlay';
import { type SensorMode } from '@/lib/visual-styles';

interface DetectionOverlayProps {
  targets: DetectionTarget[];
  sensorMode?: SensorMode;
  visible: boolean;
  selectedId?: string | null;
  onSelectTarget?: (target: DetectionTarget) => void;
  onTrackCockpit?: (target: DetectionTarget) => void;
}

function DetectionOverlayInner({
  targets,
  sensorMode = 'NORMAL',
  visible,
  selectedId,
  onSelectTarget,
  onTrackCockpit,
}: DetectionOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [projected, setProjected] = useState<ProjectedTarget[]>([]);
  const animFrameRef = useRef<number | null>(null);

  const updatePositions = useCallback(() => {
    if (!visible) return;
    const map = typeof window !== 'undefined' ? (window as any).__map || (window as any).map : null;
    if (!map || !map.project) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const projectedTargets = filterAndProjectTargets(
      targets,
      (lngLat) => {
        try {
          return map.project(lngLat);
        } catch {
          return null;
        }
      },
      { width, height },
      45
    );

    setProjected(projectedTargets);
  }, [targets, visible]);

  useEffect(() => {
    if (!visible) {
      setProjected([]);
      return;
    }

    let attachedMap: any = null;

    const onMove = () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(updatePositions);
    };

    const attachMap = () => {
      const map = typeof window !== 'undefined' ? (window as any).__map || (window as any).map : null;
      if (map && map !== attachedMap && map.on) {
        if (attachedMap && attachedMap.off) {
          attachedMap.off('move', onMove);
          attachedMap.off('zoom', onMove);
        }
        map.on('move', onMove);
        map.on('zoom', onMove);
        attachedMap = map;
      }
    };

    attachMap();
    updatePositions();

    const interval = setInterval(() => {
      attachMap();
      updatePositions();
    }, 1000);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      clearInterval(interval);
      if (attachedMap && attachedMap.off) {
        attachedMap.off('move', onMove);
        attachedMap.off('zoom', onMove);
      }
    };
  }, [visible, updatePositions]);

  if (!visible || projected.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-[8] overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Top indicator tag */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 backdrop-blur-md border border-[var(--gold-primary)]/30 rounded text-[10px] font-mono text-[var(--gold-primary)] tracking-widest flex items-center gap-2 pointer-events-auto shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>GOD&apos;S EYE DETECTION: {projected.length} TRACKS</span>
        <span className="text-[var(--text-muted)] text-[9px]">(Press D to hide)</span>
      </div>

      {projected.map((t) => {
        const isSelected = selectedId === t.id;
        const meta = getTargetClassification(t, sensorMode);
        const altStr = formatTargetAlt(t.alt);
        const spdStr = formatTargetSpeed(t.speed);
        const size = t.boxSize;
        const half = size / 2;

        return (
          <div
            key={t.id}
            className="absolute transition-transform duration-75 will-change-transform pointer-events-auto cursor-pointer"
            style={{
              transform: `translate3d(${t.x - half}px, ${t.y - half}px, 0)`,
              width: `${size}px`,
              height: `${size}px`,
            }}
            onClick={() => onSelectTarget?.(t)}
            title={`${t.label} (${meta.label})`}
          >
            {/* Tactical Box Frame */}
            <div
              className={`relative w-full h-full transition-colors ${
                isSelected ? 'scale-110 drop-shadow-[0_0_8px_currentColor]' : 'hover:scale-105'
              }`}
              style={{ color: meta.color }}
            >
              {/* Corner 1: Top-Left */}
              <span
                className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2"
                style={{ borderColor: meta.color }}
              />
              {/* Corner 2: Top-Right */}
              <span
                className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2"
                style={{ borderColor: meta.color }}
              />
              {/* Corner 3: Bottom-Left */}
              <span
                className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2"
                style={{ borderColor: meta.color }}
              />
              {/* Corner 4: Bottom-Right */}
              <span
                className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2"
                style={{ borderColor: meta.color }}
              />

              {/* Center crosshair dot */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: meta.color }}
              />

              {/* Target Data Tag */}
              <div
                className="absolute left-full top-0 ml-2 whitespace-nowrap bg-black/85 backdrop-blur-md px-1.5 py-0.5 border rounded text-[9px] font-mono leading-tight shadow-md flex flex-col gap-0.5"
                style={{
                  borderColor: isSelected ? meta.color : `${meta.color}55`,
                  color: meta.color,
                }}
              >
                <div className="flex items-center gap-1 font-bold">
                  <span className="px-1 rounded text-[8px] bg-white/10">{meta.code}</span>
                  <span className="tracking-wider">{t.label || t.id.slice(0, 6)}</span>
                  {isSelected && <span className="text-[7px] text-amber-400 font-black">[LOCK]</span>}
                </div>
                <div className="text-[8px] text-white/80 flex items-center gap-1.5 font-mono">
                  <span>{altStr}</span>
                  <span>·</span>
                  <span>{spdStr}</span>
                </div>
                {isSelected && t.type === 'flight' && onTrackCockpit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrackCockpit(t);
                    }}
                    className="mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/40 transition-colors pointer-events-auto text-center"
                    title="이 기체 콕핏 추적 모드 진입"
                  >
                    CHASE [C] ✈
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const DetectionOverlay = memo(DetectionOverlayInner);
export default DetectionOverlay;
