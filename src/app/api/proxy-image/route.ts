/**
 * /api/proxy-image
 *
 * Server-side image proxy — fetches external satellite/recon images
 * and serves them to the client, bypassing CORS restrictions.
 *
 * Usage: /api/proxy-image?url=https://upload.wikimedia.org/...
 *
 * Security: only whitelisted domains are proxied.
 */

import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_DOMAINS = [
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'amti.csis.org',
  'beyondparallel.csis.org',
  'www.inss.org.il',
  'www.defense.gov',
  'media.defense.gov',
  'www.rand.org',
  'nid.nps.go.kr',
  'www.mod.go.jp',
  'i.imgur.com',
  'live.staticflickr.com',
  'images.globaltimes.cn',
  'cdnjs.cloudflare.com',
];

const CACHE_SECS = 3600; // 1 hour

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('Missing ?url= parameter', { status: 400 });
  }

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  // Domain whitelist check
  const isAllowed = ALLOWED_DOMAINS.some(d =>
    parsed.hostname === d || parsed.hostname.endsWith('.' + d)
  );
  if (!isAllowed) {
    return new NextResponse(`Domain not allowed: ${parsed.hostname}`, { status: 403 });
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OSIRIS-Intelligence/1.0; +https://osiris.lightning)',
        'Accept': 'image/webp,image/jpeg,image/png,image/*,*/*',
        'Referer': 'https://commons.wikimedia.org/',
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      return new NextResponse(`Upstream error: ${upstream.status} ${upstream.statusText}`, {
        status: upstream.status,
      });
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_SECS}, stale-while-revalidate=86400`,
        'Access-Control-Allow-Origin': '*',
        'X-Proxy-Source': parsed.hostname,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Proxy fetch failed: ${msg}`, { status: 502 });
  }
}
