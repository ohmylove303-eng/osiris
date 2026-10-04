import { describe, it, expect } from 'vitest';
import {
  getSensorConfig,
  getSensorFilter,
  keyToSensorMode,
  nextSensorMode,
  SENSOR_MODES,
  type SensorMode,
} from './visual-styles';

describe('visual-styles', () => {
  describe('SENSOR_MODES', () => {
    it('has exactly 7 modes', () => {
      expect(SENSOR_MODES).toHaveLength(7);
    });

    it('starts with NORMAL', () => {
      expect(SENSOR_MODES[0]).toBe('NORMAL');
    });

    it('contains all expected modes', () => {
      const expected: SensorMode[] = [
        'NORMAL', 'CRT', 'NVG', 'FLIR_WHITE', 'FLIR_IRONBOW', 'NOIR', 'SNOW',
      ];
      expect(SENSOR_MODES).toEqual(expected);
    });
  });

  describe('getSensorConfig', () => {
    it('returns config for every defined mode', () => {
      for (const mode of SENSOR_MODES) {
        const cfg = getSensorConfig(mode);
        expect(cfg).toBeDefined();
        expect(cfg.label).toBeTruthy();
        expect(cfg.shortLabel).toBeTruthy();
        expect(typeof cfg.filter).toBe('string');
        expect(typeof cfg.scanlines).toBe('number');
        expect(typeof cfg.vignette).toBe('number');
        expect(typeof cfg.grain).toBe('number');
      }
    });

    it('NORMAL has filter "none"', () => {
      expect(getSensorConfig('NORMAL').filter).toBe('none');
    });

    it('NVG contains hue-rotate', () => {
      expect(getSensorConfig('NVG').filter).toContain('hue-rotate');
    });

    it('FLIR_WHITE inverts the image', () => {
      expect(getSensorConfig('FLIR_WHITE').filter).toContain('invert');
    });

    it('falls back to NORMAL for unknown mode', () => {
      // force an unknown string through the type
      const cfg = getSensorConfig('UNKNOWN' as SensorMode);
      expect(cfg.filter).toBe('none');
    });
  });

  describe('getSensorFilter', () => {
    it('returns a string for every mode', () => {
      for (const mode of SENSOR_MODES) {
        const filter = getSensorFilter(mode);
        expect(typeof filter).toBe('string');
        expect(filter.length).toBeGreaterThan(0);
      }
    });
  });

  describe('keyToSensorMode', () => {
    it('maps 1 to NORMAL', () => {
      expect(keyToSensorMode('1')).toBe('NORMAL');
    });

    it('maps 3 to NVG', () => {
      expect(keyToSensorMode('3')).toBe('NVG');
    });

    it('maps 7 to SNOW', () => {
      expect(keyToSensorMode('7')).toBe('SNOW');
    });

    it('returns null for 0', () => {
      expect(keyToSensorMode('0')).toBeNull();
    });

    it('returns null for 8', () => {
      expect(keyToSensorMode('8')).toBeNull();
    });

    it('returns null for non-numeric', () => {
      expect(keyToSensorMode('a')).toBeNull();
    });
  });

  describe('nextSensorMode', () => {
    it('advances NORMAL to CRT', () => {
      expect(nextSensorMode('NORMAL')).toBe('CRT');
    });

    it('wraps SNOW back to NORMAL', () => {
      expect(nextSensorMode('SNOW')).toBe('NORMAL');
    });

    it('cycles through all modes in order', () => {
      let mode: SensorMode = 'NORMAL';
      const visited: SensorMode[] = [mode];
      for (let i = 0; i < SENSOR_MODES.length - 1; i++) {
        mode = nextSensorMode(mode);
        visited.push(mode);
      }
      expect(visited).toEqual(SENSOR_MODES);
    });
  });

  describe('sensor overlay values', () => {
    it('CRT has scanlines enabled', () => {
      expect(getSensorConfig('CRT').scanlines).toBeGreaterThan(0);
    });

    it('NVG has high vignette', () => {
      expect(getSensorConfig('NVG').vignette).toBeGreaterThanOrEqual(0.4);
    });

    it('NORMAL has no overlays', () => {
      const cfg = getSensorConfig('NORMAL');
      expect(cfg.scanlines).toBe(0);
      expect(cfg.vignette).toBe(0);
      expect(cfg.grain).toBe(0);
    });

    it('all keyHints are unique', () => {
      const hints = SENSOR_MODES.map(m => getSensorConfig(m).keyHint);
      expect(new Set(hints).size).toBe(hints.length);
    });
  });
});
