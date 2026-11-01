import { describe, it, expect } from 'vitest';
import { getKoreanTransitVehicles, interpolateRoutePosition, KOREAN_ROUTES } from './korean-transit';

describe('Korean Transit Simulation & Directional Engine', () => {
  it('generates vehicles for all four transit modes: bus, taxi, rail, metro', () => {
    const vehicles = getKoreanTransitVehicles(Date.now());
    expect(vehicles.length).toBeGreaterThan(50);

    const modes = new Set(vehicles.map(v => v.mode));
    expect(modes.has('bus')).toBe(true);
    expect(modes.has('taxi')).toBe(true);
    expect(modes.has('rail')).toBe(true);
    expect(modes.has('metro')).toBe(true);
  });

  it('assigns clear upbound and downbound directions and labels', () => {
    const vehicles = getKoreanTransitVehicles(Date.now());

    for (const v of vehicles) {
      expect(v.dir).toBeDefined();
      expect(['up', 'down', 'inner', 'outer']).toContain(v.dir);
      expect(v.dirLabel).toBeDefined();
      expect(typeof v.dirLabel).toBe('string');
      expect(v.dirLabel!.length).toBeGreaterThan(3);

      if (v.dir === 'up') {
        expect(v.dirLabel).toContain('[상행 ▲]');
      } else if (v.dir === 'down') {
        expect(v.dirLabel).toContain('[하행 ▼]');
      } else if (v.dir === 'inner') {
        expect(v.dirLabel).toMatch(/\[내선순환 ↻\]|\[순환 ↻\]/);
      }
    }
  });

  it('grounds all taxi routes strictly on actual roads and streets', () => {
    const vehicles = getKoreanTransitVehicles(Date.now());
    const taxis = vehicles.filter(v => v.mode === 'taxi');
    expect(taxis.length).toBeGreaterThanOrEqual(10);

    for (const taxi of taxis) {
      expect(taxi.label).toContain('[택시]');
      expect(taxi.lat).toBeGreaterThan(37.48);
      expect(taxi.lat).toBeLessThan(37.58);
      expect(taxi.lng).toBeGreaterThan(126.90);
      expect(taxi.lng).toBeLessThan(127.08);
      expect(taxi.b).toBeGreaterThanOrEqual(0);
      expect(taxi.b).toBeLessThanOrEqual(360);
    }
  });

  it('interpolates positions along waypoints with correct ping-pong forward direction', () => {
    const waypoints: [number, number][] = [
      [127.0280, 37.4980],
      [127.0630, 37.5088],
    ];
    // Start of trip: forward = true (상행)
    const pos1 = interpolateRoutePosition(waypoints, 50, 0, 1000, false);
    expect(pos1.forward).toBe(true);
    expect(pos1.lng).toBeGreaterThanOrEqual(127.0280);
    expect(pos1.lng).toBeLessThanOrEqual(127.0630);

    // Later: ping-pong return trip: forward = false (하행)
    const totalDistMeters = 3300;
    const speedMps = (50 * 1000) / 3600;
    const oneWaySec = totalDistMeters / speedMps;
    const returnTimeMs = (oneWaySec * 1.5) * 1000;
    const pos2 = interpolateRoutePosition(waypoints, 50, 0, returnTimeMs, false);
    expect(pos2.forward).toBe(false);
  });
});

