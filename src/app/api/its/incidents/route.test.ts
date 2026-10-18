import { describe, it, expect } from 'vitest';
import { GET, VERIFIED_ITS_INCIDENTS } from './route';

describe('ITS Incidents API', () => {
  it('returns all verified ITS road incidents with 200 OK', async () => {
    const req = new Request('http://localhost:3000/api/its/incidents');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.total).toBe(VERIFIED_ITS_INCIDENTS.length);
    expect(json.incidents).toHaveLength(VERIFIED_ITS_INCIDENTS.length);
  });

  it('filters incidents by type (e.g. accident)', async () => {
    const req = new Request('http://localhost:3000/api/its/incidents?type=accident');
    const res = await GET(req);
    const json = await res.json();

    expect(json.incidents.every((i: any) => i.type === 'accident')).toBe(true);
    expect(json.total).toBeGreaterThan(0);
  });

  it('filters incidents by road name (e.g. 경부고속도로)', async () => {
    const req = new Request('http://localhost:3000/api/its/incidents?road=경부');
    const res = await GET(req);
    const json = await res.json();

    expect(json.incidents.every((i: any) => i.roadName.includes('경부'))).toBe(true);
    expect(json.total).toBeGreaterThan(0);
  });
});
