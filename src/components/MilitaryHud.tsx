'use client';

import { memo, useMemo } from 'react';
import { Crosshair } from 'lucide-react';
import { latLngToMGRS } from '@/lib/mgrs-converter';
import { type SensorMode, getSensorConfig } from '@/lib/visual-styles';

/**
 * Military HUD — tactical heads-up display overlay.
 *
 * Renders MGRS coordinates, altitude, bearing, speed, and tracked entity
 * telemetry in a military-style format. Sits over the map with
 * `pointer-events: none`.
 */

interface TrackedEntity {
  id: string;
  label: string;
  type: string;
  lat: number;
  lng: number;
  alt?: number;
  speed?: number;
  heading?: number;
}

interface MilitaryHudProps {
  /** Observer lat/lng (cursor or center). */
  cursorLat: number | null;
  cursorLng: number | null;
  /** Map zoom level. */
  zoom: number;
  /** Map bearing in degrees. */
  bearing: number;
  /** Map pitch in degrees. */
  pitch: number;
  /** Currently tracked entity, if any. */
  tracked: TrackedEntity | null;
  /** Active sensor mode. */
  sensorMode: SensorMode;
  /** Active entity counts by type. */
  entityCounts: Record<string, number>;
  /** Whether the HUD is visible. */
  visible: boolean;
}

function formatCoord(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir} ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

function MilitaryHudInner({
  cursorLat,
  cursorLng,
  zoom,
  bearing,
  pitch,
  tracked,
  sensorMode,
  entityCounts,
  visible,
}: MilitaryHudProps) {
  if (!visible) return null;

  const mgrs = useMemo(() => {
    if (cursorLat == null || cursorLng == null) return '—';
    try {
      return latLngToMGRS(cursorLat, cursorLng);
    } catch {
      return '—';
    }
  }, [cursorLat, cursorLng]);

  const coord = cursorLat != null && cursorLng != null
    ? formatCoord(cursorLat, cursorLng)
    : '—';

  const totalEntities = Object.values(entityCounts).reduce((s, v) => s + v, 0);
  const sensorCfg = getSensorConfig(sensorMode);

  return (
    <div data-military-hud="true" className="fixed inset-0 pointer-events-none z-[5] military-hud" aria-hidden="true">
      {/* ── Top-left: Grid reference ── */}
      <div className="absolute top-14 left-3 space-y-1">
        <div className="hud-block">
          <div className="text-[8px] font-mono text-white/30 tracking-[0.2em]">GRID REF</div>
          <div className="text-[11px] font-mono font-bold text-[var(--cyan-primary)] tracking-wider">
            {mgrs}
          </div>
        </div>
        <div className="hud-block">
          <div className="text-[8px] font-mono text-white/30 tracking-[0.2em]">COORD</div>
          <div className="text-[10px] font-mono text-white/60 tabular-nums">{coord}</div>
        </div>
      </div>

      {/* ── Top-right: Camera telemetry ── */}
      <div className="absolute top-14 right-3 space-y-1 text-right">
        <div className="hud-block">
          <div className="text-[8px] font-mono text-white/30 tracking-[0.2em]">BRG / PITCH</div>
          <div className="text-[10px] font-mono text-white/60 tabular-nums">
            {Math.round(bearing).toString().padStart(3, '0')}° / {Math.round(pitch)}°
          </div>
        </div>
        <div className="hud-block">
          <div className="text-[8px] font-mono text-white/30 tracking-[0.2em]">ZOOM</div>
          <div className="text-[10px] font-mono text-white/60 tabular-nums">
            {zoom.toFixed(1)}
          </div>
        </div>
        <div className="hud-block">
          <div className="text-[8px] font-mono text-white/30 tracking-[0.2em]">OPTICS</div>
          <div className="text-[10px] font-mono font-bold tabular-nums" style={{
            color: sensorMode === 'NVG' ? '#00ff88' : sensorMode.includes('FLIR') ? '#ff6b35' : 'var(--gold-primary)',
          }}>
            {sensorCfg.shortLabel}
          </div>
        </div>
      </div>

      {/* ── Bottom-left: Entity count ── */}
      <div className="absolute bottom-10 left-3">
        <div className="hud-block">
          <div className="text-[8px] font-mono text-white/30 tracking-[0.2em]">CONTACTS</div>
          <div className="text-[11px] font-mono font-bold text-[var(--alert-green)] tabular-nums">
            {totalEntities.toLocaleString()}
          </div>
          <div className="text-[8px] font-mono text-white/25 mt-0.5">
            {Object.entries(entityCounts)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k.toUpperCase().slice(0, 3)}:${v}`)
              .join(' · ')}
          </div>
        </div>
      </div>

      {/* ── Tracked entity info ── */}
      {tracked && (
        <div className="absolute bottom-10 right-3 text-right">
          <div className="hud-block">
            <div className="text-[8px] font-mono text-[var(--alert-orange)] tracking-[0.2em] flex items-center gap-1 justify-end">
              <Crosshair className="w-3 h-3" />
              TRACKING
            </div>
            <div className="text-[11px] font-mono font-bold text-[var(--gold-primary)] tracking-wider">
              {tracked.label}
            </div>
            <div className="text-[9px] font-mono text-white/50 mt-0.5">
              {tracked.type} · {formatCoord(tracked.lat, tracked.lng)}
            </div>
            {tracked.alt != null && tracked.alt > 0 && (
              <div className="text-[9px] font-mono text-white/40">
                ALT {Math.round(tracked.alt * 3.28084).toLocaleString()} FT
                {tracked.speed != null && ` · ${Math.round(tracked.speed)} KTS`}
                {tracked.heading != null && ` · HDG ${Math.round(tracked.heading).toString().padStart(3, '0')}°`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Center crosshair ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg width="32" height="32" viewBox="0 0 32 32" className="opacity-20">
          <line x1="16" y1="4" x2="16" y2="12" stroke="white" strokeWidth="0.5" />
          <line x1="16" y1="20" x2="16" y2="28" stroke="white" strokeWidth="0.5" />
          <line x1="4" y1="16" x2="12" y2="16" stroke="white" strokeWidth="0.5" />
          <line x1="20" y1="16" x2="28" y2="16" stroke="white" strokeWidth="0.5" />
          <circle cx="16" cy="16" r="3" stroke="white" strokeWidth="0.5" fill="none" />
        </svg>
      </div>
    </div>
  );
}

export default memo(MilitaryHudInner);
