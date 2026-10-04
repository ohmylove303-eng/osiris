import { describe, it, expect } from 'vitest';

describe('SharePanel URL serialization', () => {
  it('correctly serializes lat, lon, zoom, layers, sensor, hud, and cockpit', () => {
    const params = new URLSearchParams();
    const lat = 37.5665;
    const lng = 126.978;
    const zoom = 12.5;
    params.set('lat', lat.toFixed(4));
    params.set('lon', lng.toFixed(4));
    params.set('zoom', zoom.toFixed(2));

    const activeLayers: Record<string, boolean> = {
      flights: true,
      military: true,
      satellites: false,
    };
    const layerKeys = Object.entries(activeLayers)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(',');
    params.set('layers', layerKeys);

    const sensorMode: string = 'NVG';
    const hudVisible = true;
    const cockpitTarget = 'kal123';

    if (sensorMode && sensorMode !== 'NORMAL') params.set('sensor', sensorMode);
    if (hudVisible) params.set('hud', '1');
    if (cockpitTarget) params.set('cockpit', cockpitTarget);

    const query = params.toString();
    expect(query).toContain('lat=37.5665');
    expect(query).toContain('lon=126.9780');
    expect(query).toContain('zoom=12.50');
    expect(query).toContain('layers=flights%2Cmilitary');
    expect(query).toContain('sensor=NVG');
    expect(query).toContain('hud=1');
    expect(query).toContain('cockpit=kal123');
  });
});
