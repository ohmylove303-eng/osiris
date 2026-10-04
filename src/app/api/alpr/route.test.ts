import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('/api/alpr', () => {
  it('returns GeoJSON FeatureCollection of ALPR checkpoints', async () => {
    const req = new Request('http://localhost/api/alpr');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const geojson = await res.json();
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features.length).toBeGreaterThanOrEqual(4);

    const first = geojson.features[0];
    expect(first.geometry.type).toBe('Point');
    expect(first.properties.name).toBeDefined();
    expect(first.properties.type).toBeDefined();
  });

  it('filters by bounding box when provided', async () => {
    const req = new Request('http://localhost/api/alpr?minLat=37.0&maxLat=38.0&minLng=126.0&maxLng=128.0');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const geojson = await res.json();
    for (const f of geojson.features) {
      const [lng, lat] = f.geometry.coordinates;
      expect(lat).toBeGreaterThanOrEqual(37.0);
      expect(lat).toBeLessThanOrEqual(38.0);
      expect(lng).toBeGreaterThanOrEqual(126.0);
      expect(lng).toBeLessThanOrEqual(128.0);
    }
  });
});
