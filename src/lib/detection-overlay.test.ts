import { describe, it, expect } from 'vitest';
import {
  formatTargetAlt,
  formatTargetSpeed,
  getTargetClassification,
  filterAndProjectTargets,
  type DetectionTarget,
} from './detection-overlay';

describe('detection-overlay', () => {
  describe('formatTargetAlt', () => {
    it('formats meters to FL above 18,000 ft', () => {
      // 10,000m * 3.28084 = 32,808ft -> FL328
      expect(formatTargetAlt(10000)).toBe('FL328');
    });

    it('formats lower altitude as feet with FT suffix', () => {
      // 1,000m * 3.28084 = 3,281ft
      expect(formatTargetAlt(1000)).toBe('3,281FT');
    });

    it('handles undefined or NaN altitude gracefully', () => {
      expect(formatTargetAlt(undefined)).toBe('—');
      expect(formatTargetAlt(NaN)).toBe('—');
    });
  });

  describe('formatTargetSpeed', () => {
    it('formats knots with KT suffix', () => {
      expect(formatTargetSpeed(450.4)).toBe('450KT');
    });

    it('handles undefined and negative speeds', () => {
      expect(formatTargetSpeed(undefined)).toBe('—');
      expect(formatTargetSpeed(-5)).toBe('—');
    });
  });

  describe('getTargetClassification', () => {
    it('classifies military target with high priority red in NORMAL mode', () => {
      const tgt: DetectionTarget = {
        id: 'tgt1',
        label: 'SU-57',
        type: 'flight',
        lat: 38,
        lng: 127,
        military: true,
      };
      const res = getTargetClassification(tgt, 'NORMAL');
      expect(res.code).toBe('MIL');
      expect(res.isHostileOrMil).toBe(true);
      expect(res.color).toBe('#ff3b30');
    });

    it('adapts colors in NVG sensor mode', () => {
      const tgt: DetectionTarget = {
        id: 'tgt2',
        label: 'B738',
        type: 'flight',
        lat: 37,
        lng: 126,
      };
      const res = getTargetClassification(tgt, 'NVG');
      expect(res.code).toBe('FLI');
      expect(res.color).toBe('#00ff66');
    });

    it('adapts colors in FLIR sensor mode', () => {
      const tgt: DetectionTarget = {
        id: 'tgt3',
        label: 'CARRIER',
        type: 'ship',
        lat: 35,
        lng: 129,
        military: true,
      };
      const res = getTargetClassification(tgt, 'FLIR_IRONBOW');
      expect(res.code).toBe('TGT');
      expect(res.color).toBe('#ff3b30');
    });
  });

  describe('filterAndProjectTargets', () => {
    const mockViewport = { width: 1000, height: 800 };
    const mockTargets: DetectionTarget[] = [
      { id: 'center', label: 'TGT-C', type: 'flight', lat: 37.5, lng: 127.0 },
      { id: 'near-edge', label: 'TGT-E', type: 'flight', lat: 37.8, lng: 127.5 },
      { id: 'outside', label: 'TGT-O', type: 'flight', lat: 45.0, lng: 140.0 },
    ];

    it('projects inside viewport and filters outside targets', () => {
      const projectFn = (lngLat: [number, number]) => {
        if (lngLat[0] === 127.0 && lngLat[1] === 37.5) return { x: 500, y: 400 }; // exact center
        if (lngLat[0] === 127.5 && lngLat[1] === 37.8) return { x: 950, y: 750 }; // near edge
        return { x: 2500, y: 3000 }; // far outside
      };

      const result = filterAndProjectTargets(mockTargets, projectFn, mockViewport, 10);
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('center'); // Closer to center should be first
      expect(result[1].id).toBe('near-edge');
      expect(result[0].x).toBe(500);
      expect(result[0].y).toBe(400);
    });

    it('respects maxTargets limit', () => {
      const targets: DetectionTarget[] = Array.from({ length: 30 }, (_, i) => ({
        id: `tgt-${i}`,
        label: `TGT-${i}`,
        type: 'flight',
        lat: 37 + i * 0.01,
        lng: 127 + i * 0.01,
      }));

      const projectFn = () => ({ x: 500, y: 400 });
      const result = filterAndProjectTargets(targets, projectFn, mockViewport, 10);
      expect(result.length).toBe(10);
    });

    it('returns empty array when viewport is 0', () => {
      const result = filterAndProjectTargets(mockTargets, () => ({ x: 100, y: 100 }), { width: 0, height: 0 });
      expect(result).toEqual([]);
    });
  });
});
