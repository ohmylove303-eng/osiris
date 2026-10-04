import { describe, it, expect } from 'vitest';
import {
  createCockpitState,
  updateCockpitState,
  interpolatePosition,
  computeCockpitCamera,
  lerpAngle,
  formatAltitude,
  formatSpeed,
  type TrackedAircraft,
} from './cockpit-camera';

const SAMPLE_AIRCRAFT: TrackedAircraft = {
  icao24: 'abc123',
  callsign: 'KAL123',
  lat: 37.5665,
  lng: 126.9780,
  alt: 10000,
  heading: 90,
  speed: 450,
  type: 'B738',
};

describe('cockpit-camera', () => {
  describe('lerpAngle', () => {
    it('interpolates forward 0→90 at t=0.5', () => {
      expect(lerpAngle(0, 90, 0.5)).toBeCloseTo(45, 1);
    });

    it('takes the short arc from 350 to 10', () => {
      const result = lerpAngle(350, 10, 0.5);
      expect(result).toBeCloseTo(0, 1);
    });

    it('takes the short arc from 10 to 350', () => {
      const result = lerpAngle(10, 350, 0.5);
      expect(result).toBeCloseTo(0, 1);
    });

    it('returns start at t=0', () => {
      expect(lerpAngle(45, 135, 0)).toBeCloseTo(45, 1);
    });

    it('returns end at t=1', () => {
      expect(lerpAngle(45, 135, 1)).toBeCloseTo(135, 1);
    });

    it('handles 180° ambiguity', () => {
      const result = lerpAngle(0, 180, 0.5);
      // Could go either way; just ensure it's a number in 0–360
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(360);
    });
  });

  describe('createCockpitState', () => {
    it('sets target ICAO', () => {
      const state = createCockpitState(SAMPLE_AIRCRAFT);
      expect(state.targetIcao).toBe('abc123');
    });

    it('sets both prev and curr to the initial position', () => {
      const state = createCockpitState(SAMPLE_AIRCRAFT);
      expect(state.prevPos.lat).toBe(SAMPLE_AIRCRAFT.lat);
      expect(state.currPos.lat).toBe(SAMPLE_AIRCRAFT.lat);
    });

    it('sets a recent lastUpdate timestamp', () => {
      const before = Date.now();
      const state = createCockpitState(SAMPLE_AIRCRAFT);
      expect(state.lastUpdate).toBeGreaterThanOrEqual(before);
      expect(state.lastUpdate).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('updateCockpitState', () => {
    it('shifts currPos to prevPos', () => {
      const state = createCockpitState(SAMPLE_AIRCRAFT);
      const updated: TrackedAircraft = { ...SAMPLE_AIRCRAFT, lat: 38.0 };
      const next = updateCockpitState(state, updated);
      expect(next.prevPos.lat).toBe(SAMPLE_AIRCRAFT.lat);
      expect(next.currPos.lat).toBe(38.0);
    });

    it('preserves the target ICAO', () => {
      const state = createCockpitState(SAMPLE_AIRCRAFT);
      const next = updateCockpitState(state, { ...SAMPLE_AIRCRAFT, lat: 38 });
      expect(next.targetIcao).toBe('abc123');
    });
  });

  describe('interpolatePosition', () => {
    it('returns prevPos at t=0 (just after update)', () => {
      const state = createCockpitState(SAMPLE_AIRCRAFT);
      // Override to test: prevPos and currPos differ
      const st = {
        ...state,
        prevPos: { ...SAMPLE_AIRCRAFT, lat: 37.0 },
        currPos: { ...SAMPLE_AIRCRAFT, lat: 38.0 },
      };
      const pos = interpolatePosition(st, st.lastUpdate);
      expect(pos.lat).toBeCloseTo(37.0, 2);
    });

    it('returns currPos at t=1 (full interval elapsed)', () => {
      const state = createCockpitState(SAMPLE_AIRCRAFT);
      const st = {
        ...state,
        prevPos: { ...SAMPLE_AIRCRAFT, lat: 37.0 },
        currPos: { ...SAMPLE_AIRCRAFT, lat: 38.0 },
      };
      const pos = interpolatePosition(st, st.lastUpdate + st.pollInterval);
      expect(pos.lat).toBeCloseTo(38.0, 2);
    });

    it('returns midpoint at t=0.5', () => {
      const state = createCockpitState(SAMPLE_AIRCRAFT);
      const st = {
        ...state,
        prevPos: { ...SAMPLE_AIRCRAFT, lat: 37.0 },
        currPos: { ...SAMPLE_AIRCRAFT, lat: 38.0 },
      };
      const pos = interpolatePosition(st, st.lastUpdate + st.pollInterval / 2);
      expect(pos.lat).toBeCloseTo(37.5, 2);
    });

    it('clamps altitude to minimum', () => {
      const state = createCockpitState(SAMPLE_AIRCRAFT);
      const st = {
        ...state,
        prevPos: { ...SAMPLE_AIRCRAFT, alt: 50 },
        currPos: { ...SAMPLE_AIRCRAFT, alt: 100 },
      };
      const pos = interpolatePosition(st, st.lastUpdate);
      // 50 m is below 150 m minimum
      expect(pos.alt).toBeGreaterThanOrEqual(150);
    });

    it('does not exceed t=1 even if much time has passed', () => {
      const state = createCockpitState(SAMPLE_AIRCRAFT);
      const st = {
        ...state,
        prevPos: { ...SAMPLE_AIRCRAFT, lat: 37.0 },
        currPos: { ...SAMPLE_AIRCRAFT, lat: 38.0 },
      };
      // Way past the poll interval
      const pos = interpolatePosition(st, st.lastUpdate + 60_000);
      expect(pos.lat).toBeCloseTo(38.0, 2);
    });

    it('interpolates heading correctly through north', () => {
      const state = createCockpitState(SAMPLE_AIRCRAFT);
      const st = {
        ...state,
        prevPos: { ...SAMPLE_AIRCRAFT, heading: 350 },
        currPos: { ...SAMPLE_AIRCRAFT, heading: 10 },
      };
      const pos = interpolatePosition(st, st.lastUpdate + st.pollInterval / 2);
      expect(pos.heading).toBeCloseTo(0, 0);
    });
  });

  describe('computeCockpitCamera', () => {
    it('returns the aircraft coordinates as center', () => {
      const cam = computeCockpitCamera(SAMPLE_AIRCRAFT);
      expect(cam.lat).toBe(SAMPLE_AIRCRAFT.lat);
      expect(cam.lng).toBe(SAMPLE_AIRCRAFT.lng);
    });

    it('uses the aircraft heading as bearing', () => {
      const cam = computeCockpitCamera(SAMPLE_AIRCRAFT);
      expect(cam.bearing).toBe(SAMPLE_AIRCRAFT.heading);
    });

    it('returns higher zoom for lower altitude', () => {
      const low = computeCockpitCamera({ ...SAMPLE_AIRCRAFT, alt: 500 });
      const high = computeCockpitCamera({ ...SAMPLE_AIRCRAFT, alt: 10000 });
      expect(low.zoom).toBeGreaterThan(high.zoom);
    });

    it('returns pitch between 30 and 75 degrees', () => {
      const cam = computeCockpitCamera(SAMPLE_AIRCRAFT);
      expect(cam.pitch).toBeGreaterThanOrEqual(30);
      expect(cam.pitch).toBeLessThanOrEqual(75);
    });
  });

  describe('formatAltitude', () => {
    it('formats low altitude in feet', () => {
      expect(formatAltitude(100)).toMatch(/\d+ ft/);
    });

    it('formats high altitude as flight level', () => {
      const result = formatAltitude(10000);
      expect(result).toMatch(/^FL\d{3}$/);
    });

    it('FL330 for ~10058m', () => {
      // 10058m ≈ 33000 ft = FL330
      expect(formatAltitude(10058)).toBe('FL330');
    });
  });

  describe('formatSpeed', () => {
    it('formats as integer with KTS suffix', () => {
      expect(formatSpeed(450.7)).toBe('451 KTS');
    });

    it('handles zero', () => {
      expect(formatSpeed(0)).toBe('0 KTS');
    });
  });
});
