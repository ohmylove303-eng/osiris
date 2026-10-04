import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('/api/radio', () => {
  it('returns GeoJSON FeatureCollection of strategic radio stations', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const geojson = await res.json();
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features.length).toBeGreaterThanOrEqual(5);

    const first = geojson.features[0];
    expect(first.geometry.type).toBe('Point');
    expect(first.geometry.coordinates.length).toBe(2);
    expect(first.properties.name).toBeDefined();
    expect(first.properties.streamUrl).toBeDefined();
  });
});
