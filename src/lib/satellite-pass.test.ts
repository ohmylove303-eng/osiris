import { describe, it, expect } from 'vitest';
import {
  computeElevation,
  computeAzimuth,
  formatPassTime,
  formatDuration,
  isSunBelowHorizon,
} from './satellite-pass';

describe('satellite-pass', () => {
  describe('computeElevation', () => {
    it('returns ~90° for a satellite directly overhead', () => {
      // Satellite at same lat/lng, 400 km up
      const el = computeElevation(37.5, 127.0, 0, 37.5, 127.0, 400);
      expect(el).toBeCloseTo(90, 0);
    });

    it('returns positive elevation for a nearby satellite', () => {
      // ISS-like altitude, slightly offset
      const el = computeElevation(37.5, 127.0, 0, 38.0, 127.5, 408);
      expect(el).toBeGreaterThan(0);
    });

    it('returns negative elevation for a satellite well below horizon', () => {
      // Satellite on the opposite side of Earth
      const el = computeElevation(37.5, 127.0, 0, -37.5, -53.0, 400);
      expect(el).toBeLessThan(0);
    });

    it('handles observer at altitude', () => {
      const elSea = computeElevation(37.5, 127.0, 0, 38.0, 127.5, 408);
      const elMtn = computeElevation(37.5, 127.0, 2, 38.0, 127.5, 408);
      // Mountain observer should have a slightly different (usually higher) elevation
      expect(typeof elMtn).toBe('number');
      expect(Math.abs(elMtn - elSea)).toBeLessThan(5);
    });
  });

  describe('computeAzimuth', () => {
    it('returns ~0° for a satellite due north', () => {
      const az = computeAzimuth(37.5, 127.0, 38.5, 127.0);
      expect(az).toBeCloseTo(0, -1);
    });

    it('returns ~90° for a satellite due east', () => {
      const az = computeAzimuth(37.5, 127.0, 37.5, 128.0);
      expect(az).toBeCloseTo(90, -1);
    });

    it('returns ~180° for a satellite due south', () => {
      const az = computeAzimuth(37.5, 127.0, 36.5, 127.0);
      expect(az).toBeCloseTo(180, -1);
    });

    it('returns ~270° for a satellite due west', () => {
      const az = computeAzimuth(37.5, 127.0, 37.5, 126.0);
      expect(az).toBeCloseTo(270, -1);
    });

    it('always returns 0–360', () => {
      const az = computeAzimuth(37.5, 127.0, 36.0, 125.0);
      expect(az).toBeGreaterThanOrEqual(0);
      expect(az).toBeLessThanOrEqual(360);
    });
  });

  describe('formatPassTime', () => {
    it('formats a UTC time string', () => {
      const result = formatPassTime('2026-10-03T14:30:45Z');
      expect(result).toBe('14:30:45Z');
    });

    it('zero-pads single digits', () => {
      const result = formatPassTime('2026-01-01T03:05:09Z');
      expect(result).toBe('03:05:09Z');
    });
  });

  describe('formatDuration', () => {
    it('formats seconds as mm:ss', () => {
      expect(formatDuration(305)).toBe('5:05');
    });

    it('handles zero', () => {
      expect(formatDuration(0)).toBe('0:00');
    });

    it('handles exactly one minute', () => {
      expect(formatDuration(60)).toBe('1:00');
    });

    it('handles large durations', () => {
      expect(formatDuration(600)).toBe('10:00');
    });
  });

  describe('isSunBelowHorizon', () => {
    it('returns true for midnight UTC at moderate latitudes', () => {
      // Midnight at Seoul (UTC+9 = ~15:00 UTC), but testing with a time
      // that is clearly night in most places
      const midnight = new Date('2026-06-15T00:00:00Z');
      // At 37.5°N, 0°E (close to Greenwich), midnight UTC in summer
      const result = isSunBelowHorizon(37.5, 0, midnight);
      expect(result).toBe(true);
    });

    it('returns false for noon UTC near the equator', () => {
      const noon = new Date('2026-06-15T12:00:00Z');
      const result = isSunBelowHorizon(0, 0, noon);
      expect(result).toBe(false);
    });

    it('returns a boolean', () => {
      const d = new Date('2026-03-20T06:00:00Z');
      expect(typeof isSunBelowHorizon(37.5, 127.0, d)).toBe('boolean');
    });
  });
});
