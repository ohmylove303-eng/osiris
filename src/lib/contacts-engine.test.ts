import { describe, it, expect } from 'vitest';
import {
  buildContacts,
  filterByType,
  formatDistance,
  formatBearing,
  type RawFlight,
  type RawShip,
  type RawSatellite,
} from './contacts-engine';
import type { LngLat } from './geo';

/* ── Fixtures ── */

const SEOUL: LngLat = [126.978, 37.566];

const nearbyFlights: RawFlight[] = [
  { icao24: 'a1', callsign: 'KAL001', lat: 37.6, lng: 127.0, alt: 10000, speed: 450 },
  { icao24: 'a2', callsign: 'AAR002', lat: 37.5, lng: 126.9, alt: 5000, speed: 300 },
  { icao24: 'a3', callsign: 'JIN003', lat: 37.7, lng: 127.1, alt: 8000, speed: 400 },
];

const farFlight: RawFlight = {
  icao24: 'far1', callsign: 'FAR001', lat: 40.0, lng: 130.0, alt: 12000, speed: 500,
};

const nearbyShips: RawShip[] = [
  { mmsi: 's1', name: 'BUSAN EXPRESS', lat: 37.55, lng: 126.95, speed: 12 },
];

const nearbySats: RawSatellite[] = [
  { noradId: 'n1', name: 'ISS', lat: 37.58, lng: 127.01, alt: 408000 },
];

/* ── Tests ── */

describe('contacts-engine', () => {
  describe('buildContacts', () => {
    it('finds nearby flights', () => {
      const contacts = buildContacts(SEOUL, nearbyFlights, [], []);
      expect(contacts).toHaveLength(3);
    });

    it('excludes flights outside the radius', () => {
      const contacts = buildContacts(SEOUL, [farFlight], [], []);
      expect(contacts).toHaveLength(0);
    });

    it('sorts by distance (nearest first)', () => {
      const contacts = buildContacts(SEOUL, nearbyFlights, [], []);
      for (let i = 1; i < contacts.length; i++) {
        expect(contacts[i].distanceKm).toBeGreaterThanOrEqual(contacts[i - 1].distanceKm);
      }
    });

    it('includes ships and satellites', () => {
      const contacts = buildContacts(SEOUL, [], nearbyShips, nearbySats);
      expect(contacts.some(c => c.type === 'ship')).toBe(true);
      expect(contacts.some(c => c.type === 'satellite')).toBe(true);
    });

    it('mixes all entity types and sorts globally', () => {
      const contacts = buildContacts(SEOUL, nearbyFlights, nearbyShips, nearbySats);
      expect(contacts.length).toBe(5); // 3 flights + 1 ship + 1 sat
      // Still sorted by distance
      for (let i = 1; i < contacts.length; i++) {
        expect(contacts[i].distanceKm).toBeGreaterThanOrEqual(contacts[i - 1].distanceKm);
      }
    });

    it('respects maxContacts', () => {
      const contacts = buildContacts(SEOUL, nearbyFlights, nearbyShips, nearbySats, { maxContacts: 2 });
      expect(contacts).toHaveLength(2);
    });

    it('respects custom radius', () => {
      // Use a tiny radius — might exclude most contacts
      const contacts = buildContacts(SEOUL, nearbyFlights, [], [], { radiusKm: 1 });
      expect(contacts.length).toBeLessThan(nearbyFlights.length);
    });

    it('sets bearing between 0 and 360', () => {
      const contacts = buildContacts(SEOUL, nearbyFlights, [], []);
      for (const c of contacts) {
        expect(c.bearingDeg).toBeGreaterThanOrEqual(0);
        expect(c.bearingDeg).toBeLessThanOrEqual(360);
      }
    });

    it('uses callsign as label when available', () => {
      const contacts = buildContacts(SEOUL, nearbyFlights, [], []);
      expect(contacts[0].label).not.toBe('');
      expect(contacts.some(c => c.label === 'KAL001')).toBe(true);
    });

    it('falls back to ICAO when callsign is missing', () => {
      const noCallsign: RawFlight = { icao24: 'abc', lat: 37.57, lng: 126.98, alt: 1000 };
      const contacts = buildContacts(SEOUL, [noCallsign], [], []);
      expect(contacts[0].label).toBe('ABC');
    });

    it('handles empty inputs', () => {
      const contacts = buildContacts(SEOUL, [], [], []);
      expect(contacts).toHaveLength(0);
    });
  });

  describe('filterByType', () => {
    it('filters to flights only', () => {
      const all = buildContacts(SEOUL, nearbyFlights, nearbyShips, nearbySats);
      const flights = filterByType(all, 'flight');
      expect(flights.every(c => c.type === 'flight')).toBe(true);
      expect(flights).toHaveLength(3);
    });

    it('filters to ships only', () => {
      const all = buildContacts(SEOUL, nearbyFlights, nearbyShips, nearbySats);
      const ships = filterByType(all, 'ship');
      expect(ships).toHaveLength(1);
    });

    it('returns empty for no matches', () => {
      const contacts = buildContacts(SEOUL, nearbyFlights, [], []);
      const ships = filterByType(contacts, 'ship');
      expect(ships).toHaveLength(0);
    });
  });

  describe('formatDistance', () => {
    it('formats sub-km as metres', () => {
      expect(formatDistance(0.5)).toBe('500 m');
    });

    it('formats small km with one decimal', () => {
      expect(formatDistance(5.3)).toBe('5.3 km');
    });

    it('formats large km as integer', () => {
      expect(formatDistance(142.7)).toBe('143 km');
    });
  });

  describe('formatBearing', () => {
    it('zero-pads to 3 digits', () => {
      expect(formatBearing(5)).toBe('005°');
    });

    it('formats 360 as 360°', () => {
      expect(formatBearing(360)).toBe('360°');
    });

    it('rounds fractional degrees', () => {
      expect(formatBearing(45.7)).toBe('046°');
    });
  });

  describe('performance', () => {
    it('handles 5000 flights in under 50ms', () => {
      const manyFlights: RawFlight[] = [];
      for (let i = 0; i < 5000; i++) {
        manyFlights.push({
          icao24: `f${i}`,
          lat: 37.5 + (Math.random() - 0.5) * 4,
          lng: 127.0 + (Math.random() - 0.5) * 4,
          alt: Math.random() * 12000,
          speed: Math.random() * 500,
        });
      }
      const start = performance.now();
      buildContacts(SEOUL, manyFlights, [], []);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });
});
