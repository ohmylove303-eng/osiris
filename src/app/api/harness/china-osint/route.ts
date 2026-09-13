/**
 * /api/harness/china-osint
 *
 * Harness Technique — China Maritime Encroachment OSINT Pipeline
 *
 * GET  → Return all sites with Socratic 5-Gate verification reports + RAG dedup status
 * POST → Re-run verification for a specific site_id (recursive refresh)
 */

import { NextRequest, NextResponse } from 'next/server';
import { CHINA_ENCROACHMENT_SITES, ChinaEncroachmentSite } from '@/lib/china-encroachment';
import { runFullSocraticAudit, SocraticVerificationRequest } from '@/lib/socratic-reasoning-engine';

// ─── Helper: build Socratic request from a ChinaEncroachmentSite ───

function siteToSocraticRequest(site: ChinaEncroachmentSite): SocraticVerificationRequest {
  // Parse area from dimensions string e.g. "매립 면적 2.8㎢"
  const areaMatch = site.specifications.dimensions.match(/([\d.]+)\s*(?:㎢|km2|km²)/);
  const area = areaMatch ? parseFloat(areaMatch[1]) : 0;

  return {
    id: site.id,
    name: site.name,
    domain: 'site',
    country: 'CN',
    site_area_sqkm: area,
    site_runway_m: site.runway_length_m ?? 0,
    site_visible_objects: site.visible_objects.map(o => o.object_type),
    site_construction_year: parseInt(
      site.specifications.construction_year.match(/\d{4}/)?.[0] ?? '2010'
    ),
    site_thesis: site.analysis_dialectic.thesis_china,
    site_antithesis: site.analysis_dialectic.antithesis_western,
    coords: [site.lat, site.lng],
  };
}

// ─── RAG dedup: simple text-similarity check (no external embeddings needed) ───

function computeJaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const setA = tokenize(a);
  const setB = tokenize(b);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function dedupSites(sites: ChinaEncroachmentSite[]): {
  unique: ChinaEncroachmentSite[];
  duplicates: { id: string; similarTo: string; score: number }[];
} {
  const unique: ChinaEncroachmentSite[] = [];
  const duplicates: { id: string; similarTo: string; score: number }[] = [];

  for (const site of sites) {
    const ragText = site.rag_text ?? '';
    let isDuplicate = false;
    for (const existing of unique) {
      const similarity = computeJaccardSimilarity(ragText, existing.rag_text ?? '');
      if (similarity > 0.72 && site.id !== existing.id) {
        duplicates.push({ id: site.id, similarTo: existing.id, score: Math.round(similarity * 100) });
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) unique.push(site);
  }

  return { unique, duplicates };
}

// ─── GET ───────────────────────────────────────────────────────────

export async function GET() {
  try {
    // 1. RAG dedup
    const { unique, duplicates } = dedupSites(CHINA_ENCROACHMENT_SITES);

    // 2. Socratic 5-Gate verification for each unique site (rules-only, fast)
    const socraticReports: Record<string, Awaited<ReturnType<typeof runFullSocraticAudit>>> = {};
    for (const site of unique) {
      const req = siteToSocraticRequest(site);
      // We deliberately use the fast path (rules_only) — no Ollama for GET
      const report = await runFullSocraticAudit(req);
      socraticReports[site.id] = report;
    }

    // 3. Build summary
    const summary = {
      total_sites: CHINA_ENCROACHMENT_SITES.length,
      unique_sites: unique.length,
      rag_dedup_count: duplicates.length,
      duplicates,
      critical_count: unique.filter(s => s.threat_level === 'CRITICAL').length,
      high_count: unique.filter(s => s.threat_level === 'HIGH').length,
      moderate_count: unique.filter(s => s.threat_level === 'MODERATE').length,
    };

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      summary,
      sites: unique.map(site => ({
        ...site,
        socratic_report: socraticReports[site.id],
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: 'error', message: msg, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// ─── POST — recursive single-site re-verification ─────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { site_id, force_recheck = false } = body as { site_id?: string; force_recheck?: boolean };

    const site = CHINA_ENCROACHMENT_SITES.find(s => s.id === site_id);
    if (!site) {
      return NextResponse.json(
        { status: 'error', message: `Site '${site_id}' not found.` },
        { status: 404 }
      );
    }

    const socraticReq = siteToSocraticRequest(site);

    // Full audit including local Ollama attempt
    const report = await runFullSocraticAudit(socraticReq);

    // RAG dedup check for this specific site against all others
    const others = CHINA_ENCROACHMENT_SITES.filter(s => s.id !== site.id);
    const ragSimilarities = others.map(other => ({
      id: other.id,
      name: other.name,
      similarity: Math.round(
        computeJaccardSimilarity(site.rag_text ?? '', other.rag_text ?? '') * 100
      ),
    })).filter(r => r.similarity > 40).sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      site_id: site.id,
      force_recheck,
      site,
      socratic_report: report,
      rag_similarity_check: ragSimilarities,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: 'error', message: msg, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
