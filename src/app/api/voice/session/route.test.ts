import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';

describe('/api/voice/session', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns local_speech fallback when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const req = new Request('http://localhost/api/voice/session', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.fallback).toBe('local_speech');
    expect(data.tools).toBeDefined();
    expect(data.tools.length).toBe(10);
  });

  it('returns client_secret when OpenAI API call succeeds', async () => {
    process.env.OPENAI_API_KEY = 'sk-mock-key';

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        client_secret: { value: 'ek_mock_secret', expires_at: 123456789 },
      }),
    } as any);

    const req = new Request('http://localhost/api/voice/session', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.client_secret.value).toBe('ek_mock_secret');
  });

  it('falls back gracefully when OpenAI returns error', async () => {
    process.env.OPENAI_API_KEY = 'sk-mock-key';

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as any);

    const req = new Request('http://localhost/api/voice/session', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.fallback).toBe('local_speech');
  });
});
