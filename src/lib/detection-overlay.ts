/**
 * Detection Overlay Logic — Target calculation, projection filtering, and classification
 * for military-grade God's Eye View detection HUD.
 */

export interface DetectionTarget {
  id: string;
  label: string;
  type: 'flight' | 'ship' | 'satellite' | 'tactical';
  lat: number;
  lng: number;
  alt?: number; // Altitude in meters
  speed?: number; // Speed in knots
  heading?: number; // Heading in degrees
  subType?: string;
  military?: boolean;
}

export interface ProjectedTarget extends DetectionTarget {
  x: number;
  y: number;
  boxSize: number;
  screenDistFromCenter: number;
}

export interface ViewportDimensions {
  width: number;
  height: number;
}

/**
 * Format altitude into aviation flight level (FL) or feet.
 */
export function formatTargetAlt(meters?: number): string {
  if (meters == null || isNaN(meters)) return '—';
  const feet = meters * 3.28084;
  if (feet >= 18000) {
    const fl = Math.round(feet / 100);
    return `FL${fl.toString().padStart(3, '0')}`;
  }
  return `${Math.round(feet).toLocaleString()}FT`;
}

/**
 * Format speed in knots.
 */
export function formatTargetSpeed(knots?: number): string {
  if (knots == null || isNaN(knots) || knots < 0) return '—';
  return `${Math.round(knots)}KT`;
}

/**
 * Get tactical category tag and color identifier.
 */
export function getTargetClassification(target: DetectionTarget, sensorMode = 'NORMAL'): {
  code: string;
  label: string;
  color: string;
  isHostileOrMil: boolean;
} {
  const isMil = !!target.military || target.subType?.toLowerCase().includes('mil') || false;

  // Sensor color overrides
  if (sensorMode === 'NVG') {
    return {
      code: isMil ? 'MIL' : target.type.toUpperCase().slice(0, 3),
      label: isMil ? 'HOSTILE/MIL' : target.type.toUpperCase(),
      color: isMil ? '#39ff14' : '#00ff66',
      isHostileOrMil: isMil,
    };
  }

  if (sensorMode.includes('FLIR')) {
    return {
      code: isMil ? 'TGT' : target.type.toUpperCase().slice(0, 3),
      label: isMil ? 'PRIORITY' : target.type.toUpperCase(),
      color: isMil ? '#ff3b30' : '#ff9500',
      isHostileOrMil: isMil,
    };
  }

  if (isMil) {
    return {
      code: 'MIL',
      label: 'TACTICAL TGT',
      color: '#ff3b30',
      isHostileOrMil: true,
    };
  }

  switch (target.type) {
    case 'flight':
      return { code: 'AIR', label: 'AIR TRACK', color: '#00e5ff', isHostileOrMil: false };
    case 'ship':
      return { code: 'NAV', label: 'SURFACE TRACK', color: '#00ffc8', isHostileOrMil: false };
    case 'satellite':
      return { code: 'ORB', label: 'ORBITAL', color: '#b388ff', isHostileOrMil: false };
    default:
      return { code: 'OBJ', label: 'UNKNOWN', color: '#ffd600', isHostileOrMil: false };
  }
}

/**
 * Filter entities by screen viewport, project to screen space, and sort by proximity to screen center.
 */
export function filterAndProjectTargets(
  targets: DetectionTarget[],
  projectFn: (lngLat: [number, number]) => { x: number; y: number } | null,
  viewport: ViewportDimensions,
  maxTargets = 50,
  padding = 30
): ProjectedTarget[] {
  if (!targets.length || viewport.width <= 0 || viewport.height <= 0) {
    return [];
  }

  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const projected: ProjectedTarget[] = [];

  for (const t of targets) {
    if (t.lat == null || t.lng == null || isNaN(t.lat) || isNaN(t.lng)) continue;
    const pt = projectFn([t.lng, t.lat]);
    if (!pt) continue;

    // Viewport bound check
    if (
      pt.x < -padding ||
      pt.x > viewport.width + padding ||
      pt.y < -padding ||
      pt.y > viewport.height + padding
    ) {
      continue;
    }

    const dx = pt.x - cx;
    const dy = pt.y - cy;
    const distSq = dx * dx + dy * dy;

    // Box size dynamically scales slightly based on military/priority
    const baseSize = t.military ? 40 : 34;

    projected.push({
      ...t,
      x: Math.round(pt.x),
      y: Math.round(pt.y),
      boxSize: baseSize,
      screenDistFromCenter: Math.sqrt(distSq),
    });
  }

  // Prioritize targets closer to center of display
  projected.sort((a, b) => a.screenDistFromCenter - b.screenDistFromCenter);

  return projected.slice(0, maxTargets);
}
