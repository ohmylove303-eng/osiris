/**
 * OSIRIS — Visual Sensor Modes (God's Eye View integration)
 *
 * Six sensor overlays inspired by military and intelligence optics,
 * applied as CSS filter composites over the map canvas.
 *
 * The CSS filter approach is chosen over WebGL shaders for three reasons:
 *  1. No MapLibre GL internal API coupling — works across versions.
 *  2. Instant toggle — no shader recompilation cost.
 *  3. Degrades gracefully on devices that don't support custom GL programs.
 *
 * The overlay pseudo-elements (scanlines, vignette, noise) are injected into
 * a dedicated `<div>` that sits above the map canvas with `pointer-events: none`.
 */

export type SensorMode =
  | 'NORMAL'
  | 'CRT'
  | 'NVG'
  | 'FLIR_WHITE'
  | 'FLIR_IRONBOW'
  | 'NOIR'
  | 'SNOW';

export const SENSOR_MODES: SensorMode[] = [
  'NORMAL',
  'CRT',
  'NVG',
  'FLIR_WHITE',
  'FLIR_IRONBOW',
  'NOIR',
  'SNOW',
];

export interface SensorConfig {
  label: string;
  shortLabel: string;
  filter: string;
  /** Scanline overlay opacity, 0 = off. */
  scanlines: number;
  /** Vignette overlay opacity, 0 = off. */
  vignette: number;
  /** Grain/noise overlay opacity, 0 = off. */
  grain: number;
  /** Extra CSS class for the overlay container. */
  overlayClass: string;
  /** Key hint, e.g. "1" for the keyboard shortcut display. */
  keyHint: string;
}

const CONFIGS: Record<SensorMode, SensorConfig> = {
  NORMAL: {
    label: 'Normal',
    shortLabel: 'NRM',
    filter: 'none',
    scanlines: 0,
    vignette: 0,
    grain: 0,
    overlayClass: '',
    keyHint: '1',
  },
  CRT: {
    label: 'CRT Monitor',
    shortLabel: 'CRT',
    filter: 'sepia(0.25) contrast(1.25) brightness(0.92) saturate(1.1)',
    scanlines: 0.12,
    vignette: 0.4,
    grain: 0.06,
    overlayClass: 'sensor-crt',
    keyHint: '2',
  },
  NVG: {
    label: 'Night Vision (NVG)',
    shortLabel: 'NVG',
    filter: 'hue-rotate(80deg) saturate(3) brightness(1.15) contrast(1.15)',
    scanlines: 0.04,
    vignette: 0.55,
    grain: 0.1,
    overlayClass: 'sensor-nvg',
    keyHint: '3',
  },
  FLIR_WHITE: {
    label: 'FLIR White Hot',
    shortLabel: 'WHT',
    filter: 'grayscale(1) invert(1) contrast(1.35) brightness(0.95)',
    scanlines: 0,
    vignette: 0.3,
    grain: 0.04,
    overlayClass: 'sensor-flir-white',
    keyHint: '4',
  },
  FLIR_IRONBOW: {
    label: 'FLIR Ironbow',
    shortLabel: 'IRN',
    filter: 'hue-rotate(180deg) saturate(2.2) contrast(1.3) brightness(0.9)',
    scanlines: 0,
    vignette: 0.3,
    grain: 0.03,
    overlayClass: 'sensor-flir-ironbow',
    keyHint: '5',
  },
  NOIR: {
    label: 'Noir',
    shortLabel: 'NOR',
    filter: 'grayscale(0.85) contrast(1.25) brightness(0.8)',
    scanlines: 0,
    vignette: 0.5,
    grain: 0.08,
    overlayClass: 'sensor-noir',
    keyHint: '6',
  },
  SNOW: {
    label: 'Snow / Arctic',
    shortLabel: 'SNW',
    filter: 'hue-rotate(200deg) saturate(0.45) brightness(1.12) contrast(0.95)',
    scanlines: 0.03,
    vignette: 0.2,
    grain: 0.12,
    overlayClass: 'sensor-snow',
    keyHint: '7',
  },
};

/**
 * Return the full configuration for a sensor mode.
 * Falls back to NORMAL if the mode is unrecognized.
 */
export function getSensorConfig(mode: SensorMode): SensorConfig {
  return CONFIGS[mode] ?? CONFIGS.NORMAL;
}

/**
 * Return the CSS filter string for a sensor mode.
 */
export function getSensorFilter(mode: SensorMode): string {
  return (CONFIGS[mode] ?? CONFIGS.NORMAL).filter;
}

/**
 * Map a keyboard number key (1–7) to a sensor mode.
 * Returns `null` for keys outside the range.
 */
export function keyToSensorMode(key: string): SensorMode | null {
  const idx = parseInt(key, 10);
  if (idx >= 1 && idx <= SENSOR_MODES.length) {
    return SENSOR_MODES[idx - 1];
  }
  return null;
}

/**
 * Cycle to the next sensor mode, wrapping around.
 */
export function nextSensorMode(current: SensorMode): SensorMode {
  const idx = SENSOR_MODES.indexOf(current);
  return SENSOR_MODES[(idx + 1) % SENSOR_MODES.length];
}
