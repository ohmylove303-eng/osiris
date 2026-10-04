'use client';

import { memo, useMemo } from 'react';
import { ShieldAlert, Activity, Radio, Cpu } from 'lucide-react';
import { type SensorMode } from '@/lib/visual-styles';

interface AiHudSummaryProps {
  zoom: number;
  centerLat: number;
  centerLng: number;
  airCount: number;
  seaCount: number;
  sensorMode: SensorMode;
  visible?: boolean;
}

function AiHudSummaryInner({
  zoom,
  centerLat,
  centerLng,
  airCount,
  seaCount,
  sensorMode,
  visible = true,
}: AiHudSummaryProps) {
  if (!visible) return null;

  // Derive strategic region name and threat summary
  const summary = useMemo(() => {
    let region = 'GLOBAL THEATRE';
    let alertLevel: 'LOW' | 'MED' | 'HIGH' | 'DEFCON-2' = 'LOW';
    let tacticalPhrase = 'ROUTINE SURVEILLANCE';

    // Geolocation heuristics
    if (centerLat >= 33 && centerLat <= 43 && centerLng >= 124 && centerLng <= 132) {
      region = 'KOREAN PENINSULA / DMZ';
      alertLevel = 'DEFCON-2';
      tacticalPhrase = 'MONITORING STRATEGIC ASSETS';
    } else if (centerLat >= 20 && centerLat <= 28 && centerLng >= 115 && centerLng <= 125) {
      region = 'TAIWAN STRAIT / SCS';
      alertLevel = 'HIGH';
      tacticalPhrase = 'NAVAL AIR ENCROACHMENT WATCH';
    } else if (centerLat >= 44 && centerLat <= 60 && centerLng >= 25 && centerLng <= 45) {
      region = 'EASTERN EUROPEAN FRONT';
      alertLevel = 'HIGH';
      tacticalPhrase = 'ELECTRONIC RECONNAISSANCE ACTIVE';
    } else if (centerLat >= 12 && centerLat <= 35 && centerLng >= 30 && centerLng <= 60) {
      region = 'MIDDLE EAST / RED SEA';
      alertLevel = 'HIGH';
      tacticalPhrase = 'MARITIME CHOKEPOINT MONITOR';
    } else if (zoom < 3) {
      region = 'GLOBAL STRATEGIC OVERVIEW';
      alertLevel = 'LOW';
      tacticalPhrase = 'ORBITAL SURVEILLANCE LOCK';
    }

    const totalContacts = airCount + seaCount;
    if (totalContacts > 50 && alertLevel === 'LOW') {
      alertLevel = 'MED';
      tacticalPhrase = 'HIGH DENSITY TRACK CONVERGENCE';
    }

    return { region, alertLevel, tacticalPhrase, totalContacts };
  }, [centerLat, centerLng, zoom, airCount, seaCount]);

  const levelColor =
    summary.alertLevel === 'DEFCON-2'
      ? '#ff3b30'
      : summary.alertLevel === 'HIGH'
      ? '#ff9500'
      : summary.alertLevel === 'MED'
      ? '#ffd600'
      : '#00e5ff';

  return (
    <div
      className="fixed top-14 left-1/2 -translate-x-1/2 pointer-events-none z-[8] select-none max-w-[95vw] overflow-hidden"
      aria-label="AI Tactical Summary"
    >
      <div className="flex items-center gap-2 px-3 py-1 bg-black/80 backdrop-blur-md border border-[var(--gold-primary)]/30 rounded shadow-xl text-[10px] font-mono leading-none">
        <div className="flex items-center gap-1" style={{ color: levelColor }}>
          <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
          <span className="font-bold tracking-wider">[{summary.alertLevel}]</span>
        </div>

        <span className="text-[var(--border-subtle)]">|</span>

        <span className="text-white/90 font-bold tracking-wide">{summary.region}</span>

        <span className="text-[var(--border-subtle)]">|</span>

        <span className="text-[var(--gold-primary)] opacity-90">{summary.tacticalPhrase}</span>

        <span className="text-[var(--border-subtle)]">|</span>

        <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
          <Activity className="w-3 h-3 text-cyan-400" />
          <span>{summary.totalContacts} TRACKS</span>
        </div>
      </div>
    </div>
  );
}

export const AiHudSummary = memo(AiHudSummaryInner);
export default AiHudSummary;
