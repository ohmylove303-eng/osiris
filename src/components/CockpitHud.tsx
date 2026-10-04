'use client';

import { memo, useMemo } from 'react';
import { Plane, Navigation, Gauge, ArrowUp } from 'lucide-react';
import { formatAltitude, formatSpeed, type TrackedAircraft } from '@/lib/cockpit-camera';
import { type SensorMode, getSensorConfig } from '@/lib/visual-styles';

/**
 * Cockpit HUD — heads-up display for cockpit mode.
 *
 * Shows airspeed, altitude, heading, vertical speed, and aircraft
 * identification in a pilot-style layout.
 */

interface CockpitHudProps {
  aircraft: TrackedAircraft;
  sensorMode: SensorMode;
  visible: boolean;
  onExit?: () => void;
}

function CockpitHudInner({ aircraft, sensorMode, visible, onExit }: CockpitHudProps) {
  if (!visible) return null;

  const sensorCfg = getSensorConfig(sensorMode);
  const altFt = Math.round(aircraft.alt * 3.28084);
  const heading = Math.round(aircraft.heading);
  const speed = Math.round(aircraft.speed ?? 0);
  const vr = aircraft.verticalRate ?? 0;

  // Heading tape marks
  const headingMarks = useMemo(() => {
    const marks: { deg: number; label: string; offset: number }[] = [];
    for (let i = -3; i <= 3; i++) {
      const deg = ((heading + i * 10) % 360 + 360) % 360;
      let label = deg.toString().padStart(3, '0');
      if (deg === 0) label = 'N';
      else if (deg === 90) label = 'E';
      else if (deg === 180) label = 'S';
      else if (deg === 270) label = 'W';
      marks.push({ deg, label, offset: i * 40 });
    }
    return marks;
  }, [heading]);

  const hudColor = sensorMode === 'NVG' ? '#00ff88'
    : sensorMode.includes('FLIR') ? '#ff6b35'
    : '#00e5ff';

  return (
    <div data-cockpit-hud="true" className="fixed inset-0 pointer-events-none z-[6] cockpit-hud" aria-hidden="true">
      {/* ── Top center: Heading tape ── */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[280px] overflow-hidden">
        <div className="relative h-8 flex items-center justify-center">
          {headingMarks.map(m => (
            <div
              key={m.deg}
              className="absolute text-[10px] font-mono font-bold tabular-nums"
              style={{
                left: `calc(50% + ${m.offset}px)`,
                transform: 'translateX(-50%)',
                color: m.offset === 0 ? hudColor : `${hudColor}66`,
              }}
            >
              {m.label}
              <div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-px h-2"
                style={{ backgroundColor: m.offset === 0 ? hudColor : `${hudColor}44` }}
              />
            </div>
          ))}
          {/* Center caret */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: `5px solid ${hudColor}`,
            }}
          />
        </div>
        <div className="text-center mt-1">
          <span className="text-[13px] font-mono font-bold tabular-nums" style={{ color: hudColor }}>
            {heading.toString().padStart(3, '0')}°
          </span>
        </div>
      </div>

      {/* ── Left: Airspeed ── */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2">
        <div className="space-y-2">
          <div className="text-[8px] font-mono tracking-[0.2em]" style={{ color: `${hudColor}88` }}>
            AIRSPEED
          </div>
          <div className="text-[22px] font-mono font-bold tabular-nums leading-none" style={{ color: hudColor }}>
            {speed}
          </div>
          <div className="text-[9px] font-mono" style={{ color: `${hudColor}66` }}>KTS</div>
        </div>
      </div>

      {/* ── Right: Altitude ── */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-right">
        <div className="space-y-2">
          <div className="text-[8px] font-mono tracking-[0.2em]" style={{ color: `${hudColor}88` }}>
            ALTITUDE
          </div>
          <div className="text-[22px] font-mono font-bold tabular-nums leading-none" style={{ color: hudColor }}>
            {altFt.toLocaleString()}
          </div>
          <div className="text-[9px] font-mono" style={{ color: `${hudColor}66` }}>
            FT · {formatAltitude(aircraft.alt)}
          </div>
          {/* Vertical speed indicator */}
          {vr !== 0 && (
            <div className="flex items-center gap-1 justify-end mt-1">
              <ArrowUp
                className="w-3 h-3"
                style={{
                  color: vr > 0 ? '#00ff88' : '#ff4444',
                  transform: vr < 0 ? 'rotate(180deg)' : 'none',
                }}
              />
              <span className="text-[9px] font-mono tabular-nums" style={{
                color: vr > 0 ? '#00ff88' : '#ff4444',
              }}>
                {Math.abs(Math.round(vr))} FPM
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom center: Aircraft briefing & exit strip (God's Eye View specification) ── */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-center">
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl shadow-2xl"
          style={{
            backgroundColor: 'rgba(4,8,20,0.85)',
            border: `1px solid ${hudColor}44`,
            backdropFilter: 'blur(16px)',
            boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 16px ${hudColor}22`,
          }}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: `${hudColor}15`, border: `1px solid ${hudColor}33` }}>
            <Plane className="w-4 h-4 animate-pulse" style={{ color: hudColor }} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-mono font-bold tracking-wider" style={{ color: hudColor }}>
                {aircraft.callsign || aircraft.icao24.toUpperCase()}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded font-bold" style={{
                color: hudColor,
                backgroundColor: `${hudColor}15`,
                border: `1px solid ${hudColor}44`,
              }}>
                {aircraft.type || 'CHASE'} · {sensorCfg.shortLabel}
              </span>
            </div>
            <div className="text-[9px] font-mono text-white/70 mt-0.5 tabular-nums">
              {aircraft.lat.toFixed(3)}°N {aircraft.lng.toFixed(3)}°E · {Math.round(aircraft.speed || 0)} KTS · HDG {Math.round(aircraft.heading).toString().padStart(3, '0')}°
            </div>
          </div>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="pointer-events-auto px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold tracking-wider transition-all border border-red-500/60 bg-red-500/10 text-red-300 hover:bg-red-500/30 hover:text-white hover:border-red-400 cursor-pointer shadow-lg ml-2 active:scale-95"
              title="3인칭 콕핏 추적 종료 (단축키: C 또는 ESC)"
            >
              [EXIT · C]
            </button>
          )}
        </div>
      </div>

      {/* ── Pitch ladder (simplified) ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160px]">
        {[-10, -5, 0, 5, 10].map(deg => (
          <div
            key={deg}
            className="flex items-center justify-between mb-4"
            style={{ opacity: deg === 0 ? 0.5 : 0.15 }}
          >
            <div className="text-[7px] font-mono tabular-nums" style={{ color: hudColor }}>
              {deg > 0 ? `+${deg}` : deg}
            </div>
            <div className="flex-1 mx-2 h-px" style={{
              backgroundColor: hudColor,
              borderStyle: deg === 0 ? 'solid' : 'dashed',
            }} />
            <div className="text-[7px] font-mono tabular-nums" style={{ color: hudColor }}>
              {deg > 0 ? `+${deg}` : deg}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(CockpitHudInner);
