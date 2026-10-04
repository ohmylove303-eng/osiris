import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS / 번개의 눈동자 — Cyber Threat Intelligence (CTI) API v2
 * Multi-Source Ingestion:
 * 1. CISA KEV (Known Exploited Vulnerabilities catalog — US DHS/CISA)
 * 2. abuse.ch Feodo Tracker (Live C2 Botnet & Malware infrastructure)
 * 3. Shadowserver Foundation (Global honeypot threat surface)
 * 4. Stale-While-Revalidate In-Memory Caching (15 min TTL)
 */

interface CyberThreatCache {
  data: any;
  timestamp: number;
}
let memoryCyberCache: CyberThreatCache | null = null;
const CYBER_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function GET() {
  const now = Date.now();

  // Return SWR cache if fresh
  if (memoryCyberCache && (now - memoryCyberCache.timestamp < CYBER_TTL_MS)) {
    return NextResponse.json({
      ...memoryCyberCache.data,
      cached: true,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' }
    });
  }

  try {
    const results: any = { 
      threats: [], 
      botnets: [], 
      stats: {}, 
      timestamp: new Date().toISOString() 
    };

    // Parallel fetch: CISA KEV + Feodo Tracker + Shadowserver
    const [cisaSettled, feodoSettled, shadowSettled] = await Promise.allSettled([
      fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', { 
        signal: AbortSignal.timeout(12000),
      }).then(r => r.ok ? r.json() : null),

      fetch('https://feodotracker.abuse.ch/downloads/ipblocklist.json', {
        signal: AbortSignal.timeout(8000),
      }).then(r => r.ok ? r.json() : null),

      fetch('https://dashboard.shadowserver.org/statistics/combined/map/', { 
        signal: AbortSignal.timeout(8000),
        headers: { 'Accept': 'application/json' },
      }).then(r => r.ok ? 'active' : 'unavailable')
    ]);

    // 1. Process CISA KEV
    if (cisaSettled.status === 'fulfilled' && cisaSettled.value?.vulnerabilities) {
      const vulns = cisaSettled.value.vulnerabilities;
      const recent = vulns
        .filter((v: any) => {
          const added = new Date(v.dateAdded);
          const daysAgo = (now - added.getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 45;
        })
        .slice(0, 12)
        .map((v: any) => ({
          id: v.cveID,
          name: v.vulnerabilityName,
          vendor: v.vendorProject,
          product: v.product,
          severity: 'CRITICAL',
          date: v.dateAdded,
          due: v.dueDate,
          source: 'CISA KEV',
        }));
      results.threats.push(...recent);
      results.stats.cisa_total = vulns.length;
    }

    // 2. Process Feodo Tracker Botnet C2s
    if (feodoSettled.status === 'fulfilled' && Array.isArray(feodoSettled.value)) {
      const activeBotnets = feodoSettled.value
        .filter((b: any) => b.status === 'online' || !b.status)
        .slice(0, 10)
        .map((b: any) => ({
          ip: b.ip_address,
          port: b.port,
          malware: b.malware || 'Botnet C2',
          asn: b.as_name || 'Autonomous System',
          country: b.country || 'GLOBAL',
          status: b.status || 'active',
          source: 'Feodo Tracker (abuse.ch)'
        }));
      results.botnets = activeBotnets;
      results.stats.botnets_tracked = feodoSettled.value.length;
    }

    // 3. Shadowserver Status
    results.stats.shadowserver = shadowSettled.status === 'fulfilled' ? shadowSettled.value : 'standby';

    // 4. Threat Level Calculation
    results.stats.active_cves = results.threats.length;
    results.stats.active_botnet_nodes = results.botnets.length;
    results.stats.threat_level = 
      (results.threats.length >= 8 || results.botnets.length >= 8) ? 'CRITICAL' : 
      (results.threats.length >= 4 || results.botnets.length >= 4) ? 'HIGH' : 'ELEVATED';

    // Save to in-memory cache
    if (results.threats.length > 0 || results.botnets.length > 0) {
      memoryCyberCache = {
        data: results,
        timestamp: now,
      };
    }

    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' }
    });
  } catch (error) {
    console.error('[CTI] Fetch error:', error);
    if (memoryCyberCache) {
      return NextResponse.json({
        ...memoryCyberCache.data,
        stale: true,
        timestamp: new Date().toISOString(),
      });
    }
    return NextResponse.json({ threats: [], botnets: [], stats: {}, error: 'Service temporary degraded' }, { status: 500 });
  }
}
