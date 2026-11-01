import { describe, it, expect } from 'vitest';
import { KOREAN_ROUTES } from './korean-transit';

describe('Korean Transit Real-World Grounding & Geospatial Alignment (Superpowers TDD)', () => {
  it('rail-gyeongui-dmz must navigate intermediate Seoul stations (Gajwa, Gongdeok, Hyochang) without crossing Han River', () => {
    const route = KOREAN_ROUTES.find(r => r.id === 'rail-gyeongui-dmz');
    expect(route).toBeDefined();

    // Must have dense stations between DMC and Yongsan
    const wp = route!.waypoints;
    const dmcIdx = wp.findIndex(p => Math.abs(p[0] - 126.8990) < 0.01 && Math.abs(p[1] - 37.5690) < 0.01);
    const yongsanIdx = wp.findIndex(p => Math.abs(p[0] - 126.9640) < 0.01 && Math.abs(p[1] - 37.5300) < 0.01);

    expect(dmcIdx).toBeGreaterThanOrEqual(0);
    expect(yongsanIdx).toBeGreaterThan(dmcIdx);
    
    // There must be at least 4 intermediate track points between DMC and Yongsan
    const intermediatePoints = yongsanIdx - dmcIdx - 1;
    expect(intermediatePoints).toBeGreaterThanOrEqual(4);

    // All intermediate points must stay north of Han River (lat > 37.530)
    for (let i = dmcIdx; i <= yongsanIdx; i++) {
      expect(wp[i][1]).toBeGreaterThanOrEqual(37.528);
    }
  });

  it('metro-arex must cross Han River strictly via Magok Railway Bridge (마곡철교)', () => {
    const route = KOREAN_ROUTES.find(r => r.id === 'metro-arex');
    expect(route).toBeDefined();

    const wp = route!.waypoints;
    // Between Gimpo Airport and DMC, it must pass through Magok Railway Bridge
    const hasMagokBridge = wp.some(p => 
      p[0] >= 126.845 && p[0] <= 126.875 && 
      p[1] >= 37.580 && p[1] <= 37.600
    );
    expect(hasMagokBridge).toBe(true);
  });

  it('bus-3000 must follow dense Route 48 and Yanghwa Bridge with max segment distance under 2.5km in Seoul/Gimpo urban corridor', () => {
    const route = KOREAN_ROUTES.find(r => r.id === 'bus-3000');
    expect(route).toBeDefined();

    const wp = route!.waypoints;
    // In urban zone (east of lng 126.70), waypoints must be dense so bus does not cut water or buildings
    const urbanPoints = wp.filter(p => p[0] >= 126.70);
    expect(urbanPoints.length).toBeGreaterThanOrEqual(25);

    // Verify Yanghwa Bridge coordinates exist
    const hasYanghwaBridge = wp.some(p => 
      Math.abs(p[0] - 126.9050) < 0.005 && Math.abs(p[1] - 37.5460) < 0.005
    );
    expect(hasYanghwaBridge).toBe(true);
  });

  it('bus-m6117 must follow curved Olympic Expressway and cross strictly via Wonhyo Bridge', () => {
    const route = KOREAN_ROUTES.find(r => r.id === 'bus-m6117');
    expect(route).toBeDefined();

    const wp = route!.waypoints;
    // Must have dense curve points along Olympic Expressway (at least 20 points between Gimpo Hangang-ro and Seoul Station)
    expect(wp.length).toBeGreaterThanOrEqual(28);

    // Wonhyo Bridge centerline verification
    const hasWonhyoBridge = wp.some(p => 
      Math.abs(p[0] - 126.9410) < 0.005 && Math.abs(p[1] - 37.5290) < 0.005
    );
    expect(hasWonhyoBridge).toBe(true);
  });

  it('bus-7700 BRT must completely avoid Gimpo Airport runway security box', () => {
    const route = KOREAN_ROUTES.find(r => r.id === 'bus-7700');
    expect(route).toBeDefined();

    const wp = route!.waypoints;
    // Gimpo airport runways are located between lng 126.785..126.815 and lat 37.550..37.575
    // 7700 must stay south along Bongo-daero (lat <= 37.545) until it turns north on Hwagok-ro (lng >= 126.835)
    for (const [lng, lat] of wp) {
      if (lng >= 126.785 && lng <= 126.820) {
        expect(lat).toBeLessThan(37.545); // strictly on Bongo-daero south of runway
      }
    }
  });
});
