import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('/api/cctv/track', () => {
  it('returns valid tracking payload with status ok and engines specification', async () => {
    const req = new Request('http://localhost/api/cctv/track?camId=CAM-SEOUL-TEST');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.camId).toBe('CAM-SEOUL-TEST');
    expect(json.engines).toBeDefined();
    expect(json.engines.rank1_detection.name).toContain('YOLO26');
    expect(json.engines.rank2_tracking.name).toContain('ByteTrackTracker');
    expect(json.engines.rank3_lockon.name).toContain('SAM 2.1');
    expect(json.engines.rank4_alpr.name).toContain('EasyKoreanLpDetector');
    expect(Array.isArray(json.entities)).toBe(true);
    expect(json.entities.length).toBeGreaterThan(0);
  });

  it('filters entities by vehicle or person', async () => {
    const vehicleReq = new Request('http://localhost/api/cctv/track?camId=CAM-TEST&filter=vehicle');
    const vehicleRes = await GET(vehicleReq);
    const vehicleJson = await vehicleRes.json();
    expect(vehicleJson.filter).toBe('vehicle');
    expect(vehicleJson.entities.every((e: any) => e.type === 'vehicle')).toBe(true);

    const personReq = new Request('http://localhost/api/cctv/track?camId=CAM-TEST&filter=person');
    const personRes = await GET(personReq);
    const personJson = await personRes.json();
    expect(personJson.filter).toBe('person');
    expect(personJson.entities.every((e: any) => e.type === 'person')).toBe(true);
  });

  it('locks onto target when targetId is provided', async () => {
    const req = new Request('http://localhost/api/cctv/track?camId=CAM-TEST&targetId=TRK-V-102');
    const res = await GET(req);
    const json = await res.json();
    expect(json.lockedTarget).toBeDefined();
    expect(json.lockedTarget.id).toBe('TRK-V-102');
  });
});
