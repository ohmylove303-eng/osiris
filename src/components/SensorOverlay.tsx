'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { type SensorMode, getSensorConfig, SENSOR_MODES } from '@/lib/visual-styles';

/**
 * Sensor Overlay — renders the CSS filter + scanline/vignette/grain effects
 * for the active sensor mode.
 *
 * This `<div>` sits over the map with `pointer-events: none`. The CSS filter
 * is applied to the map container itself (the parent `<main>`), and the
 * overlay effects (scanlines, vignette, grain) are rendered as pseudo-layers
 * inside this div.
 */
interface SensorOverlayProps {
  mode: SensorMode;
  /** Called when the mode changes (for the parent to persist). */
  onModeChange?: (mode: SensorMode) => void;
}

function SensorOverlayInner({ mode }: SensorOverlayProps) {
  const cfg = getSensorConfig(mode);

  if (mode === 'NORMAL') return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[4]"
      aria-hidden="true"
      data-sensor-mode={mode}
    >
      {/* Scanlines */}
      {cfg.scanlines > 0 && (
        <div
          className="absolute inset-0"
          style={{
            opacity: cfg.scanlines,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
            backgroundSize: '100% 4px',
          }}
        />
      )}

      {/* Vignette */}
      {cfg.vignette > 0 && (
        <div
          className="absolute inset-0"
          style={{
            opacity: cfg.vignette,
            background:
              'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.8) 100%)',
          }}
        />
      )}

      {/* Grain/noise — CSS-only animated noise */}
      {cfg.grain > 0 && (
        <div
          className="absolute inset-0 sensor-grain"
          style={{ opacity: cfg.grain }}
        />
      )}

      {/* Mode indicator badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div
          className="px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-[0.2em] border"
          style={{
            color: mode === 'NVG' ? '#00ff88' : mode.includes('FLIR') ? '#ff6b35' : '#e0e0e0',
            borderColor: mode === 'NVG' ? '#00ff8844' : mode.includes('FLIR') ? '#ff6b3544' : '#ffffff22',
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {cfg.shortLabel}
        </div>
        <div className="text-[8px] font-mono text-white/40 tracking-wider">
          [{cfg.keyHint}]
        </div>
      </div>
    </div>
  );
}

export const SensorOverlay = memo(SensorOverlayInner);

/**
 * Hook to manage the sensor mode CSS filter on the map container.
 *
 * Returns the current filter string and a ref callback to attach to the
 * map container element.
 */
export function useSensorFilter(mode: SensorMode) {
  const filter = getSensorConfig(mode).filter;

  // Apply the filter to the map's canvas container
  useEffect(() => {
    const mapContainer = document.querySelector('.maplibregl-canvas-container') as HTMLElement | null;
    const mapCanvas = document.querySelector('.maplibregl-canvas') as HTMLElement | null;
    const target = mapContainer || mapCanvas;

    if (target) {
      target.style.filter = filter;
      target.style.transition = 'filter 0.3s ease';
    }

    return () => {
      if (target) {
        target.style.filter = '';
        target.style.transition = '';
      }
    };
  }, [filter]);

  return filter;
}

export default SensorOverlay;
