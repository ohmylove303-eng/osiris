import { describe, it, expect } from 'vitest';
import { GET, POST } from './route';

describe('/api/cctv/track', () => {
  it('returns honest tracking payload with zero fake data on unstreamed camera', async () => {
    const req = new Request('http://localhost/api/cctv/track?camId=CAM-SEOUL-TEST');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.camId).toBe('CAM-SEOUL-TEST');
    expect(json.engines).toBeDefined();
    expect(json.engines.rank1_detection.name).toContain('YOLO');
    expect(json.engines.rank2_tracking.name).toContain('ByteTrackTracker');
    expect(Array.isArray(json.entities)).toBe(true);
    // Zero-fake-data policy: unstreamed camera must NOT fabricate boxes on empty pavement
    expect(json.entities.length).toBe(0);
    expect(json.counts.total).toBe(0);
  });

  it('handles POST requests with frame data or graceful standby', async () => {
    const req = new Request('http://localhost/api/cctv/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        camId: 'CAM-TEST-POST',
        filter: 'vehicle',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.camId).toBeDefined();
    expect(json.engines).toBeDefined();
    expect(Array.isArray(json.entities)).toBe(true);
  });
});
